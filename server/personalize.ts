import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type StampConfig = {
  xPct: number; // horizontal centre of the name, 0-100 of page width
  yPct: number; // vertical position, 0-100 measured from the top of the page
  sizePermille: number; // font size as 1/1000 of the page width
  colorHex: string; // "#RRGGBB"
  mottoAbove?: boolean; // motto line above the name instead of below
};

export type PrintLayout = "a4-sheets" | "a5-pages";

export type PersonalizeInput = {
  /** "a4-sheets": print-at-home A4 landscape sheets, two A5 pages each, cut in half (default). "a5-pages": one A5 page per PDF page, for tablets. */
  layout?: PrintLayout;
  base: Uint8Array;
  name: string;
  motto?: string | null;
  orderRef: string; // e.g. "PL-000123"
  shopName: string;
  stamp: StampConfig;
};

/** Standard PDF fonts only cover WinAnsi: strip accents and anything else outside printable ASCII. */
export function toPrintableAscii(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const v = m ? parseInt(m[1], 16) : 0x1b2a2b;
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

/**
 * Builds the buyer's own copy of a planner:
 *  - name (+ optional motto) stamped on the cover,
 *  - a small licence footer with the order reference on every page,
 *  - fresh metadata carrying the order reference, so a leaked file can be traced,
 *  - form fields flattened so the copy is not trivially editable.
 */
export async function personalizePdf(input: PersonalizeInput): Promise<Uint8Array> {
  const name = toPrintableAscii(input.name);
  if (!name) throw new Error("Name has no printable characters");
  const motto = input.motto ? toPrintableAscii(input.motto) : "";

  const pdf = await PDFDocument.load(input.base, { ignoreEncryption: true, updateMetadata: false });
  const nameFont = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const footFont = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  if (pages.length === 0) throw new Error("Master PDF has no pages");

  // Cover: name + motto, shrunk if needed so it never leaves the page.
  const cover = pages[0];
  const { width: cw, height: ch } = cover.getSize();
  const color = hexToRgb(input.stamp.colorHex);
  let size = (input.stamp.sizePermille / 1000) * cw;
  while (size > 6 && nameFont.widthOfTextAtSize(name, size) > cw * 0.8) size -= 0.5;
  const cx = (input.stamp.xPct / 100) * cw;
  const baseY = ch - (input.stamp.yPct / 100) * ch;
  cover.drawText(name, { x: cx - nameFont.widthOfTextAtSize(name, size) / 2, y: baseY, size, font: nameFont, color });
  if (motto) {
    let ms = size * 0.55;
    while (ms > 5 && nameFont.widthOfTextAtSize(motto, ms) > cw * 0.8) ms -= 0.5;
    cover.drawText(motto, { x: cx - nameFont.widthOfTextAtSize(motto, ms) / 2, y: input.stamp.mottoAbove ? baseY + size * 1.15 : baseY - size * 1.15, size: ms, font: nameFont, color, opacity: 0.85 });
  }

  // Licence footer on every page except the cover (the cover already carries the buyer's name).
  // It sits at the very bottom edge so it never collides with a planner page's own footer line.
  const footer = `Licensed to ${name} - Order ${input.orderRef} - Personal use only. Do not share or resell.`;
  for (const page of pages.slice(1)) {
    const { width } = page.getSize();
    let fs = 6.5;
    while (fs > 4 && footFont.widthOfTextAtSize(footer, fs) > width * 0.9) fs -= 0.25;
    page.drawText(footer, { x: (width - footFont.widthOfTextAtSize(footer, fs)) / 2, y: 3.5, size: fs, font: footFont, color: rgb(0.45, 0.45, 0.45), opacity: 0.7 });
  }

  try { pdf.getForm().flatten(); } catch { /* no form fields */ }

  const a4 = (input.layout ?? "a4-sheets") === "a4-sheets";
  const result = a4 ? await toA4Sheets(pdf, nameFont, footFont, name, input) : pdf;

  const meta = result;
  meta.setTitle(`${input.shopName} planner - ${input.orderRef}`);
  meta.setAuthor(input.shopName);
  meta.setSubject(`Licensed copy ${input.orderRef}`);
  meta.setKeywords([input.orderRef]);
  meta.setProducer(input.shopName);
  meta.setCreator(input.shopName);
  meta.setCreationDate(new Date());
  meta.setModificationDate(new Date());
  return meta.save();
}

const A4W = 841.89, A4H = 595.28;

function wrap(text: string, font: PDFFont, size: number, maxW: number) {
  const lines: string[] = []; let cur = "";
  for (const w of text.split(" ")) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** First sheet of the print version: tells the buyer, before anything else, that the sheets must be cut. */
function drawInstructionSheet(out: PDFDocument, titleFont: PDFFont, body: PDFFont, bold: PDFFont, name: string, input: PersonalizeInput) {
  const page = out.addPage([A4W, A4H]);
  const ink = rgb(0.04, 0.055, 0.067), teal = rgb(0.1, 0.55, 0.52), grey = rgb(0.38, 0.42, 0.43);
  const L = 70;
  page.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: rgb(0.96, 0.95, 0.92) });
  page.drawText("Your notebook, ready to cut", { x: L, y: 480, size: 36, font: titleFont, color: ink });
  page.drawText("Every sheet holds two A5 pages. Three steps turn them into your notebook.", { x: L, y: 450, size: 13, font: body, color: grey });
  const steps = [
    ["1", "Print", "A4 paper, landscape, one-sided. Choose Actual size or 100% - not Fit to page - so the pages stay A5."],
    ["2", "Cut", "Cut every sheet in half along the small marks at the top and bottom centre. Each half is one A5 page."],
    ["3", "Bind", "Keep the pages in order - left half, then right half, sheet after sheet - and bind them with rings, discs, a binder or staples."],
  ];
  let y = 380;
  for (const [n, head, text] of steps) {
    page.drawCircle({ x: L + 14, y: y + 6, size: 14, borderColor: teal, borderWidth: 1.2 });
    page.drawText(n, { x: L + 10.5, y: y + 1.5, size: 12, font: bold, color: teal });
    page.drawText(head, { x: L + 44, y: y, size: 16, font: bold, color: ink });
    let ly = y - 20;
    for (const line of wrap(text, body, 12.5, 600)) { page.drawText(line, { x: L + 44, y: ly, size: 12.5, font: body, color: grey }); ly -= 17; }
    y = ly - 26;
  }
  page.drawText("Prefer a tablet? Download the A5 version from your order page.", { x: L, y: 70, size: 11.5, font: body, color: ink });
  const foot = `Licensed to ${name} - Order ${input.orderRef} - Personal use only. Do not share or resell.`;
  page.drawText(foot, { x: L, y: 3.5, size: 6.5, font: body, color: rgb(0.45, 0.45, 0.45) });
}

/** Re-lays the stamped A5 pages two per A4 landscape sheet (reading order), with cut marks at the centre. */
async function toA4Sheets(a5: PDFDocument, titleFont: PDFFont, footFont: PDFFont, name: string, input: PersonalizeInput) {
  const out = await PDFDocument.create();
  const titleF = await out.embedFont(StandardFonts.TimesRoman);
  const body = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  drawInstructionSheet(out, titleF, body, bold, name, input);
  // Fonts added with embedFont are only written to the file on save, so round-trip the stamped pages first.
  const settled = await PDFDocument.load(await a5.save(), { updateMetadata: false });
  const emb = await out.embedPages(settled.getPages());
  for (let i = 0; i < emb.length; i += 2) {
    const sheet = out.addPage([A4W, A4H]);
    sheet.drawPage(emb[i], { x: 0, y: 0, width: A4W / 2, height: A4H });
    if (emb[i + 1]) sheet.drawPage(emb[i + 1], { x: A4W / 2, y: 0, width: A4W / 2, height: A4H });
    const c = { thickness: 0.6, color: rgb(0.3, 0.3, 0.3), opacity: 0.8 };
    sheet.drawLine({ start: { x: A4W / 2, y: A4H }, end: { x: A4W / 2, y: A4H - 9 }, ...c });
    sheet.drawLine({ start: { x: A4W / 2, y: 0 }, end: { x: A4W / 2, y: 9 }, ...c });
  }
  return out;
}

export const orderRef = (id: number) => `PL-${String(id).padStart(6, "0")}`;
