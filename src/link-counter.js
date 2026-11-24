// Firebase setup: db is the Firestore database, auth tells us who's logged in
import { db, auth } from "./firebase-config.js";
// Firestore functions: collection() points to a path, getDocs() fetches all docs in it
import { collection, getDocs } from "firebase/firestore";
// Runs a function whenever the login state changes (sign in, sign out, page load)
import { onAuthStateChanged } from "firebase/auth";

// The counter number and the list area on link-checker.html
const counterElement = document.querySelector("#linkCheckCounter");
const historyElement = document.querySelector("#linkHistory");

// How many checks are visible before the user clicks "Show more"
const INITIAL_COUNT = 4; // checks shown before "Show more"

// Replaces the history area with a single message.
function showMessage(text) {
  historyElement.innerHTML = "";
  const p = document.createElement("p");
  p.className = "text-body-secondary text-center mb-0";
  p.textContent = text;
  historyElement.appendChild(p);
}

// Builds the list of checks. checks is an array of objects with url and result fields.
function renderHistory(checks) {
  historyElement.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "list-unstyled mb-0";

  checks.forEach((check, index) => {
    const item = document.createElement("li");
    // Green for safe, red for anything else (unsafe)
    const safe = check.result === "safe";
    item.className = `${safe ? "text-success" : "text-danger"} fw-semibold mb-2 text-break d-flex gap-2`;

    // Hide any entry past the first INITIAL_COUNT. The button reveals them.
    if (index >= INITIAL_COUNT) {
      item.classList.add("d-none");
    }

    // Check or X icon. aria-label gives screen readers a text description.
    const icon = document.createElement("i");
    icon.className = `bi ${safe ? "bi-check-circle-fill" : "bi-x-circle-fill"}`;
    icon.setAttribute("aria-label", safe ? "Safe" : "Unsafe");

    const url = document.createElement("span");
    url.textContent = check.url;

    item.append(icon, url);
    list.appendChild(item);
  });

  historyElement.appendChild(list);

  // Only show the button if there are hidden entries to reveal
  if (checks.length > INITIAL_COUNT) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-success btn-sm d-block mx-auto mt-2";
    button.textContent = "Show more";
    // Tells screen readers whether the hidden items are currently visible
    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", () => {
      // Read the current state from the button, so the toggle knows what to do
      const expanded = button.getAttribute("aria-expanded") === "true";

      // Show or hide every entry past the first INITIAL_COUNT.
      // toggle(class, force): when force is true, it adds the class (hides);
      // when false, it removes it (shows).
      list.querySelectorAll("li").forEach((item, index) => {
        if (index >= INITIAL_COUNT) {
          item.classList.toggle("d-none", expanded);
        }
      });

      // Flip the button label and its accessibility state
      button.textContent = expanded ? "Show more" : "Show less";
      button.setAttribute("aria-expanded", String(!expanded));
    });

    historyElement.appendChild(button);
  }
}

// Runs when the page loads and whenever the user signs in or out
onAuthStateChanged(auth, async (user) => {
  // No user logged in
  if (!user) return;

  try {
    // Fetch every link check saved under this user's account
    const snapshot = await getDocs(
      collection(db, "users", user.uid, "linkChecks"),
    );

    // The total number of checks, shown under the history heading
    counterElement.textContent = snapshot.size;

    if (snapshot.empty) {
      showMessage("No link history yet.");
      return;
    }

    // Convert each document to its data, then sort newest first.
    // checkedAt is a Firestore timestamp, so toMillis() gives a number to compare.
    // The ?? 0 handles a missing timestamp (for example, a write that hasn't finished yet).
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
