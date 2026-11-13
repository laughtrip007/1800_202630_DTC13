import { db } from "./firebaseConfig.js";
import { collection, getDocs } from "firebase/firestore";
import { avatarSrc } from "./avatar.js";

const reportList = document.getElementById("reportList");

// older reports used username/message instead of ownerName/details
function reportFields(report) {
  return {
    name: report.ownerName || report.username || "Anonymous",
    query: report.query || "Untitled report",
    details: report.details || report.message || "",
  };
}

function createReportCard(id, report) {
  const { name, query, details } = reportFields(report);

  const card = document.createElement("article");
  card.className = "card border-0 shadow-sm mb-3";

  const body = document.createElement("div");
  body.className = "card-body d-flex gap-3";

  const avatar = document.createElement("img");
  avatar.className = "avatar rounded-circle";
  avatar.src = avatarSrc(report.ownerAvatar);
  avatar.alt = "";
  avatar.width = 40;
  avatar.height = 40;

  const content = document.createElement("div");
  content.className = "flex-grow-1 text-break";

  const author = document.createElement("h2");
  author.className = "h6 fw-bold mb-0";
  author.textContent = name;

  const title = document.createElement("p");
  title.className = "small text-body-secondary mb-2";
  title.textContent = query;

  const text = document.createElement("p");
  text.className = "card-text text-truncate-2";
  text.textContent = details;

  const linkRow = document.createElement("div");
  linkRow.className = "text-end";
  const link = document.createElement("a");
  link.className = "btn btn-outline-success btn-sm";
  link.href = "scam_query.html?id=" + encodeURIComponent(id);
  link.textContent = "View post";
  linkRow.appendChild(link);

  content.append(author, title, text, linkRow);
  body.append(avatar, content);
  card.appendChild(body);
  return card;
}

async function showReports() {
  try {
    const snapshot = await getDocs(collection(db, "scamReports"));

    // newest first; sorted here so reports without a date still show
    const time = (d) => (d.data().createdAt ?? d.data().last_updated)?.toMillis?.() ?? 0;
    const reports = snapshot.docs.sort((a, b) => time(b) - time(a));

    reportList.innerHTML = "";

    if (reports.length === 0) {
      const p = document.createElement("p");
      p.className = "text-body-secondary text-center";
      p.textContent = "No reports yet. Be the first to submit one!";
      reportList.appendChild(p);
      return;
    }

    reports.forEach((d) => reportList.appendChild(createReportCard(d.id, d.data())));
  } catch (error) {
    console.error("Error loading reports:", error);
    reportList.innerHTML = `<p class="text-danger text-center">Could not load reports.</p>`;
  }
}

showReports();
