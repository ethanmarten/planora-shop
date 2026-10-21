import { createHmac, timingSafeEqual } from "node:crypto";
import express, { type Express } from "express";
import { personalizePdf, orderRef } from "./personalize";
import { storageGetSignedUrl } from "./storage";
import { consumeDownload, getOrderById, getOrderByToken, getProductById, giveBackDownload, markOrderPaid } from "./store";

export const SHOP_NAME = process.env.SHOP_NAME || "Planora";

/** GET /api/download/:token - builds the buyer's personalised PDF on the fly and streams it. */
export function registerDownloadRoute(app: Express) {
  app.get("/api/download/:token", async (req, res) => {
    const order = await getOrderByToken(String(req.params.token)).catch(() => undefined);
    if (!order) return res.status(404).send("Order not found");
    if (order.status !== "paid") return res.status(402).send("This order has not been paid yet");
    const product = await getProductById(order.productId);
    if (!product) return res.status(404).send("Product not found");

    if (!(await consumeDownload(order.id))) {
      return res.status(403).send("Download limit reached or link expired. Contact support to get more downloads.");
    }
    try {
      const url = await storageGetSignedUrl(product.baseFileKey);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Master file fetch failed (${r.status})`);
      const layout = req.query.format === "a5" ? "a5-pages" : "a4-sheets";
      const out = await personalizePdf({
        layout,
        base: new Uint8Array(await r.arrayBuffer()),
        name: order.buyerName, motto: order.buyerMotto, orderRef: orderRef(order.id), shopName: SHOP_NAME,
        stamp: { xPct: product.coverNameXPct, yPct: product.coverNameYPct, sizePermille: product.coverNameSizePermille, colorHex: product.stampColor, mottoAbove: product.mottoAbove },
      });
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${SHOP_NAME}-${product.slug}-${layout === "a5-pages" ? "A5-tablet" : "A4-print-and-cut"}.pdf"`,
        "Content-Length": String(out.length),
        "Cache-Control": "no-store",
      });
      res.send(Buffer.from(out));
    } catch (e) {
      console.error("[download] failed", e);
      await giveBackDownload(order.id); // a failed build must not cost the buyer a download
      res.status(500).send("Could not prepare your file. Please try again.");
    }
  });
}

/**
 * POST /api/webhooks/payment - provider-neutral "order paid" hook.
 * Body: {"event":"order_paid","orderId":123,"paymentRef":"..."}  Header: x-signature = hex HMAC-SHA256(rawBody, PAYMENT_WEBHOOK_SECRET)
 * Must be registered BEFORE express.json(), because the signature is computed over the raw bytes.
 * A real provider (Lemon Squeezy, Paddle, PayPal...) gets its own small adapter that ends in markOrderPaid().
 */
export function registerPaymentWebhook(app: Express) {
  app.post("/api/webhooks/payment", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) return res.status(503).send("Payments not configured");
    const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    const given = Buffer.from(String(req.header("x-signature") || ""), "hex");
    const expected = createHmac("sha256", secret).update(raw).digest();
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return res.status(401).send("Bad signature");
    try {
      const body = JSON.parse(raw.toString("utf8"));
      if (body.event === "order_paid" && Number.isInteger(body.orderId)) {
        const order = await getOrderById(body.orderId);
        if (!order) return res.status(404).send("Unknown order");
        await markOrderPaid(order.id, String(body.paymentRef || "webhook"));
      }
      res.json({ ok: true });
    } catch {
      res.status(400).send("Bad payload");
    }
  });
}
