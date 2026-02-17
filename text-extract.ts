/*
Text extraction utilities (client-side)

Performance refactor:
- pdfjs-dist / pdf worker / tesseract.js / mammoth are heavy.
- We lazy-load them ONLY when the user uploads a matching file type.

Note:
- Everything runs in the browser (no backend).
*/

export type ExtractProgress = {
  stage: "loading" | "reading" | "pdf" | "ocr" | "docx" | "done" | "error";
  progress01: number; // 0..1
  message?: string;
};

// Lazy module caches
let _pdfjs: any | null = null;
// ملاحظة: سنستخدم CDN للـ worker لتجنب تضمينه داخل Bundle
let _pdfWorkerUrl: string | null = null;
let _mammoth: any | null = null;
let _tesseract: any | null = null;

async function getPdfjs() {
  if (_pdfjs) return _pdfjs;

  const mod = await import("pdfjs-dist");
  _pdfjs = mod as any;

  // PDF Worker عبر CDN (يحذف ~1.1MB من bundle)
  if (!_pdfWorkerUrl) {
    const v = String((_pdfjs as any).version || (_pdfjs as any).default?.version || "").trim();
    const version = v || "4.0.379"; // fallback آمن لو لم تتوفر version
    _pdfWorkerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
  }

  try {
    (_pdfjs as any).GlobalWorkerOptions.workerSrc = _pdfWorkerUrl;
  } catch {
    // ignore
  }

  return _pdfjs;
}

export async function prepareExtractEnginesForFile(
  file: File,
  onProgress?: (p: ExtractProgress) => void
) {
  const t = file.type;
  const name = file.name.toLowerCase();

  // لن نحمّل شيء لو المحركات محمّلة بالفعل
  if (t === "application/pdf" || name.endsWith(".pdf")) {
    if (_pdfjs) return;
    onProgress?.({ stage: "loading", progress01: 0.02, message: "تحميل محرك PDF..." });
    await getPdfjs();
    onProgress?.({ stage: "loading", progress01: 0.1, message: "تم تحميل محرك PDF" });
    return;
  }

  if (t.startsWith("image/") || /(\.png|\.jpg|\.jpeg|\.webp)$/.test(name)) {
    if (_tesseract) return;
    onProgress?.({ stage: "loading", progress01: 0.02, message: "تحميل محرك OCR..." });
    await getTesseract();
    onProgress?.({ stage: "loading", progress01: 0.1, message: "تم تحميل محرك OCR" });
    return;
  }

  if (
    t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    if (_mammoth) return;
    onProgress?.({ stage: "loading", progress01: 0.02, message: "تحميل محرك Word..." });
    await getMammoth();
    onProgress?.({ stage: "loading", progress01: 0.1, message: "تم تحميل محرك Word" });
  }
}

async function getMammoth() {
  if (_mammoth) return _mammoth;
  const mod = await import("mammoth");
  _mammoth = (mod as any).default || mod;
  return _mammoth;
}

async function getTesseract() {
  if (_tesseract) return _tesseract;
  _tesseract = await import("tesseract.js");
  return _tesseract;
}

export async function extractTextFromPdf(file: File, onProgress?: (p: ExtractProgress) => void) {
  onProgress?.({ stage: "reading", progress01: 0.02, message: "قراءة ملف PDF" });
  const buf = await file.arrayBuffer();

  const pdfjsLib = await getPdfjs();

  onProgress?.({ stage: "pdf", progress01: 0.08, message: "تحليل صفحات PDF" });
  const doc = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  const totalPages: number = doc.numPages;

  let out = "";
  for (let i = 1; i <= totalPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as any[])
      .map((it) => ("str" in it ? (it as any).str : ""))
      .join(" ");

    out += `\n\n---\nصفحة ${i}/${totalPages}\n`;
    out += pageText;

    const p = 0.08 + (i / totalPages) * 0.9;
    onProgress?.({ stage: "pdf", progress01: Math.min(0.98, p) });
  }

  onProgress?.({ stage: "done", progress01: 1, message: "تم استخراج النص" });
  return out.trim();
}

export async function extractTextFromImage(file: File, onProgress?: (p: ExtractProgress) => void) {
  onProgress?.({ stage: "reading", progress01: 0.05, message: "تحميل الصورة" });

  const tesseract = await getTesseract();
  const worker = await (tesseract as any).createWorker("ara");

  try {
    await worker.setParameters({ tessedit_pageseg_mode: "6" } as any);

    const { data } = await worker.recognize(file, {
      logger: (m: any) => {
        if (m?.status === "recognizing text") {
          onProgress?.({
            stage: "ocr",
            progress01: 0.1 + 0.9 * (m.progress ?? 0),
            message: "OCR جاري...",
          });
        }
      },
    } as any);

    onProgress?.({ stage: "done", progress01: 1, message: "تم استخراج النص" });
    return String(data?.text || "").trim();
  } finally {
    await worker.terminate();
  }
}

export async function extractTextFromDocx(file: File, onProgress?: (p: ExtractProgress) => void) {
  onProgress?.({ stage: "reading", progress01: 0.1, message: "قراءة ملف Word" });
  const buf = await file.arrayBuffer();

  const mammoth = await getMammoth();

  onProgress?.({ stage: "docx", progress01: 0.5, message: "استخراج نص Word" });
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  const text = String(res?.value || "").trim();

  onProgress?.({ stage: "done", progress01: 1, message: "تم استخراج النص" });
  return text;
}

export async function extractTextFromFile(file: File, onProgress?: (p: ExtractProgress) => void) {
  const t = file.type;
  const name = file.name.toLowerCase();

  if (t === "application/pdf" || name.endsWith(".pdf")) {
    return extractTextFromPdf(file, onProgress);
  }

  if (t.startsWith("image/") || /(\.png|\.jpg|\.jpeg|\.webp)$/.test(name)) {
    return extractTextFromImage(file, onProgress);
  }

  if (t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) {
    return extractTextFromDocx(file, onProgress);
  }

  throw new Error("نوع الملف غير مدعوم لاستخراج النص حالياً");
}
