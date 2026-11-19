import { onAuthReady, logoutUser } from "/src/authentication.js";
import { db } from "/src/firebase-config.js";
import { createSaveButton, setSaveLook } from "/src/save-button.js";
import { avatarSrc } from "/src/avatar.js";
import { createAvatarPicker } from "/src/avatar-picker.js";
import { isAdmin } from "/src/admin-check.js";
import { formatDate } from "/src/format.js";
import {
  DEFAULT_NAME,
  MAX_NAME_LENGTH,
  profileFromUserData,
  syncPublicProfile,
} from "/src/public-profile.js";
import { Modal } from "bootstrap";
import { updateProfile } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  writeBatch,
} from "firebase/firestore";

// data layout: see FIRESTORE.md
// saved items: savedReports / savedHelp map fields on users/{uid}
// link checks: users/{uid}/linkChecks
// my posts: users/{uid}/postedReports and postedHelp

const CHECKS_SHOWN = 20; // link checks listed before "Show all"

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

// items saved before the pages were renamed still have the old file names
const OLD_PAGES = {
  "scam_query.html": "scam-query.html",
  "community_help.html": "community-help.html",
};

function fixOldHref(href) {
  const page = href.split(/[?#]/)[0];
  return Object.hasOwn(OLD_PAGES, page) ? OLD_PAGES[page] + href.slice(page.length) : href;
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
    title.href = fixOldHref(item.href);
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

// latest 20 link checks (all of them after "Show all"); the badge shows the total
async function loadLinkChecks(uid, showAll = false) {
  try {
    const checksRef = collection(db, "users", uid, "linkChecks");
    const newestFirst = [orderBy("checkedAt", "desc")];
    if (!showAll) newestFirst.push(limit(CHECKS_SHOWN));
    const [countSnap, snapshot] = await Promise.all([
      getCountFromServer(checksRef),
      getDocs(query(checksRef, ...newestFirst)),
    ]);
    const checks = snapshot.docs.map((d) => d.data());
    const total = countSnap.data().count;

    renderList("checks", checks, "You haven't checked any links yet.", buildCheckItem);
    document.querySelector("#checksCount").textContent = total;

    if (total > checks.length) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "btn btn-link btn-sm text-success fw-semibold px-0 mt-2";
      more.textContent = "Show all " + total;
      more.addEventListener("click", () => {
        more.disabled = true;
        loadLinkChecks(uid, true);
      });
      document.querySelector("#checksList").appendChild(more);
    }
  } catch (error) {
    console.error("Error loading link checks:", error);
    showError("checks");
  }
}

// one thing I posted (from postedReports / postedHelp): title linking to it, and the date
function buildPostedItem(item) {
  const row = document.createElement("div");
  row.className = "list-group-item list-group-item-action px-0 position-relative";

  const title = document.createElement("a");
  title.className = "fw-semibold d-block text-reset text-decoration-none stretched-link text-break";
  title.href = fixOldHref(item.href || "#");
  title.textContent = item.title || "Untitled";

  const date = document.createElement("small");
  date.className = "text-body-secondary";
  date.textContent = item.createdAt ? "Posted " + formatDate(item.createdAt) : "";

  row.append(title, date);
  return row;
}

// my reports or questions, newest first
async function loadPosted(uid, subcollection, key, emptyMessage) {
  try {
    const q = query(collection(db, "users", uid, subcollection), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    renderList(key, snapshot.docs.map((d) => d.data()), emptyMessage, buildPostedItem);
  } catch (error) {
    console.error(`Error loading ${subcollection}:`, error);
    showError(key);
  }
}

// which collection each saved map points to
const SAVED_SOURCES = { savedReports: "scamReports", savedHelp: "helpPosts" };

// A saved item is only a copy, so it stays after the post itself is deleted (by its
// author or an admin). Drops those from the map, and from the user doc too.
async function removeDeletedSaves(userRef, savedMap, field) {
  const ids = Object.keys(savedMap || {});
  const checks = await Promise.all(
    ids.map(async (id) => {
      try {
        return (await getDoc(doc(db, SAVED_SOURCES[field], id))).exists();
      } catch {
        return true; // couldn't check: keep it
      }
    }),
  );
  const gone = ids.filter((id, i) => !checks[i]);
  if (gone.length === 0) return savedMap;

  try {
    await updateDoc(
      userRef,
      Object.fromEntries(gone.map((id) => [field + "." + id, deleteField()])),
    );
  } catch (error) {
    console.error(`Error cleaning up ${field}:`, error);
  }
  return Object.fromEntries(Object.entries(savedMap).filter(([id]) => !gone.includes(id)));
}

// saved items are a map field on the user doc: { <id>: { title, text, href, savedAt } }
// canUnsave: show a Save/Saved button on each item
async function showSaved(uid, savedMap, field, key, emptyMessage, canUnsave = false) {
  const userRef = doc(db, "users", uid);
  savedMap = await removeDeletedSaves(userRef, savedMap, field);

  // id = post/report id; data is kept so an unsave can be undone (same savedAt, same order)
  const items = Object.entries(savedMap || {})
    .map(([id, data]) => ({ ...data, id: id, data: data, saved: true }))
    .sort((a, b) => (b.savedAt?.toMillis?.() ?? 0) - (a.savedAt?.toMillis?.() ?? 0));

  async function toggleSaved(item, saveBtn) {
    const path = field + "." + item.id;
    saveBtn.disabled = true;
    try {
      await updateDoc(userRef, { [path]: item.saved ? deleteField() : item.data });
      item.saved = !item.saved;
      setSaveLook(saveBtn, item.saved);
      document.querySelector(`#${key}Count`).textContent = items.filter((i) => i.saved).length;
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      alert("Could not update your saved list. Please try again.");
    } finally {
      saveBtn.disabled = false;
    }
  }

  renderList(key, items, emptyMessage, (item) =>
    buildSavedItem(item, canUnsave ? toggleSaved : null),
  );
}

// profile picture: the avatar field on users/{uid}, changed through the picker modal
function setUpAvatar(uid, initialAvatar) {
  const avatarImg = document.querySelector("#profileAvatar");
  let avatar = null;

  function show(newAvatar) {
    avatar = newAvatar;
    avatarImg.src = avatarSrc(avatar);
  }

  const picker = createAvatarPicker({ uid, onSaved: show });
  document.querySelector("#avatarBtn").addEventListener("click", () => picker.open(avatar));
  show(initialAvatar);
}

// name: users/{uid}.name, publicProfiles/{uid}.name (so posts show it) and the login's displayName
function setUpNameEditor(user, initialName) {
  const nameEl = document.querySelector("#profileName");
  const modalEl = document.querySelector("#nameModal");
  const modal = Modal.getOrCreateInstance(modalEl);
  const form = document.querySelector("#nameForm");
  const input = document.querySelector("#nameInput");
  const errorEl = document.querySelector("#nameError");
  const saveBtn = document.querySelector("#nameSave");
  let name = initialName;

  function showNameError(text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
  }

  document.querySelector("#editNameBtn").addEventListener("click", () => {
    input.value = name;
    showNameError("");
    modal.show();
  });
  modalEl.addEventListener("shown.bs.modal", () => input.focus());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = input.value.trim().replace(/\s+/g, " ");
    if (newName === "") {
      showNameError("Please enter a name.");
      return;
    }
    if (newName.length > MAX_NAME_LENGTH) {
      showNameError(`Please keep it under ${MAX_NAME_LENGTH} characters.`);
      return;
    }

    saveBtn.disabled = true;
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", user.uid), { name: newName }, { merge: true });
      batch.set(doc(db, "publicProfiles", user.uid), { name: newName }, { merge: true });
      await batch.commit();
      await updateProfile(user, { displayName: newName });
      name = newName;
      nameEl.textContent = newName;
      modal.hide();
    } catch (error) {
      console.error("Error saving name:", error);
      showNameError("Could not save your name. Please try again.");
    } finally {
      saveBtn.disabled = false;
    }
  });
}

onAuthReady(async (user) => {
  if (!user) return;

  document.querySelector("#profileEmail").textContent = user.email;
  document.querySelector("#profileSince").textContent = new Date(
    user.metadata.creationTime,
  ).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  loadLinkChecks(user.uid);
  loadPosted(user.uid, "postedReports", "myReports", "You haven't reported any scams yet.");
  loadPosted(user.uid, "postedHelp", "myHelp", "You haven't asked any questions yet.");

  isAdmin(user.uid).then((admin) => {
    document.querySelector("#adminLink").classList.toggle("d-none", !admin);
  });

  // one read gives the name, the avatar and both saved lists
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const data = userDoc.data() || {};
    const profile = profileFromUserData(data);
    document.querySelector("#profileName").textContent = profile.name;
    setUpNameEditor(user, profile.name);
    setUpAvatar(user.uid, profile.avatar);

    // make sure everyone sees my current name and picture on my posts (fixes older accounts)
    syncPublicProfile(user.uid, profile).catch((error) =>
      console.error("Error updating public profile:", error),
    );

    showSaved(user.uid, data.savedReports, "savedReports", "reports", "No saved scam reports yet.", true);
    showSaved(user.uid, data.savedHelp, "savedHelp", "help", "No saved help pages yet.", true);
  } catch (error) {
    console.error("Error loading profile:", error);
    document.querySelector("#profileName").textContent = user.displayName || DEFAULT_NAME;
    document.querySelector("#editNameBtn").classList.add("d-none");
    setUpAvatar(user.uid, null);
    showError("reports");
    showError("help");
  }
});

document.querySelector("#logoutBtn").addEventListener("click", logoutUser);
