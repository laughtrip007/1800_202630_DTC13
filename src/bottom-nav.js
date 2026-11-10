const tabs = [
  { href: "main.html", icon: "bi-house-door", activeIcon: "bi-house-door-fill", label: "Home", pages: ["main.html"] },
  {
    href: "features.html",
    icon: "bi-grid", activeIcon: "bi-grid-fill",
    label: "Features",
    pages: [
      "features.html",
      "link-checker.html",
      "analyzing.html",
      "link-result.html",
      "scam_reports.html",
      "scam_query.html",
      "submitReport.html",
      "community_help.html",
    ],
  },
  { href: "profile.html", icon: "bi-person-circle", activeIcon: "bi-person-circle", label: "Profile", pages: ["profile.html"] },
];

class BottomNav extends HTMLElement {
  connectedCallback() {
    const current = location.pathname.split("/").pop();

    const links = tabs
      .map((tab) => {
        const active = tab.pages.includes(current);
        return `
          <a class="nav-link text-white text-center${active ? " active" : ""}"
             href="${tab.href}"${active ? ' aria-current="page"' : ""}>
            <i class="bi ${active ? tab.activeIcon : tab.icon} bottom-nav-icon d-block" aria-hidden="true"></i>
            <small>${tab.label}</small>
          </a>`;
      })
      .join("");

    this.innerHTML = `
      <nav class="navbar fixed-bottom bg-success bottom-nav" aria-label="Bottom navigation">
        <div class="container-fluid justify-content-around">${links}</div>
      </nav>
    `;
  }
}

customElements.define("bottom-nav", BottomNav);
