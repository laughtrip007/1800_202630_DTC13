// Admin page: pick documents and delete them.
// Only accounts with an admins/{uid} doc can open it, and the Firestore rules check
// the same doc, so for anyone else the reads and deletes here are refused anyway.
import { db } from "/src/firebase-config.js";
import { onAuthReady } from "/src/authentication.js";
import { isAdmin } from "/src/admin-check.js";
import { confirmDialog } from "/src/confirm-dialog.js";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  updateDoc,
  deleteField,
} from "firebase/firestore";

const statusEl = document.querySelector("#adminStatus");
const contentEl = document.querySelector("#adminContent");
const tabButtons = document.querySelectorAll("#adminTabs [data-tab]");
const otherSourceEl = document.querySelector("#otherSource");
const searchEl = document.querySelector("#adminSearch");
const selectAllEl = document.querySelector("#selectAll");
const alsoContentWrap = document.querySelector("#alsoContentWrap");
const alsoContentEl = document.querySelector("#alsoContent");
const refreshBtn = document.querySelector("#refreshBtn");
const deleteBtn = document.querySelector("#deleteSelectedBtn");
const countEl = document.querySelector("#adminCount");
const listEl = document.querySelector("#adminList");

// subcollections a user doc can have (the last three are from the old layout)
const USER_SUBCOLLECTIONS = ["linkChecks", "postedReports", "postedHelp", "savedReports", "savedHelp", "public"];

// "Other data" tab: whole collections, and per-user subcollections read with collectionGroup
const OTHER_SOURCES = [
  { key: "publicProfiles", label: "publicProfiles" },
  { key: "users/*/linkChecks", label: "users/*/linkChecks" },
  { key: "users/*/postedReports", label: "users/*/postedReports" },
  { key: "users/*/postedHelp", label: "users/*/postedHelp" },
  { key: "links", label: "links (no longer used)" },
  { key: "linkChecks", label: "linkChecks, top level (no longer used)" },
  { key: "avatars", label: "avatars (no longer used)" },
  { key: "helpComments", label: "helpComments (no longer used)" },
  { key: "helpRatings", label: "helpRatings (no longer used)" },
  { key: "users/*/savedReports", label: "users/*/savedReports (no longer used)" },
  { key: "users/*/savedHelp", label: "users/*/savedHelp (no longer used)" },
  { key: "users/*/public", label: "users/*/public (no longer used)" },
];

let me = null;
let tab = "helpPosts";
let rows = []; // { path, ref, title, meta, ... } for the current tab
let selected = new Set(); // paths of checked rows
let openComments = new Set(); // help post paths with their comments shown
let loadId = 0; // ignores a slow load if the tab changed meanwhile
let busy = false;

// ---------- small helpers ----------

function formatDate(timestamp) {
  const date = timestamp?.toDate?.();
  return date
    ? date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })
    : "";
}

function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

// newest first; older docs used last_updated
function newestFirst(docs) {
  const time = (d) => (d.data().createdAt ?? d.data().last_updated)?.toMillis?.() ?? 0;
  return [...docs].sort((a, b) => time(b) - time(a));
}

// "field: value · field: value" for docs we don't know the shape of
function summarize(data) {
  const short = (value) => {
    if (value?.toDate) return formatDate(value);
    if (value && typeof value === "object") return "{…}";
    const text = String(value);
    return text.length > 40 ? text.slice(0, 40) + "…" : text;
  };
  const parts = Object.entries(data).map(([key, value]) => key + ": " + short(value));
  return parts.join(" · ") || "(empty)";
}

// a batch can hold 500 writes, so big deletes go in chunks
async function deleteRefs(refs) {
  const unique = [...new Map(refs.map((ref) => [ref.path, ref])).values()];
  for (let i = 0; i < unique.length; i += 450) {
    const batch = writeBatch(db);
    unique.slice(i, i + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// ---------- loading each tab ----------

async function loadHelpPosts() {
  const snapshot = await getDocs(collection(db, "helpPosts"));
  return newestFirst(snapshot.docs).map((d) => {
    const post = d.data();

    // comments: { uid: { commentId: {...} } } -> flat list, newest first
    const comments = [];
    Object.entries(post.comments || {}).forEach(([uid, userComments]) => {
      Object.entries(userComments || {}).forEach(([id, comment]) => {
        comments.push({ ...comment, uid: uid, id: id });
      });
    });
    comments.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    return {
      path: d.ref.path,
      ref: d.ref,
      title: post.question || "(no question)",
      meta: [
        post.ownerName || post.userID || "Anonymous",
        formatDate(post.createdAt),
        plural(Object.keys(post.ratings || {}).length, "rating"),
      ]
        .filter(Boolean)
        .join(" · "),
      comments: comments,
      // the author's postedHelp entry goes with the post
      alsoDelete: post.ownerId ? [doc(db, "users", post.ownerId, "postedHelp", d.id)] : [],
    };
  });
}

async function loadReports() {
  const snapshot = await getDocs(collection(db, "scamReports"));
  return newestFirst(snapshot.docs).map((d) => {
    const report = d.data();
    const ownerId = report.ownerId || report.owner;
    return {
      path: d.ref.path,
      ref: d.ref,
      title: report.query || "Untitled report",
      meta: [report.ownerName || report.username || "Anonymous", formatDate(report.createdAt || report.last_updated)]
        .filter(Boolean)
        .join(" · "),
      preview: report.details || report.message || "",
      alsoDelete: ownerId ? [doc(db, "users", ownerId, "postedReports", d.id)] : [],
    };
  });
}

async function loadUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs
    .map((d) => {
      const user = d.data();
      return {
        path: d.ref.path,
        ref: d.ref,
        uid: d.id,
        title: user.name || "(no name)",
        meta: [user.email, d.id].filter(Boolean).join(" · "),
        isMe: d.id === me.uid,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function loadOther(key) {
  let docs;
  if (key.startsWith("users/*/")) {
    // every subcollection with this name, but only the ones under users/{uid}
    const snapshot = await getDocs(collectionGroup(db, key.split("/")[2]));
    docs = snapshot.docs.filter((d) => d.ref.parent.parent?.parent.id === "users");
  } else {
    docs = (await getDocs(collection(db, key))).docs;
  }
  return newestFirst(docs).map((d) => ({
    path: d.ref.path,
    ref: d.ref,
    title: d.ref.path,
    meta: summarize(d.data()),
  }));
}

function loadCurrentTab() {
  if (tab === "helpPosts") return loadHelpPosts();
  if (tab === "scamReports") return loadReports();
  if (tab === "users") return loadUsers();
  return loadOther(otherSourceEl.value);
}

async function showTab() {
  const thisLoad = ++loadId;
  rows = [];
  selected.clear();
  openComments.clear();
  countEl.textContent = "";
  listEl.innerHTML = `<p class="list-group-item text-body-secondary text-center mb-0">Loading…</p>`;
  updateToolbar();

  try {
    const result = await loadCurrentTab();
    if (thisLoad !== loadId) return;
    rows = result;
    render();
  } catch (error) {
    if (thisLoad !== loadId) return;
    console.error("Error loading admin data:", error);
    listEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "list-group-item text-danger text-center mb-0";
    p.textContent = "Could not load this data. " + (error.code || "");
    listEl.appendChild(p);
  }
}

// ---------- drawing ----------

function visibleRows() {
  const keyword = searchEl.value.trim().toLowerCase();
  return rows.filter((row) =>
    (row.title + " " + row.meta + " " + (row.preview || "") + " " + row.path).toLowerCase().includes(keyword),
  );
}

function updateToolbar() {
  const selectable = visibleRows().filter((row) => !row.isMe);
  const checkedCount = selectable.filter((row) => selected.has(row.path)).length;
  selectAllEl.checked = selectable.length > 0 && checkedCount === selectable.length;
  selectAllEl.indeterminate = checkedCount > 0 && checkedCount < selectable.length;
  selectAllEl.disabled = busy || selectable.length === 0;

  deleteBtn.disabled = busy || selected.size === 0;
  deleteBtn.textContent = busy ? "Deleting…" : "Delete selected (" + selected.size + ")";
}

function createCommentList(row) {
  const box = document.createElement("div");
  box.className = "mt-2";

  row.comments.forEach((comment) => {
    const line = document.createElement("div");
    line.className = "d-flex align-items-start gap-2 border-start border-success border-3 ps-2 mb-2";

    const text = document.createElement("small");
    text.className = "flex-grow-1";
    const name = document.createElement("strong");
    name.textContent = (comment.userName || "Anonymous") + ": ";
    text.append(name, comment.text || "");

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-outline-danger btn-sm py-0";
    remove.setAttribute("aria-label", "Delete comment");
    remove.title = "Delete comment";
    remove.innerHTML = `<i class="bi bi-trash" aria-hidden="true"></i>`;
    remove.disabled = busy;
    remove.addEventListener("click", () => deleteComment(row, comment));

    line.append(text, remove);
    box.appendChild(line);
  });

  return box;
}

function createRow(row) {
  const item = document.createElement("div");
  item.className = "list-group-item d-flex gap-3 align-items-start";

  const box = document.createElement("input");
  box.type = "checkbox";
  box.className = "form-check-input mt-1 flex-shrink-0";
  box.setAttribute("aria-label", "Select " + row.title);
  box.checked = selected.has(row.path);
  box.disabled = busy || row.isMe;
  box.addEventListener("change", () => {
    if (box.checked) selected.add(row.path);
    else selected.delete(row.path);
    updateToolbar();
  });

  const content = document.createElement("div");
  content.className = "flex-grow-1 text-break";
  content.style.minWidth = "0";

  const title = document.createElement("div");
  title.className = "fw-semibold";
  title.textContent = row.title;
  if (row.isMe) {
    const badge = document.createElement("span");
    badge.className = "badge text-bg-secondary ms-2";
    badge.textContent = "you";
    title.appendChild(badge);
  }

  const meta = document.createElement("small");
  meta.className = "text-body-secondary d-block";
  meta.textContent = row.meta;

  content.append(title, meta);

  if (row.preview) {
    const preview = document.createElement("p");
    preview.className = "small mb-0 mt-1 text-truncate-2";
    preview.textContent = row.preview;
    content.appendChild(preview);
  }

  // help posts: show/hide comments, each one deletable
  if (row.comments) {
    const open = openComments.has(row.path);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn btn-link btn-sm text-success p-0 mt-1";
    toggle.textContent =
      row.comments.length === 0
        ? "No comments"
        : (open ? "Hide " : "Show ") + plural(row.comments.length, "comment");
    toggle.disabled = row.comments.length === 0;
    toggle.setAttribute("aria-expanded", open);
    toggle.addEventListener("click", () => {
      if (open) openComments.delete(row.path);
      else openComments.add(row.path);
      render();
    });
    content.appendChild(toggle);
    if (open && row.comments.length > 0) content.appendChild(createCommentList(row));
  }

  item.append(box, content);
  return item;
}

function render() {
  const visible = visibleRows();

  // only rows you can see stay selected, so a filter never hides what gets deleted
  const visiblePaths = new Set(visible.map((row) => row.path));
  selected.forEach((path) => {
    if (!visiblePaths.has(path)) selected.delete(path);
  });

  countEl.textContent =
    visible.length === rows.length
      ? plural(rows.length, "item")
      : visible.length + " of " + plural(rows.length, "item");

  listEl.innerHTML = "";
  if (visible.length === 0) {
    const p = document.createElement("p");
    p.className = "list-group-item text-body-secondary text-center mb-0";
    p.textContent = rows.length === 0 ? "Nothing here." : "Nothing matches the filter.";
    listEl.appendChild(p);
  }
  visible.forEach((row) => listEl.appendChild(createRow(row)));
  updateToolbar();
}

function setBusy(value) {
  busy = value;
  refreshBtn.disabled = value;
  tabButtons.forEach((btn) => (btn.disabled = value));
  otherSourceEl.disabled = value;
  render();
}

// ---------- deleting ----------

// everything stored for one user (not their login: that's in Firebase Authentication)
async function refsForUser(uid, alsoContent) {
  const reads = USER_SUBCOLLECTIONS.map((name) => getDocs(collection(db, "users", uid, name)));
  if (alsoContent) {
    reads.push(getDocs(query(collection(db, "helpPosts"), where("ownerId", "==", uid))));
    reads.push(getDocs(query(collection(db, "scamReports"), where("ownerId", "==", uid))));
  }
  const snapshots = await Promise.all(reads);

  const refs = snapshots.flatMap((snapshot) => snapshot.docs.map((d) => d.ref));
  refs.push(doc(db, "publicProfiles", uid), doc(db, "users", uid));
  return refs;
}

async function deleteSelected() {
  const chosen = rows.filter((row) => selected.has(row.path));
  if (chosen.length === 0) return;

  const isUsers = tab === "users";
  let message = "This can't be undone.";
  if (isUsers) {
    message =
      "Their profile, history and saved items will be deleted" +
      (alsoContentEl.checked ? ", along with their help posts and scam reports" : "") +
      ". Their login stays: remove it in Firebase Authentication if needed. This can't be undone.";
  }
  const ok = await confirmDialog({
    title: "Delete " + plural(chosen.length, isUsers ? "user" : "item") + "?",
    message: message,
    confirmText: "Delete",
  });
  if (!ok) return;

  setBusy(true);
  try {
    let refs = [];
    if (isUsers) {
      for (const row of chosen) refs.push(...(await refsForUser(row.uid, alsoContentEl.checked)));
    } else {
      chosen.forEach((row) => refs.push(row.ref, ...(row.alsoDelete || [])));
    }
    await deleteRefs(refs);

    rows = rows.filter((row) => !selected.has(row.path));
    selected.clear();
  } catch (error) {
    console.error("Error deleting:", error);
    alert(`Error deleting:\n${error.code || ""}\n${error.message || error}`);
    setBusy(false);
    await showTab(); // reload, in case some batches went through
    return;
  }
  setBusy(false);
}

async function deleteComment(row, comment) {
  const ok = await confirmDialog({
    title: "Delete this comment?",
    message: (comment.userName || "Anonymous") + ": " + (comment.text || ""),
    confirmText: "Delete",
  });
  if (!ok) return;

  // their last comment on this post: remove the whole uid entry instead of leaving {}
  const sameUser = row.comments.filter((c) => c.uid === comment.uid).length;
  const path = sameUser === 1 ? "comments." + comment.uid : "comments." + comment.uid + "." + comment.id;

  setBusy(true);
  try {
    await updateDoc(row.ref, { [path]: deleteField() });
    row.comments = row.comments.filter((c) => c !== comment);
  } catch (error) {
    alert(`Error deleting comment:\n${error.code || ""}\n${error.message || error}`);
  }
  setBusy(false);
}

// ---------- events ----------

OTHER_SOURCES.forEach((source) => {
  const option = document.createElement("option");
  option.value = source.key;
  option.textContent = source.label;
  otherSourceEl.appendChild(option);
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab === tab) return;
    tab = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    otherSourceEl.classList.toggle("d-none", tab !== "other");
    alsoContentWrap.classList.toggle("d-none", tab !== "users");
    searchEl.value = "";
    showTab();
  });
});

otherSourceEl.addEventListener("change", showTab);
searchEl.addEventListener("input", render);
refreshBtn.addEventListener("click", showTab);
deleteBtn.addEventListener("click", deleteSelected);

selectAllEl.addEventListener("change", () => {
  visibleRows()
    .filter((row) => !row.isMe)
    .forEach((row) => {
      if (selectAllEl.checked) selected.add(row.path);
      else selected.delete(row.path);
    });
  render();
});

onAuthReady(async (user) => {
  if (!user) return;
  me = user;

  if (!(await isAdmin(user.uid))) {
    location.replace("main.html");
    return;
  }

  statusEl.classList.add("d-none");
  contentEl.classList.remove("d-none");
  showTab();
});
