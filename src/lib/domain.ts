// Reduces a URL or domain to the bare host so `https://www.Acme.com:8080/about`
// and `acme.com` compare equal: no protocol, credentials, www, port, path,
// query, fragment or trailing dot.
export function normalizeDomain(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/^.*@/, "")
    .replace(/:\d+$/, "")
    .replace(/\.+$/, "")
    .replace(/^www\./, "");
}
