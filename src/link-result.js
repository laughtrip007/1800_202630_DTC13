import { db, auth } from "./firebase-config.js";
import {
  collection,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { normalizeLink } from "./link-id.js";

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

const UNSAVED_RESULTS = ["error", "notfound"];

function init() {
  const checkedURL = localStorage.getItem("checkedURL");
  const result = localStorage.getItem("checkedResult");

  if (!checkedURL || !result) {
    location.replace("link-checker.html");
    return;
  }

  const info = RESULTS[result] ?? RESULTS.error;

  document.querySelector("#checkedUrl").textContent = checkedURL;

  document.querySelector("#resultIcon").className =
    `bi ${info.icon} ${info.color} d-block display-1`;

  const resultText = document.querySelector("#resultText");
  resultText.textContent = info.title;
  resultText.classList.add(info.color);

  document.querySelector("#resultDescription").textContent = info.description;

  // Save to history once, and never save unverified results
  if (!localStorage.getItem("resultSaved") && !UNSAVED_RESULTS.includes(result)) {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) return;

      try {
        const { url, linkId } = normalizeLink(checkedURL);
        const batch = writeBatch(db);

        // the user's own history
        batch.set(doc(collection(db, "users", user.uid, "linkChecks")), {
          url: checkedURL,
          linkId: linkId,
          result: result,
          checkedAt: serverTimestamp(),
        });

        // public count for this link (created on the first check)
        batch.set(
          doc(db, "links", linkId),
          {
            url: url,
            checkCount: increment(1),
            results: { [result]: increment(1) },
            lastResult: result,
            lastCheckedAt: serverTimestamp(),
          },
          { merge: true },
        );

        await batch.commit();
        localStorage.setItem("resultSaved", "true");
      } catch (error) {
        console.error("Error saving link check:", error);
      }
    });
  }

  document.querySelector("#checkAnotherBtn").addEventListener("click", () => {
    localStorage.removeItem("checkedURL");
    localStorage.removeItem("checkedResult");
    localStorage.removeItem("resultSaved");

    window.location.href = "link-checker.html";
  });
}

init();
