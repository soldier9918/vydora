export const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD", "INR"] as const;
export type Currency = typeof CURRENCIES[number];
export type ExchangeRates = { date: string; rates: Record<string, number> };
export const CURRENCY_KEY = "vydora:display-currency";

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((currency) => currency === value);
}

export function parseRates(value: unknown): ExchangeRates {
  if (!value || typeof value !== "object") throw new Error("Exchange rates unavailable");
  const data = value as { base?: unknown; date?: unknown; rates?: Record<string, unknown> };
  if (data.base !== "GBP" || typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !data.rates) {
    throw new Error("Invalid exchange rates");
  }
  const rates: Record<string, number> = { GBP: 1 };
  for (const currency of CURRENCIES.filter((c) => c !== "GBP")) {
    const rate = data.rates[currency];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) throw new Error("Invalid exchange rate");
    rates[currency] = rate;
  }
  return { date: data.date, rates };
}

export async function fetchRates(): Promise<ExchangeRates> {
  const response = await fetch("https://api.frankfurter.dev/v1/latest?base=GBP&symbols=USD,EUR,CAD,AUD,INR", {
    credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Exchange rates unavailable");
  return parseRates(await response.json());
}

export function convertedAmount(gbp: number, currency: Currency, rates?: ExchangeRates): number | null {
  const rate = currency === "GBP" ? 1 : rates?.rates[currency];
  if (!Number.isFinite(gbp) || gbp < 0 || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round((gbp * rate + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "code" }).format(amount);
}