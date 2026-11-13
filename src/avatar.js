// Avatars are { shape, color } (see FIRESTORE.md).
// The user's own avatar is the `avatar` field on users/{uid}, which only they can read.
// When they post or comment, a copy goes into the post (ownerAvatar / userAvatar) so
// everyone sees it, the same way ownerName works. No avatar means the default icon.
import { db } from "/src/firebaseConfig.js";
import { doc, getDoc, setDoc, updateDoc, deleteField } from "firebase/firestore";

export const DEFAULT_AVATAR = "images/default-avatar.svg";

// background + shape color
export const AVATAR_COLORS = {
  green: { label: "Green", bg: "#d1e7dd", fg: "#198754" },
  teal: { label: "Teal", bg: "#d2f4ea", fg: "#1aa179" },
  cyan: { label: "Cyan", bg: "#cff4fc", fg: "#0aa2c0" },
  blue: { label: "Blue", bg: "#cfe2ff", fg: "#0d6efd" },
  indigo: { label: "Indigo", bg: "#e0cffc", fg: "#6610f2" },
  purple: { label: "Purple", bg: "#e2d9f3", fg: "#6f42c1" },
  pink: { label: "Pink", bg: "#f7d6e6", fg: "#d63384" },
  red: { label: "Red", bg: "#f8d7da", fg: "#dc3545" },
  orange: { label: "Orange", bg: "#ffe5d0", fg: "#fd7e14" },
  yellow: { label: "Yellow", bg: "#fff3cd", fg: "#cc9a06" },
  gray: { label: "Gray", bg: "#e9ecef", fg: "#6c757d" },
  dark: { label: "Dark", bg: "#343a40", fg: "#f8f9fa" },
};

// each shape is drawn in a 100 x 100 box and kept small enough to stay inside the circle.
// bg is passed in for cut-outs like the smile's eyes
export const AVATAR_SHAPES = {
  circle: { label: "Circle", svg: () => '<circle cx="50" cy="50" r="23"/>' },
  square: { label: "Square", svg: () => '<rect x="30" y="30" width="40" height="40" rx="7"/>' },
  triangle: { label: "Triangle", svg: () => '<polygon points="50,21 75,65 25,65"/>' },
  diamond: { label: "Diamond", svg: () => '<polygon points="50,25 75,50 50,75 25,50"/>' },
  pentagon: {
    label: "Pentagon",
    svg: () => '<polygon points="50,26 73.8,43.3 64.7,71.2 35.3,71.2 26.2,43.3"/>',
  },
  hexagon: {
    label: "Hexagon",
    svg: () => '<polygon points="74,50 62,70.8 38,70.8 26,50 38,29.2 62,29.2"/>',
  },
  star: {
    label: "Star",
    svg: () =>
      '<polygon points="50,26 56.5,43.1 74.7,44 60.5,55.4 65.3,73 50,63 34.7,73 39.5,55.4 25.3,44 43.5,43.1"/>',
  },
  heart: {
    label: "Heart",
    svg: () =>
      '<path d="M50 74C50 74 24 58 24 41C24 32 31 26 38 26C44 26 48 30 50 34C52 30 56 26 62 26C69 26 76 32 76 41C76 58 50 74 50 74Z"/>',
  },
  shield: {
    label: "Shield",
    svg: () => '<path d="M50 22L74 31V49C74 63 64 73 50 79C36 73 26 63 26 49V31Z"/>',
  },
  bolt: { label: "Lightning", svg: () => '<polygon points="58,22 30,56 47,56 42,78 70,44 53,44"/>' },
  moon: {
    label: "Moon",
    svg: (bg) => `<circle cx="53" cy="50" r="24"/><circle cx="64" cy="42" r="19" fill="${bg}"/>`,
  },
  flower: {
    label: "Flower",
    svg: (bg) =>
      '<circle cx="64" cy="50" r="10"/><circle cx="57" cy="62.1" r="10"/><circle cx="43" cy="62.1" r="10"/>' +
      '<circle cx="36" cy="50" r="10"/><circle cx="43" cy="37.9" r="10"/><circle cx="57" cy="37.9" r="10"/>' +
      `<circle cx="50" cy="50" r="6" fill="${bg}"/>`,
  },
  ring: {
    label: "Ring",
    svg: () =>
      '<path fill-rule="evenodd" d="M26 50a24 24 0 1 0 48 0a24 24 0 1 0-48 0ZM38 50a12 12 0 1 0 24 0a12 12 0 1 0-24 0Z"/>',
  },
  plus: { label: "Plus", svg: () => '<path d="M42 26h16v16h16v16H58v16H42V58H26V42h16Z"/>' },
  smile: {
    label: "Smile",
    svg: (bg) =>
      `<circle cx="50" cy="50" r="24"/><circle cx="42" cy="45" r="3.2" fill="${bg}"/>` +
      `<circle cx="58" cy="45" r="3.2" fill="${bg}"/>` +
      `<path d="M40 56Q50 66 60 56" fill="none" stroke="${bg}" stroke-width="3.5" stroke-linecap="round"/>`,
  },
};

export function presetAvatarUrl(shape, color) {
  // hasOwn so odd values copied into posts (e.g. "constructor") fall back safely
  const c = Object.hasOwn(AVATAR_COLORS, color) ? AVATAR_COLORS[color] : AVATAR_COLORS.green;
  const s = Object.hasOwn(AVATAR_SHAPES, shape) ? AVATAR_SHAPES[shape] : AVATAR_SHAPES.circle;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${c.bg}"/><g fill="${c.fg}">${s.svg(c.bg)}</g></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// the src to put on an <img> for this avatar (or the default icon)
export function avatarSrc(avatar) {
  return avatar?.shape ? presetAvatarUrl(avatar.shape, avatar.color) : DEFAULT_AVATAR;
}

// just the two names, for copying into a post, report or comment
export function avatarCopy(avatar) {
  return avatar?.shape ? { shape: avatar.shape, color: avatar.color } : null;
}

export async function loadAvatar(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return avatarCopy(snap.data()?.avatar);
}

// merge, so the rest of the user doc is kept
export async function saveAvatar(uid, avatar) {
  await setDoc(doc(db, "users", uid), { avatar: avatarCopy(avatar) }, { merge: true });
}

export async function removeAvatar(uid) {
  await updateDoc(doc(db, "users", uid), { avatar: deleteField() });
}
