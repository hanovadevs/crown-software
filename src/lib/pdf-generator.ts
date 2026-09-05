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

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // High resolution for crisp printing
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: Math.max(element.scrollWidth, 1024),
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

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
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = contentHeight;
    let position = margin;

    // First page
    pdf.addImage(
      imgData,
      "JPEG",
      margin,
      position,
      contentWidth,
      contentHeight,
      undefined,
      "FAST",
    );
    heightLeft -= pdfHeight - margin * 2;

    // Subsequent pages if content exceeds 1 page
    while (heightLeft > 0) {
      position = heightLeft - contentHeight + margin;
      pdf.addPage();
      pdf.addImage(
        imgData,
        "JPEG",
        margin,
        position,
        contentWidth,
        contentHeight,
        undefined,
        "FAST",
      );
      heightLeft -= pdfHeight - margin * 2;
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
