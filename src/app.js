import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "/styles/style.css";
import "/src/site-navbar.js";
import "/src/bottom-nav.js";
import { onAuthReady } from "/src/authentication.js";

// login check: logged out -> login page, logged in -> home
const page = location.pathname.split("/").pop() || "index.html";
const isLoginPage = page === "login.html";

// only check once, signup does its own redirect after saving the user
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
