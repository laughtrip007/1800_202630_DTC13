import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";

// Show the user's name in the welcome message
onAuthReady(async (user) => {
  if (!user) return; // app.js redirects logged-out users to login.html

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const name = userDoc.exists() ? userDoc.data().name : user.displayName || user.email;
  document.getElementById("name-goes-here").textContent = name + "!";
});
