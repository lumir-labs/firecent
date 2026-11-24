"use client";

import type { PreparedAttachment } from "@app/api/assistant-types";

export class PdfPasswordRequiredError extends Error {
  constructor(message = "PDF requires a password") {
    super(message);
    this.name = "PdfPasswordRequiredError";
  }
}

export class PdfWrongPasswordError extends Error {
  constructor(message = "Incorrect PDF password") {
    super(message);
    this.name = "PdfWrongPasswordError";
  }
}

const MAX_IMAGE_DIM = 1500;
const IMAGE_QUALITY = 0.82;
const MAX_PDF_IMAGE_PAGES = 10;
const MIN_DIGITAL_CHARS_PER_PAGE = 40;
const MAX_TEXT_CHARS = 180_000;

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed reading file"));
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  if (typeof window === "undefined") return dataUrl;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
    };
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = dataUrl;
  });
}

async function parseSpreadsheetOrCsv(
  file: File,
  kind: "spreadsheet" | "csv",
): Promise<PreparedAttachment> {
  const XLSX = await import("xlsx");
  const buf = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buf, { type: "array", cellDates: true });

  const sheetBlocks: string[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    const cleanedLines: string[] = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const cells = row.map((cell) =>
        String(cell ?? "")
          .replace(/[\r\n\t]+/g, " ")
          .trim(),
      );
      // Trim trailing empty cells to keep tokens minimal
      while (cells.length > 0 && cells[cells.length - 1] === "") {
        cells.pop();
      }
      if (cells.length === 0 || cells.every((c) => c === "")) continue;
      cleanedLines.push(cells.join("\t"));
      totalRows += 1;
    }

    if (cleanedLines.length > 0) {
      const prefix =
        workbook.SheetNames.length > 1 ? `--- Sheet: ${sheetName} ---\n` : "";
      sheetBlocks.push(prefix + cleanedLines.join("\n"));
    }
  }

  const textContent = sheetBlocks.join("\n\n").slice(0, MAX_TEXT_CHARS);

  return {
    name: file.name,
    mimeType: file.type || (kind === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    sizeBytes: file.size,
    kind,
    textContent,
    rowCount: totalRows,
  };
}

/**
 * Extracts text from a PDF preserving visual rows (grouped by Y coordinate).
 * Falls back to rendering pages as compressed JPEGs ONLY if the PDF is scanned.
 */
async function parsePdfFile(
  file: File,
  password?: string,
): Promise<PreparedAttachment> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }

  const data = new Uint8Array(await readFileAsArrayBuffer(file));

  let loadingTask: ReturnType<typeof pdfjs.getDocument>;
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    loadingTask = pdfjs.getDocument({
      data,
      password: password || undefined,
      useSystemFonts: true,
    });
    doc = await loadingTask.promise;
  } catch (err: unknown) {
    const e = err as { name?: string; code?: number };
    if (e?.name === "PasswordException") {
      // code 1 = NEED_PASSWORD, code 2 = INCORRECT_PASSWORD
      if (e.code === 2) throw new PdfWrongPasswordError();
      throw new PdfPasswordRequiredError();
    }
    throw err;
  }

  const numPages = doc.numPages;
  const pageTexts: string[] = [];
  let totalChars = 0;

  for (let p = 1; p <= numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    type Item = { str: string; x: number; y: number };
    const items: Item[] = [];
    for (const raw of tc.items) {
      if (!("str" in raw)) continue;
      const str = raw.str.trim();
      if (!str) continue;
      const t = raw.transform as number[];
      items.push({ str, x: t[4] ?? 0, y: t[5] ?? 0 });
    }

    // Group items into visual rows by Y coordinate (top-to-bottom, left-to-right)
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: Array<{ y: number; items: Item[] }> = [];
    for (const item of items) {
      const existing = rows.find((r) => Math.abs(r.y - item.y) <= 3.5);
      if (existing) {
        existing.items.push(item);
      } else {
        rows.push({ y: item.y, items: [item] });
      }
    }

    const lines = rows.map((row) => {
      row.items.sort((a, b) => a.x - b.x);
      return row.items.map((i) => i.str).join("\t");
    });

    const pageText = lines.join("\n").trim();
    totalChars += pageText.length;
    if (pageText) {
      pageTexts.push(`--- Page ${p}/${numPages} ---\n${pageText}`);
    }
  }

  const avgCharsPerPage = numPages > 0 ? totalChars / numPages : 0;

  // Digital PDF: zero vision tokens!
  if (avgCharsPerPage >= MIN_DIGITAL_CHARS_PER_PAGE) {
    await loadingTask.destroy();
    return {
      name: file.name,
      mimeType: "application/pdf",
      sizeBytes: file.size,
      kind: "pdf_text",
      textContent: pageTexts.join("\n\n").slice(0, MAX_TEXT_CHARS),
      pageCount: numPages,
    };
  }

  // Scanned / image-only PDF: rasterize pages to compact JPEGs for Kimi Vision
  const images: string[] = [];
  const pagesToRender = Math.min(numPages, MAX_PDF_IMAGE_PAGES);

  for (let p = 1; p <= pagesToRender; p++) {
    const page = await doc.getPage(p);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      2.2,
      MAX_IMAGE_DIM / Math.max(baseViewport.width, baseViewport.height),
    );
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
  }

  await loadingTask.destroy();

  return {
    name: file.name,
    mimeType: "application/pdf",
    sizeBytes: file.size,
    kind: "pdf_images",
    textContent: pageTexts.length > 0 ? pageTexts.join("\n\n").slice(0, 10_000) : undefined,
    images,
    pageCount: numPages,
  };
}

/**
 * Parses an image, PDF, Excel (.xlsx/.xls), or CSV file into a token-efficient
 * PreparedAttachment ready for the Firecent AI Assistant.
 */
export async function prepareAttachmentFile(
  file: File,
  opts?: { password?: string },
): Promise<PreparedAttachment> {
  const lower = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/.test(lower)) {
    const compressed = await compressImageFile(file);
    return {
      name: file.name,
      mimeType: "image/jpeg",
      sizeBytes: file.size,
      kind: "image",
      images: [compressed],
    };
  }

  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    return parsePdfFile(file, opts?.password);
  }

  if (
    mime === "text/csv" ||
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv")
  ) {
    return parseSpreadsheetOrCsv(file, "csv");
  }

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    /\.(xlsx|xls|ods)$/.test(lower)
  ) {
    return parseSpreadsheetOrCsv(file, "spreadsheet");
  }

  throw new Error(
    `Unsupported file format: ${file.name}. Use PDF, Excel (.xlsx/.xls), CSV, or image.`,
  );
}
