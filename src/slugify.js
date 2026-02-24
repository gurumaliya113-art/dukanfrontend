// Utility to generate a slug from a string (e.g., product title)
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Collapse multiple hyphens
}
