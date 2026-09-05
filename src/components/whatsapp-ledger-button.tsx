"use client";

import {
  Check,
  Download,
  FileDown,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  normalizeWhatsAppNumber,
  whatsappNativeUrl,
  whatsappUrl,
} from "@/lib/whatsapp";
import {
  generateElementPdf,
  triggerPdfDownload,
  type GeneratedPdfResult,
} from "@/lib/pdf-generator";

type SendStatus = "idle" | "generating" | "shared" | "downloaded" | "error";

export function WhatsAppLedgerButton({
  phone: initialPhone,
  message,
  label = "Send to WhatsApp",
  triggerPrint = true,
  documentName,
}: {
  phone?: string | null;
  message: string;
  label?: string;
  /** When true (default on invoice/ledger print pages), automatically generates & attaches/downloads the PDF. */
  triggerPrint?: boolean;
  /** Custom document file name (e.g. "INV-2026-0001") */
  documentName?: string;
}) {
  const [status, setStatus] = useState<SendStatus>("idle");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [customPhone, setCustomPhone] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastPdfResult, setLastPdfResult] = useState<GeneratedPdfResult | null>(null);

  const activePhone = initialPhone || customPhone;

  // Short message for WhatsApp — company greeting + summary text
  const shortMessage = [
    "السلام علیکم",
    "",
    message,
    "",
    "— Crown Accumulator Management System",
  ].join("\n");

  const buildFileName = useCallback(() => {
    if (documentName) {
      const clean = documentName.replace(/[^a-zA-Z0-9_-]/g, "_");
      return `Crown_${clean}.pdf`;
    }
    return `Crown_Statement_${new Date().toISOString().slice(0, 10)}.pdf`;
  }, [documentName]);

  const openWhatsAppDirectly = useCallback(
    (normalizedNumber: string) => {
      const isMobile =
        typeof navigator !== "undefined" &&
        /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

      if (isMobile) {
        // On mobile, native deep link opens WhatsApp app without opening a blank browser tab
        const nativeUrl = whatsappNativeUrl(normalizedNumber, shortMessage);
        const webUrl = whatsappUrl(normalizedNumber, shortMessage);
        window.location.href = nativeUrl || webUrl || "";
      } else {
        // On desktop, open WhatsApp Web in a new tab
        const webUrl = whatsappUrl(normalizedNumber, shortMessage);
        if (webUrl) {
          window.open(webUrl, "_blank", "noopener,noreferrer");
        }
      }
    },
    [shortMessage],
  );

  const executeSendFlow = useCallback(
    async (targetPhone?: string | null) => {
      const candidatePhone = targetPhone || activePhone;
      const normalizedNumber = normalizeWhatsAppNumber(candidatePhone);

      // If no valid phone number exists, prompt user via modal
      if (!normalizedNumber) {
        setShowPhoneModal(true);
        return;
      }

      setShowPhoneModal(false);
      setErrorMessage("");

      const sheetElement =
        typeof document !== "undefined"
          ? (document.querySelector(
              ".invoice-sheet, .printable-report, .gate-pass-sheet, .executive-report-sheet",
            ) as HTMLElement | null)
          : null;

      // Case A: No printable sheet on page (e.g. party cards, party details) OR triggerPrint disabled
      if (!sheetElement || !triggerPrint) {
        openWhatsAppDirectly(normalizedNumber);
        setStatus("shared");
        setTimeout(() => setStatus("idle"), 8000);
        return;
      }

      // Case B: Printable sheet present -> Generate real PDF
      setStatus("generating");

      try {
        const fileName = buildFileName();
        const pdfResult = await generateElementPdf({
          targetElement: sheetElement,
          fileName,
        });

        setLastPdfResult(pdfResult);

        // Check if device supports Web Share API with File (Standard on modern Android Chrome & iPhone iOS Safari)
        const canShareFiles =
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [pdfResult.file] });

        if (canShareFiles) {
          try {
            await navigator.share({
              title: pdfResult.fileName,
              text: shortMessage,
              files: [pdfResult.file],
            });
            setStatus("shared");
            setTimeout(() => setStatus("idle"), 8000);
            return;
          } catch (shareErr: unknown) {
            // If user closed or cancelled the share sheet, return to idle
            if (
              shareErr instanceof Error &&
              (shareErr.name === "AbortError" || shareErr.message.includes("canceled"))
            ) {
              setStatus("idle");
              return;
            }
            // If share failed with unexpected error, fall through to download + WhatsApp
          }
        }

        // Fallback for Desktop (or browsers without File Web Share):
        // 1. Download the PDF directly to device
        triggerPdfDownload(pdfResult.blob, pdfResult.fileName);

        // 2. Open WhatsApp (Web or Desktop) with pre-filled message
        openWhatsAppDirectly(normalizedNumber);

        // 3. Show helpful guidance banner
        setStatus("downloaded");
      } catch (err: unknown) {
        console.error("PDF generation or WhatsApp send failed:", err);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Failed to generate PDF. You can still open WhatsApp directly.",
        );
        setStatus("error");
      }
    },
    [activePhone, buildFileName, openWhatsAppDirectly, shortMessage, triggerPrint],
  );

  const handleClick = () => {
    executeSendFlow();
  };

  const handleModalSubmit = () => {
    if (normalizeWhatsAppNumber(customPhone)) {
      executeSendFlow(customPhone);
    }
  };

  const handleRedownloadPdf = () => {
    if (lastPdfResult) {
      triggerPdfDownload(lastPdfResult.blob, lastPdfResult.fileName);
    }
  };

  return (
    <>
      {/* Main Action Button */}
      <button
        className="button whatsapp-button no-print"
        type="button"
        onClick={handleClick}
        disabled={status === "generating"}
        title="Send document PDF directly via WhatsApp"
      >
        {status === "generating" ? (
          <>
            <Loader2 className="animate-spin" size={17} />
            <span>Generating PDF...</span>
          </>
        ) : (
          <>
            <MessageCircle size={17} />
            <span>{label}</span>
          </>
        )}
      </button>

      {/* Desktop Downloaded Banner: User has the PDF downloaded and WhatsApp open */}
      {status === "downloaded" && (
        <div className="whatsapp-step-banner no-print" role="status">
          <div className="step-banner-content">
            <div className="step-banner-icon step-check">
              <Check size={18} />
            </div>
            <div className="step-banner-text">
              <strong>PDF Downloaded &amp; WhatsApp Opened!</strong>
              <span>
                {lastPdfResult?.fileName || "Your PDF"} is saved in your downloads.
                Drag &amp; drop it into the WhatsApp chat to send.
              </span>
            </div>
          </div>
          <div className="step-banner-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={handleRedownloadPdf}
              title="Re-download PDF"
            >
              <Download size={14} /> Re-download
            </button>
            <button
              className="button whatsapp-button"
              type="button"
              onClick={() => {
                const norm = normalizeWhatsAppNumber(activePhone);
                if (norm) openWhatsAppDirectly(norm);
              }}
            >
              <Send size={14} /> Open WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="notice-close"
              aria-label="Dismiss banner"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Shared Confirmation Banner */}
      {status === "shared" && (
        <div className="whatsapp-step-banner whatsapp-done-banner no-print" role="status">
          <div className="step-banner-content">
            <div className="step-banner-icon step-done">
              <Check size={18} />
            </div>
            <div className="step-banner-text">
              <strong>Shared via WhatsApp!</strong>
              <span>The document has been prepared and sent to WhatsApp.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="notice-close"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Banner with Direct WhatsApp Fallback */}
      {status === "error" && (
        <div className="whatsapp-step-banner whatsapp-error-banner no-print" role="alert">
          <div className="step-banner-content">
            <div className="step-banner-icon step-error">
              <X size={18} />
            </div>
            <div className="step-banner-text">
              <strong>PDF Generation Notice</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
          <div className="step-banner-actions">
            <button
              className="button whatsapp-button"
              type="button"
              onClick={() => {
                const norm = normalizeWhatsAppNumber(activePhone);
                if (norm) openWhatsAppDirectly(norm);
                setStatus("idle");
              }}
            >
              <Send size={14} /> Send Text Only
            </button>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="notice-close"
              aria-label="Dismiss banner"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Phone Number Modal: When party does not have a saved phone number */}
      {showPhoneModal && (
        <div
          className="whatsapp-modal-overlay no-print"
          onClick={() => setShowPhoneModal(false)}
        >
          <div
            className="whatsapp-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-modal-title"
          >
            <div className="whatsapp-modal-head">
              <h3 id="whatsapp-modal-title">
                <span className="whatsapp-modal-icon-badge">
                  <MessageCircle size={18} />
                </span>
                Send via WhatsApp
              </h3>
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                className="whatsapp-modal-close"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <p className="whatsapp-modal-desc">
              Enter the recipient&apos;s WhatsApp mobile number:
            </p>

            <div className="whatsapp-modal-field">
              <label htmlFor="whatsapp-phone-input" className="whatsapp-modal-label">
                WhatsApp Phone Number
              </label>
              <input
                id="whatsapp-phone-input"
                className="whatsapp-modal-input"
                placeholder="e.g. 03001234567 or 923001234567"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && normalizeWhatsAppNumber(customPhone)) {
                    e.preventDefault();
                    handleModalSubmit();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="whatsapp-modal-steps">
              <div className="step-item">
                <Share2 size={16} />
                <span>On Android &amp; iPhone: Shares the PDF directly into WhatsApp</span>
              </div>
              <div className="step-item">
                <FileDown size={16} />
                <span>On Desktop: Downloads the PDF and opens WhatsApp Web</span>
              </div>
            </div>

            <div className="whatsapp-modal-actions">
              <button
                className="whatsapp-modal-btn whatsapp-modal-btn-cancel"
                type="button"
                onClick={() => setShowPhoneModal(false)}
              >
                Cancel
              </button>
              <button
                className="whatsapp-modal-btn whatsapp-modal-btn-submit"
                type="button"
                disabled={!normalizeWhatsAppNumber(customPhone)}
                onClick={handleModalSubmit}
              >
                <Send size={15} />
                Send Document
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
