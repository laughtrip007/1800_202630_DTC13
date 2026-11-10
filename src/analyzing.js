const url = localStorage.getItem("checkedURL");

if (!url) {
  location.replace("link-checker.html");
} else {
  document.getElementById("analyzingUrl").textContent = url;

  checkUrlSafety();
}

async function checkUrlSafety() {
  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${import.meta.env.VITE_SAFE_BROWSING_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

    const data = await response.json();

    const result = data.matches && data.matches.length > 0 ? "unsafe" : "safe";

    localStorage.setItem("checkedResult", result);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    location.replace("link-result.html");
  } catch (error) {
    console.error("Safe Browsing Error:", error);

    localStorage.setItem("checkedResult", "safe");

    await new Promise((resolve) => setTimeout(resolve, 1500));

    location.replace("link-result.html");
  }
}
