import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** A sellable planner. The master PDF key is server-only and never sent to browsers. */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description").notNull(),
  year: int("year").notNull(),
  priceCents: int("priceCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  pageCount: int("pageCount"),
  /** Storage key of the master PDF (private, server-side only). */
  baseFileKey: varchar("baseFileKey", { length: 512 }).notNull(),
  /** Public cover preview image (PNG/JPG) shown in the shop. */
  previewImageUrl: text("previewImageUrl"),
  /** Where the buyer's name is stamped on page 1, as fractions of the page. */
  coverNameXPct: int("coverNameXPct").default(50).notNull(), // 0-100, horizontal centre
  coverNameYPct: int("coverNameYPct").default(82).notNull(), // 0-100 from the top
  coverNameSizePermille: int("coverNameSizePermille").default(45).notNull(), // font size = n/1000 of page width
  stampColor: varchar("stampColor", { length: 7 }).default("#1B2A2B").notNull(),
  /** Put the buyer's optional motto line above the name instead of below it (for covers with free space above). */
  mottoAbove: boolean("mottoAbove").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/** One purchase. Buyers are guests: they reach their order through the secret accessToken. */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  accessToken: varchar("accessToken", { length: 64 }).notNull().unique(),
  productId: int("productId").notNull(),
  buyerName: varchar("buyerName", { length: 80 }).notNull(),
  buyerEmail: varchar("buyerEmail", { length: 320 }).notNull(),
  /** Optional short line printed under the name on the cover. */
  buyerMotto: varchar("buyerMotto", { length: 80 }),
  amountCents: int("amountCents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: mysqlEnum("status", ["pending", "paid", "refunded"]).default("pending").notNull(),
  paymentRef: varchar("paymentRef", { length: 128 }),
  downloadsUsed: int("downloadsUsed").default(0).notNull(),
  downloadsMax: int("downloadsMax").default(3).notNull(),
  licenseAcceptedAt: timestamp("licenseAcceptedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  paidAt: timestamp("paidAt"),
  /** Downloads stop working after this moment (set when the order is paid). */
  expiresAt: timestamp("expiresAt"),
});
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
