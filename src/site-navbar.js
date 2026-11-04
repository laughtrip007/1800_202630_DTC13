import { logoutUser, onAuthReady } from "/src/authentication.js";
import logoUrl from "/images/SafeLink-Logo.png";

class SiteNavbar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <nav class="navbar bg-success" data-bs-theme="dark">
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
    `;

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
