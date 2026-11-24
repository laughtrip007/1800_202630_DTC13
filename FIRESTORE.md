# Firestore structure

This is the data layout SafeLink uses. Please follow it when you add or change anything that reads or writes Firestore. The matching security rules are in [`firestore.rules`](firestore.rules).

Two rules of thumb:

- **Public content** (things every user sees) lives in a top-level collection.
- **Personal data** (things only the owner sees) lives under `users/{uid}`.

```
users/{uid}
│  name, email, country, school
│  avatar:       { shape, color }
│  savedReports: { <reportId>: { title, text, href, savedAt } }
│  savedHelp:    { <postId>:   { title, text, href, savedAt } }
│
├─ linkChecks/{checkId}        url, result, checkedAt
├─ postedReports/{reportId}    title, href, createdAt
└─ postedHelp/{postId}         title, href, createdAt

publicProfiles/{uid}           name, avatar
admins/{uid}                   (empty, added by hand)
scamReports/{reportId}         query, details, ownerId, ownerName, ownerAvatar, createdAt, seenBy
helpPosts/{postId}             question, ownerId, ownerName, ownerAvatar, createdAt, ratings, comments
```

## `users/{uid}`

One document per account, created at sign-up. Only that user can read or write it and its subcollections.

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `email` | string | |
| `country` | string | |
| `school` | string | |
| `avatar` | map | `{ shape, color }`, or missing for the default icon (see below) |
| `savedReports` | map | Key = scam report id. Value = `{ title, text, href, savedAt }` |
| `savedHelp` | map | Key = help post id. Value = `{ title, text, href, savedAt }` |

Saved items are map fields, not subcollections, because the list is short and always read together with the profile.

- Save: `setDoc(userRef, { savedHelp: { [postId]: {...} } }, { merge: true })`
- Unsave: `updateDoc(userRef, { ["savedHelp." + postId]: deleteField() })`
- There is no `orderBy` on a map, so sort by `savedAt` in JavaScript.
- A saved item is a copy, so it stays when the post is deleted. Profile checks each saved id still exists and removes the ones that don't.

### `users/{uid}/linkChecks/{checkId}`

The user's own link check history. One document per check, auto id.

| Field | Type | Notes |
|---|---|---|
| `url` | string | What the user typed |
| `result` | string | `"safe"` or `"unsafe"`. `"notfound"` and `"error"` aren't saved |
| `checkedAt` | timestamp | `serverTimestamp()` |

For the latest five, use `query(..., orderBy("checkedAt", "desc"), limit(5))`. For the total, use `getCountFromServer(...)`.

### `users/{uid}/postedReports/{reportId}` and `users/{uid}/postedHelp/{postId}`

A short index of what the user has posted. **The document id is the same as the report or post id**, so it's easy to delete together with the original.

| Field | Type | Notes |
|---|---|---|
| `title` | string | Report `query`, or the post's `question` |
| `href` | string | `scam-query.html?id=<id>` or `community-help.html#post-<id>` |
| `createdAt` | timestamp | |

The full content stays in `scamReports` / `helpPosts`. Profile lists them as **My Scam Reports** and **My Questions**.

### Avatars

An avatar is just two names: `{ shape, color }`. The picture is drawn in the browser from `AVATAR_SHAPES` / `AVATAR_COLORS` in `src/avatar.js`, so it's only a few bytes. To add an option, add it there; nothing in Firestore changes.

- `shape`: `circle`, `square`, `triangle`, `diamond`, `pentagon`, `hexagon`, `star`, `heart`, `shield`, `bolt`, `moon`, `flower`, `ring`, `plus`, `smile`
- `color`: `green`, `teal`, `cyan`, `blue`, `indigo`, `purple`, `pink`, `red`, `orange`, `yellow`, `gray`, `dark`

`avatarSrc(avatar)` returns the default icon when the avatar is missing.

## `publicProfiles/{uid}`: names and pictures on posts

`users/{uid}` is private, so the part of a profile other people need lives here too: `{ name, avatar }`. Anyone signed in can read it; only the owner can write it, and only those two fields (name 1 to 50 characters).

Pages that show posts, reports or comments look up the author's **current** name and picture by uid (`src/public-profile.js`), so changing either one updates old posts too:

1. `await loadPublicProfiles(uids)` with the `ownerId`s (and comment uids) on the page
2. `authorName(uid, savedName)` and `avatarSrc(authorAvatar(uid, savedCopy))`

It's kept up to date by:

- **Sign up**: created with the name.
- **Posting** a question, comment or report: the same batch writes my `{ name, avatar }`.
- **Changing** the avatar (`saveAvatar` / `removeAvatar`, `avatar: null` when removed) or the name (Profile, pencil button: also updates `users/{uid}.name` and the login's display name).
- **Opening Profile**: fixes it if it's missing or out of date (older accounts).

A copy still goes into each post (`ownerName` / `ownerAvatar`, `userName` / `userAvatar` on comments). It's only shown when the author has no `publicProfiles` doc, or the post is too old to have an `ownerId`.

The author name always comes from `users/{uid}.name` (or "SafeLink user"), **never the email**, so emails aren't shown to other users.

## `admins/{uid}`

If this doc exists, that account is an admin. Add it by hand in the Firebase console (Start collection `admins`, document id = the user's uid from Authentication, no fields needed). The app can't write here.

Admins see an **Admin** button on Profile that opens `admin.html`, where they can pick documents and delete them:

- **Help posts**: deletes the post and the author's `postedHelp` entry. Single comments can be deleted too.
- **Reports**: deletes the report and the author's `postedReports` entry.
- **Users**: deletes `users/{uid}` with all its subcollections and `publicProfiles/{uid}`, and removes their comments, ratings and "I've seen this" marks from other people's posts. Optionally their posts and reports too. Their login in Firebase Authentication stays.
- **Other data**: any document in `publicProfiles`, the per-user subcollections, or the old collections below.

The rules give admins read and delete on every document (`match /{document=**}`), plus updating `ratings` / `comments` on help posts and `seenBy` on reports.

## `scamReports/{reportId}`

| Field | Type | Notes |
|---|---|---|
| `query` | string | Report title |
| `details` | string | |
| `ownerId` | string | Author uid (was `owner`) |
| `ownerName` | string | |
| `ownerAvatar` | map or null | Copy of the author's avatar when they posted |
| `createdAt` | timestamp | (was `last_updated`) |
| `seenBy` | map | `{ <uid>: true }`, people who tapped "I've seen this". The count is the number of keys |

Anyone signed in can read. Only the author can delete, or edit `query` / `details`. Anyone **except the author** can add or remove their own `seenBy` entry (`updateDoc(reportRef, { ["seenBy." + uid]: true })`, or `deleteField()` to undo). The author's button is disabled. Scam Reports can sort by this count ("Most seen").

## `helpPosts/{postId}`

| Field | Type | Notes |
|---|---|---|
| `question` | string | |
| `ownerId` | string | Author uid |
| `ownerName` | string | Author name (was `userID`, which held the name) |
| `ownerAvatar` | map or null | Copy of the author's avatar when they posted |
| `createdAt` | timestamp | |
| `ratings` | map | `{ <uid>: stars }`, stars is 1 to 5 |
| `comments` | map | `{ <uid>: { <commentId>: { text, userName, userAvatar, createdAt } } }` |

Ratings and comments are grouped by uid so the rules can make sure each user only changes their own entry.

- Rate: `updateDoc(postRef, { ["ratings." + uid]: stars })`
- Comment: `updateDoc(postRef, { ["comments." + uid + "." + commentId]: {...} })`
- Remove either one: same path with `deleteField()`

Deleting the post removes its ratings and comments too, since they're inside it.

Community Help loads 15 posts at a time (`orderBy("createdAt", "desc")`, `limit`, `startAfter`) with a **Load more** button. A saved link to an older post keeps loading pages until that post shows up.

### What the rules check on new posts and reports

- Only the expected fields: a new post can't come with `ratings` / `comments`, and a new report can't come with `seenBy`, so no one can give themselves stars or "seen" marks.
- `ownerId` is my uid, `ownerName` is 1 to 50 characters, `ownerAvatar` is a map or null.
- `createdAt` is the server's time (`serverTimestamp()`), so dates can't be faked.
- Text lengths: question 1000, report title 120, report details 5000 (the inputs have the same `maxlength`).

## Writes that touch two places

Use `writeBatch` so both succeed or neither does.

| Action | Writes |
|---|---|
| Submit a report | `scamReports/{id}` + `users/{uid}/postedReports/{id}` + `publicProfiles/{uid}` |
| Ask a question | `helpPosts/{id}` + `users/{uid}/postedHelp/{id}` + `publicProfiles/{uid}` |
| Comment | `helpPosts/{id}.comments` + `publicProfiles/{uid}` |
| Delete a post | delete both of the above |

To know the id before writing, create the reference first: `const postRef = doc(collection(db, "helpPosts"));` then use `postRef.id` for the second write.

## Which page uses what

| Page | Reads | Writes |
|---|---|---|
| Sign up | | `users/{uid}`, `publicProfiles/{uid}` |
| Home | `users/{uid}` (name) | |
| Link result | | `users/{uid}/linkChecks` |
| Link checker | `users/{uid}/linkChecks` (latest 5, count) | |
| Scam reports | `scamReports`, `publicProfiles` (authors), `users/{uid}` (saved?) | `users/{uid}.savedReports`, `scamReports/{id}.seenBy` |
| Report detail | `scamReports/{id}`, `users/{uid}` (saved?), `publicProfiles/{ownerId}` | `users/{uid}.savedReports`, `scamReports/{id}.seenBy` |
| Submit report | `users/{uid}` (name + avatar to copy) | `scamReports` + `postedReports` (batch) |
| Community help | `helpPosts` (15 at a time), `users/{uid}` (saved? + name/avatar to copy), `publicProfiles` (authors) | `helpPosts` (+ `postedHelp`, `publicProfiles`), `users/{uid}.savedHelp` |
| Admin | everything (admins only) | deletes anything, comments/ratings on `helpPosts`, `seenBy` on reports |
| Profile | `users/{uid}` (name, avatar, saved maps), `linkChecks` (latest 20 + count), `postedReports`, `postedHelp`, `admins/{uid}` (admin?), `publicProfiles/{uid}` | `users/{uid}` (unsave, avatar, name), `publicProfiles/{uid}` (name, avatar) |

## Collections that are no longer used

`links`, `linkChecks` and `avatars` (top level), `helpComments`, `helpRatings`, and the `savedReports` / `savedHelp` / `public` subcollections under users. They only hold test data and can be deleted from the console once the new code is merged.
