"use client";

export interface GeneratePdfOptions {
  fileName?: string;
  elementSelector?: string;
  targetElement?: HTMLElement | null;
}

export interface GeneratedPdfResult {
  blob: Blob;
  file: File;
  fileName: string;
}

/**
 * Captures an HTML printable element and converts it into a high-resolution A4 PDF.
 */
export async function generateElementPdf(
  options: GeneratePdfOptions = {},
): Promise<GeneratedPdfResult> {
  if (typeof window === "undefined") {
    throw new Error("generateElementPdf can only be run in the browser.");
  }

  const {
    fileName = `Crown_Document_${Date.now()}.pdf`,
    elementSelector = ".invoice-sheet, .printable-report, .gate-pass-sheet, .executive-report-sheet",
    targetElement,
  } = options;

  const element: HTMLElement | null =
    targetElement ||
    (document.querySelector(elementSelector) as HTMLElement | null);

  if (!element) {
    throw new Error("Printable document element not found on page.");
  }

  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  // Temporarily scroll to top and ensure proper styles for capture
  const originalScrollTop = window.scrollY;
  window.scrollTo(0, 0);

  // Apply clean PDF export styles (strips card shadows, borders, rounding, and resets width for A4)
  element.classList.add("pdf-exporting");

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // High resolution for crisp printing
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    if (!canvas.width || !canvas.height) throw new Error("The document rendered as an empty page.");

    // A4 dimensions in mm: 210 x 297
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 8; // 8mm margin
    const contentWidth = pdfWidth - margin * 2;
    const pageHeightPixels = Math.floor(((pdfHeight - margin * 2) * canvas.width) / contentWidth);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    const context = pageCanvas.getContext("2d");
    if (!context) throw new Error("The browser could not render the PDF pages.");

    for (let top = 0, page = 0; top < canvas.height; top += pageHeightPixels, page++) {
      const sliceHeight = Math.min(pageHeightPixels, canvas.height - top);
      pageCanvas.height = sliceHeight;
      context.drawImage(canvas, 0, top, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      if (page > 0) pdf.addPage();
      pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.9), "JPEG", margin, margin,
        contentWidth, (sliceHeight * contentWidth) / canvas.width, undefined, "FAST");
    }

    const cleanFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    const blob = pdf.output("blob");
    const file = new File([blob], cleanFileName, {
      type: "application/pdf",
      lastModified: Date.now(),
    });

    return {
      blob,
      file,
      fileName: cleanFileName,
    };
  } finally {
    element.classList.remove("pdf-exporting");
    window.scrollTo(0, originalScrollTop);
  }
}

/**
 * Triggers an immediate browser download of the generated PDF file.
 */
export function triggerPdfDownload(blobOrFile: Blob | File, fileName: string) {
  const url = URL.createObjectURL(blobOrFile);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
