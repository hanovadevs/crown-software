// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportBuilder } from "./report-builder";

describe("ReportBuilder WhatsApp action", () => {
  it("submits the auto-prepare flag with the report filters", () => {
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

    const button = screen.getByRole("button", { name: /Prepare PDF for WhatsApp/i });
    expect(button).toBeDefined();
    expect(button.getAttribute("formAction")).toBe("/reports/print");
    expect(button.getAttribute("name")).toBe("autoWhatsApp");
    expect(button.getAttribute("value")).toBe("1");
    expect(new FormData(button.closest("form")!, button as HTMLButtonElement).get("autoWhatsApp")).toBe("1");
  });
});
