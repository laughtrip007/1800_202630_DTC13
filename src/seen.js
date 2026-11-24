// "I've seen this" on scam reports: seenBy: { <uid>: true } on the report (see FIRESTORE.md).
// The count shows how many people ran into the same scam, and reports can be sorted by it.
import { db } from "/src/firebase-config.js";
import { doc, updateDoc, deleteField } from "firebase/firestore";

export function seenCount(report) {
  return Object.keys(report.seenBy || {}).length;
}

export function hasSeen(report, uid) {
  return uid != null && Object.hasOwn(report.seenBy || {}, uid);
}

// "seenBy.<uid>" only touches my entry, the rules check that
export async function setSeen(reportId, uid, seen) {
  await updateDoc(doc(db, "scamReports", reportId), {
    ["seenBy." + uid]: seen ? true : deleteField(),
  });
}

export function setSeenLook(btn, count, seen) {
  btn.querySelector("i").className = seen ? "bi bi-people-fill" : "bi bi-people";
  btn.querySelector("span").textContent = "I've seen this (" + count + ")";
  btn.classList.toggle("btn-success", seen);
  btn.classList.toggle("btn-outline-success", !seen);
  btn.setAttribute("aria-pressed", String(seen));
}

// isOwner: the author can't mark their own report, but still sees the count
export function createSeenButton(count, seen, isOwner) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm d-inline-flex align-items-center gap-1";
  const icon = document.createElement("i");
  icon.setAttribute("aria-hidden", "true");
  btn.append(icon, document.createElement("span"));
  setSeenLook(btn, count, seen);
  if (isOwner) {
    btn.disabled = true;
    btn.title = "People who ran into the same scam";
  } else {
    btn.title = "Tap if you ran into the same scam";
  }
  return btn;
}
