import { describe, it, expect } from "vitest";
import { computeTotals } from "@/hooks/operator/useInvoices";
import { expenseLineDescription, buildExpenseLineItems } from "@/lib/operator/invoiceExpenses";

describe("expenseLineDescription", () => {
  it("labels a known expense type", () => {
    expect(expenseLineDescription({ type: "parking", notes: null })).toBe("Parking");
  });

  it("appends driver notes when present", () => {
    expect(expenseLineDescription({ type: "toll", notes: "M6 toll northbound" }))
      .toBe("Toll — M6 toll northbound");
  });

  it("ignores blank/whitespace-only notes", () => {
    expect(expenseLineDescription({ type: "ulez", notes: "   " })).toBe("ULEZ Charge");
  });

  it("falls back to a generic label for an unrecognised type", () => {
    expect(expenseLineDescription({ type: "mystery_fee", notes: null })).toBe("Expense");
  });
});

describe("buildExpenseLineItems", () => {
  const expenses = [
    { id: "e1", type: "parking", amount: 12.5, notes: null },
    { id: "e2", type: "ulez", amount: 15, notes: "Congestion zone entry" },
    { id: "e3", type: "toll", amount: 4.2, notes: null },
  ];

  it("only includes expenses whose id is in the included set", () => {
    const included = new Set(["e1", "e3"]);
    const items = buildExpenseLineItems(expenses, included);
    expect(items.map((i) => i.description)).toEqual(["Parking", "Toll"]);
    expect(items.every((i) => i.quantity === 1)).toBe(true);
    expect(items.map((i) => i.unit_price)).toEqual([12.5, 4.2]);
  });

  it("returns an empty array when nothing is included (no auto-include)", () => {
    expect(buildExpenseLineItems(expenses, new Set())).toEqual([]);
  });

  it("returns an empty array when there are no expenses at all", () => {
    expect(buildExpenseLineItems([], new Set(["e1"]))).toEqual([]);
  });

  it("never lists the same expense twice, even if its id were duplicated in the set", () => {
    const included = new Set(["e2", "e2"]); // Set dedupes on its own
    const items = buildExpenseLineItems(expenses, included);
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe("ULEZ Charge — Congestion zone entry");
  });
});

describe("expenses combine with manual items in the invoice total (no double count)", () => {
  it("adds selected-expense line items to the manual charges before totalling", () => {
    const manualItems = [{ description: "Airport transfer — MAN → Blackpool", quantity: 1, unit_price: 80 }];
    const expenses = [
      { id: "e1", type: "parking", amount: 12.5, notes: null },
      { id: "e2", type: "toll", amount: 4.2, notes: null }, // not included below
    ];
    const included = new Set(["e1"]);
    const expenseItems = buildExpenseLineItems(expenses, included);

    const totals = computeTotals([...manualItems, ...expenseItems], 0);
    expect(totals.subtotal).toBe(92.5); // 80 + 12.5, the un-included toll is excluded
    expect(totals.total).toBe(92.5);
  });

  it("matches a manual-only invoice's total when no expenses are included", () => {
    const manualItems = [{ description: "Airport transfer", quantity: 1, unit_price: 80 }];
    const withoutExpenses = computeTotals(manualItems, 0);
    const withEmptyExpenses = computeTotals([...manualItems, ...buildExpenseLineItems([], new Set())], 0);
    expect(withEmptyExpenses).toEqual(withoutExpenses);
  });
});
