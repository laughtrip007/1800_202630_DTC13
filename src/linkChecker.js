const analyzeBtn = document.querySelector("#analyzeBtn");

analyzeBtn.addEventListener("click", () => {
  const link = document.querySelector("#linkInput").value.trim();

  if (link === "") {
    alert("Please enter a link.");
    return;
  }

  console.log("Checking link:", link);

  window.location.href = "analyzing.html";
});
