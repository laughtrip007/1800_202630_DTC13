import { db } from "./firebase-config.js";
import { onAuthReady } from "./authentication.js";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { DEFAULT_NAME, loadMyProfile, setPublicProfile } from "./public-profile.js";

const form = document.getElementById("addReportForm");
const submitBtn = document.getElementById("submitReportBtn");

let currentUser = null;
// my name and avatar (from my users doc), loaded in the background and copied into the report
let myProfilePromise = Promise.resolve({ name: DEFAULT_NAME, avatar: null });

onAuthReady((user) => {
  currentUser = user;
  if (user) {
    myProfilePromise = loadMyProfile(user.uid).catch(() => ({
      name: user.displayName || DEFAULT_NAME,
      avatar: null,
    }));
  }
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
  const me = await myProfilePromise;

  // make the id first so the user's postedReports entry can use the same one
  const reportRef = doc(collection(db, "scamReports"));
  const batch = writeBatch(db);

  batch.set(reportRef, {
    query: queryText,
    details: details,
    ownerId: uid,
    ownerName: me.name,
    ownerAvatar: me.avatar,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", uid, "postedReports", reportRef.id), {
    title: queryText,
    href: "scam-query.html?id=" + reportRef.id,
    createdAt: serverTimestamp(),
  });
  // keep my public name/avatar current, so the report shows them
  setPublicProfile(batch, uid, me);

  try {
    await batch.commit();
    location.href = "scam-reports.html";
  } catch (error) {
    alert(`Error saving report:\n${error.code || ""}\n${error.message || error}`);
    submitBtn.disabled = false;
  }
}

form.addEventListener("submit", saveReport);
