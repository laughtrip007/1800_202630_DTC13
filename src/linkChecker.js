const linkForm = document.querySelector("#linkForm");
const linkInput = document.querySelector("#linkInput");

linkForm.addEventListener("submit", (e) => {
  e.preventDefault();

  let input = linkInput.value.trim();

  if (!input) {
    alert("Please enter a link.");
    return;
  }

  // Add https:// if missing
  if (!/^https?:\/\//i.test(input)) {
    input = "https://" + input;
  }

  // Validate URL: must be http(s) and have a real-looking domain (e.g. "google.com", not "abc")
  let url;
  try {
    url = new URL(input);
  } catch {
    url = null;
  }

  if (!url || !url.hostname.includes(".")) {
    alert("Please enter a valid website address (example: google.com)");
    return;
  }

  // Save the normalized link for the results page, and clear any previous result
  localStorage.setItem("checkedURL", url.href);
  localStorage.removeItem("checkedResult");

  window.location.href = "analyzing.html";
});
