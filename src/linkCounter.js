import { db, auth } from "./firebaseConfig.js";
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
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
  if (!user) return;

  try {
    // users/{uid}/linkChecks: count all, but only read the latest 5
    const checksRef = collection(db, "users", user.uid, "linkChecks");
    const [countSnap, snapshot] = await Promise.all([
      getCountFromServer(checksRef),
      getDocs(query(checksRef, orderBy("checkedAt", "desc"), limit(5))),
    ]);

    counterElement.textContent = countSnap.data().count;

    if (snapshot.empty) {
      showMessage("No link history yet.");
      return;
    }

    historyElement.innerHTML = "";
    const list = document.createElement("ul");
    list.className = "list-unstyled mb-0";

    snapshot.docs.map((d) => d.data()).forEach((check) => {
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
