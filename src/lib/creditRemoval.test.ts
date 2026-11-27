import { describe, it, expect } from "vitest";
import { moneyOfLedgerRow, paidCreditsPerRow } from "./billingRecords";

describe("free-credit removal preserves financial reporting", () => {
  it("withdrawn free credits have no purchase or spending value", () => {
    expect(moneyOfLedgerRow({amount:-30,reason:"free_credit_removal"},new Map())).toBeNull();
  });
  it("removing free credits never consumes purchased credits in the money breakdown", () => {
    expect(paidCreditsPerRow([
      {amount:-5,reason:"scene_image"},
      {amount:-30,reason:"free_credit_removal"},
      {amount:125,reason:"topup"},
      {amount:30,reason:"starter"},
    ])).toEqual([5,0,0,0]);
  });
});