// Shared currency formatting — the workspace currency (Settings) is the single
// source of truth for how every amount in the app is displayed.

export const CURRENCY_CODES = ["USD", "EUR", "GBP", "CAD", "AUD", "PKR", "INR"] as const;

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  PKR: "Rs",
  INR: "₹",
};

export const CURRENCY_NAMES: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  PKR: "Pakistani Rupee",
  INR: "Indian Rupee",
};

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code;
}

// Alphabetic symbols read wrong when glued to the number ("Rs12,000"), while
// attached ones ("$12,000", "CA$12,000") are conventionally kept as-is.
export function joinSymbol(symbol: string, formattedAmount: string): string {
  return /[A-Za-z]$/.test(symbol) ? `${symbol} ${formattedAmount}` : `${symbol}${formattedAmount}`;
}

export function formatMoney(amount: number, currency: string, decimals: number = 2): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return joinSymbol(currencySymbol(currency), formatted);
}
