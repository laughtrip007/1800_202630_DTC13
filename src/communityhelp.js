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

const postBtn = document.querySelector("#postBtn");
const questionInput = document.querySelector("#questionInput");
const postList = document.querySelector("#postList");

let currentUser = null;

onAuthReady((user) => {
  currentUser = user;
});

// Read all questions from Firestore and show them
async function showPosts() {
  postList.innerHTML = "";

  const q = query(collection(db, "helpPosts"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  snapshot.forEach((doc) => {
    const post = doc.data();

    postList.innerHTML += `
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-body">
          <h4 class="card-title">${post.userID}</h4>
          <p class="card-text">${post.question}</p>
        </div>
      </div>
    `;
  });
}

// Save a new question to Firestore
postBtn.addEventListener("click", async () => {
  const question = questionInput.value.trim();

  if (currentUser === null) {
    alert("Please log in to post a question.");
    return;
  }

  if (question === "") {
    alert("Please enter a question.");
    return;
  }

  await addDoc(collection(db, "helpPosts"), {
    question: question,
    userID: currentUser.displayName || currentUser.email,
    createdAt: serverTimestamp(),
  });

  questionInput.value = "";
  showPosts();
});

showPosts();