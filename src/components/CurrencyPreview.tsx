import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CURRENCIES, CURRENCY_KEY, convertedAmount, fetchRates, formatCurrency, isCurrency, type Currency, type ExchangeRates } from "@/lib/currency";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CurrencyContext = createContext<{ currency: Currency; setCurrency: (currency: Currency) => void; rates?: ExchangeRates; loading: boolean; error: boolean } | null>(null);

export function CurrencyPreviewProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("GBP");
  useEffect(() => {
    try { const saved = localStorage.getItem(CURRENCY_KEY); if (isCurrency(saved)) setCurrencyState(saved); } catch { /* Storage is optional. */ }
  }, []);
  const query = useQuery({ queryKey: ["currency-rates"], queryFn: fetchRates, enabled: currency !== "GBP", staleTime: 3600000, retry: 1 });
  const setCurrency = (next: Currency) => {
    setCurrencyState(next);
    try { localStorage.setItem(CURRENCY_KEY, next); } catch { /* Storage is optional. */ }
  };
  return <CurrencyContext.Provider value={{ currency, setCurrency, rates: query.data, loading: query.isFetching && !query.data, error: query.isError }}>{children}</CurrencyContext.Provider>;
}

export function CurrencySelector() {
  const context = useContext(CurrencyContext);
  if (!context) return null;
  return <div className="mt-5 space-y-2">
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="price-currency" className="text-sm font-semibold">Currency</label>
      <Select value={context.currency} onValueChange={(value) => { if (isCurrency(value)) context.setCurrency(value); }}>
        <SelectTrigger id="price-currency" aria-label="Price currency" className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <p className="text-xs text-muted-foreground" role="status">
      {context.currency === "GBP" ? "All payments are charged in GBP." : context.loading ? "Loading exchange rates… Payments remain in GBP." : context.error && !context.rates ? "Exchange rates unavailable. GBP prices still apply." : `Approximate conversions${context.rates ? ` · Rates dated ${context.rates.date}` : ""}. Payments are charged in GBP; your bank’s rate and fees may differ.`}
    </p>
  </div>;
}

export function ConvertedPrice({ gbp, monthly = false }: { gbp: number; monthly?: boolean }) {
  const context = useContext(CurrencyContext);
  if (!context || context.currency === "GBP") return null;
  const amount = convertedAmount(gbp, context.currency, context.rates);
  if (amount === null) return null;
  return <p className="mt-1 text-sm font-medium text-muted-foreground">≈ {formatCurrency(amount, context.currency)}{monthly ? " / month" : ""}</p>;
}