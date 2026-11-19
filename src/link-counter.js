import { db, auth } from "./firebase-config.js";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const counterElement = document.querySelector("#linkCheckCounter");
const historyElement = document.querySelector("#linkHistory");

const INITIAL_COUNT = 4; // checks shown before "Show more"

function showMessage(text) {
  historyElement.innerHTML = "";
  const p = document.createElement("p");
  p.className = "text-body-secondary text-center mb-0";
  p.textContent = text;
  historyElement.appendChild(p);
}

function renderHistory(checks) {
  historyElement.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "list-unstyled mb-0";

  checks.forEach((check, index) => {
    const item = document.createElement("li");
    const safe = check.result === "safe";
    item.className = `${safe ? "text-success" : "text-danger"} fw-semibold mb-2 text-break d-flex gap-2`;

    if (index >= INITIAL_COUNT) {
      item.classList.add("d-none");
    }

    const icon = document.createElement("i");
    icon.className = `bi ${safe ? "bi-check-circle-fill" : "bi-x-circle-fill"}`;
    icon.setAttribute("aria-label", safe ? "Safe" : "Unsafe");

    const url = document.createElement("span");
    url.textContent = check.url;

    item.append(icon, url);
    list.appendChild(item);
  });

  historyElement.appendChild(list);

  if (checks.length > INITIAL_COUNT) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-success btn-sm d-block mx-auto mt-2";
    button.textContent = "Show more";
    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";

      list.querySelectorAll("li").forEach((item, index) => {
        if (index >= INITIAL_COUNT) {
          item.classList.toggle("d-none", expanded);
        }
      });

      button.textContent = expanded ? "Show more" : "Show less";
      button.setAttribute("aria-expanded", String(!expanded));
    });

    historyElement.appendChild(button);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const snapshot = await getDocs(
      collection(db, "users", user.uid, "linkChecks"),
    );

    counterElement.textContent = snapshot.size;

    if (snapshot.empty) {
      showMessage("No link history yet.");
      return;
    }

    // Newest first
    const checks = snapshot.docs
      .map((doc) => doc.data())
      .sort(
        (a, b) =>
          (b.checkedAt?.toMillis?.() ?? 0) - (a.checkedAt?.toMillis?.() ?? 0),
      );

    renderHistory(checks);
  } catch (error) {
    console.error("Error loading link history:", error);
    showMessage("Could not load your link history.");
  }
});
