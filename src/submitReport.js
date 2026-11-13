import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { loadAvatar } from "./avatar.js";

const form = document.getElementById("addReportForm");
const submitBtn = document.getElementById("submitReportBtn");

let currentUser = null;
// my avatar, loaded in the background and copied into the report
let myAvatarPromise = Promise.resolve(null);

onAuthReady((user) => {
  currentUser = user;
  if (user) myAvatarPromise = loadAvatar(user.uid).catch(() => null);
});

async function saveReport(event) {
  event.preventDefault();

  const queryText = document.getElementById("queryInput").value.trim();
  const details = document.getElementById("detailsInput").value.trim();

  if (currentUser === null) {
    alert("Please log in to submit a report.");
    return;
  }

  if (queryText === "" || details === "") {
    alert("Please fill in both fields.");
    return;
  }

  submitBtn.disabled = true;
  const uid = currentUser.uid;
  const ownerAvatar = await myAvatarPromise;

  // make the id first so the user's postedReports entry can use the same one
  const reportRef = doc(collection(db, "scamReports"));
  const batch = writeBatch(db);

  batch.set(reportRef, {
    query: queryText,
    details: details,
    ownerId: uid,
    ownerName: currentUser.displayName || currentUser.email,
    ownerAvatar: ownerAvatar,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", uid, "postedReports", reportRef.id), {
    title: queryText,
    href: "scam_query.html?id=" + reportRef.id,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    location.href = "scam_reports.html";
  } catch (error) {
    alert(`Error saving report:\n${error.code || ""}\n${error.message || error}`);
    submitBtn.disabled = false;
  }
}

form.addEventListener("submit", saveReport);
