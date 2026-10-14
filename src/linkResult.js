const resultText = document.querySelector("#resultText");

const randomResult = Math.random();

if (randomResult > 0.5) {
  resultText.textContent = "SAFE!";
  resultText.classList.add("text-success");
} else {
  resultText.textContent = "UNSAFE!";
  resultText.classList.add("text-danger");
}

const checkAnotherBtn = document.querySelector("#checkAnotherBtn");

checkAnotherBtn.addEventListener("click", () => {
  window.location.href = "link-checker.html";
});
