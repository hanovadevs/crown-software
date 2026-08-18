// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportBuilder } from "./report-builder";

describe("ReportBuilder WhatsApp action", () => {
  it("opens WhatsApp after selecting a party ledger and party", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <ReportBuilder
        options={{
          parties: [{ id: "party-1", name: "ABC Motors", phone: "03001234567", receivable: "500", payable: "0" }],
          products: [],
          workers: [],
          warehouses: [],
        }}
      />,
    );

    fireEvent.click(screen.getByDisplayValue("party-ledger"));
    fireEvent.change(screen.getByLabelText("Specific Party"), { target: { value: "party-1" } });

    const button = screen.getByRole("button", { name: /Send to WhatsApp/i });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("wa.me/923001234567"),
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockRestore();
  });
});

