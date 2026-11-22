// Read the URL the user submitted on the checker page.
// It was saved to localStorage by linkChecker.js before redirecting here.
const url = localStorage.getItem("checkedURL");

// If there's no URL, send them back to the checker. Otherwise, show the URL and start the check.
if (!url) {
  location.replace("link-checker.html");
} else {
  document.getElementById("analyzingUrl").textContent = url;
  checkUrlSafety(url);
}

// Asks Google DNS whether the domain exists.
// Returns true (exists), false (does not exist), or null (couldn't tell)
async function domainExists(hostname) {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    return data.Status !== 3; // 3 = NXDOMAIN (domain doesn't exist)
  } catch {
    return null;
  }
}

// Sends the URL to Google Safe Browsing and returns "safe" or "unsafe".
async function checkSafeBrowsing(url) {
  const response = await fetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${import.meta.env.VITE_SAFE_BROWSING_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          clientId: "safelink",
          clientVersion: "1.0.0",
        },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Safe Browsing API returned ${response.status}`);
  }

  const data = await response.json();
  // If Google returned any matches, the URL is flagged. No matches means safe.
  // The ?. handles a response with no "matches" field.
  return data.matches?.length > 0 ? "unsafe" : "safe";
}

// Runs the full check and saves the result for link-result.html to display.
async function checkUrlSafety(url) {
  const minDelay = new Promise((resolve) => setTimeout(resolve, 1500));

  let result;

  try {
    const { hostname } = new URL(url); // throws if malformed

    const exists = await domainExists(hostname);

    if (exists === false) {
      // Domain doesn't exist, so skip Safe Browsing and report NOT FOUND.
      result = "notfound";
    } else {
      result = await checkSafeBrowsing(url);
    }
  } catch (error) {
    console.error("Link check error:", error);
    result = "error";
  }

  await minDelay;

  // Runs the full check and saves the result for link-result.html to display.
  localStorage.setItem("checkedResult", result);
  location.replace("link-result.html");
}
