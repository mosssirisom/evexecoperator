// Pure helpers for turning a booking's logged expenses into invoice line
// items. `booking_expenses.type` is a driver-facing enum with no dedicated
// customer-facing description — this maps it to invoice-ready wording.

export const EXPENSE_TYPE_LABEL = {
  parking: "Parking",
  ulez: "ULEZ Charge",
  congestion: "Congestion Charge",
  toll: "Toll",
  airport_fee: "Airport Fee",
  other: "Other Expense",
};

export function expenseLineDescription(exp) {
  const base = EXPENSE_TYPE_LABEL[exp.type] || "Expense";
  return exp.notes && exp.notes.trim() ? `${base} — ${exp.notes.trim()}` : base;
}

// Builds invoice line items for the subset of `expenses` whose id is in
// `includedIds`. The checklist (`includedIds`) is the single source of truth
// for what's on the invoice — this never reads or writes any other item
// list, so an expense can't end up represented twice.
export function buildExpenseLineItems(expenses, includedIds) {
  return (expenses || [])
    .filter((exp) => includedIds.has(exp.id))
    .map((exp) => ({
      description: expenseLineDescription(exp),
      quantity: 1,
      unit_price: Number(exp.amount) || 0,
    }));
}
