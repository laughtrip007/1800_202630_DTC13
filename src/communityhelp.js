import { db } from "/src/firebaseConfig.js";
import { onAuthReady } from "/src/authentication.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const postForm = document.querySelector("#postForm");
const postBtn = document.querySelector("#postBtn");
const questionInput = document.querySelector("#questionInput");
const postList = document.querySelector("#postList");

let currentUser = null;

onAuthReady((user) => {
  currentUser = user;
});

// Build a post card with textContent so user input is never treated as HTML (prevents XSS)
function createPostCard(post) {
  const card = document.createElement("div");
  card.className = "card border-0 shadow-sm mb-3";

  const body = document.createElement("div");
  body.className = "card-body";

  const author = document.createElement("h3");
  author.className = "h6 fw-bold card-title";
  author.textContent = post.userID || "Anonymous";

  const text = document.createElement("p");
  text.className = "card-text mb-0";
  text.style.whiteSpace = "pre-wrap";
  text.textContent = post.question;

  body.append(author, text);
  card.appendChild(body);
  return card;
}

// Read all questions from Firestore and show them
async function showPosts() {
  try {
    const q = query(collection(db, "helpPosts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    postList.innerHTML = "";

    if (snapshot.empty) {
      const p = document.createElement("p");
      p.className = "text-body-secondary text-center";
      p.textContent = "No questions yet. Be the first to ask!";
      postList.appendChild(p);
      return;
    }

    snapshot.forEach((doc) => postList.appendChild(createPostCard(doc.data())));
  } catch (error) {
    console.error("Error loading posts:", error);
    postList.innerHTML = `<p class="text-danger text-center">Could not load questions.</p>`;
  }
}

// Save a new question to Firestore
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
      createdAt: serverTimestamp(),
    });
    questionInput.value = "";
    await showPosts();
  } catch (error) {
    console.error("Error posting question:", error);
    alert("Could not post your question. Please try again.");
  } finally {
    postBtn.disabled = false;
  }
});

showPosts();
