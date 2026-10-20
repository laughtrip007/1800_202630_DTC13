const resultText = document.querySelector("#resultText");
const checkAnotherBtn = document.querySelector("#checkAnotherBtn");

// Get previously checked URL
const checkedURL = localStorage.getItem("checkedURL");

// Generate placeholder result
const result = Math.random() > 0.5 ? "safe" : "unsafe";

// Log for testing
console.log({
  url: checkedURL,
  result: result,
});

// Display result
if (result === "safe") {
  resultText.textContent = "SAFE!";
  resultText.classList.add("text-success");
} else {
  resultText.textContent = "UNSAFE!";
  resultText.classList.add("text-danger");
}

// Return to link checker
checkAnotherBtn.addEventListener("click", () => {
  window.location.href = "link-checker.html";
});
