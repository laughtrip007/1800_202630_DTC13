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

publicProfiles/{uid}           avatar
scamReports/{reportId}         query, details, ownerId, ownerName, ownerAvatar, createdAt
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

The full content stays in `scamReports` / `helpPosts`. This is only so each user's posts show up under their account.

### Avatars

An avatar is just two names: `{ shape, color }`. The picture is drawn in the browser from `AVATAR_SHAPES` / `AVATAR_COLORS` in `src/avatar.js`, so it's only a few bytes. To add an option, add it there; nothing in Firestore changes.

- `shape`: `circle`, `square`, `triangle`, `diamond`, `pentagon`, `hexagon`, `star`, `heart`, `shield`, `bolt`, `moon`, `flower`, `ring`, `plus`, `smile`
- `color`: `green`, `teal`, `cyan`, `blue`, `indigo`, `purple`, `pink`, `red`, `orange`, `yellow`, `gray`, `dark`

The user's own avatar lives on their private `users/{uid}` doc. Other users can't read that doc, so it is also saved to **`publicProfiles/{uid}`** (`{ avatar }`), which anyone signed in can read. `saveAvatar` / `removeAvatar` write both in one batch. Removing sets `avatar: null` there instead of deleting the doc.

Pages that show posts look up the author's **current** avatar by uid, so changing your picture updates your old posts and comments too:

1. `await loadPublicAvatars(uids)` with the `ownerId`s (and comment uids) on the page
2. `avatarSrc(authorAvatar(uid, savedCopy))` for each `<img>`

When posting, a copy still goes into the post (`ownerAvatar` on reports and posts, `userAvatar` on comments). It's only used when the author has no `publicProfiles` doc yet (they haven't changed their picture since this was added) or the post is too old to have an `ownerId`. Names still work the old way: changing your name doesn't update old posts.

`avatarSrc(avatar)` returns the default icon when the avatar is missing.

## `scamReports/{reportId}`

| Field | Type | Notes |
|---|---|---|
| `query` | string | Report title |
| `details` | string | |
| `ownerId` | string | Author uid (was `owner`) |
| `ownerName` | string | |
| `ownerAvatar` | map or null | Copy of the author's avatar when they posted |
| `createdAt` | timestamp | (was `last_updated`) |

Anyone signed in can read. Only the author can edit or delete.

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

## Writes that touch two places

Use `writeBatch` so both succeed or neither does.

| Action | Writes |
|---|---|
| Submit a report | `scamReports/{id}` + `users/{uid}/postedReports/{id}` |
| Ask a question | `helpPosts/{id}` + `users/{uid}/postedHelp/{id}` |
| Delete a post | delete both of the above |

To know the id before writing, create the reference first: `const postRef = doc(collection(db, "helpPosts"));` then use `postRef.id` for the second write.

## Which page uses what

| Page | Reads | Writes |
|---|---|---|
| Sign up | | `users/{uid}` |
| Home | `users/{uid}` (name) | |
| Link result | | `users/{uid}/linkChecks` |
| Link checker | `users/{uid}/linkChecks` (latest 5, count) | |
| Scam reports | `scamReports`, `publicProfiles` (authors) | |
| Report detail | `scamReports/{id}`, `users/{uid}` (saved?), `publicProfiles/{ownerId}` | `users/{uid}.savedReports` |
| Submit report | `users/{uid}` (avatar to copy) | `scamReports` + `postedReports` (batch) |
| Community help | `helpPosts`, `users/{uid}` (saved? + avatar to copy), `publicProfiles` (authors) | `helpPosts` (+ `postedHelp`), `users/{uid}.savedHelp` |
| Profile | `users/{uid}` (name, avatar, saved maps), `linkChecks` | `users/{uid}` (unsave, avatar), `publicProfiles/{uid}` (avatar) |

`postedReports` and `postedHelp` are written already. The planned "My Reports" / "My Questions" lists on Profile will read them.

## Collections that are no longer used

`links`, `linkChecks` and `avatars` (top level), `helpComments`, `helpRatings`, and the `savedReports` / `savedHelp` / `public` subcollections under users. They only hold test data and can be deleted from the console once the new code is merged.
