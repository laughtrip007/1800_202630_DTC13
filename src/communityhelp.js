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

// ratings: helpRatings collection (postId, stars, userID, userName, ratedAt)
async function loadRatings() {
  try {
    const snapshot = await getDocs(collection(db, "helpRatings"));
    ratings = snapshot.docs.map((d) => {
      const rating = d.data();
      rating.id = d.id;
      return rating;
    });
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
  } catch (error) {
    alert(`Error deleting post:\n${error.code || ""}\n${error.message || error}`);
    deleteBtn.disabled = false;
    return;
  }

  // also remove the post's comments and ratings so they don't stay in Firestore
  const postComments = comments.filter((c) => c.postId === id);
  const postRatings = ratings.filter((r) => r.postId === id);
  const results = await Promise.allSettled([
    ...postComments.map((c) => deleteDoc(doc(db, "helpComments", c.id))),
    ...postRatings.map((r) => deleteDoc(doc(db, "helpRatings", r.id))),
  ]);
  if (results.some((r) => r.status === "rejected")) {
    console.error("Some comments/ratings of the deleted post could not be removed", results);
  }

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

  try {
    // doc id is postId_userID so rating again replaces the old rating
    const ratingId = postId + "_" + currentUser.uid;
    const rating = {
      postId: postId,
      stars: stars,
      userID: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
    };
    await setDoc(doc(db, "helpRatings", ratingId), { ...rating, ratedAt: serverTimestamp() });

    ratings = ratings.filter((r) => r.id !== ratingId);
    ratings.push({ ...rating, id: ratingId });
    renderPosts();
  } catch (error) {
    alert(`Error saving rating:\n${error.code || ""}\n${error.message || error}`);
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

  commentBtn.disabled = true;
  try {
    const comment = {
      postId: openPostId,
      text: text,
      userID: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
    };
    const ref = await addDoc(collection(db, "helpComments"), {
      ...comment,
      createdAt: serverTimestamp(),
    });

    comments.push({ ...comment, id: ref.id, createdAt: Timestamp.now() });
    commentInput.value = "";
    renderPosts();
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
    comments = comments.filter((c) => c.id !== commentId);
    renderPosts();
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

// loads posts, ratings and comments at the same time, then draws the list
async function showPosts() {
  try {
    const q = query(collection(db, "helpPosts"), orderBy("createdAt", "desc"));
    const [snapshot] = await Promise.all([getDocs(q), loadRatings(), loadComments()]);

    posts = snapshot.docs.map((d) => {
      const post = d.data();
      post.id = d.id;
      return post;
    });
    renderPosts();
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