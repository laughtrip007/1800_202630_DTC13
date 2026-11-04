// Shared by every page: Bootstrap, global styles, the two navbars, and the login guard.
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "/styles/style.css";
import "/src/site-navbar.js";
import "/src/bottom-nav.js";
import { onAuthReady } from "/src/authentication.js";

// Every page starts with <body hidden> so nothing is shown before we know who the user is.
// - Not logged in  -> only login.html is allowed
// - Logged in      -> login.html and index.html go straight to the home page
const page = location.pathname.split("/").pop() || "index.html";
const isLoginPage = page === "login.html";

// Only react to the first auth result: login/signup handle their own redirect afterwards,
// so the signup flow can finish saving the user's Firestore document first.
const unsubscribe = onAuthReady((user) => {
  unsubscribe();

  if (!user && !isLoginPage) {
    location.replace("login.html");
  } else if (user && (isLoginPage || page === "index.html")) {
    location.replace("main.html");
  } else {
    document.body.hidden = false;
  }
});
