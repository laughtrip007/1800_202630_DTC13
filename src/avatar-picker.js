// Profile picture picker: choose a shape and a color.
// The markup is #avatarModal in profile.html.
import { Modal } from "bootstrap";
import {
  AVATAR_SHAPES,
  AVATAR_COLORS,
  presetAvatarUrl,
  saveAvatar,
  removeAvatar,
} from "/src/avatar.js";

// onSaved(avatar) is called after saving; avatar is null when the picture was removed
export function createAvatarPicker({ uid, onSaved }) {
  const modal = Modal.getOrCreateInstance(document.querySelector("#avatarModal"));
  const preview = document.querySelector("#presetPreview");
  const shapeRow = document.querySelector("#shapeOptions");
  const colorRow = document.querySelector("#colorOptions");
  const errorEl = document.querySelector("#avatarError");
  const removeBtn = document.querySelector("#avatarRemove");
  const saveBtn = document.querySelector("#avatarSave");

  let shape = "circle";
  let color = "green";

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function makeOption(label, onPick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-option";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    const img = document.createElement("img");
    img.className = "rounded-circle";
    img.alt = "";
    img.width = 40;
    img.height = 40;
    btn.appendChild(img);
    btn.addEventListener("click", () => {
      onPick();
      refresh();
    });
    return btn;
  }

  const shapeButtons = Object.entries(AVATAR_SHAPES).map(([key, s]) => {
    const btn = makeOption(s.label, () => (shape = key));
    shapeRow.appendChild(btn);
    return [key, btn];
  });
  const colorButtons = Object.entries(AVATAR_COLORS).map(([key, c]) => {
    const btn = makeOption(c.label, () => (color = key));
    colorRow.appendChild(btn);
    return [key, btn];
  });

  // shape buttons show the chosen color, color buttons show the chosen shape
  function refresh() {
    preview.src = presetAvatarUrl(shape, color);
    preview.alt = `${AVATAR_COLORS[color].label} ${AVATAR_SHAPES[shape].label.toLowerCase()} avatar`;
    shapeButtons.forEach(([key, btn]) => {
      btn.firstChild.src = presetAvatarUrl(key, color);
      btn.setAttribute("aria-pressed", String(key === shape));
    });
    colorButtons.forEach(([key, btn]) => {
      btn.firstChild.src = presetAvatarUrl(shape, key);
      btn.setAttribute("aria-pressed", String(key === color));
    });
  }

  // a random combo, for people who don't want to choose
  document.querySelector("#avatarShuffle").addEventListener("click", () => {
    const pick = (obj) => {
      const keys = Object.keys(obj);
      return keys[Math.floor(Math.random() * keys.length)];
    };
    shape = pick(AVATAR_SHAPES);
    color = pick(AVATAR_COLORS);
    refresh();
  });

  async function run(task) {
    showError("");
    saveBtn.disabled = true;
    removeBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      await task();
      modal.hide();
    } catch (error) {
      console.error("Error saving profile picture:", error);
      // the code (e.g. permission-denied) helps tell a rules problem from a network one
      showError(`Could not save your picture. Please try again.${error.code ? ` (${error.code})` : ""}`);
    } finally {
      saveBtn.disabled = false;
      removeBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  }

  saveBtn.addEventListener("click", () => {
    const avatar = { shape: shape, color: color };
    run(async () => {
      await saveAvatar(uid, avatar);
      onSaved(avatar);
    });
  });

  removeBtn.addEventListener("click", () =>
    run(async () => {
      await removeAvatar(uid);
      onSaved(null);
    }),
  );

  // starts from the user's current avatar, if it's still a valid option
  function open(current) {
    showError("");
    if (AVATAR_SHAPES[current?.shape] && AVATAR_COLORS[current?.color]) {
      shape = current.shape;
      color = current.color;
    }
    refresh();
    removeBtn.hidden = !current;
    modal.show();
  }

  return { open };
}
