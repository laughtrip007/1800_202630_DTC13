import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";

onAuthReady(async (user) => {
  if (!user) return;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const name = userDoc.exists() ? userDoc.data().name : user.displayName || user.email;
  document.getElementById("name-goes-here").textContent = name + "!";
});

// Safety tips
const tips = [
  "Don’t click links in unexpected texts or emails, even if they look official.",
  "Check the web address carefully before entering a password. Scammers use look-alike sites like paypa1.com.",
  "Banks and the government will never ask for your password or PIN by text or email.",
  "Be suspicious of messages that create urgency, like “Your account will be closed in 24 hours.”",
  "If a deal looks too good to be true, it probably is.",
  "Never pay with gift cards. Real companies and agencies don’t ask for them.",
  "Turn on two-factor authentication for your email and bank accounts.",
  "Hover over or long-press a link to preview where it really goes before opening it.",
  "If a friend sends a strange link, confirm with them another way before clicking.",
  "When in doubt, check the link with SafeLink first.",
];

const tipText = document.getElementById("tipText");
let currentTip = -1;

// don't show the same tip twice in a row
function randomTipIndex() {
  let index;
  do {
    index = Math.floor(Math.random() * tips.length);
  } while (index === currentTip);
  return index;
}

function showTip() {
  currentTip = randomTipIndex();
  tipText.textContent = tips[currentTip];

  // replay the animation
  tipText.classList.remove("tip-enter");
  void tipText.offsetWidth;
  tipText.classList.add("tip-enter");
}

function changeTip() {
  tipText.classList.add("tip-exit");
  setTimeout(() => {
    tipText.classList.remove("tip-exit");
    showTip();
  }, 250);
}

// new tip every 8s, pauses on hover or when the tab is hidden
const AUTO_REFRESH_MS = 8000;
const tipCard = document.querySelector(".tip-card");
let autoTimer = null;

function startAutoRefresh() {
  stopAutoRefresh();
  autoTimer = setInterval(changeTip, AUTO_REFRESH_MS);
}

function stopAutoRefresh() {
  clearInterval(autoTimer);
  autoTimer = null;
}

tipCard.addEventListener("mouseenter", stopAutoRefresh);
tipCard.addEventListener("mouseleave", startAutoRefresh);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopAutoRefresh();
  else startAutoRefresh();
});

showTip();
startAutoRefresh();
