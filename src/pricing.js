export const REGION = {
  IN: "IN",
  US: "US",
};

export function getCurrency(region) {
  return String(region || "").toUpperCase() === REGION.US
    ? { code: "USD", symbol: "$" }
    : { code: "INR", symbol: "₹" };
}

export function getProductUnitPrice(product, region) {
  const r = String(region || "").toUpperCase();

  if (r === REGION.US) {
    const usd = Number(product?.price_usd ?? product?.priceUsd ?? NaN);
    if (!Number.isNaN(usd) && usd > 0) {
      return { amount: usd, currency: "USD", symbol: "$" };
    }
  }

  const inr = Number(product?.price_inr ?? product?.priceInr ?? product?.price ?? NaN);
  if (!Number.isNaN(inr) && inr >= 0) {
    return { amount: inr, currency: "INR", symbol: "₹" };
  }

  const fallback = getCurrency(region);
  return { amount: 0, currency: fallback.code, symbol: fallback.symbol };
}

export function getProductUnitMrp(product, region) {
  const r = String(region || "").toUpperCase();

  if (r === REGION.US) {
    const usd = Number(product?.mrp_usd ?? product?.mrpUsd ?? NaN);
    if (!Number.isNaN(usd) && usd > 0) {
      return { amount: usd, currency: "USD", symbol: "$" };
    }
  }

  const inr = Number(product?.mrp_inr ?? product?.mrpInr ?? product?.mrp ?? NaN);
  if (!Number.isNaN(inr) && inr > 0) {
    return { amount: inr, currency: "INR", symbol: "₹" };
  }

  const fallback = getCurrency(region);
  return { amount: 0, currency: fallback.code, symbol: fallback.symbol };
}

export function getCartItemUnitPrice(item, region) {
  const r = String(region || "").toUpperCase();

  if (r === REGION.US) {
    const usd = Number(item?.price_usd ?? item?.priceUsd ?? NaN);
    if (!Number.isNaN(usd) && usd > 0) {
      return { amount: usd, currency: "USD", symbol: "$" };
    }
  }

  const inr = Number(item?.price_inr ?? item?.priceInr ?? item?.price ?? NaN);
  if (!Number.isNaN(inr) && inr >= 0) {
    return { amount: inr, currency: "INR", symbol: "₹" };
  }

  const fallback = getCurrency(region);
  return { amount: 0, currency: fallback.code, symbol: fallback.symbol };
}

export function formatMoney(amount, currency) {
  const n = Number(amount) || 0;
  const { symbol } = currency === "USD" ? { symbol: "$" } : { symbol: "₹" };

  const formatted = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    maximumFractionDigits: 0,
  }).format(n);

  return `${symbol}${formatted}`;
}
