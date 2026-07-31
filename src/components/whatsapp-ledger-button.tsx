"use client";

import { FileText, MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";
import { normalizeWhatsAppNumber, whatsappUrl } from "@/lib/whatsapp";

export function WhatsAppLedgerButton({
  phone: initialPhone,
  message,
  label = "Send to WhatsApp",
  triggerPrint = true,
}: {
  phone?: string | null;
  message: string;
  label?: string;
  triggerPrint?: boolean;
}) {
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [customPhone, setCustomPhone] = useState("");
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const activePhone = initialPhone || customPhone;
  const href = whatsappUrl(activePhone, message);

  const handleLaunchWhatsApp = (targetPhone?: string | null) => {
    const finalPhone = targetPhone || activePhone;
    const finalHref = whatsappUrl(finalPhone, message);

    if (!finalHref) {
      setShowPhoneModal(true);
      return;
    }

    if (triggerPrint && typeof window !== "undefined") {
      try {
        window.print();
      } catch {
        // Continue even if window.print is blocked
      }
    }

    window.open(finalHref, "_blank", "noopener,noreferrer");
    setStatusNotice("WhatsApp opened! Save the PDF from the print window to attach it to your message.");
    setTimeout(() => setStatusNotice(null), 8000);
    setShowPhoneModal(false);
  };

  return (
    <>
      {href ? (
        <a
          className="button whatsapp-button no-print"
          href={href}
          rel="noreferrer"
          target="_blank"
          onClick={() => {
            if (triggerPrint && typeof window !== "undefined") {
              try {
                window.print();
              } catch {}
            }
            setStatusNotice("WhatsApp opened! Save the PDF from the print window to attach it to your message.");
            setTimeout(() => setStatusNotice(null), 8000);
          }}
        >
          <MessageCircle size={17} /> {label}
        </a>
      ) : (
        <button
          className="button whatsapp-button no-print"
          type="button"
          onClick={() => setShowPhoneModal(true)}
          title="Send PDF summary via WhatsApp"
        >
          <MessageCircle size={17} /> {label}
        </button>
      )}

      {statusNotice && (
        <div className="whatsapp-notice-banner no-print">
          <FileText size={18} />
          <span>{statusNotice}</span>
          <button type="button" onClick={() => setStatusNotice(null)} className="notice-close" aria-label="Close notification">
            <X size={14} />
          </button>
        </div>
      )}

      {showPhoneModal && (
        <div className="whatsapp-modal-overlay no-print" onClick={() => setShowPhoneModal(false)}>
          <div className="whatsapp-modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="whatsapp-modal-head">
              <h3><MessageCircle size={20} color="#20b85a" /> Send via WhatsApp</h3>
              <button type="button" onClick={() => setShowPhoneModal(false)} className="icon-button" aria-label="Close"><X size={18} /></button>
            </div>
            <p className="muted-text">Enter the recipient&apos;s WhatsApp phone number:</p>
            <div className="field">
              <input
                className="input"
                placeholder="03xx xxxxxxx or 923xx xxxxxxx"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button className="button button-secondary" type="button" onClick={() => setShowPhoneModal(false)}>Cancel</button>
              <button
                className="button whatsapp-button"
                type="button"
                disabled={!normalizeWhatsAppNumber(customPhone)}
                onClick={() => handleLaunchWhatsApp(customPhone)}
              >
                <Send size={16} /> Open WhatsApp & Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
