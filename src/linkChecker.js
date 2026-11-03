const analyzeBtn = document.querySelector("#analyzeBtn");

analyzeBtn.addEventListener("click", () => {
  const link = document.querySelector("#linkInput").value.trim();

  if (!link) {
    alert("Please enter a link.");
    return;
  }

  // Save the link for the results page
  localStorage.setItem("checkedURL", link);

  console.log("Checking link:", link);

  window.location.href = "analyzing.html";
});
