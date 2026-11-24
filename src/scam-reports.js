import { db } from "./firebase-config.js";
import { collection, getDocs } from "firebase/firestore";
import { avatarSrc } from "./avatar.js";
import { loadPublicProfiles, authorAvatar, authorName } from "./public-profile.js";
import { formatDate } from "./format.js";
import { onAuthReady } from "./authentication.js";
import { createSaveButton, setSaveLook } from "./save-button.js";
import { loadSavedIds, setSaved } from "./saved.js";
import { seenCount, hasSeen, setSeen, setSeenLook, createSeenButton } from "./seen.js";

const reportList = document.getElementById("reportList");
const searchInput = document.getElementById("searchInput");

let allReports = []; // { id, data } so "I've seen this" can update data.seenBy in place
let sortBy = "newest";
let currentUser = null;
let savedIds = new Set(); // reports I saved (users/{uid}.savedReports)
let loaded = false; // reports have been read; until then the list keeps "Loading…" or the error

onAuthReady(async (user) => {
  currentUser = user;
  if (user === null) return;
  try {
    savedIds = await loadSavedIds(user.uid, "savedReports");
  } catch (error) {
    console.error("Error loading saved reports:", error);
  }
  showReports();
});

async function toggleSave(id, report, saveBtn) {
  if (currentUser === null) {
    alert("Please log in to save a report.");
    return;
  }
  const { name, query } = reportFields(report);
  const wasSaved = savedIds.has(id);
  saveBtn.disabled = true;
  try {
    const item = { title: query, text: "Reported by " + name, href: "scam-query.html?id=" + id };
    await setSaved(currentUser.uid, "savedReports", id, wasSaved ? null : item);
    if (wasSaved) savedIds.delete(id);
    else savedIds.add(id);
    setSaveLook(saveBtn, !wasSaved);
  } catch (error) {
    alert(`Error saving report:\n${error.code || ""}\n${error.message || error}`);
  } finally {
    saveBtn.disabled = false;
  }
}

// marks or unmarks "I've seen this"; updates the button only, so the list doesn't jump
async function toggleSeen(id, report, seenBtn) {
  if (currentUser === null) {
    alert("Please log in first.");
    return;
  }
  const uid = currentUser.uid;
  const wasSeen = hasSeen(report, uid);
  seenBtn.disabled = true;
  try {
    await setSeen(id, uid, !wasSeen);
    report.seenBy = { ...(report.seenBy || {}) };
    if (wasSeen) delete report.seenBy[uid];
    else report.seenBy[uid] = true;
    setSeenLook(seenBtn, seenCount(report), !wasSeen);
  } catch (error) {
    alert(`Error saving:\n${error.code || ""}\n${error.message || error}`);
  } finally {
    seenBtn.disabled = false;
  }
}

// older reports used owner/username/message instead of ownerId/ownerName/details.
// The name is the author's current one (publicProfiles), or the copy in the report.
function reportFields(report) {
  return {
    name: authorName(report.ownerId || report.owner, report.ownerName || report.username),
    query: report.query || "Untitled report",
    details: report.details || report.message || "",
  };
}

function createReportCard(id, report) {
  const { name, query } = reportFields(report);

  const card = document.createElement("article");
  card.className = "card border-0 shadow-sm mb-3";

  const body = document.createElement("div");
  body.className = "card-body";

  // avatar + name + date
  const header = document.createElement("div");
  header.className = "d-flex align-items-center gap-3 mb-2";

  const avatar = document.createElement("img");
  avatar.className = "avatar rounded-circle flex-shrink-0";
  avatar.src = avatarSrc(authorAvatar(report.ownerId || report.owner, report.ownerAvatar));
  avatar.alt = "";
  avatar.width = 40;
  avatar.height = 40;

  const nameAndDate = document.createElement("div");
  const author = document.createElement("p");
  author.className = "fw-bold mb-0";
  author.textContent = name;
  const date = document.createElement("small");
  date.className = "text-body-secondary d-block";
  date.textContent = formatDate(report.createdAt || report.last_updated);
  nameAndDate.append(author, date);
  header.append(avatar, nameAndDate);

  // only the title here; the details are on the report page
  const title = document.createElement("h2");
  title.className = "h5 fw-bold text-break mb-3";
  title.textContent = query;

  // "I've seen this" on the left, Save + View post on the right
  const linkRow = document.createElement("div");
  linkRow.className = "d-flex flex-wrap align-items-center gap-2";

  const uid = currentUser?.uid;
  const isOwner = uid != null && (report.ownerId || report.owner) === uid;
  const seenBtn = createSeenButton(seenCount(report), hasSeen(report, uid), isOwner);
  if (!isOwner) seenBtn.addEventListener("click", () => toggleSeen(id, report, seenBtn));
  linkRow.appendChild(seenBtn);

  const saveBtn = createSaveButton(savedIds.has(id));
  saveBtn.classList.add("ms-auto");
  saveBtn.addEventListener("click", () => toggleSave(id, report, saveBtn));
  linkRow.appendChild(saveBtn);

  const link = document.createElement("a");
  link.className = "btn btn-outline-success btn-sm";
  link.href = "scam-query.html?id=" + encodeURIComponent(id);
  link.textContent = "View post";
  linkRow.appendChild(link);

  body.append(header, title, linkRow);
  card.appendChild(body);
  return card;
}

// shows the reports that contain the keyword (all of them if the box is empty)
function showReports() {
  // auth can finish first: don't show "No reports yet" (or hide an error) before the list arrives
  if (!loaded) return;
  const keyword = searchInput.value.trim().toLowerCase();

  const reports = allReports.filter((r) => {
    const { name, query, details } = reportFields(r.data);
    return (name + " " + query + " " + details).toLowerCase().includes(keyword);
  });

  // allReports is newest first already
  if (sortBy === "oldest") reports.reverse();
  if (sortBy === "seen") reports.sort((a, b) => seenCount(b.data) - seenCount(a.data));

  reportList.innerHTML = "";

  if (reports.length === 0) {
    const p = document.createElement("p");
    p.className = "text-body-secondary text-center";
    p.textContent =
      keyword === "" ? "No reports yet. Be the first to submit one!" : "No reports match your search.";
    reportList.appendChild(p);
    return;
  }

  reports.forEach((r) => reportList.appendChild(createReportCard(r.id, r.data)));
}

async function loadReports() {
  try {
    const snapshot = await getDocs(collection(db, "scamReports"));

    // newest first; sorted here so reports without a date still show
    const time = (d) => (d.data().createdAt ?? d.data().last_updated)?.toMillis?.() ?? 0;
    allReports = snapshot.docs
      .sort((a, b) => time(b) - time(a))
      .map((d) => ({ id: d.id, data: d.data() }));
    await loadPublicProfiles(allReports.map((r) => r.data.ownerId || r.data.owner));

    loaded = true;
    showReports();
  } catch (error) {
    console.error("Error loading reports:", error);
    reportList.innerHTML = `<p class="text-danger text-center">Could not load reports.</p>`;
  }
}

searchInput.addEventListener("input", showReports);
document.querySelectorAll('input[name="sort"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    sortBy = radio.value;
    showReports();
  });
});

loadReports();
