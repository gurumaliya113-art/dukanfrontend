const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const getApiBase = () => {
  // In dev, keep this empty so CRA `proxy` in package.json works.
  // In production (Netlify), set REACT_APP_API_URL to your backend base.
  return trimTrailingSlash(process.env.REACT_APP_API_URL || "");
};

export const apiFetch = (path, options) => {
  const base = getApiBase();

  // Allow absolute URLs if ever needed.
  if (/^https?:\/\//i.test(path)) {
    return fetch(path, options);
  }

  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;

  return fetch(`${base}${normalizedPath}`, options);
};
