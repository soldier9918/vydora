export type CreditNotice = { required?: number };
export const CREDIT_NOTICE_EVENT = "vydora:credits-required";
export function showCreditNotice(code: string, required?: number) {
  if (["payment_required", "insufficient_credits", "read_only"].includes(code) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<CreditNotice>(CREDIT_NOTICE_EVENT, { detail: { required } }));
  }
}