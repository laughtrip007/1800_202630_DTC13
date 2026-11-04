import { db, auth } from "./firebaseConfig.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const RESULTS = {
  safe: {
    title: "SAFE",
    icon: "bi-shield-check",
    color: "text-success",
    description:
      "This link appears to be safe based on our current analysis. While no system can guarantee complete safety, there are no obvious signs of phishing, scams, or malicious activity associated with this website.",
  },
  unsafe: {
    title: "UNSAFE",
    icon: "bi-shield-exclamation",
    color: "text-danger",
    description:
      "This link may be unsafe or potentially harmful. It could be associated with phishing attempts, scams, or other suspicious activity. We recommend avoiding this website and not entering any personal information.",
  },
};

function init() {
  const checkedURL = localStorage.getItem("checkedURL");

  if (!checkedURL) {
    location.replace("link-checker.html");
    return;
  }

  // keep the same result on refresh
  let result = localStorage.getItem("checkedResult");
  const isNewCheck = !result;
  if (isNewCheck) {
    // TODO: real link check
    result = Math.random() > 0.5 ? "safe" : "unsafe";
    localStorage.setItem("checkedResult", result);
  }

  const info = RESULTS[result];
  document.querySelector("#checkedUrl").textContent = checkedURL;
  document.querySelector("#resultIcon").className = `bi ${info.icon} ${info.color} d-block display-1`;
  const resultText = document.querySelector("#resultText");
  resultText.textContent = info.title;
  resultText.classList.add(info.color);
  document.querySelector("#resultDescription").textContent = info.description;

  if (isNewCheck) {
    // only save once
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) return;
      try {
        await addDoc(collection(db, "linkChecks"), {
          userID: user.uid,
          userName: user.displayName,
          url: checkedURL,
          result: result,
          checkedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error saving link check:", error);
      }
    });
  }

  document.querySelector("#checkAnotherBtn").addEventListener("click", () => {
    localStorage.removeItem("checkedURL");
    localStorage.removeItem("checkedResult");
    window.location.href = "link-checker.html";
  });
}

init();
