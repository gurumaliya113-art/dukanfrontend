export const CATEGORIES = [
  { value: "new", label: "New Arrivals" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "kids", label: "Kids" },
];

export const normalizeCategory = (value) => {
  const raw = value === undefined || value === null ? "" : String(value);
  const v = raw.trim().toLowerCase();
  if (!v) return "new";
  if (v === "new" || v === "new-arrivals" || v === "new arrivals" || v === "arrivals") return "new";
  if (v === "men" || v === "man" || v === "mens" || v === "men's") return "men";
  if (v === "women" || v === "woman" || v === "womens" || v === "women's") return "women";
  if (v === "kids" || v === "kid" || v === "children" || v === "child") return "kids";
  return "new";
};

export const getCategoryLabel = (value) => {
  const normalized = normalizeCategory(value);
  return CATEGORIES.find((c) => c.value === normalized)?.label || "New Arrivals";
};
