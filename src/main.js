// Import the file that has the authentication helper function we want to use.
// The function we want to use is called "onAuthReady" which returns the login state
import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";

function showName() {
  onAuthReady(async function (user) {
    if (!user) {
      location.href = "index.html";
      return;
    }
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const name = userDoc.exists()
      ? userDoc.data().name
      : user.displayName || user.email;
    document.getElementById("name-goes-here").textContent = name + "!";
  });
}

showName();
