"use client";

import { Check, Download, FileText, MessageCircle, Send, X } from "lucide-react";
import { useCallback, useState } from "react";
import { normalizeWhatsAppNumber, whatsappUrl } from "@/lib/whatsapp";

type Step = "idle" | "pdf-saved" | "done";

export function WhatsAppLedgerButton({
  phone: initialPhone,
  message,
  label = "Send to WhatsApp",
  triggerPrint = true,
}: {
  phone?: string | null;
  message: string;
  label?: string;
  /** When false (e.g. on the report builder page), skip the print dialog since the user hasn't generated the PDF view yet. */
  triggerPrint?: boolean;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [customPhone, setCustomPhone] = useState("");

  const activePhone = initialPhone || customPhone;

  // Short message for WhatsApp — the actual ledger goes as a PDF attachment
  const shortMessage = [
    "السلام علیکم",
    "",
    message,
    "",
    "— Crown Accumulator Management System",
  ].join("\n");

  const openWhatsApp = useCallback(
    (targetPhone?: string | null) => {
      const finalPhone = targetPhone || activePhone;
      const href = whatsappUrl(finalPhone, shortMessage);

      if (!href) {
        setShowPhoneModal(true);
        return;
      }

      window.open(href, "_blank", "noopener,noreferrer");
      setStep("done");
      setShowPhoneModal(false);
      // Auto-dismiss the banner after 12 seconds
      setTimeout(() => setStep("idle"), 12000);
    },
    [activePhone, shortMessage],
  );

  const handleClick = useCallback(() => {
    if (!activePhone && !customPhone) {
      setShowPhoneModal(true);
      return;
    }

    if (triggerPrint) {
      // Step 1: Open browser print dialog so user can "Save as PDF"
      try {
        window.print();
      } catch {
        // Some browsers block window.print — continue anyway
      }
      setStep("pdf-saved");
    } else {
      // On pages without a printable view (e.g. report builder), go straight to WhatsApp
      openWhatsApp();
    }
  }, [activePhone, customPhone, triggerPrint, openWhatsApp]);

  const handleModalSend = useCallback(() => {
    if (triggerPrint) {
      try {
        window.print();
      } catch {}
      setStep("pdf-saved");
      setShowPhoneModal(false);
    } else {
      openWhatsApp(customPhone);
    }
  }, [customPhone, triggerPrint, openWhatsApp]);

  return (
    <>
      {/* Main Button */}
      <button
        className="button whatsapp-button no-print"
        type="button"
        onClick={handleClick}
        title="Save PDF and send via WhatsApp"
      >
        <MessageCircle size={17} /> {label}
      </button>

      {/* Step 2 Banner: After PDF is saved, prompt user to open WhatsApp */}
      {step === "pdf-saved" && (
        <div className="whatsapp-step-banner no-print">
          <div className="step-banner-content">
            <div className="step-banner-icon step-check">
              <Check size={18} />
            </div>
            <div className="step-banner-text">
              <strong>Step 1 done — PDF saved!</strong>
              <span>Now open WhatsApp and attach the saved PDF to your message.</span>
            </div>
          </div>
          <div className="step-banner-actions">
            <button
              className="button whatsapp-button"
              type="button"
              onClick={() => openWhatsApp()}
            >
              <Send size={16} /> Open WhatsApp Now
            </button>
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="notice-close"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 Banner: WhatsApp opened confirmation */}
      {step === "done" && (
        <div className="whatsapp-step-banner whatsapp-done-banner no-print">
          <div className="step-banner-content">
            <div className="step-banner-icon step-done">
              <MessageCircle size={18} />
            </div>
            <div className="step-banner-text">
              <strong>WhatsApp opened!</strong>
              <span>Attach the PDF you saved and send it to the party.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="notice-close"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Phone Number Modal */}
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
              Enter the recipient&apos;s WhatsApp phone number to proceed:
            </p>
            <div className="whatsapp-modal-field">
              <label htmlFor="whatsapp-phone-input" className="whatsapp-modal-label">
                Recipient Phone Number
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
                    handleModalSend();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="whatsapp-modal-steps">
              <div className="step-item">
                <span className="step-num">1</span>
                <span>Save the statement as a PDF file</span>
              </div>
              <div className="step-item">
                <span className="step-num">2</span>
                <span>Attach the saved PDF in WhatsApp chat</span>
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
                onClick={handleModalSend}
              >
                <Send size={15} />
                {triggerPrint ? "Save PDF & Send" : "Open WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
