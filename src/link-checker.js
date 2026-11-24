// Grab the form and the text input from link-checker.html
const linkForm = document.querySelector("#linkForm");
const linkInput = document.querySelector("#linkInput");

linkForm.addEventListener("submit", (e) => {
  // Stop the browser from submitting the form and reloading the page.
  // Handle everything in JavaScript instead.
  e.preventDefault();

  // Get the typed text and remove spaces at the start and end
  let input = linkInput.value.trim();

  // Empty input: tell the user and stop
  if (!input) {
    alert("Please enter a link.");
    return;
  }

  // Add https:// if missing.
  // The "i" makes the check case-insensitive.
  if (!/^https?:\/\//i.test(input)) {
    input = "https://" + input;
  }

  // Needs a real domain like google.com
  let url;
  try {
    url = new URL(input);
  } catch {
    url = null;
  }

  // Reject the input if it didn't parse, or if the hostname has no dot.
  // A dot check catches inputs like "google" or "localhost", which aren't
  // real public websites.
  if (!url || !url.hostname.includes(".")) {
    alert("Please enter a valid website address (example: google.com)");
    return;
  }

  // Reset state from any previous check
  localStorage.setItem("checkedURL", url.href);
  localStorage.removeItem("checkedResult");
  localStorage.removeItem("resultSaved");
  window.location.href = "analyzing.html";
});
