"use client";

import {
  Check,
  Copy,
  Download,
  FileDown,
  FileText,
  Loader2,
  MessageCircle,
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

type SendStatus = "idle" | "generating" | "ready" | "shared" | "downloaded" | "error";

export function WhatsAppLedgerButton({
  phone: initialPhone,
  message,
  label = "Send to WhatsApp",
  triggerPrint = true,
  documentName,
  autoTrigger = false,
}: {
  phone?: string | null;
  message: string;
  label?: string;
  /** When true (default on invoice/ledger print pages), automatically generates & attaches/downloads the PDF. */
  triggerPrint?: boolean;
  /** Custom document file name (e.g. "INV-2026-0001") */
  documentName?: string;
  /** When true, initiates generation on mount (e.g. redirected from reports page) */
  autoTrigger?: boolean;
}) {
  const [status, setStatus] = useState<SendStatus>("idle");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showDirectShareModal, setShowDirectShareModal] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
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

        const canShareFiles =
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [pdfResult.file] });

        if (canShareFiles) {
          try {
            // CRITICAL FOR IPHONE (iOS Safari) & ANDROID:
            // Share ONLY the PDF file in the files array!
            // DO NOT pass 'text' alongside 'files', because WhatsApp's iOS extension
            // ignores the file attachment and only pastes the text string when text is provided!
            await navigator.share({
              title: pdfResult.fileName,
              files: [pdfResult.file],
            });
            setStatus("shared");
            setTimeout(() => setStatus("idle"), 8000);
            return;
          } catch (shareErr: unknown) {
            if (
              shareErr instanceof Error &&
              (shareErr.name === "AbortError" || shareErr.message.includes("canceled"))
            ) {
              // User explicitly dismissed the native share sheet
              setStatus("idle");
              return;
            }
            // Safari threw NotAllowedError (user gesture expired during async PDF generation)
            // Or share failed -> Show the Direct Action Share Modal so the user can tap with fresh gesture!
            setShowDirectShareModal(true);
            setStatus("ready");
            return;
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
    [activePhone, buildFileName, openWhatsAppDirectly, triggerPrint],
  );

  // Auto-trigger if requested on page mount (e.g. from /reports redirect)
  useEffect(() => {
    if (autoTrigger && status === "idle") {
      const timer = setTimeout(() => {
        executeSendFlow();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoTrigger, executeSendFlow, status]);

  const handleClick = () => {
    if (status === "ready" && lastPdfResult) {
      handleDirectShare();
      return;
    }
    executeSendFlow();
  };

  const handleModalSubmit = () => {
    if (normalizeWhatsAppNumber(customPhone)) {
      executeSendFlow(customPhone);
    }
  };

  const handleDirectShare = async () => {
    if (!lastPdfResult) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        // Direct synchronous user click -> Safari user gesture is 100% active and fresh!
        // Share ONLY the file so WhatsApp attaches the PDF document!
        await navigator.share({
          title: lastPdfResult.fileName,
          files: [lastPdfResult.file],
        });
        setShowDirectShareModal(false);
        setStatus("shared");
        setTimeout(() => setStatus("idle"), 8000);
        return;
      }
    } catch (e: unknown) {
      if (e instanceof Error && (e.name === "AbortError" || e.message.includes("canceled"))) {
        return;
      }
    }

    // Fallback if native share was cancelled or failed
    triggerPdfDownload(lastPdfResult.blob, lastPdfResult.fileName);
    const norm = normalizeWhatsAppNumber(activePhone);
    if (norm) openWhatsAppDirectly(norm);
    setShowDirectShareModal(false);
    setStatus("downloaded");
  };

  const handleRedownloadPdf = () => {
    if (lastPdfResult) {
      triggerPdfDownload(lastPdfResult.blob, lastPdfResult.fileName);
    }
  };

  const handleCopySummary = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shortMessage);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 3000);
      }
    } catch {
      // ignore
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
        ) : status === "ready" ? (
          <>
            <Share2 size={17} />
            <span>Share PDF...</span>
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
              <span>The PDF document has been attached and sent to WhatsApp.</span>
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

      {/* Direct Action Share Modal: Specifically fixes iOS Safari gesture timeout */}
      {showDirectShareModal && lastPdfResult && (
        <div
          className="whatsapp-modal-overlay no-print"
          onClick={() => setShowDirectShareModal(false)}
        >
          <div
            className="whatsapp-modal-content direct-share-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="direct-share-title"
          >
            <div className="whatsapp-modal-head">
              <h3 id="direct-share-title">
                <span className="whatsapp-modal-icon-badge whatsapp-ready-badge">
                  <FileText size={18} />
                </span>
                PDF Ready to Send
              </h3>
              <button
                type="button"
                onClick={() => setShowDirectShareModal(false)}
                className="whatsapp-modal-close"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <p className="whatsapp-modal-desc">
              Your official PDF (<strong>{lastPdfResult.fileName}</strong>) is ready. Tap below to send the actual file on WhatsApp:
            </p>

            <div className="direct-share-buttons">
              <button
                type="button"
                className="button whatsapp-button button-full direct-action-primary"
                onClick={handleDirectShare}
              >
                <Share2 size={18} />
                <span>Share PDF to WhatsApp</span>
              </button>

              <button
                type="button"
                className="button button-secondary button-full"
                onClick={() => {
                  triggerPdfDownload(lastPdfResult.blob, lastPdfResult.fileName);
                }}
              >
                <Download size={16} />
                <span>Download PDF File</span>
              </button>

              <button
                type="button"
                className="button button-secondary button-full"
                onClick={handleCopySummary}
              >
                {copiedText ? (
                  <>
                    <Check size={16} style={{ color: "#10b981" }} />
                    <span>Summary Text Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy Summary Text</span>
                  </>
                )}
              </button>
            </div>

            <div className="whatsapp-modal-steps">
              <div className="step-item">
                <Share2 size={16} />
                <span>Tap <strong>WhatsApp</strong> in your phone&apos;s share sheet to attach the PDF</span>
              </div>
            </div>
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
                <span>On Android &amp; iPhone: Attaches the PDF directly into WhatsApp</span>
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
