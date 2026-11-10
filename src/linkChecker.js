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

  // Needs a real domain like google.com
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

  // Reset state from any previous check
  localStorage.setItem("checkedURL", url.href);
  localStorage.removeItem("checkedResult");
  localStorage.removeItem("resultSaved");
  window.location.href = "analyzing.html";
});
