import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { orderRef, personalizePdf, toPrintableAscii } from "./personalize";

async function masterPdf(pages = 3) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([420, 595]).drawText(`Master page ${i + 1}`, { x: 40, y: 540, size: 18 });
  return pdf.save();
}
const stamp = { xPct: 50, yPct: 80, sizePermille: 60, colorHex: "#1B2A2B" };
const text = (bytes: Uint8Array) => {
  const f = join(mkdtempSync(join(tmpdir(), "pl-")), "t.pdf");
  writeFileSync(f, bytes);
  return execFileSync("pdftotext", ["-layout", f, "-"]).toString();
};

describe("personalizePdf", () => {
  it("stamps the name and motto on the cover and a licence footer on every other page", async () => {
    const out = await personalizePdf({ base: await masterPdf(), name: "Emma Johnson", motto: "Plan the dream", orderRef: orderRef(42), shopName: "Planora", stamp, layout: "a5-pages" });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getKeywords()).toContain("PL-000042");
    expect(doc.getAuthor()).toBe("Planora");
    const t = text(out);
    expect(t).toContain("Emma Johnson");
    expect(t).toContain("Plan the dream");
    expect((t.match(/Licensed to Emma Johnson - Order PL-000042/g) || []).length).toBe(2); // every page except the cover
    expect(t).toContain("Master page 1"); // original content is preserved
  });
  it("only puts the name on the cover page", async () => {
    const out = await personalizePdf({ base: await masterPdf(), name: "Zed", orderRef: "PL-000001", shopName: "Planora", stamp, layout: "a5-pages" });
    const pages = text(out).split("\f");
    expect(pages[0]).toMatch(/\bZed\b/);
    expect(pages[1].replace(/Licensed to Zed[^\n]*/g, "")).not.toMatch(/\bZed\b/);
  });
  it("shrinks very long names to fit and rejects names with no printable letters", async () => {
    const out = await personalizePdf({ base: await masterPdf(1), name: "Alexandrina Maximiliana Montgomery-Featherstonehaugh", orderRef: "PL-000002", shopName: "Planora", stamp });
    expect(out.length).toBeGreaterThan(500);
    await expect(personalizePdf({ base: await masterPdf(1), name: "محمد", orderRef: "PL-000003", shopName: "Planora", stamp })).rejects.toThrow();
  });
  it("print layout: instruction sheet first, then A4 landscape sheets with two A5 pages each", async () => {
    const out = await personalizePdf({ base: await masterPdf(5), name: "Emma Johnson", orderRef: orderRef(7), shopName: "Planora", stamp });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1 + 3); // instructions + ceil(5/2) sheets
    for (const p of doc.getPages()) { const { width, height } = p.getSize(); expect(Math.round(width)).toBe(842); expect(Math.round(height)).toBe(595); }
    const pages = text(out).split("\f");
    expect(pages[0]).toMatch(/Cut every sheet in half/);
    expect(pages[1]).toContain("Emma Johnson");
    expect(pages[1]).toContain("Master page 1");
    expect(pages[1]).toContain("Master page 2"); // two pages on one sheet
    expect(pages[3]).toContain("Master page 5");
  });
  it("normalises accents", () => {
    expect(toPrintableAscii("  José   Müller ")).toBe("Jose Muller");
  });
});
