import { db, auth } from "./firebaseConfig.js";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const counterElement = document.querySelector("#linkCheckCounter");
const historyElement = document.querySelector("#linkHistory");

function showMessage(text) {
  historyElement.innerHTML = "";
  const p = document.createElement("p");
  p.className = "text-body-secondary text-center mb-0";
  p.textContent = text;
  historyElement.appendChild(p);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return; // app.js redirects logged-out users to login.html

  try {
    const q = query(collection(db, "linkChecks"), where("userID", "==", user.uid));
    const snapshot = await getDocs(q);

    counterElement.textContent = snapshot.size;

    if (snapshot.empty) {
      showMessage("No link history yet.");
      return;
    }

    // Sort newest first (checkedAt can be null for a write that is still pending)
    const checks = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => (b.checkedAt?.toMillis?.() ?? 0) - (a.checkedAt?.toMillis?.() ?? 0));

    historyElement.innerHTML = "";
    const list = document.createElement("ul");
    list.className = "list-unstyled mb-0";

    checks.slice(0, 5).forEach((check) => {
      const item = document.createElement("li");
      const safe = check.result === "safe";
      item.className = `${safe ? "text-success" : "text-danger"} fw-semibold mb-2 text-break d-flex gap-2`;

      const icon = document.createElement("i");
      icon.className = `bi ${safe ? "bi-check-circle-fill" : "bi-x-circle-fill"}`;
      icon.setAttribute("aria-label", safe ? "Safe" : "Unsafe");

      const url = document.createElement("span");
      url.textContent = check.url;

      item.append(icon, url);
      list.appendChild(item);
    });

    historyElement.appendChild(list);
  } catch (error) {
    console.error("Error loading link history:", error);
    showMessage("Could not load your link history.");
  }
});
