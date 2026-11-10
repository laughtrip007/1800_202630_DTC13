// In-page replacement for confirm(), using a Bootstrap modal.
// Usage: if (await confirmDialog({ title, message, confirmText })) { ... }
import { Modal } from "bootstrap";

let modalEl = null;

// one modal for the whole page, created the first time it's needed
function buildModal() {
  modalEl = document.createElement("div");
  modalEl.className = "modal fade";
  modalEl.tabIndex = -1;
  modalEl.setAttribute("aria-labelledby", "confirmTitle");
  modalEl.setAttribute("aria-hidden", "true");
  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 shadow">
        <div class="modal-header border-0 pb-0">
          <h2 id="confirmTitle" class="modal-title h5 fw-bold"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body pt-2">
          <p id="confirmMessage" class="mb-0 text-body-secondary"></p>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button id="confirmOk" type="button" class="btn btn-danger"></button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
}

// resolves true if the user clicks the confirm button, false if they cancel or close it
export function confirmDialog({ title, message, confirmText = "Delete" }) {
  if (!modalEl) buildModal();

  // textContent, since the message can contain user text
  modalEl.querySelector("#confirmTitle").textContent = title;
  modalEl.querySelector("#confirmMessage").textContent = message;
  const okBtn = modalEl.querySelector("#confirmOk");
  okBtn.textContent = confirmText;

  const modal = Modal.getOrCreateInstance(modalEl);

  return new Promise((resolve) => {
    let confirmed = false;
    const onOk = () => {
      confirmed = true;
      modal.hide();
    };

    okBtn.addEventListener("click", onOk);
    modalEl.addEventListener(
      "hidden.bs.modal",
      () => {
        okBtn.removeEventListener("click", onOk);
        resolve(confirmed);
      },
      { once: true },
    );
    modal.show();
  });
}
