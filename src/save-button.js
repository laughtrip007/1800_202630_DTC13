// Save / Saved bookmark button, shared by Community Help and Profile

export function setSaveLook(btn, saved) {
  btn.querySelector("i").className = saved ? "bi bi-bookmark-fill" : "bi bi-bookmark";
  btn.querySelector("span").textContent = saved ? "Saved" : "Save";
  btn.classList.toggle("btn-success", saved);
  btn.classList.toggle("btn-outline-success", !saved);
  btn.setAttribute("aria-pressed", String(saved));
}

export function createSaveButton(saved) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm d-inline-flex align-items-center gap-1";

  const icon = document.createElement("i");
  icon.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  btn.append(icon, label);

  setSaveLook(btn, saved);
  return btn;
}
