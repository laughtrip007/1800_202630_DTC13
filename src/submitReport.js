import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const form = document.getElementById("addReportForm");
const submitBtn = document.getElementById("submitReportBtn");

let currentUser = null;

onAuthReady((user) => {
  currentUser = user;
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

  const newReport = {
    query: queryText,
    details: details,
    owner: currentUser.uid,
    ownerName: currentUser.displayName || currentUser.email,
    last_updated: serverTimestamp(),
  };

  submitBtn.disabled = true;
  try {
    await addDoc(collection(db, "scamReports"), newReport);
    location.href = "scam_reports.html";
  } catch (error) {
    alert(`Error saving report:\n${error.code || ""}\n${error.message || error}`);
    submitBtn.disabled = false;
  }
}

form.addEventListener("submit", saveReport);
