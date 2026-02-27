import { SITE } from "./siteConfig";

const clampAtWordBoundary = (text, max) => {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace < Math.max(20, max - 30)) return cut.trim();
  return cut.slice(0, lastSpace).trim();
};

export const buildTitle = (primary, secondary = "") => {
  const brand = SITE.siteNameShort;
  const parts = [primary, secondary, brand].map((x) => String(x || "").trim()).filter(Boolean);
  let title = parts.join(" | ");

  // Prefer removing secondary before truncating primary.
  if (title.length > 60 && secondary) {
    title = [primary, brand].filter(Boolean).join(" | ");
  }

  if (title.length > 60) {
    const maxPrimary = Math.max(35, 60 - (` | ${brand}`.length));
    const safePrimary = clampAtWordBoundary(primary, maxPrimary);
    title = [safePrimary, brand].filter(Boolean).join(" | ");
  }

  // Ensure a floor so titles don't look thin.
  if (title.length < 25 && primary) {
    title = `${primary} | ${brand}`;
  }

  return title;
};

export const buildMetaDescription = (mainText, fallbackText) => {
  const raw = String(mainText || "").replace(/\s+/g, " ").trim();
  const fallback = String(fallbackText || "").replace(/\s+/g, " ").trim();

  let s = raw || fallback;
  if (!s) return "";

  // Target 140–160 characters.
  if (s.length < 140 && fallback && s !== fallback) {
    const needed = 155 - s.length;
    const add = clampAtWordBoundary(fallback, Math.max(0, needed));
    s = `${s}${s.endsWith(".") ? "" : "."} ${add}`.trim();
  }

  if (s.length > 160) s = clampAtWordBoundary(s, 160);

  if (s.length < 140) {
    // Add a short CTR tail if still short.
    const tail = "Shop online with worldwide shipping and 7-day returns.";
    const combined = `${s}${s.endsWith(".") ? "" : "."} ${tail}`;
    s = combined.length > 160 ? clampAtWordBoundary(combined, 160) : combined;
  }

  return s;
};

export const absoluteUrl = (pathOrUrl) => {
  const value = String(pathOrUrl || "").trim();
  if (!value) return SITE.origin;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/")) return `${SITE.origin}/${value}`;
  return `${SITE.origin}${value}`;
};

export const canonicalFromLocation = (locationLike) => {
  const pathname = String(locationLike?.pathname || "/");
  const search = String(locationLike?.search || "");
  // Avoid hashes in canonical.
  return absoluteUrl(`${pathname}${search}`);
};

export const robotsForPath = (pathname) => {
  const path = String(pathname || "/").toLowerCase();

  // Checkout/account/payment/admin flows should not be indexed.
  const noindexPrefixes = [
    "/admin",
    "/cart",
    "/checkout",
    "/payment",
    "/login",
    "/customer-auth",
    "/account",
  ];

  const isNoindex = noindexPrefixes.some((p) => path === p || path.startsWith(`${p}/`));
  return isNoindex ? "noindex, nofollow" : "index, follow";
};
