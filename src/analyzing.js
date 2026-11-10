const url = localStorage.getItem("checkedURL");

if (!url) {
  location.replace("link-checker.html");
} else {
  document.getElementById("analyzingUrl").textContent = url;
  checkUrlSafety(url);
}

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
  return data.matches?.length > 0 ? "unsafe" : "safe";
}

async function checkUrlSafety(url) {
  const minDelay = new Promise((resolve) => setTimeout(resolve, 1500));

  let result;

  try {
    const { hostname } = new URL(url); // throws if malformed

    const exists = await domainExists(hostname);

    if (exists === false) {
      result = "notfound";
    } else {
      result = await checkSafeBrowsing(url);
    }
  } catch (error) {
    console.error("Link check error:", error);
    result = "error";
  }

  await minDelay;

  localStorage.setItem("checkedResult", result);
  location.replace("link-result.html");
}
