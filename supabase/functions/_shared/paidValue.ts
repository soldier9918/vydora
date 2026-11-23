/** Net amount actually paid on a Stripe invoice, in pence, excluding VAT where Stripe itemises it. Null when it can't be valued in GBP. */
export function paidNetPence(inv: { amount_paid?: number | null; currency?: string | null; tax?: number | null; total_taxes?: { amount?: number | null }[] | null; total_tax_amounts?: { amount?: number | null }[] | null }): number | null {
  if ((inv.currency ?? "").toLowerCase() !== "gbp") return null;
  const paid = inv.amount_paid ?? 0;
  const list = inv.total_taxes ?? inv.total_tax_amounts;
  const tax = list ? list.reduce((s, t) => s + (t.amount ?? 0), 0) : (inv.tax ?? 0);
  return Math.max(0, paid - Math.max(0, tax));
}
