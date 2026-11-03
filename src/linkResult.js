import { db, auth } from "./firebaseConfig.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const resultText = document.querySelector("#resultText");
const checkAnotherBtn = document.querySelector("#checkAnotherBtn");

// Get previously checked URL
const checkedURL = localStorage.getItem("checkedURL");

// Generate placeholder result
const result = Math.random() > 0.5 ? "safe" : "unsafe";

const resultDescription = document.querySelector("#resultDescription");

if (result === "safe") {
  resultText.textContent = "SAFE!";
  resultText.classList.add("text-success");

  resultDescription.textContent =
    "This link appears to be safe based on our current analysis. While no system can guarantee complete safety, there are no obvious signs of phishing, scams, or malicious activity associated with this website.";
} else {
  resultText.textContent = "UNSAFE!";
  resultText.classList.add("text-danger");

  resultDescription.textContent =
    "This link may be unsafe or potentially harmful. It could be associated with phishing attempts, scams, or other suspicious activity. We recommend avoiding this website and not entering any personal information.";
}

// Save to Firestore after auth state is loaded
onAuthStateChanged(auth, async (user) => {
  try {
    await addDoc(collection(db, "linkChecks"), {
      userID: user ? user.uid : "anonymous",
      userName: user ? user.displayName : "anonymous",
      url: checkedURL,
      result: result,
      checkedAt: serverTimestamp(),
    });

  } catch (error) {
    alert("Could not save link check. Please try again.");
    console.error("Error saving link check:", error);
  }
});

// Check another link
checkAnotherBtn.addEventListener("click", () => {
  localStorage.removeItem("checkedURL");
  window.location.href = "link-checker.html";
});
