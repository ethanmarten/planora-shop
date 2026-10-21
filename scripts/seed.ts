/**
 * Uploads the planners in seed/products.json (master PDF kept private + public cover) and creates the products.
 * Safe to re-run: products whose slug already exists are skipped.
 *   pnpm seed          -> real upload (needs DATABASE_URL + MANUS_API_URL + MANUS_API_KEY)
 *   pnpm seed --dry    -> only checks the files and the data, uploads nothing
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dry = process.argv.includes("--dry");
const root = join(import.meta.dirname, "..", "seed");
const items: any[] = JSON.parse(readFileSync(join(root, "products.json"), "utf8"));

function check(it: any) {
  const pdf = join(root, it.folder, "master.pdf"), cover = join(root, it.folder, "cover.jpg");
  for (const f of [pdf, cover]) if (!existsSync(f)) throw new Error(`Missing file: ${f}`);
  const head = readFileSync(pdf).subarray(0, 5).toString("latin1");
  if (head !== "%PDF-") throw new Error(`${pdf} is not a PDF`);
  if (!/^[a-z0-9-]{2,96}$/.test(it.slug)) throw new Error(`Bad slug: ${it.slug}`);
  return { pdf, cover };
}

if (dry) {
  for (const it of items) { const { pdf, cover } = check(it); console.log(`OK  ${it.slug}  master=${(readFileSync(pdf).length / 1e6).toFixed(1)}MB  cover=${(readFileSync(cover).length / 1e3).toFixed(0)}KB  $${(it.priceCents / 100).toFixed(2)}`); }
  console.log("Dry run complete - nothing uploaded.");
} else {
  const { storagePut } = await import("../server/storage");
  const store = await import("../server/store");
  const existing = new Set((await store.listAllProducts()).map(p => p.slug));
  for (const it of items) {
    if (existing.has(it.slug)) { console.log(`skip ${it.slug} (already exists)`); continue; }
    const { pdf, cover } = check(it);
    const m = await storagePut(`planners/master/${it.slug}.pdf`, readFileSync(pdf), "application/pdf");
    const c = await storagePut(`planners/preview/${it.slug}.jpg`, readFileSync(cover), "image/jpeg");
    const id = await store.createProduct({
      slug: it.slug, title: it.title, description: it.description, year: it.year, priceCents: it.priceCents, currency: it.currency ?? "USD",
      pageCount: it.pageCount ?? null, baseFileKey: m.key, previewImageUrl: c.url, active: it.active ?? true,
      coverNameXPct: Math.round(it.coverNameXPct), coverNameYPct: Math.round(it.coverNameYPct), coverNameSizePermille: it.coverNameSizePermille,
      stampColor: it.stampColor, mottoAbove: !!it.mottoAbove,
    });
    console.log(`created ${it.slug} (id ${id})`);
  }
}
process.exit(0);
