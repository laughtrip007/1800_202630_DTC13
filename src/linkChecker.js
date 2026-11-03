const analyzeBtn = document.querySelector("#analyzeBtn");

analyzeBtn.addEventListener("click", () => {
  const link = document.querySelector("#linkInput").value.trim();

  if (!link) {
    alert("Please enter a link.");
    return;
  }

  let formattedLink = link;

  // Add https:// if missing
  if (
    !formattedLink.startsWith("http://") &&
    !formattedLink.startsWith("https://")
  ) {
    formattedLink = "https://" + formattedLink;
  }

  // Validate URL
  try {
    new URL(formattedLink);
  } catch {
    alert("Please enter a valid website address (example: google.com)");
    return;
  }

  // Save the link for the results page
  localStorage.setItem("checkedURL", link);

  window.location.href = "analyzing.html";
});
