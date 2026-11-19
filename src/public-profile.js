// publicProfiles/{uid} = { name, avatar }: the part of a profile everyone signed in can read
// (users/{uid} is owner-only). Posts, reports and comments show the author's CURRENT name
// and picture from here, so changing either updates old posts too. The copies saved in each
// post (ownerName/ownerAvatar, userName/userAvatar) are only a fallback for authors with no doc.
import { db } from "/src/firebase-config.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { avatarCopy } from "/src/avatar.js";

export const DEFAULT_NAME = "SafeLink user";
export const MAX_NAME_LENGTH = 50; // same limit as firestore.rules

// my own name and avatar, from my users doc. Never falls back to the email: that would
// show my email to everyone on my posts.
export async function loadMyProfile(uid) {
  const data = (await getDoc(doc(db, "users", uid))).data() || {};
  return profileFromUserData(data);
}

export function profileFromUserData(data) {
  return { name: data.name || DEFAULT_NAME, avatar: avatarCopy(data.avatar) };
}

// adds "keep my publicProfiles doc up to date" to a batch (used when posting)
export function setPublicProfile(batch, uid, profile) {
  batch.set(
    doc(db, "publicProfiles", uid),
    { name: profile.name, avatar: avatarCopy(profile.avatar) },
    { merge: true },
  );
}

// creates or fixes my publicProfiles doc if it doesn't match my profile (Profile page)
export async function syncPublicProfile(uid, profile) {
  const ref = doc(db, "publicProfiles", uid);
  const current = (await getDoc(ref)).data();
  const avatar = avatarCopy(profile.avatar);
  const same =
    current &&
    current.name === profile.name &&
    JSON.stringify(avatarCopy(current.avatar)) === JSON.stringify(avatar);
  if (!same) await setDoc(ref, { name: profile.name, avatar: avatar }, { merge: true });
}

// ---------- reading other people's profiles ----------

const profiles = new Map(); // uid -> { name, avatar }, only users who have a doc
const checkedUids = new Set();

// call before drawing posts; uids can repeat or be missing (older posts)
export async function loadPublicProfiles(uids) {
  const todo = [...new Set(uids)].filter((uid) => uid && !checkedUids.has(uid));
  await Promise.all(
    todo.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "publicProfiles", uid));
        checkedUids.add(uid);
        if (snap.exists()) profiles.set(uid, snap.data());
      } catch (error) {
        // fall back to the copies in the posts
        console.error("Error loading profile:", error);
      }
    }),
  );
}

// the author's current avatar, or the copy saved in the post
export function authorAvatar(uid, savedCopy) {
  return profiles.has(uid) ? avatarCopy(profiles.get(uid).avatar) : savedCopy;
}

// the author's current name, or the copy saved in the post
export function authorName(uid, savedName) {
  const current = profiles.get(uid)?.name;
  if (current) return current;
  // older posts saved the email when there was no display name: never show it
  if (!savedName || savedName.includes("@")) return DEFAULT_NAME;
  return savedName;
}
