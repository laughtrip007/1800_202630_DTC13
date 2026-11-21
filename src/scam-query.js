import { db } from "./firebase-config.js";
import { onAuthReady } from "./authentication.js";
import { doc, onSnapshot, writeBatch } from "firebase/firestore";
import { avatarSrc } from "./avatar.js";
import { loadPublicProfiles, authorAvatar, authorName } from "./public-profile.js";
import { formatDate } from "./format.js";
import { createSaveButton, setSaveLook } from "./save-button.js";
import { loadSavedIds, setSaved } from "./saved.js";
import { confirmDialog } from "./confirm-dialog.js";
import { seenCount, hasSeen, setSeen, setSeenLook, createSeenButton } from "./seen.js";

const deleteBtn = document.getElementById("deleteBtn");
const id = new URLSearchParams(location.search).get("id");

let currentUser = null;
let report = null;
let saved = false;

// Save/Saved button, shown once the report and the user are both loaded
const saveBtn = createSaveButton(false);
saveBtn.classList.add("d-none");
document.getElementById("reportActions").prepend(saveBtn);

function showSaveButton() {
  saveBtn.classList.toggle("d-none", currentUser === null || report === null);
}

// "I've seen this": count from the live report, so it updates when others tap it too
const seenBtn = createSeenButton(0, false, false);
seenBtn.classList.add("d-none");
document.getElementById("reportActions").prepend(seenBtn);

function showSeenButton() {
  seenBtn.classList.toggle("d-none", currentUser === null || report === null);
  if (currentUser === null || report === null) return;
  const isOwner = (report.ownerId || report.owner) === currentUser.uid;
  setSeenLook(seenBtn, seenCount(report), hasSeen(report, currentUser.uid));
  seenBtn.disabled = isOwner;
  seenBtn.title = isOwner ? "People who ran into the same scam" : "Tap if you ran into the same scam";
}

async function toggleSeen() {
  seenBtn.disabled = true;
  try {
    // onSnapshot redraws the button with the new count
    await setSeen(id, currentUser.uid, !hasSeen(report, currentUser.uid));
  } catch (error) {
    alert(`Error saving:\n${error.code || ""}\n${error.message || error}`);
    seenBtn.disabled = false;
  }
}

// older reports used owner/username instead of ownerId/ownerName
function ownerOf(r) {
  return r.ownerId || r.owner;
}
function ownerName(r) {
  return authorName(ownerOf(r), r.ownerName || r.username);
}

// only the owner can delete
function showDeleteButton() {
  const ownerId = report?.ownerId || report?.owner;
  const isOwner = currentUser !== null && ownerId === currentUser.uid;
  deleteBtn.classList.toggle("d-none", !isOwner);
}

onAuthReady(async (user) => {
  currentUser = user;
  showDeleteButton();
  showSeenButton();
  if (user === null) return;
  try {
    saved = (await loadSavedIds(user.uid, "savedReports")).has(id);
    setSaveLook(saveBtn, saved);
  } catch (error) {
    console.error("Error loading saved reports:", error);
  }
  showSaveButton();
});

async function toggleSave() {
  saveBtn.disabled = true;
  try {
    const item = {
      title: report.query || "Untitled report",
      text: "Reported by " + ownerName(report),
      href: "scam-query.html?id=" + id,
    };
    await setSaved(currentUser.uid, "savedReports", id, saved ? null : item);
    saved = !saved;
    setSaveLook(saveBtn, saved);
  } catch (error) {
    alert(`Error saving report:\n${error.code || ""}\n${error.message || error}`);
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteReport() {
  const ok = await confirmDialog({
    title: "Delete this report?",
    message: "It will be removed for everyone. This can't be undone.",
  });
  if (!ok) return;

  deleteBtn.disabled = true;
  try {
    // the report and its entry in my postedReports go together
    const batch = writeBatch(db);
    batch.delete(doc(db, "scamReports", id));
    batch.delete(doc(db, "users", currentUser.uid, "postedReports", id));
    await batch.commit();
    location.href = "scam-reports.html";
  } catch (error) {
    alert(`Error deleting report:\n${error.code || ""}\n${error.message || error}`);
    deleteBtn.disabled = false;
  }
}

// the copies in the report first, then the author's current name and picture
async function showOwner(shown) {
  const img = document.getElementById("ownerAvatar");
  const name = document.getElementById("username_goes_here");
  const draw = () => {
    img.src = avatarSrc(authorAvatar(ownerOf(shown), shown.ownerAvatar));
    name.textContent = ownerName(shown);
  };
  draw();
  await loadPublicProfiles([ownerOf(shown)]);
  if (report === shown) draw();
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
        showSaveButton();
        showSeenButton();
        return;
      }

      // older reports used username/message instead of ownerName/details
      report = docSnap.data();
      document.getElementById("query_goes_here").textContent = report.query || "Untitled report";
      document.getElementById("date_goes_here").textContent = formatDate(
        report.createdAt || report.last_updated,
      );
      document.getElementById("message_goes_here").textContent = report.details || report.message || "";
      showOwner(report);
      showDeleteButton();
      showSaveButton();
      showSeenButton();
    },
    (error) => {
      console.error("failed reading the document", error);
    },
  );
}

deleteBtn.addEventListener("click", deleteReport);
saveBtn.addEventListener("click", toggleSave);
seenBtn.addEventListener("click", toggleSeen);

showReport();
