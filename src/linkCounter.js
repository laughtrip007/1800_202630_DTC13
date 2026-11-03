import { db, auth } from "./firebaseConfig.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const counterElement = document.querySelector("#linkCheckCounter");
const historyElement = document.querySelector("#linkHistory");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    counterElement.textContent = "0";
    return;
  }

     console.log("Current User:", user.uid);
  try {
    // Get current user's link checks
    const q = query(
      collection(db, "linkChecks"),
      where("userID", "==", user.uid),
    );

      const snapshot = await getDocs(q);
      
      console.log("Documents Found:", snapshot.size);

    // Counter
    counterElement.textContent = snapshot.size;

    // Clear placeholder text
    historyElement.innerHTML = "";

    // Store docs in array for sorting
    const checks = [];

    snapshot.forEach((doc) => {
      checks.push(doc.data());
    });


    // Show latest 5
    checks.slice(0, 5).forEach((check) => {
      const item = document.createElement("div");

      if (check.result === "safe") {
        item.className = "text-success fw-semibold mb-2";
        item.textContent = `✅ ${check.url}`;
      } else {
        item.className = "text-danger fw-semibold mb-2";
        item.textContent = `❌ ${check.url}`;
      }

      historyElement.appendChild(item);
    });

    // No history fallback
    if (checks.length === 0) {
      historyElement.innerHTML = `
        <p class="text-muted text-center">
          No link history yet.
        </p>
      `;
    }
  } catch (error) {
    console.error("Error loading link history:", error);
  }
});
