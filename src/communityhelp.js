import { db } from "/src/firebaseConfig.js";
import { onAuthReady } from "/src/authentication.js";
import {
  collection,
  addDoc,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
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
let ratings = [];
let comments = [];
let openPostId = null;

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

function isOwner(post) {
  if (currentUser === null) return false;

  // older posts only stored the name
  if (!post.ownerId) {
    return post.userID === (currentUser.displayName || currentUser.email);
  }

  return post.ownerId === currentUser.uid;
}

// ratings: helpRatings collection (postId, stars, userID, userName, ratedAt)
async function loadRatings() {
  try {
    const snapshot = await getDocs(collection(db, "helpRatings"));
    ratings = snapshot.docs.map((d) => d.data());
  } catch (error) {
    console.error("Error loading ratings:", error);
    ratings = [];
  }
}

// comments: helpComments collection (postId, text, userID, userName, createdAt)
async function loadComments() {
  try {
    const snapshot = await getDocs(collection(db, "helpComments"));
    comments = snapshot.docs.map((d) => {
      const comment = d.data();
      comment.id = d.id;
      return comment;
    });
  } catch (error) {
    console.error("Error loading comments:", error);
    comments = [];
  }
}

async function deletePost(id, deleteBtn) {
  if (!confirm("Delete this post?")) return;

  deleteBtn.disabled = true;
  try {
    await deleteDoc(doc(db, "helpPosts", id));
    if (openPostId === id) closeComments();
    showPosts();
  } catch (error) {
    alert(`Error deleting post:\n${error.code || ""}\n${error.message || error}`);
    deleteBtn.disabled = false;
  }
}

async function saveRating(postId, stars) {
  if (currentUser === null) {
    alert("Please log in to rate a post.");
    return;
  }

  try {
    // doc id is postId_userID so rating again replaces the old rating
    await setDoc(doc(db, "helpRatings", postId + "_" + currentUser.uid), {
      postId: postId,
      stars: stars,
      userID: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      ratedAt: serverTimestamp(),
    });
    showPosts();
  } catch (error) {
    alert(`Error saving rating:\n${error.code || ""}\n${error.message || error}`);
  }
}

function openComments(postId, post) {
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

  commentBtn.disabled = true;
  try {
    await addDoc(collection(db, "helpComments"), {
      postId: openPostId,
      text: text,
      userID: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      createdAt: serverTimestamp(),
    });
    commentInput.value = "";
    await showPosts();
    showComments();
  } catch (error) {
    alert(`Error saving comment:\n${error.code || ""}\n${error.message || error}`);
  } finally {
    commentBtn.disabled = false;
  }
}

async function deleteComment(commentId) {
  if (!confirm("Delete this comment?")) return;

  try {
    await deleteDoc(doc(db, "helpComments", commentId));
    await showPosts();
    showComments();
  } catch (error) {
    alert(`Error deleting comment:\n${error.code || ""}\n${error.message || error}`);
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
    deleteBtn.addEventListener("click", () => deleteComment(comment.id));
    card.appendChild(deleteBtn);
  }

  return card;
}

// fills the side panel with the comments of the open post (newest first)
function showComments() {
  commentList.innerHTML = "";

  const postComments = comments
    .filter((c) => c.postId === openPostId)
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  if (postComments.length === 0) {
    const p = document.createElement("p");
    p.className = "text-body-secondary small";
    p.textContent = "No comments yet. Be the first to comment!";
    commentList.appendChild(p);
    return;
  }

  postComments.forEach((comment) => commentList.appendChild(createCommentCard(comment)));
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
    summary.textContent =
      "Rating: " + average.toFixed(1) + " / 5 (" + postRatings.length + " ratings)";
  }

  const starRow = document.createElement("div");
  starRow.className = "d-flex gap-1";

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.textContent = "★";
    star.title = "Rate " + i + " out of 5";

    if (i <= myStars) {
      star.className = "btn btn-warning btn-sm";
    } else {
      star.className = "btn btn-outline-warning btn-sm";
    }

    star.addEventListener("click", () => saveRating(postId, i));
    starRow.appendChild(star);
  }

  section.append(summary, starRow);
  return section;
}

function createPostCard(post, id) {
  const card = document.createElement("div");
  card.className = "card border-0 shadow-sm mb-3";

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

async function showPosts() {
  try {
    const q = query(collection(db, "helpPosts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    await loadRatings();
    await loadComments();

    postList.innerHTML = "";

    if (snapshot.empty) {
      const p = document.createElement("p");
      p.className = "text-body-secondary text-center";
      p.textContent = "No questions yet. Be the first to ask!";
      postList.appendChild(p);
      return;
    }

    snapshot.forEach((d) => postList.appendChild(createPostCard(d.data(), d.id)));
  } catch (error) {
    console.error("Error loading posts:", error);
    postList.innerHTML = `<p class="text-danger text-center">Could not load questions.</p>`;
  }
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
    alert(`Error posting question:\n${error.code || ""}\n${error.message || error}`);
  } finally {
    postBtn.disabled = false;
  }
});

commentClose.addEventListener("click", closeComments);
commentBtn.addEventListener("click", saveComment);