"use client";

import { Check, Download, FileText, Loader2, MessageCircle, Share2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { generateElementPdf, triggerPdfDownload, type GeneratedPdfResult } from "@/lib/pdf-generator";
import { normalizeWhatsAppNumber, whatsappUrl } from "@/lib/whatsapp";

type Status = "idle" | "generating" | "ready" | "opened" | "handoff" | "error";

function supportsFileShare(file: File | null): boolean {
  if (!file || typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try { return navigator.canShare({ files: [file] }); } catch { return false; }
}

type Props = {
  phone?: string | null;
  recipientName?: string | null;
  message: string;
  label?: string;
  triggerPrint?: boolean;
  documentName?: string;
  autoTrigger?: boolean;
};

export function WhatsAppLedgerButton({
  phone,
  recipientName,
  message,
  label = "Send to WhatsApp",
  triggerPrint = true,
  documentName,
  autoTrigger = false,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [pdf, setPdf] = useState<GeneratedPdfResult | null>(null);
  const [error, setError] = useState("");
  const autoStarted = useRef(false);
  const preparing = useRef(false);

  const number = normalizeWhatsAppNumber(phoneOverride ?? phone);
  const shortMessage = ["السلام علیکم", "", message, "", "— Crown Accumulator"].join("\n");
  const chatUrl = whatsappUrl(number, shortMessage);
  const canShareFile = supportsFileShare(pdf?.file ?? null);

  const preparePdf = useCallback(async () => {
    if (preparing.current) return;
    preparing.current = true;
    setStatus("generating");
    setError("");
    try {
      const cleanName = documentName?.replace(/[^a-zA-Z0-9_-]/g, "_");
      const result = await generateElementPdf({
        fileName: cleanName ? `Crown_${cleanName}.pdf` : `Crown_Statement_${new Date().toISOString().slice(0, 10)}.pdf`,
      });
      setPdf(result);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PDF could not be prepared.");
      setStatus("error");
    } finally {
      preparing.current = false;
    }
  }, [documentName]);

  useEffect(() => {
    if (!autoTrigger || !triggerPrint || autoStarted.current) return;
    const timer = window.setTimeout(() => {
      if (autoStarted.current) return;
      autoStarted.current = true;
      if (number) void preparePdf();
      else setShowPhoneModal(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoTrigger, number, preparePdf, triggerPrint]);

  function handlePrepare() {
    if (!number) {
      setPhoneInput(phone ?? "");
      setShowPhoneModal(true);
      return;
    }
    void preparePdf();
  }

  function savePhone() {
    if (!normalizeWhatsAppNumber(phoneInput)) return;
    setPhoneOverride(phoneInput.trim());
    setShowPhoneModal(false);
    if (triggerPrint && !pdf) void preparePdf();
  }

  async function shareFile() {
    if (!pdf || !canShareFile) return;
    try {
      await navigator.share({ title: pdf.fileName, files: [pdf.file] });
      // A resolved browser share does not prove that WhatsApp delivered the file.
      setStatus("handoff");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "The device could not share this PDF.");
      setStatus("ready");
    }
  }

  const chatAction = chatUrl ? (
    <a
      className="button whatsapp-button no-print"
      href={chatUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        try {
          if (triggerPrint && pdf) triggerPdfDownload(pdf.blob, pdf.fileName);
          setStatus("opened");
        } catch (cause) {
          event.preventDefault();
          setError(cause instanceof Error ? cause.message : "The PDF could not be downloaded.");
          setStatus("error");
        }
      }}
    >
      <MessageCircle size={17} />
      {triggerPrint ? "Download PDF & open WhatsApp chat" : label}
    </a>
  ) : null;

  return <>
    {triggerPrint && (!pdf || status === "generating" || status === "error") ? (
      <button className="button whatsapp-button no-print" type="button" onClick={handlePrepare} disabled={status === "generating"}>
        {status === "generating" ? <><Loader2 className="animate-spin" size={17} /> Preparing PDF…</>
          : <><FileText size={17} /> {status === "error" ? "Retry PDF" : label}</>}
      </button>
    ) : chatAction ?? (
      <button className="button whatsapp-button no-print" type="button" onClick={() => setShowPhoneModal(true)}>
        <MessageCircle size={17} /> Add recipient number
      </button>
    )}

    {triggerPrint && pdf && status !== "generating" && status !== "error" && <div className="whatsapp-step-banner no-print" role="status">
      <div className="step-banner-content">
        <div className="step-banner-icon step-check"><Check size={18} /></div>
        <div className="step-banner-text">
          <strong>{status === "handoff" ? "PDF handed to your device" : "PDF ready for WhatsApp"}</strong>
          <span>{recipientName && !phoneOverride ? `${recipientName} · ` : ""}{number ? `+${number}` : "Choose a recipient"}</span>
          <span>{status === "handoff"
            ? "Confirm the recipient and press Send in the app you selected."
            : "Open the saved chat, attach the downloaded PDF, and press Send. WhatsApp cannot attach a file through a chat link."}</span>
        </div>
      </div>
      <div className="step-banner-actions">
        <button className="button button-secondary" type="button" onClick={() => triggerPdfDownload(pdf.blob, pdf.fileName)}><Download size={14} /> Download again</button>
        {canShareFile && <button className="button button-secondary" type="button" onClick={() => void shareFile()}><Share2 size={14} /> Device share</button>}
        <button className="notice-close" type="button" aria-label="Change recipient" title="Change recipient" onClick={() => { setPhoneInput(phoneOverride ?? phone ?? ""); setShowPhoneModal(true); }}><MessageCircle size={14} /></button>
        <button className="notice-close" type="button" aria-label="Dismiss guidance" onClick={() => setStatus("idle")}><X size={14} /></button>
      </div>
    </div>}

    {status === "error" && <div className="whatsapp-step-banner whatsapp-error-banner no-print" role="alert">
      <div className="step-banner-content"><div className="step-banner-icon step-error"><X size={18} /></div>
        <div className="step-banner-text"><strong>PDF could not be prepared</strong><span>{error}</span></div>
      </div>
      <div className="step-banner-actions">{chatUrl && <a className="button whatsapp-button" href={chatUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> Open chat without PDF</a>}<button className="notice-close" type="button" aria-label="Dismiss error" onClick={() => setStatus("idle")}><X size={14} /></button></div>
    </div>}

    {showPhoneModal && <div className="whatsapp-modal-overlay no-print" onClick={() => setShowPhoneModal(false)}>
      <div className="whatsapp-modal-content" role="dialog" aria-modal="true" aria-labelledby="whatsapp-modal-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") setShowPhoneModal(false); }}>
        <div className="whatsapp-modal-head"><h3 id="whatsapp-modal-title"><span className="whatsapp-modal-icon-badge"><MessageCircle size={18} /></span>Recipient number</h3>
          <button className="whatsapp-modal-close" type="button" aria-label="Close" onClick={() => setShowPhoneModal(false)}><X size={16} /></button>
        </div>
        <p className="whatsapp-modal-desc">Enter a WhatsApp number only when the party has no saved contact, or to use a different recipient.</p>
        <div className="whatsapp-modal-field"><label className="whatsapp-modal-label" htmlFor="whatsapp-phone-input">WhatsApp number</label>
          <input className="whatsapp-modal-input" id="whatsapp-phone-input" type="tel" autoFocus placeholder="03001234567" value={phoneInput}
            onChange={(event) => setPhoneInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") savePhone(); }} />
        </div>
        <div className="whatsapp-modal-actions"><button className="whatsapp-modal-btn whatsapp-modal-btn-cancel" type="button" onClick={() => setShowPhoneModal(false)}>Cancel</button>
          <button className="whatsapp-modal-btn whatsapp-modal-btn-submit" type="button" disabled={!normalizeWhatsAppNumber(phoneInput)} onClick={savePhone}>Use this number</button>
        </div>
      </div>
    </div>}
  </>;
}
