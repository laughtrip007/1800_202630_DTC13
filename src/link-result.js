// Firebase setup: db is the Firestore database, auth tells us who's logged in
import { db, auth } from "./firebase-config.js";
// addDoc() adds a new document to a collection; serverTimestamp() asks Firestore to set the time on the server
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
// Runs a function when the login state is known (signed in or signed out)
import { onAuthStateChanged } from "firebase/auth";

// Display details for each possible result. The key matches the value
// stored in localStorage by analyzing.js ("safe", "unsafe", "notfound", "error").
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
  notfound: {
    title: "NOT FOUND",
    icon: "bi-globe-americas",
    color: "text-secondary",
    description:
      "This website doesn't seem to exist. Check the address for typos. If you were given this link by someone, it may be fake or broken.",
  },
  error: {
    title: "UNVERIFIED",
    icon: "bi-question-circle",
    color: "text-warning",
    description:
      "We couldn't verify this link right now. Please try again later. Don't enter personal or payment information on this site unless you can confirm it's safe.",
  },
};

// Results we show on screen but don't save to history.
// "error" means we couldn't check, and "notfound" means the site doesn't exist
const UNSAVED_RESULTS = ["error", "notfound"];

// Runs once when the page loads
function init() {
  // Read the values that analyzing.js and linkChecker.js saved
  const checkedURL = localStorage.getItem("checkedURL");
  const result = localStorage.getItem("checkedResult");

  // If either value is missing, the user opened this page directly.
  // Send them back to the checker.
  if (!checkedURL || !result) {
    location.replace("link-checker.html");
    return;
  }

  // Use the matching entry, or fall back to the "error" entry if the value is unexpected
  const info = RESULTS[result] ?? RESULTS.error;

  // Fill in the page with the URL that was checked
  document.querySelector("#checkedUrl").textContent = checkedURL;

  // Set the icon and its color. The class string replaces the whole className,
  // so the icon's other classes come from the template.
  document.querySelector("#resultIcon").className =
    `bi ${info.icon} ${info.color} d-block display-1`;

  // Show the title (SAFE, UNSAFE, etc.) and color it
  const resultText = document.querySelector("#resultText");
  resultText.textContent = info.title;
  resultText.classList.add(info.color);

  // Show the explanation paragraph
  document.querySelector("#resultDescription").textContent = info.description;

  // Save to history only if this check hasn't been saved yet and the result is worth keeping.
  // resultSaved prevents a duplicate entry if the user refreshes the page.
  if (
    !localStorage.getItem("resultSaved") &&
    !UNSAVED_RESULTS.includes(result)
  ) {
    // Firebase doesn't know the user yet when the page first loads, so we wait
    // for onAuthStateChanged to report the login state.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Fire once
      unsubscribe();

      // User not logged in
      if (!user) return;

      try {
        // Add a new document to this user's linkChecks subcollection
        await addDoc(collection(db, "users", user.uid, "linkChecks"), {
          url: checkedURL,
          result: result,
          checkedAt: serverTimestamp(),
        });

        // Mark this check as saved so a refresh doesn't add it again
        localStorage.setItem("resultSaved", "true");
      } catch (error) {
        console.error("Error saving link check:", error);
      }
    });
  }

  // "Check Another Link" clears the stored check and goes back to the form.
  // Clearing resultSaved lets the next check save normally.
  document.querySelector("#checkAnotherBtn").addEventListener("click", () => {
    localStorage.removeItem("checkedURL");
    localStorage.removeItem("checkedResult");
    localStorage.removeItem("resultSaved");

    window.location.href = "link-checker.html";
  });
}

init();
