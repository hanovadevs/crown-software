// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportBuilder } from "./report-builder";

describe("ReportBuilder WhatsApp action", () => {
  it("shows WhatsApp after selecting a party ledger and party", () => {
    render(<ReportBuilder options={{
      parties: [{ id: "party-1", name: "ABC Motors", phone: "03001234567", receivable: "500", payable: "0" }],
      products: [],
      workers: [],
      warehouses: [],
    }} />);
    fireEvent.click(screen.getByDisplayValue("party-ledger"));
    fireEvent.change(screen.getByLabelText("Specific Party"), { target: { value: "party-1" } });
    const link = screen.getByRole("link", { name: "Send to WhatsApp" });
    expect(link.getAttribute("href")).toContain("wa.me/923001234567");
  });
});
