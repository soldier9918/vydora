export type FailureRefund = { credits_charged: number; refunded: boolean };
export function refundState(row: FailureRefund): "not_charged" | "recorded" | "not_recorded" {
  return row.credits_charged === 0 ? "not_charged" : row.refunded ? "recorded" : "not_recorded";
}
export function refundStatus(row: FailureRefund): string {
  const state = refundState(row);
  if (state === "not_charged") return "No credits charged";
  return `${row.credits_charged} credits · ${state === "recorded" ? "Refund recorded" : "Refund not recorded"}`;
}

export function failureCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    let text = String(value ?? "");
    if (/^\s*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [keys.map(escape).join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\r\n");
}