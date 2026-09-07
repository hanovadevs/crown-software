// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportBuilder } from "./report-builder";

describe("ReportBuilder WhatsApp action", () => {
  it("renders Send PDF to WhatsApp button submitting to /reports/print?autoWhatsApp=1", () => {
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

    const button = screen.getByRole("button", { name: /Send PDF to WhatsApp/i });
    expect(button).toBeDefined();
    expect(button.getAttribute("formAction")).toBe("/reports/print?autoWhatsApp=1");
  });
});
