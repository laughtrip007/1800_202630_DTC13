import { onAuthReady, logoutUser } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { createSaveButton, setSaveLook } from "/src/saveButton.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";

// saved items: users/{uid}/savedReports and users/{uid}/savedHelp
// fields: title, text, href, savedAt

function formatDate(timestamp) {
  const date = timestamp?.toDate?.();
  return date ? date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "";
}

function renderList(key, items, emptyMessage, buildItem) {
  document.querySelector(`#${key}Count`).textContent = items.length;
  const container = document.querySelector(`#${key}List`);
  container.innerHTML = "";

  if (items.length === 0) {
    const p = document.createElement("p");
    p.className = "text-body-secondary mb-0";
    p.textContent = emptyMessage;
    container.appendChild(p);
    return;
  }

  const list = document.createElement("div");
  list.className = "list-group list-group-flush";
  items.forEach((item) => list.appendChild(buildItem(item)));
  container.appendChild(list);
}

function showError(key) {
  document.querySelector(`#${key}Count`).textContent = "!";
  document.querySelector(`#${key}List`).innerHTML =
    `<p class="text-danger mb-0">Could not load this list.</p>`;
}

function buildCheckItem(check) {
  const safe = check.result === "safe";
  const row = document.createElement("div");
  row.className = "list-group-item px-0 d-flex gap-2";

  const icon = document.createElement("i");
  icon.className = `bi ${safe ? "bi-check-circle-fill text-success" : "bi-x-circle-fill text-danger"}`;
  icon.setAttribute("aria-label", safe ? "Safe" : "Unsafe");

  const body = document.createElement("div");
  body.className = "text-break";
  const url = document.createElement("div");
  url.className = "fw-semibold";
  url.textContent = check.url;
  const date = document.createElement("small");
  date.className = "text-body-secondary";
  date.textContent = formatDate(check.checkedAt);
  body.append(url, date);

  row.append(icon, body);
  return row;
}

// onToggle is optional: when given, the row gets a Save/Saved button
function buildSavedItem(item, onToggle) {
  const row = document.createElement("div");
  row.className = "list-group-item px-0 d-flex align-items-start gap-2 position-relative";
  if (item.href) row.classList.add("list-group-item-action");

  const body = document.createElement("div");
  body.className = "flex-grow-1";
  body.style.minWidth = "0";

  // stretched-link makes the whole row clickable, but a button can't go inside <a>
  const title = document.createElement(item.href ? "a" : "div");
  title.className = "fw-semibold d-block text-reset text-decoration-none";
  title.textContent = item.title || "Untitled";
  if (item.href) {
    title.href = item.href;
    title.classList.add("stretched-link");
  }
  body.appendChild(title);

  if (item.text) {
    const text = document.createElement("p");
    text.className = "small text-body-secondary mb-1 text-truncate-2";
    text.textContent = item.text;
    body.appendChild(text);
  }

  const date = document.createElement("small");
  date.className = "text-body-secondary";
  date.textContent = item.savedAt ? `Saved ${formatDate(item.savedAt)}` : "";
  body.appendChild(date);

  row.appendChild(body);

  if (onToggle) {
    // same Save/Saved button as Community Help; z-2 keeps it above the stretched link
    const saveBtn = createSaveButton(item.saved);
    saveBtn.classList.add("flex-shrink-0", "position-relative", "z-2");
    saveBtn.addEventListener("click", async () => {
      await onToggle(item, saveBtn);
      // unsaved items stay in the list (faded) so they can be saved again
      body.classList.toggle("opacity-50", !item.saved);
    });
    row.appendChild(saveBtn);
  }

  return row;
}

async function loadLinkChecks(uid) {
  try {
    const snapshot = await getDocs(query(collection(db, "linkChecks"), where("userID", "==", uid)));
    const checks = snapshot.docs
      .map((d) => d.data())
      .sort((a, b) => (b.checkedAt?.toMillis?.() ?? 0) - (a.checkedAt?.toMillis?.() ?? 0));
    renderList("checks", checks, "You haven't checked any links yet.", buildCheckItem);
  } catch (error) {
    console.error("Error loading link checks:", error);
    showError("checks");
  }
}

// canUnsave: show a Save/Saved button on each item
async function loadSaved(uid, subcollection, key, emptyMessage, canUnsave = false) {
  let items = [];

  // unsave deletes the doc; saving again writes the original data back (same savedAt, same order)
  async function toggleSaved(item, saveBtn) {
    const ref = doc(db, "users", uid, subcollection, item.id);
    saveBtn.disabled = true;
    try {
      if (item.saved) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, item.data);
      }
      item.saved = !item.saved;
      setSaveLook(saveBtn, item.saved);
      document.querySelector(`#${key}Count`).textContent = items.filter((i) => i.saved).length;
    } catch (error) {
      console.error(`Error updating ${subcollection}:`, error);
      alert("Could not update your saved list. Please try again.");
    } finally {
      saveBtn.disabled = false;
    }
  }

  try {
    const q = query(collection(db, "users", uid, subcollection), orderBy("savedAt", "desc"));
    const snapshot = await getDocs(q);
    // id = post/report id; data is kept so an unsave can be undone
    items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id, data: d.data(), saved: true }));
    renderList(key, items, emptyMessage, (item) =>
      buildSavedItem(item, canUnsave ? toggleSaved : null),
    );
  } catch (error) {
    console.error(`Error loading ${subcollection}:`, error);
    showError(key);
  }
}

onAuthReady(async (user) => {
  if (!user) return;

  document.querySelector("#profileEmail").textContent = user.email;
  document.querySelector("#profileSince").textContent = new Date(
    user.metadata.creationTime,
  ).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const name = userDoc.exists() ? userDoc.data().name : user.displayName;
    document.querySelector("#profileName").textContent = name || "SafeLink user";
  } catch (error) {
    console.error("Error loading profile:", error);
    document.querySelector("#profileName").textContent = user.displayName || "SafeLink user";
  }

  loadLinkChecks(user.uid);
  loadSaved(user.uid, "savedReports", "reports", "No saved scam reports yet.");
  loadSaved(user.uid, "savedHelp", "help", "No saved help pages yet.", true);
});

document.querySelector("#logoutBtn").addEventListener("click", logoutUser);
