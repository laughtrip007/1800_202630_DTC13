import { onAuthReady, logoutUser } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { doc, getDoc, collection, query, where, getCountFromServer } from "firebase/firestore";

onAuthReady(async (user) => {
  if (!user) return; // app.js redirects logged-out users to login.html

  document.querySelector("#profileEmail").textContent = user.email;
  document.querySelector("#profileSince").textContent = new Date(
    user.metadata.creationTime,
  ).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const name = userDoc.exists() ? userDoc.data().name : user.displayName;
    document.querySelector("#profileName").textContent = name || "SafeLink user";

    const checks = await getCountFromServer(
      query(collection(db, "linkChecks"), where("userID", "==", user.uid)),
    );
    document.querySelector("#profileChecks").textContent = checks.data().count;
  } catch (error) {
    console.error("Error loading profile:", error);
    document.querySelector("#profileName").textContent = user.displayName || "SafeLink user";
  }
});

document.querySelector("#logoutBtn").addEventListener("click", logoutUser);
