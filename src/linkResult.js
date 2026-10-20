import { db, auth } from "./firebaseConfig.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const resultText = document.querySelector("#resultText");
const checkAnotherBtn = document.querySelector("#checkAnotherBtn");

// Get previously checked URL
const checkedURL = localStorage.getItem("checkedURL");

// Generate placeholder result
const result = Math.random() > 0.5 ? "safe" : "unsafe";

// Display result
if (result === "safe") {
  resultText.textContent = "SAFE!";
  resultText.classList.add("text-success");
} else {
  resultText.textContent = "UNSAFE!";
  resultText.classList.add("text-danger");
}

// Save to Firestore
saveLinkCheck();

async function saveLinkCheck() {
  try {
    await addDoc(collection(db, "linkChecks"), {
      userID: auth.currentUser ? auth.currentUser.uid : "anonymous",
      url: checkedURL,
      result: result,
      checkedAt: serverTimestamp(),
    });

    console.log("Link check saved successfully!");
  } catch (error) {
    console.error("Error saving link check:", error);
  }
}

// Check another link
checkAnotherBtn.addEventListener("click", () => {
  localStorage.removeItem("checkedURL");
  window.location.href = "link-checker.html";
});
