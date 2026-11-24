// An account is an admin if admins/{uid} exists. Those docs are only added by hand
// in the Firebase console; the Firestore rules check the same doc (see FIRESTORE.md).
import { db } from "/src/firebase-config.js";
import { doc, getDoc } from "firebase/firestore";

export async function isAdmin(uid) {
  try {
    return (await getDoc(doc(db, "admins", uid))).exists();
  } catch (error) {
    console.error("Error checking admin:", error);
    return false;
  }
}
