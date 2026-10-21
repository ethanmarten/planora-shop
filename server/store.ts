import { randomBytes } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { orders, products, type InsertProduct, type Order, type Product } from "../drizzle/schema";
import { getDb } from "./db";

const DOWNLOAD_WINDOW_DAYS = 30;
export const DOWNLOADS_PER_ORDER = 4; // shared by the print (A4) and tablet (A5) versions

async function db() {
  const d = await getDb();
  if (!d) throw new Error("Database is not available");
  return d;
}

/** Product fields that are safe to send to a browser (never the master file key). */
export const publicProductColumns = {
  id: products.id, slug: products.slug, title: products.title, description: products.description,
  year: products.year, priceCents: products.priceCents, currency: products.currency, pageCount: products.pageCount,
  previewImageUrl: products.previewImageUrl, coverNameXPct: products.coverNameXPct, coverNameYPct: products.coverNameYPct,
  coverNameSizePermille: products.coverNameSizePermille, stampColor: products.stampColor, mottoAbove: products.mottoAbove,
};

export async function listPublicProducts() {
  return (await db()).select(publicProductColumns).from(products).where(eq(products.active, true)).orderBy(desc(products.year), products.title);
}
export async function getPublicProductBySlug(slug: string) {
  const r = await (await db()).select(publicProductColumns).from(products).where(and(eq(products.slug, slug), eq(products.active, true))).limit(1);
  return r[0];
}
export async function getProductById(id: number): Promise<Product | undefined> {
  return (await (await db()).select().from(products).where(eq(products.id, id)).limit(1))[0];
}
export async function listAllProducts() {
  return (await db()).select().from(products).orderBy(desc(products.createdAt));
}
export async function createProduct(v: InsertProduct) {
  const [res] = await (await db()).insert(products).values(v);
  return res.insertId;
}
export async function updateProduct(id: number, v: Partial<InsertProduct>) {
  await (await db()).update(products).set(v).where(eq(products.id, id));
}

export async function createOrder(p: { product: Product; name: string; email: string; motto?: string }) {
  const accessToken = randomBytes(24).toString("base64url");
  const [res] = await (await db()).insert(orders).values({
    accessToken, productId: p.product.id, buyerName: p.name, buyerEmail: p.email, buyerMotto: p.motto || null,
    amountCents: p.product.priceCents, currency: p.product.currency, downloadsMax: DOWNLOADS_PER_ORDER, licenseAcceptedAt: new Date(),
  });
  return { id: res.insertId, accessToken };
}
export async function getOrderByToken(token: string): Promise<Order | undefined> {
  return (await (await db()).select().from(orders).where(eq(orders.accessToken, token)).limit(1))[0];
}
export async function getOrderById(id: number): Promise<Order | undefined> {
  return (await (await db()).select().from(orders).where(eq(orders.id, id)).limit(1))[0];
}
export async function listOrders() {
  return (await db()).select().from(orders).orderBy(desc(orders.createdAt)).limit(300);
}

/** Idempotent: marking an already-paid order again changes nothing. */
export async function markOrderPaid(orderId: number, paymentRef: string) {
  const expires = new Date(Date.now() + DOWNLOAD_WINDOW_DAYS * 86_400_000);
  const [res] = await (await db()).update(orders)
    .set({ status: "paid", paymentRef, paidAt: new Date(), expiresAt: expires })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
  return res.affectedRows > 0;
}
export async function markOrderRefunded(orderId: number) {
  await (await db()).update(orders).set({ status: "refunded" }).where(eq(orders.id, orderId));
}
/** Admin: give a buyer more downloads (lost file, new device). */
export async function grantExtraDownloads(orderId: number, extra: number) {
  await (await db()).update(orders).set({ downloadsMax: sql`${orders.downloadsMax} + ${extra}` }).where(eq(orders.id, orderId));
}

/** Atomically takes one download; false if the order is unpaid, expired or out of downloads. */
export async function consumeDownload(orderId: number) {
  const [res] = await (await db()).update(orders)
    .set({ downloadsUsed: sql`${orders.downloadsUsed} + 1` })
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid"), lt(orders.downloadsUsed, orders.downloadsMax), sql`${orders.expiresAt} > NOW()`));
  return res.affectedRows > 0;
}
export async function giveBackDownload(orderId: number) {
  await (await db()).update(orders).set({ downloadsUsed: sql`GREATEST(${orders.downloadsUsed} - 1, 0)` }).where(eq(orders.id, orderId));
}
