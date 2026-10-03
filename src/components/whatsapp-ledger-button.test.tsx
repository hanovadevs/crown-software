// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateElementPdf, triggerPdfDownload } from "@/lib/pdf-generator";
import { WhatsAppLedgerButton } from "./whatsapp-ledger-button";

vi.mock("@/lib/pdf-generator", () => ({
  generateElementPdf: vi.fn(),
  triggerPdfDownload: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(generateElementPdf).mockResolvedValue({
    blob: new Blob(["pdf"], { type: "application/pdf" }),
    file: new File(["pdf"], "Crown_INV-1.pdf", { type: "application/pdf" }),
    fileName: "Crown_INV-1.pdf",
  });
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("WhatsApp document handoff", () => {
  it("opens the saved party contact without asking for a number", () => {
    render(<WhatsAppLedgerButton phone="0300-1234567" message="Ledger" triggerPrint={false} />);
    const link = screen.getByRole("link", { name: "Send to WhatsApp" });
    expect(link.getAttribute("href")).toContain("https://wa.me/923001234567?");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("prepares a PDF, then downloads it when opening the saved chat", async () => {
    render(<WhatsAppLedgerButton phone="03001234567" recipientName="ABC Motors" message="Invoice" documentName="INV-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Send to WhatsApp" }));
    const link = await screen.findByRole("link", { name: "Download PDF & open WhatsApp chat" });
    expect(link.getAttribute("href")).toContain("923001234567");
    expect(screen.getByText(/attach the downloaded PDF/i)).toBeDefined();
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(triggerPdfDownload).toHaveBeenCalledWith(expect.any(Blob), "Crown_INV-1.pdf");
    expect(screen.queryByText(/sent to WhatsApp/i)).toBeNull();
  });

  it("asks for a number only when no saved contact exists", async () => {
    render(<WhatsAppLedgerButton message="Invoice" documentName="INV-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Send to WhatsApp" }));
    expect(screen.getByRole("dialog")).toBeDefined();
    fireEvent.change(screen.getByRole("textbox", { name: "WhatsApp number" }), { target: { value: "03211234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this number" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Download PDF & open WhatsApp chat" }).getAttribute("href")).toContain("923211234567"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("automatically prepares the report once without repeatedly reopening the flow", async () => {
    render(<WhatsAppLedgerButton phone="03001234567" message="Report" autoTrigger />);
    await screen.findByRole("link", { name: "Download PDF & open WhatsApp chat" });
    expect(generateElementPdf).toHaveBeenCalledTimes(1);
  });
});
