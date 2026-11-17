// Turns a URL into the id of its links/{linkId} document (see FIRESTORE.md),
// so the same link always counts toward the same document.
//   https://WWW.Example.com/login/?ref=1  ->  url "example.com/login?ref=1"
export function normalizeLink(rawUrl) {
  const text = rawUrl.trim();
  let url;
  try {
    url = new URL(text.includes("://") ? text : "https://" + text);
  } catch {
    // not a parseable URL, count it by its lowercase text
    const fallback = text.toLowerCase();
    return { url: fallback, linkId: encodeURIComponent(fallback) };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  // keep ?query, scam links often use it; drop protocol and #hash
  const normalized = host + path + url.search;

  return { url: normalized, linkId: encodeURIComponent(normalized) };
}
