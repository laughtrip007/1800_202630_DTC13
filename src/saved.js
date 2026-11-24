// Saving a post or report = keeping a copy in a map field on users/{uid}
// (savedReports / savedHelp, see FIRESTORE.md). Profile lists them.
import { db } from "/src/firebase-config.js";
import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from "firebase/firestore";

// ids of everything I saved in this field
export async function loadSavedIds(uid, field) {
  const data = (await getDoc(doc(db, "users", uid))).data() || {};
  return new Set(Object.keys(data[field] || {}));
}

// item = { title, text, href } to save, or null to unsave
export async function setSaved(uid, field, id, item) {
  const userRef = doc(db, "users", uid);
  if (item) {
    // merge, so it also works if the user doc doesn't exist yet
    await setDoc(userRef, { [field]: { [id]: { ...item, savedAt: serverTimestamp() } } }, { merge: true });
  } else {
    await updateDoc(userRef, { [field + "." + id]: deleteField() });
  }
}
