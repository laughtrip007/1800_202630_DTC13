import { logoutUser, onAuthReady } from "/src/authentication.js";
import logoUrl from "/images/safelink-logo.png";

// phone header for each page. pages not listed (main, login) don't get one
const pages = {
  "features.html": { title: "Features" },
  "profile.html": { title: "Profile" },
  "admin.html": { title: "Admin", back: "profile.html" },
  "link-checker.html": { title: "Link Checker", back: "features.html" },
  "analyzing.html": { title: "Link Checker" },
  "link-result.html": { title: "Link Checker", back: "link-checker.html" },
  "scam-reports.html": {
    title: "Scam Reports",
    back: "features.html",
    action: { href: "submit-report.html", icon: "bi-plus-lg", label: "Submit a report" },
  },
  "scam-query.html": { title: "Scam Report", back: "scam-reports.html" },
  "submit-report.html": { title: "Submit a Report", back: "scam-reports.html" },
  "community-help.html": {
    title: "Community Help",
    back: "features.html",
    action: { href: "#postForm", icon: "bi-pencil-square", label: "Ask a question" },
  },
};


function iconLink(href, icon, label, attrs = "") {
  return `
    <a class="btn btn-link text-white app-bar-btn" href="${href}" aria-label="${label}" title="${label}" ${attrs}>
      <i class="bi ${icon}" aria-hidden="true"></i>
    </a>`;
}

function phoneHeader(page) {
  if (!page) return "";
  // empty spans keep the title centred
  const left = page.back ? iconLink(page.back, "bi-arrow-left", "Back", "data-back") : `<span class="app-bar-btn"></span>`;
  const right = page.action
    ? iconLink(page.action.href, page.action.icon, page.action.label)
    : `<span class="app-bar-btn"></span>`;

  return `
    <nav class="navbar bg-success d-md-none app-bar" data-bs-theme="dark">
      <div class="container-fluid flex-nowrap">
        ${left}
        <span class="navbar-brand fw-semibold mx-0 text-truncate">${page.title}</span>
        ${right}
      </div>
    </nav>`;
}

class SiteNavbar extends HTMLElement {
  connectedCallback() {
    const current = location.pathname.split("/").pop();

    this.innerHTML = `
      <nav class="navbar bg-success d-none d-md-flex" data-bs-theme="dark">
        <div class="container-fluid">
          <a class="navbar-brand d-flex align-items-center gap-2" href="main.html">
            <img src="${logoUrl}" alt="" height="36" />
            <span class="fw-semibold">SafeLink</span>
          </a>
          <div id="authControls">
            <!-- placeholder so the navbar doesn't jump -->
            <span class="btn btn-outline-light invisible auth-btn">Log out</span>
          </div>
        </div>
      </nav>
      ${phoneHeader(pages[current])}
    `;

    // came straight from the back page: go back in history instead, so that
    // page keeps its scroll position and search (like the phone's back button)
    this.querySelector("[data-back]")?.addEventListener("click", (event) => {
      if (!document.referrer || history.length < 2) return;
      const from = new URL(document.referrer);
      if (from.origin === location.origin && from.pathname.split("/").pop() === pages[current].back) {
        event.preventDefault();
        history.back();
      }
    });

    const authControls = this.querySelector("#authControls");

    onAuthReady((user) => {
      if (user) {
        authControls.innerHTML = `<button class="btn btn-outline-light auth-btn" type="button">Log out</button>`;
        authControls.querySelector("button").addEventListener("click", logoutUser);
      } else {
        authControls.innerHTML = "";
      }
    });
  }
}

customElements.define("site-navbar", SiteNavbar);
