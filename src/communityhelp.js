import { db } from "/src/firebaseConfig.js";
import { onAuthReady } from "/src/authentication.js";
import { createSaveButton, setSaveLook } from "/src/saveButton.js";
import {
  collection,
  addDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  doc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const postForm = document.querySelector("#postForm");
const postBtn = document.querySelector("#postBtn");
const questionInput = document.querySelector("#questionInput");
const postList = document.querySelector("#postList");

const commentPanel = document.querySelector("#commentPanel");
const commentClose = document.querySelector("#commentClose");
const commentQuestion = document.querySelector("#commentQuestion");
const commentInput = document.querySelector("#commentInput");
const commentBtn = document.querySelector("#commentBtn");
const commentList = document.querySelector("#commentList");

let currentUser = null;
let posts = [];
let ratings = [];
let comments = [];
let openPostId = null;
let savedIds = new Set();

onAuthReady((user) => {
  currentUser = user;
  showPosts();
});

// shows "just now", "5 min ago", "3 hours ago", "2 days ago" or the date
function formatTime(timestamp) {
  const date = timestamp?.toDate?.();
  if (!date) return "";

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + " min ago";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");

  const days = Math.floor(hours / 24);
  if (days < 7) return days + (days === 1 ? " day ago" : " days ago");

  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// full date and time, shown when you hover over the time
function formatFullTime(timestamp) {
  const date = timestamp?.toDate?.();
  return date
    ? date.toLocaleString("en-CA", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}

// older posts without ownerId can't be deleted (names aren't unique)
function isOwner(post) {
  return currentUser !== null && post.ownerId === currentUser.uid;
}

// ratings and comments are stored inside each post, grouped by user:
//   ratings:  { uid: stars }
//   comments: { uid: { commentId: { text, userName, createdAt } } }
// this turns them into flat lists so the rest of the page can filter by postId
function readPostExtras() {
  ratings = [];
  comments = [];

  posts.forEach((post) => {
    Object.entries(post.ratings || {}).forEach(([uid, stars]) => {
      ratings.push({ postId: post.id, id: uid, userID: uid, stars: stars });
    });

    Object.entries(post.comments || {}).forEach(([uid, userComments]) => {
      Object.entries(userComments).forEach(([commentId, comment]) => {
        comments.push({ ...comment, id: commentId, postId: post.id, userID: uid });
      });
    });
  });
}

// saved posts: users/{uid}/savedHelp, doc id = post id
async function loadSavedIds() {
  if (currentUser === null) return;
  try {
    const snapshot = await getDocs(
      collection(db, "users", currentUser.uid, "savedHelp"),
    );
    savedIds = new Set(snapshot.docs.map((d) => d.id));
  } catch (error) {
    console.error("Error loading saved posts:", error);
    savedIds = new Set();
  }
}

async function deletePost(id, deleteBtn) {
  if (!confirm("Delete this post?")) return;

  deleteBtn.disabled = true;
  try {
    await deleteDoc(doc(db, "helpPosts", id));
  } catch (error) {
    alert(
      `Error deleting post:\n${error.code || ""}\n${error.message || error}`,
    );
    deleteBtn.disabled = false;
    return;
  }

  // ratings and comments are inside the post, so they're already gone
  posts = posts.filter((post) => post.id !== id);
  comments = comments.filter((c) => c.postId !== id);
  ratings = ratings.filter((r) => r.postId !== id);
  if (openPostId === id) closeComments();
  renderPosts();
}

async function saveRating(postId, stars) {
  if (currentUser === null) {
    alert("Please log in to rate a post.");
    return;
  }

  const uid = currentUser.uid;
  const postRef = doc(db, "helpPosts", postId);
  const isMine = (r) => r.postId === postId && r.id === uid;
  const myRating = ratings.find(isMine);

  // clicking your current rating again removes it
  if (myRating && myRating.stars === stars) {
    try {
      await updateDoc(postRef, { ["ratings." + uid]: deleteField() });
      ratings = ratings.filter((r) => !isMine(r));
      renderPosts();
    } catch (error) {
      alert(`Error removing rating:\n${error.code || ""}\n${error.message || error}`);
    }
    return;
  }

  try {
    // "ratings.<uid>" only touches this user's rating, not everyone else's
    await updateDoc(postRef, { ["ratings." + uid]: stars });

    ratings = ratings.filter((r) => !isMine(r));
    ratings.push({ postId: postId, id: uid, userID: uid, stars: stars });
    renderPosts();
    showRatingHint(postId);
  } catch (error) {
    alert(
      `Error saving rating:\n${error.code || ""}\n${error.message || error}`,
    );
  }
}

function openComments(postId, post) {
  if (postId !== openPostId) commentInput.value = "";
  openPostId = postId;
  commentQuestion.textContent = post.question;
  commentPanel.classList.remove("d-none");
  showComments();
}

function closeComments() {
  openPostId = null;
  commentPanel.classList.add("d-none");
}

async function saveComment() {
  const text = commentInput.value.trim();

  if (currentUser === null) {
    alert("Please log in to comment.");
    return;
  }

  if (text === "") {
    alert("Please enter a comment.");
    return;
  }

  // keep the id in case the panel switches posts while saving
  const postId = openPostId;
  commentBtn.disabled = true;
  try {
    const uid = currentUser.uid;
    // time + random, unique enough for one user's comments on one post
    const commentId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const comment = {
      text: text,
      userName: currentUser.displayName || currentUser.email,
    };
    await updateDoc(doc(db, "helpPosts", postId), {
      ["comments." + uid + "." + commentId]: { ...comment, createdAt: serverTimestamp() },
    });

    comments.push({
      ...comment,
      id: commentId,
      postId: postId,
      userID: uid,
      createdAt: Timestamp.now(),
    });
    commentInput.value = "";
    renderPosts();
    showComments();
  } catch (error) {
    alert(
      `Error saving comment:\n${error.code || ""}\n${error.message || error}`,
    );
  } finally {
    commentBtn.disabled = false;
  }
}

async function deleteComment(comment) {
  if (!confirm("Delete this comment?")) return;

  // if it's your last comment on the post, remove your whole entry instead of leaving {}
  const myCount = comments.filter(
    (c) => c.postId === comment.postId && c.userID === comment.userID,
  ).length;
  const path =
    myCount === 1
      ? "comments." + comment.userID
      : "comments." + comment.userID + "." + comment.id;

  try {
    await updateDoc(doc(db, "helpPosts", comment.postId), { [path]: deleteField() });
    comments = comments.filter((c) => c.id !== comment.id);
    renderPosts();
    showComments();
  } catch (error) {
    alert(
      `Error deleting comment:\n${error.code || ""}\n${error.message || error}`,
    );
  }
}

function createCommentCard(comment) {
  const card = document.createElement("div");
  card.className = "border-start border-success border-3 ps-3 mb-3";

  const author = document.createElement("small");
  author.className = "fw-bold";
  author.textContent = comment.userName || "Anonymous";

  const time = document.createElement("small");
  time.className = "text-body-secondary ms-2";
  time.textContent = formatTime(comment.createdAt);
  time.title = formatFullTime(comment.createdAt);

  const text = document.createElement("p");
  text.className = "mb-1";
  text.style.whiteSpace = "pre-wrap";
  text.textContent = comment.text;

  card.append(author, time, text);

  // only the owner can delete
  if (currentUser !== null && comment.userID === currentUser.uid) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-link btn-sm text-danger p-0";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteComment(comment));
    card.appendChild(deleteBtn);
  }

  return card;
}

// fills the side panel with the comments of the open post (newest first)
function showComments() {
  commentList.innerHTML = "";

  const postComments = comments
    .filter((c) => c.postId === openPostId)
    .sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
    );

  if (postComments.length === 0) {
    const p = document.createElement("p");
    p.className = "text-body-secondary small";
    p.textContent = "No comments yet. Be the first to comment!";
    commentList.appendChild(p);
    return;
  }

  postComments.forEach((comment) =>
    commentList.appendChild(createCommentCard(comment)),
  );
}

// fades the "tap again to remove" hint in, then out after 3s
function showRatingHint(postId) {
  const hint = document.querySelector("#post-" + postId + " .rating-hint");
  if (!hint) return;
  hint.classList.add("show");
  setTimeout(() => hint.classList.remove("show"), 3000);
}

function createRatingSection(postId) {
  const postRatings = ratings.filter((r) => r.postId === postId);

  let total = 0;
  let myStars = 0;
  postRatings.forEach((r) => {
    total += r.stars;
    if (currentUser !== null && r.userID === currentUser.uid) {
      myStars = r.stars;
    }
  });

  const section = document.createElement("div");
  section.className = "mt-3";

  const summary = document.createElement("small");
  summary.className = "text-body-secondary d-block mb-1";

  if (postRatings.length === 0) {
    summary.textContent = "No ratings yet";
  } else {
    const average = total / postRatings.length;
    const count = postRatings.length;
    summary.textContent =
      "Rating: " +
      average.toFixed(1) +
      " / 5 (" +
      count +
      (count === 1 ? " rating)" : " ratings)");
  }
  const summaryText = summary.textContent;

  const starRow = document.createElement("div");
  starRow.className = "d-flex gap-1";

  const stars = [];

  // fills the first n stars, empties the rest
  function paintStars(n) {
    stars.forEach((star, index) => {
      star.className = index < n ? "btn btn-warning btn-sm" : "btn btn-outline-warning btn-sm";
    });
  }

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.textContent = "★";
    star.title = i === myStars ? "Remove your rating" : "Rate " + i + " out of 5";
    star.setAttribute("aria-label", star.title);

    // preview: hovering (or tabbing to) star i lights up stars 1..i
    star.addEventListener("mouseenter", () => previewStars(i));
    star.addEventListener("focus", () => previewStars(i));
    star.addEventListener("click", () => saveRating(postId, i));
    stars.push(star);
    starRow.appendChild(star);
  }

  // shows what clicking would do, in the summary line
  function previewStars(n) {
    paintStars(n);
    summary.textContent =
      n === myStars ? "Click to remove your " + n + " / 5 rating" : "Your rating: " + n + " / 5";
  }

  function resetStars() {
    paintStars(myStars);
    summary.textContent = summaryText;
  }

  // back to the saved rating when the mouse or focus leaves the row
  starRow.addEventListener("mouseleave", resetStars);
  starRow.addEventListener("focusout", (e) => {
    if (!starRow.contains(e.relatedTarget)) resetStars();
  });
  paintStars(myStars);

  // hint shown for a few seconds after rating (see showRatingHint)
  const hint = document.createElement("small");
  hint.className = "rating-hint fade text-success align-self-center ms-2";
  hint.textContent = "Tap the same star again to remove it";
  starRow.appendChild(hint);

  section.append(summary, starRow);
  return section;
}

function createPostCard(post, id) {
  const card = document.createElement("div");
  card.className = "card border-0 shadow-sm mb-3";
  card.id = "post-" + id;

  const body = document.createElement("div");
  body.className = "card-body";

  const author = document.createElement("h3");
  author.className = "h6 fw-bold card-title mb-0";
  author.textContent = post.userID || "Anonymous";

  const time = document.createElement("small");
  time.className = "text-body-secondary d-block mb-2";
  time.textContent = formatTime(post.createdAt);
  time.title = formatFullTime(post.createdAt);

  const text = document.createElement("p");
  text.className = "card-text mb-0";
  text.style.whiteSpace = "pre-wrap";
  text.textContent = post.question;

  const buttons = document.createElement("div");
  buttons.className = "d-flex gap-2 mt-3";

  const commentCount = comments.filter((c) => c.postId === id).length;
  const commentsBtn = document.createElement("button");
  commentsBtn.type = "button";
  commentsBtn.className = "btn btn-outline-success btn-sm";
  commentsBtn.textContent = "Comments (" + commentCount + ")";
  commentsBtn.addEventListener("click", () => openComments(id, post));
  buttons.appendChild(commentsBtn);

  const saveBtn = createSaveButton(savedIds.has(id));
  saveBtn.addEventListener("click", () => toggleSave(post, saveBtn));
  buttons.appendChild(saveBtn);

  // only the owner can delete
  if (isOwner(post)) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-outline-danger btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deletePost(id, deleteBtn));
    buttons.appendChild(deleteBtn);
  }

  body.append(author, time, text, createRatingSection(id), buttons);
  card.appendChild(body);
  return card;
}

// draws the post list from the data already loaded (no Firestore reads)
function renderPosts() {
  postList.innerHTML = "";

  if (posts.length === 0) {
    const p = document.createElement("p");
    p.className = "text-body-secondary text-center";
    p.textContent = "No questions yet. Be the first to ask!";
    postList.appendChild(p);
    return;
  }

  posts.forEach((post) => postList.appendChild(createPostCard(post, post.id)));
}

// loads posts (with their ratings and comments) and saved ids, then draws the list
async function showPosts() {
  try {
    const q = query(collection(db, "helpPosts"), orderBy("createdAt", "desc"));
    const [snapshot] = await Promise.all([getDocs(q), loadSavedIds()]);

    posts = snapshot.docs.map((d) => {
      const post = d.data();
      post.id = d.id;
      return post;
    });
    readPostExtras();
    renderPosts();
    scrollToLinkedPost();
  } catch (error) {
    console.error("Error loading posts:", error);
    postList.innerHTML = `<p class="text-danger text-center">Could not load questions.</p>`;
  }
}

// saves or unsaves a post in users/{uid}/savedHelp (shown on the profile page)
async function toggleSave(post, saveBtn) {
  if (currentUser === null) {
    alert("Please log in to save a post.");
    return;
  }

  const savedRef = doc(db, "users", currentUser.uid, "savedHelp", post.id);
  const wasSaved = savedIds.has(post.id);
  saveBtn.disabled = true;

  try {
    if (wasSaved) {
      await deleteDoc(savedRef);
      savedIds.delete(post.id);
    } else {
      await setDoc(savedRef, {
        title: post.question,
        text: "Asked by " + (post.userID || "Anonymous"),
        href: "community_help.html#post-" + post.id,
        savedAt: serverTimestamp(),
      });
      savedIds.add(post.id);
    }
    setSaveLook(saveBtn, !wasSaved);
  } catch (error) {
    alert(`Error saving post:\n${error.code || ""}\n${error.message || error}`);
  } finally {
    saveBtn.disabled = false;
  }
}

// coming from a saved link (#post-id): scroll to that post and highlight it
function scrollToLinkedPost() {
  if (!location.hash.startsWith("#post-")) return;

  const card = document.getElementById(location.hash.slice(1));
  // clear the hash so posting a question later doesn't scroll again
  history.replaceState(null, "", location.pathname);
  if (!card) return;

  card.scrollIntoView({ behavior: "smooth", block: "center" });
  // the card has border-0, swap it out while highlighting
  const highlight = ["border", "border-success", "border-2"];
  card.classList.remove("border-0");
  card.classList.add(...highlight);
  setTimeout(() => {
    card.classList.remove(...highlight);
    card.classList.add("border-0");
  }, 2500);
}

postForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = questionInput.value.trim();

  if (currentUser === null) {
    alert("Please log in to post a question.");
    return;
  }

  if (question === "") {
    alert("Please enter a question.");
    return;
  }

  postBtn.disabled = true;
  try {
    await addDoc(collection(db, "helpPosts"), {
      question: question,
      userID: currentUser.displayName || currentUser.email,
      ownerId: currentUser.uid,
      createdAt: serverTimestamp(),
    });
    questionInput.value = "";
    await showPosts();
  } catch (error) {
    alert(
      `Error posting question:\n${error.code || ""}\n${error.message || error}`,
    );
  } finally {
    postBtn.disabled = false;
  }
});

commentClose.addEventListener("click", closeComments);
commentBtn.addEventListener("click", saveComment);
