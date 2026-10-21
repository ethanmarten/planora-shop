import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { toPrintableAscii } from "./personalize";
import { storagePut } from "./storage";
import * as store from "./store";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  catalog: router({
    list: publicProcedure.query(() => store.listPublicProducts()),
    bySlug: publicProcedure.input(z.object({ slug: z.string().min(1).max(96) })).query(async ({ input }) => {
      const p = await store.getPublicProductBySlug(input.slug);
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Planner not found" });
      return p;
    }),
  }),

  orders: router({
    /** Guest checkout step 1: remember who the planner is for. Payment starts after this. */
    create: publicProcedure.input(z.object({
      productId: z.number().int().positive(),
      name: z.string().trim().min(1).max(60),
      email: z.string().trim().email().max(320),
      motto: z.string().trim().max(60).optional(),
      acceptLicense: z.literal(true),
    })).mutation(async ({ input }) => {
      const product = await store.getProductById(input.productId);
      if (!product || !product.active) throw new TRPCError({ code: "NOT_FOUND", message: "Planner not found" });
      const name = toPrintableAscii(input.name);
      if (!name) throw new TRPCError({ code: "BAD_REQUEST", message: "Please write the name using English (Latin) letters." });
      const motto = input.motto ? toPrintableAscii(input.motto) : "";
      const o = await store.createOrder({ product, name, email: input.email.toLowerCase(), motto });
      return { accessToken: o.accessToken };
    }),
    /** The buyer's order page. The secret token is the only credential. */
    get: publicProcedure.input(z.object({ token: z.string().min(10).max(64) })).query(async ({ input }) => {
      const o = await store.getOrderByToken(input.token);
      if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      const product = await store.getProductById(o.productId);
      return {
        status: o.status, buyerName: o.buyerName, buyerMotto: o.buyerMotto, amountCents: o.amountCents, currency: o.currency,
        downloadsLeft: Math.max(0, o.downloadsMax - o.downloadsUsed), downloadsMax: o.downloadsMax, expiresAt: o.expiresAt,
        product: product ? { title: product.title, slug: product.slug, year: product.year, previewImageUrl: product.previewImageUrl } : null,
      };
    }),
  }),

  admin: router({
    products: adminProcedure.query(async () => (await store.listAllProducts()).map(({ baseFileKey, ...rest }) => ({ ...rest, hasFile: !!baseFileKey }))),
    /** Upload the master PDF (kept private) or the public cover preview image. */
    upload: adminProcedure.input(z.object({
      kind: z.enum(["master", "preview"]),
      fileName: z.string().min(1).max(120),
      base64: z.string().min(10),
    })).mutation(async ({ input }) => {
      const bytes = Buffer.from(input.base64, "base64");
      const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (input.kind === "master") {
        if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new TRPCError({ code: "BAD_REQUEST", message: "That file is not a PDF" });
        const r = await storagePut(`planners/master/${safe}`, bytes, "application/pdf");
        return { key: r.key, url: null as string | null };
      }
      const type = /\.png$/i.test(safe) ? "image/png" : /\.webp$/i.test(safe) ? "image/webp" : "image/jpeg";
      const r = await storagePut(`planners/preview/${safe}`, bytes, type);
      return { key: r.key, url: r.url as string | null };
    }),
    createProduct: adminProcedure.input(z.object({
      slug: z.string().regex(/^[a-z0-9-]{2,96}$/), title: z.string().min(2).max(160), description: z.string().min(1).max(4000),
      year: z.number().int().min(2020).max(2100), priceCents: z.number().int().min(0).max(100000), currency: z.string().length(3).default("USD"),
      pageCount: z.number().int().positive().optional(), baseFileKey: z.string().min(1), previewImageUrl: z.string().optional(),
      coverNameXPct: z.number().int().min(0).max(100).default(50), coverNameYPct: z.number().int().min(0).max(100).default(82),
      coverNameSizePermille: z.number().int().min(10).max(120).default(45), stampColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1B2A2B"), mottoAbove: z.boolean().default(false),
    })).mutation(async ({ input }) => ({ id: await store.createProduct(input) })),
    setProductActive: adminProcedure.input(z.object({ id: z.number().int(), active: z.boolean() })).mutation(async ({ input }) => {
      await store.updateProduct(input.id, { active: input.active });
      return { ok: true };
    }),
    orders: adminProcedure.query(async () => (await store.listOrders()).map(({ accessToken, ...rest }) => ({ ...rest, accessToken }))),
    /** Manual confirmation (e.g. a bank transfer or a test purchase). Real payments arrive via the webhook. */
    markPaid: adminProcedure.input(z.object({ orderId: z.number().int(), note: z.string().max(100).default("manual") })).mutation(async ({ input }) => ({ changed: await store.markOrderPaid(input.orderId, input.note) })),
    refund: adminProcedure.input(z.object({ orderId: z.number().int() })).mutation(async ({ input }) => { await store.markOrderRefunded(input.orderId); return { ok: true }; }),
    grantDownloads: adminProcedure.input(z.object({ orderId: z.number().int(), extra: z.number().int().min(1).max(10) })).mutation(async ({ input }) => { await store.grantExtraDownloads(input.orderId, input.extra); return { ok: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
