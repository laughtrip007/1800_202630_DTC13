# SafeLink

## Overview

SafeLink is a client-side web app that helps people avoid online scams. Users can check whether a link is safe before opening it, read and share scam reports, and ask the community for help when something looks suspicious.

Developed for the COMP 1800 course at BCIT, this project applies User-Centred Design practices and agile project management, and uses Firebase for sign-in and data storage.

---

## Features

- **Check a Link**: paste a URL and get a safe / unsafe result, using the Google Safe Browsing API
- **Scam Reports**: browse reports from other users, submit your own, and save the ones you want to keep
- **Community Help**: ask a question, comment, rate posts from 1 to 5 stars, and save useful posts
- **Profile**: see your link check history, saved reports and saved help posts
- **Safety tips** on the home page that change automatically
- Sign-in required: every feature is only available after logging in
- Responsive design for desktop and mobile

---

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **UI**: [Bootstrap 5](https://getbootstrap.com/) and [Bootstrap Icons](https://icons.getbootstrap.com/)
- **Build Tool**: [Vite](https://vitejs.dev/) (multi-page setup)
- **Backend**: Firebase Authentication and Cloud Firestore
- **Link checking**: [Google Safe Browsing API](https://developers.google.com/safe-browsing)

---

## Usage

To run the application locally:

1. **Clone** the repository.
2. **Install dependencies** by running `npm install` in the project root directory.
3. **Create a `.env` file** in the project root with the Firebase and Safe Browsing keys:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_SAFE_BROWSING_API_KEY=...
   ```
4. **Start the development server** by running `npm run dev`.
5. Open the local address shown in your terminal (usually `http://localhost:5173`).

Once the application is running:

1. Sign up or log in.
2. Go to **Features** to check a link, read scam reports, or ask the community.
3. Use the **Save** buttons on reports and help posts, then find them later in **Profile**.

---

## Project Structure

```
1800_202630_DTC13/
├── src/                 # one script per page, plus shared modules
│   ├── app.js           # loaded by every page: Bootstrap, navbars, login check
│   ├── firebaseConfig.js
│   ├── authentication.js
│   ├── site-navbar.js   # <site-navbar> top bar
│   ├── bottom-nav.js    # <bottom-nav> Home / Features / Profile
│   ├── saveButton.js    # shared Save / Saved button
│   └── ...              # main.js, profile.js, communityhelp.js, etc.
├── styles/
│   └── style.css
├── images/
├── *.html               # one file per page (login, main, features, profile, ...)
├── vite.config.js       # list of pages to build
├── FIRESTORE.md         # database structure
├── firestore.rules      # Firestore security rules
├── package.json
└── README.md
```

New pages must be added to the `pages` list in `vite.config.js`. Anything that reads or writes Firestore should follow [`FIRESTORE.md`](FIRESTORE.md).

---

## Contributors

- **Birjot** - student at BCIT in the CST program.
- **Raine Omand** - A student with a good work ethic and determination!
- **Lance** - a BCIT CST Student with a passion for solving problems and creating new things that help make life easier. Fun fact: Plays basketball and loves Pop.
- **Shuhan** - BCIT CST Student with a passion for technology, programming, and building user-friendly applications. Fun fact: Loves soccer, video games, cooking, and exploring new places.

---

## Acknowledgments

- Link safety results come from the [Google Safe Browsing API](https://developers.google.com/safe-browsing).
- Icons from [Bootstrap Icons](https://icons.getbootstrap.com/).
- Code snippets were adapted from resources such as [Stack Overflow](https://stackoverflow.com/) and [MDN Web Docs](https://developer.mozilla.org/).

---

## Limitations and Future Work

### Limitations

- A "safe" result only means the link isn't on Google's known threat lists. It can't guarantee a site is trustworthy.
- Scam reports and help posts are not moderated.
- Accessibility features can be further improved.

### Future Work

- Show how many times a link has been checked by other users.
- "My Reports" and "My Questions" lists on the profile page.
- Search and filter for scam reports.
- Dark mode.

---

## License

This project is licensed under the MIT License.
