import { db } from "./firebase-config.js";
import { onAuthReady } from "./authentication.js";
import { doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { avatarSrc } from "./avatar.js";

const deleteBtn = document.getElementById("deleteBtn");
const id = new URLSearchParams(location.search).get("id");

let currentUser = null;
let report = null;

// shows the date like "Nov 16, 2026"
function formatDate(timestamp) {
  const date = timestamp?.toDate?.();
  return date
    ? date.toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
}

// only the owner can delete
function showDeleteButton() {
  const ownerId = report?.ownerId || report?.owner;
  const isOwner = currentUser !== null && ownerId === currentUser.uid;
  deleteBtn.classList.toggle("d-none", !isOwner);
}

onAuthReady((user) => {
  currentUser = user;
  showDeleteButton();
});

async function deleteReport() {
  if (!confirm("Delete this report?")) return;

  deleteBtn.disabled = true;
  try {
    await deleteDoc(doc(db, "scamReports", id));
    location.href = "scam-reports.html";
  } catch (error) {
    alert(`Error deleting report:\n${error.code || ""}\n${error.message || error}`);
    deleteBtn.disabled = false;
  }
}

function showReport() {
  if (!id) {
    location.replace("scam-reports.html");
    return;
  }

  onSnapshot(
    doc(db, "scamReports", id),
    (docSnap) => {
      if (!docSnap.exists()) {
        report = null;
        document.getElementById("username_goes_here").textContent = "Report not found";
        document.getElementById("query_goes_here").textContent = "This report may have been deleted.";
        document.getElementById("date_goes_here").textContent = "";
        document.getElementById("message_goes_here").textContent = "";
        showDeleteButton();
        return;
      }

      // older reports used username/message instead of ownerName/details
      report = docSnap.data();
      document.getElementById("username_goes_here").textContent =
        report.ownerName || report.username || "Anonymous";
      document.getElementById("query_goes_here").textContent = report.query || "Untitled report";
      document.getElementById("date_goes_here").textContent = formatDate(
        report.createdAt || report.last_updated,
      );
      document.getElementById("message_goes_here").textContent = report.details || report.message || "";
      document.getElementById("ownerAvatar").src = avatarSrc(report.ownerAvatar);
      showDeleteButton();
    },
    (error) => {
      console.error("failed reading the document", error);
    },
  );
}

deleteBtn.addEventListener("click", deleteReport);

showReport();
