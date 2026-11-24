/*****************************************************************
 * 1. CONFIGURATION & STATE
 *****************************************************************/
const SHEET_ID = "1_D06bA-n2N5HMlgQ7N0D_kzaRzy434jnvfm4u2Dkl7E";
const SHEET_TAB = "masterList";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_TAB)}`;

const SLIDER_SPECS = [
  { key: "saturation",  label: "Saturation",  min: -100, max: 100, def: 0, help: "Makes colors super bright and bold like neon paint, or turns them gray like a black-and-white photo." },
  { key: "hue",         label: "Hue",         min: -180, max: 180, def: 0, help: "Spins the color wheel! It can turn blue hair into bright pink, green, or yellow." },
  { key: "brightness",  label: "Brightness",  min: -100, max: 100, def: 0, help: "Makes your whole picture lighter like turning on a lamp, or darker like turning down the lights." },
  { key: "contrast",    label: "Contrast",    min: -100, max: 100, def: 0, help: "Makes dark shadows darker and bright spots brighter so your face pops out like a comic book." },
  { key: "shadow",      label: "Shadow",      min: -100, max: 100, def: 0, help: "Changes only the darkest parts of your picture, like hair and dark outlines." },
  { key: "highlight",   label: "Highlight",   min: -100, max: 100, def: 0, help: "Changes only the brightest shiny spots on your face and background." },
  { key: "tint",        label: "Tint",        min: -100, max: 100, def: 0, help: "Shifts colors toward cool green on the left or bright magenta pink on the right." },
  { key: "temperature", label: "Temperature", min: -100, max: 100, def: 0, help: "Makes your photo feel chilly and blue on the left, or warm and sunny orange on the right." },
  { key: "posterize",   label: "Posterize",   min: 0,    max: 100, def: 0, help: "Turns smooth photo shading into bold flat paint blocks, just like Andy Warhol's silkscreen prints!" }
];

const state = {
  rosterRows: [],
  identity: null,        // { teacher, colA, colB, label }
  studentName: "",       // sanitized first name for file keys
  sliderValues: {},
  baseImageData: null,   // ImageData at 500x500
  selectedFavorites: [], // indices 1..6 (up to 4)
  gridCells: new Array(16).fill(null) // stores variation index 1..6 for each of 16 cells
};

/*****************************************************************
 * 2. LOCAL STORAGE HELPERS
 *****************************************************************/
function sanitizeFileName(raw) {
  const cleaned = String(raw || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned || "student";
}

function keyOriginal() { return `${state.studentName}_original.png`; }
function keyWarhol(n)  { return `${state.studentName}_warhol_${n}.png`; }
function keyFinal()    { return `${state.studentName}_warhol_final.png`; }

function safeSaveStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    alert("Browser storage is full. Try switching students or clearing old browser data.");
    return false;
  }
}

function getSavedWarholCount() {
  let count = 0;
  for (let i = 1; i <= 6; i++) {
    if (localStorage.getItem(keyWarhol(i))) count++;
  }
  return count;
}

function getNextWarholSlot() {
  for (let i = 1; i <= 6; i++) {
    if (!localStorage.getItem(keyWarhol(i))) return i;
  }
  return 6;
}

/*****************************************************************
 * 3. SCREEN NAVIGATION
 *****************************************************************/
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/*****************************************************************
 * 4. GOOGLE SHEETS ROSTER CONNECTION
 *****************************************************************/
function cellText(cell) {
  if (!cell) return "";
  if (cell.v !== null && cell.v !== undefined) return String(cell.v).trim();
  if (cell.f !== null && cell.f !== undefined) return String(cell.f).trim();
  return "";
}

async function loadMasterList() {
  const statusEl = document.getElementById("rosterStatus");
  const errBox = document.getElementById("sheetErrorBox");
  statusEl.style.display = "block";
  statusEl.textContent = "Loading class roster from Google Sheets...";
  errBox.style.display = "none";

  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error("Network error");
    const rawText = await res.text();
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Invalid sheet response");

    const json = JSON.parse(rawText.substring(start, end + 1));
    const rows = (json.table && json.table.rows) || [];

    // Filter: Column E (index 4) must equal "3"
    const valid = [];
    rows.forEach(r => {
      const c = r.c || [];
      const colA = cellText(c[0]);
      const colB = cellText(c[1]);
      const colD = cellText(c[3]);
      const colE = cellText(c[4]);
      if (colE === "3" && colA && colD) {
        valid.push({
          colA,
          colB,
          teacher: colD,
          label: `${colA} ${colB ? colB.charAt(0) : ""}`.trim()
        });
      }
    });

    if (valid.length === 0) {
      throw new Error("No Grade 3 rows found in masterList.");
    }

    state.rosterRows = valid;
    statusEl.style.display = "none";
    renderTeacherButtons();
  } catch (err) {
    console.error(err);
    statusEl.style.display = "none";
    errBox.style.display = "block";
  }
}

function renderTeacherButtons() {
  const uniqueTeachers = [...new Set(state.rosterRows.map(r => r.teacher))].sort();
  const container = document.getElementById("teacherButtons");
  container.innerHTML = "";

  uniqueTeachers.forEach(teacher => {
    const btn = document.createElement("button");
    btn.className = "roster-btn";
    btn.textContent = teacher;
    btn.setAttribute("data-help", `Click here if ${teacher} is your teacher.`);
    btn.onclick = () => selectTeacher(teacher);
    container.appendChild(btn);
  });

  document.getElementById("teacherStep").style.display = "block";
  document.getElementById("studentStep").style.display = "none";
}

function selectTeacher(teacher) {
  const students = state.rosterRows.filter(r => r.teacher === teacher);
  const container = document.getElementById("studentButtons");
  container.innerHTML = "";
  document.getElementById("studentStepTitle").textContent = `Step 2: Choose Your Name (${teacher})`;

  students.forEach(stu => {
    const btn = document.createElement("button");
    btn.className = "roster-btn";
    btn.textContent = stu.label;
    btn.setAttribute("data-help", `Click this button if you are ${stu.label}.`);
    btn.onclick = () => selectStudentIdentity(stu);
    container.appendChild(btn);
  });

  document.getElementById("teacherStep").style.display = "none";
  document.getElementById("studentStep").style.display = "block";
}

function selectStudentIdentity(stu) {
  state.identity = stu;
  localStorage.setItem("warhol_student_identity", JSON.stringify(stu));
  enterNameAndUploadStep();
}

function updateHeaderIdentity() {
  const badge = document.getElementById("studentBadge");
  const switchBtn = document.getElementById("switchUserBtn");
  if (state.identity) {
    badge.style.display = "inline-flex";
    badge.textContent = `${state.identity.label} · ${state.identity.teacher}`;
    switchBtn.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
    switchBtn.style.display = "none";
  }
}

/*****************************************************************
 * 5. NAME ENTRY, PHOTO UPLOAD & SQUARE CROPPER
 *****************************************************************/
function enterNameAndUploadStep() {
  updateHeaderIdentity();
  const savedName = localStorage.getItem("warhol_active_first_name");
  const defaultName = savedName || (state.identity ? state.identity.colA : "");
  document.getElementById("firstNameInput").value = defaultName;
  state.studentName = sanitizeFileName(defaultName);

  const existingOrig = localStorage.getItem(keyOriginal());
  document.getElementById("resumeExistingWrap").style.display = existingOrig ? "block" : "none";
  showScreen("screenUpload");
}

let cropImg = null;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropBaseScale = 1;
let cropZoom = 1;
let isDraggingCrop = false;
let dragStartX = 0;
let dragStartY = 0;

function openCropperWithFile(file) {
  const rawName = document.getElementById("firstNameInput").value.trim();
  if (!rawName) {
    alert("Please enter your first name before uploading a photo.");
    document.getElementById("firstNameInput").focus();
    return;
  }
  state.studentName = sanitizeFileName(rawName);
  localStorage.setItem("warhol_active_first_name", rawName);

  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      cropImg = img;
      const canvas = document.getElementById("cropCanvas");
      cropBaseScale = Math.max(canvas.width / img.width, canvas.height / img.height);
      cropZoom = 1;
      document.getElementById("cropZoomSlider").value = "1";
      cropOffsetX = (canvas.width - img.width * cropBaseScale) / 2;
      cropOffsetY = (canvas.height - img.height * cropBaseScale) / 2;
      drawCropCanvas();
      showScreen("screenCrop");
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function drawCropCanvas() {
  if (!cropImg) return;
  const canvas = document.getElementById("cropCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scale = cropBaseScale * cropZoom;
  const w = cropImg.width * scale;
  const h = cropImg.height * scale;
  ctx.drawImage(cropImg, cropOffsetX, cropOffsetY, w, h);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 3, 0); ctx.lineTo(canvas.width / 3, canvas.height);
  ctx.moveTo((canvas.width * 2) / 3, 0); ctx.lineTo((canvas.width * 2) / 3, canvas.height);
  ctx.moveTo(0, canvas.height / 3); ctx.lineTo(canvas.width, canvas.height / 3);
  ctx.moveTo(0, (canvas.height * 2) / 3); ctx.lineTo(canvas.width, (canvas.height * 2) / 3);
  ctx.stroke();
}

function saveCroppedOriginal() {
  if (!cropImg) return;
  const viewCanvas = document.getElementById("cropCanvas");
  const exportSize = 500;
  const outCanvas = document.createElement("canvas");
  outCanvas.width = exportSize;
  outCanvas.height = exportSize;
  const octx = outCanvas.getContext("2d");

  const ratio = exportSize / viewCanvas.width;
  const scale = cropBaseScale * cropZoom * ratio;
  octx.drawImage(
    cropImg,
    cropOffsetX * ratio,
    cropOffsetY * ratio,
    cropImg.width * scale,
    cropImg.height * scale
  );

  const pngDataUrl = outCanvas.toDataURL("image/png");
  if (safeSaveStorage(keyOriginal(), pngDataUrl)) {
    openEditorWithOriginal();
  }
}

/*****************************************************************
 * 6. WARHOL PHOTO EDITOR & PIXEL FILTERS
 *****************************************************************/
function buildSlidersUI() {
  const container = document.getElementById("slidersContainer");
  container.innerHTML = "";
  SLIDER_SPECS.forEach(spec => {
    state.sliderValues[spec.key] = spec.def;
    const wrap = document.createElement("div");
    wrap.className = "slider-item";
    wrap.setAttribute("data-help", spec.help);
    wrap.innerHTML = `
      <div class="slider-header">
        <span>${spec.label}</span>
        <span id="val_${spec.key}">${spec.def}</span>
      </div>
      <input type="range" id="slider_${spec.key}" min="${spec.min}" max="${spec.max}" value="${spec.def}" />
    `;
    const input = wrap.querySelector("input");
    input.addEventListener("input", () => {
      state.sliderValues[spec.key] = Number(input.value);
      document.getElementById(`val_${spec.key}`).textContent = input.value;
      scheduleRender();
    });
    container.appendChild(wrap);
  });
}

function resetSlidersToDefault() {
  SLIDER_SPECS.forEach(spec => {
    state.sliderValues[spec.key] = spec.def;
    const input = document.getElementById(`slider_${spec.key}`);
    const valEl = document.getElementById(`val_${spec.key}`);
    if (input) input.value = spec.def;
    if (valEl) valEl.textContent = spec.def;
  });
}

function openEditorWithOriginal() {
  const origUrl = localStorage.getItem(keyOriginal());
  if (!origUrl) {
    enterNameAndUploadStep();
    return;
  }

  const savedCount = getSavedWarholCount();
  document.getElementById("fileNamingHint").textContent = savedCount >= 6
    ? `Source: ${keyOriginal()} · All 6 variations saved`
    : `Source: ${keyOriginal()} · Next save: ${keyWarhol(getNextWarholSlot())}`;

  const img = new Image();
  img.onload = () => {
    const canvas = document.getElementById("editorCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    state.baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    resetSlidersToDefault();
    renderGallerySlots();
    showScreen("screenStudio");
  };
  img.src = origUrl;
}

let renderPending = false;
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    applyFiltersToCanvas(false);
  });
}

function clamp255(v) {
  return v < 0 ? 0 : (v > 255 ? 255 : v);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255
  ];
}

function applyFiltersToCanvas(commitAsNewBase) {
  if (!state.baseImageData) return;
  const canvas = document.getElementById("editorCanvas");
  const ctx = canvas.getContext("2d");

  const src = state.baseImageData.data;
  const out = ctx.createImageData(canvas.width, canvas.height);
  const dst = out.data;

  const {
    saturation, hue, brightness, contrast,
    shadow, highlight, tint, temperature, posterize
  } = state.sliderValues;

  const cVal = contrast * 2.55;
  const contrastFactor = (259 * (cVal + 255)) / (255 * (259 - cVal));
  const satMult = 1 + saturation / 100;
  const hueShift = hue / 360;
  const levels = posterize > 0 ? Math.max(2, Math.round(16 - (posterize / 100) * 14)) : 0;
  const step = levels > 1 ? 255 / (levels - 1) : 1;

  for (let i = 0; i < src.length; i += 4) {
    let r = src[i];
    let g = src[i + 1];
    let b = src[i + 2];

    // 1. Temperature & Tint
    r += temperature * 0.65 + tint * 0.25;
    g -= tint * 0.55;
    b -= temperature * 0.65 - tint * 0.25;

    // 2. Brightness
    r += brightness * 1.28;
    g += brightness * 1.28;
    b += brightness * 1.28;

    // 3. Contrast
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // 4. Shadows & Highlights
    const lum = clamp255(0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const wShadow = Math.pow(1 - lum, 2);
    const wHigh = Math.pow(lum, 2);
    const shAdj = shadow * 1.15 * wShadow + highlight * 1.15 * wHigh;
    r += shAdj;
    g += shAdj;
    b += shAdj;

    r = clamp255(r);
    g = clamp255(g);
    b = clamp255(b);

    // 5. Hue & Saturation
    if (hue !== 0 || saturation !== 0) {
      let [h, s, l] = rgbToHsl(r, g, b);
      h = (h + hueShift + 1) % 1;
      s = Math.max(0, Math.min(1, s * satMult));
      [r, g, b] = hslToRgb(h, s, l);
    }

    // 6. Posterize
    if (levels > 0) {
      r = Math.round(Math.round((r / 255) * (levels - 1)) * step);
      g = Math.round(Math.round((g / 255) * (levels - 1)) * step);
      b = Math.round(Math.round((b / 255) * (levels - 1)) * step);
    }

    dst[i]     = clamp255(r);
    dst[i + 1] = clamp255(g);
    dst[i + 2] = clamp255(b);
    dst[i + 3] = src[i + 3];
  }

  ctx.putImageData(out, 0, 0);

  if (commitAsNewBase) {
    state.baseImageData = out;
    resetSlidersToDefault();
  }
}

/*****************************************************************
 * 7. COMPARISON POPUP & SAVING 1..6 WARHOL VARIATIONS
 *****************************************************************/
function openSaveComparisonModal() {
  const canvas = document.getElementById("editorCanvas");
  const currentDataUrl = canvas.toDataURL("image/png");
  const origDataUrl = localStorage.getItem(keyOriginal());
  const nextSlot = getNextWarholSlot();

  const priorImages = [];
  for (let i = 1; i < nextSlot; i++) {
    const url = localStorage.getItem(keyWarhol(i));
    if (url) priorImages.push({ label: keyWarhol(i), url });
  }

  const titleEl = document.getElementById("compareModalTitle");
  const questionEl = document.getElementById("compareModalQuestion");
  const thumbsEl = document.getElementById("compareThumbnails");
  thumbsEl.innerHTML = "";

  if (nextSlot === 1) {
    titleEl.textContent = `Compare Before Saving (${keyWarhol(1)})`;
    questionEl.textContent = "Compare your new variation with the original image. Confirm that the color treatment is clearly distinct before saving.";
  } else {
    titleEl.textContent = `Compare Before Saving (${keyWarhol(nextSlot)})`;
    questionEl.textContent = "Compare your new variation against the original and prior saves to ensure each version is distinct.";
  }

  thumbsEl.appendChild(makeCompareCard("Original", origDataUrl, false));

  priorImages.forEach(item => {
    thumbsEl.appendChild(makeCompareCard(item.label, item.url, false));
  });

  thumbsEl.appendChild(makeCompareCard(`New (${keyWarhol(nextSlot)})`, currentDataUrl, true));

  document.getElementById("compareConfirmBtn").onclick = () => {
    if (safeSaveStorage(keyWarhol(nextSlot), currentDataUrl)) {
      document.getElementById("compareModal").classList.remove("open");
      renderGallerySlots();

      const totalSaved = getSavedWarholCount();
      if (totalSaved < 6) {
        alert(`Saved as ${keyWarhol(nextSlot)}.\n\nReopening your original photo to create variation #${totalSaved + 1}.`);
        openEditorWithOriginal();
      } else {
        alert(`All 6 variations have been saved.\n\nThe "Create 4×4 Grid" layout builder is now unlocked.`);
        openEditorWithOriginal();
      }
    }
  };

  document.getElementById("compareModal").classList.add("open");
}

function makeCompareCard(caption, src, isNew) {
  const div = document.createElement("div");
  div.className = "compare-item" + (isNew ? " highlight-new" : "");
  div.innerHTML = `<img src="${src}" alt="${caption}" /><div style="font-family:var(--font-mono); font-size:0.72rem; word-break:break-all;">${caption}</div>`;
  return div;
}

function renderGallerySlots() {
  const container = document.getElementById("gallerySlots");
  container.innerHTML = "";

  const origUrl = localStorage.getItem(keyOriginal());
  const origBox = document.createElement("div");
  origBox.className = "slot-box" + (origUrl ? " filled" : "");
  origBox.setAttribute("data-help", "This is your original square photo. Click it anytime to start fresh from the beginning.");
  origBox.style.cursor = "pointer";
  origBox.onclick = openEditorWithOriginal;
  origBox.innerHTML = origUrl
    ? `<img src="${origUrl}" alt="Original" /><div>Original</div>`
    : `<div class="slot-placeholder">—</div><div>Original</div>`;
  container.appendChild(origBox);

  let count = 0;
  for (let i = 1; i <= 6; i++) {
    const url = localStorage.getItem(keyWarhol(i));
    if (url) count++;
    const box = document.createElement("div");
    box.className = "slot-box" + (url ? " filled" : "");
    box.setAttribute("data-help", url
      ? `Saved Warhol image #${i} (${keyWarhol(i)}).`
      : `Empty slot #${i}. Adjust the sliders and click Save to fill this spot!`);
    box.innerHTML = url
      ? `<img src="${url}" alt="Warhol ${i}" /><div>0${i}</div>`
      : `<div class="slot-placeholder">0${i}</div><div>Empty</div>`;
    container.appendChild(box);
  }

  document.getElementById("savedCountLabel").textContent = count;
  const unlockBtn = document.getElementById("unlockGridBtn");
  if (count >= 6) {
    unlockBtn.disabled = false;
    unlockBtn.textContent = "Create 4×4 Grid";
  } else {
    unlockBtn.disabled = true;
    unlockBtn.textContent = `Create 4×4 Grid (${count}/6)`;
  }
}

/*****************************************************************
 * 8. 4x4 WARHOL ARRAY BUILDER & FINAL DOWNLOAD
 *****************************************************************/
function openGridBuilder() {
  state.selectedFavorites = [1, 2, 3, 4];
  renderFavoritePicker();
  applyGridPattern("diagonal");
  showScreen("screenGrid");
}

function renderFavoritePicker() {
  const container = document.getElementById("favPickerGrid");
  container.innerHTML = "";
  document.getElementById("favCountLabel").textContent = state.selectedFavorites.length;

  for (let i = 1; i <= 6; i++) {
    const url = localStorage.getItem(keyWarhol(i));
    if (!url) continue;
    const favIdx = state.selectedFavorites.indexOf(i);
    const isSelected = favIdx !== -1;

    const btn = document.createElement("button");
    btn.className = "fav-option" + (isSelected ? " selected" : "");
    btn.setAttribute("data-help", `Click to select or unselect Warhol #${i} as one of your 4 favorites.`);
    btn.innerHTML = `
      <img src="${url}" alt="Warhol ${i}" />
      ${isSelected ? `<span class="fav-badge">${favIdx + 1}</span>` : ""}
      <div style="font-family:var(--font-mono); font-size:0.72rem;">Var 0${i}</div>
    `;
    btn.onclick = () => toggleFavorite(i);
    container.appendChild(btn);
  }

  document.getElementById("downloadFinalBtn").disabled = state.selectedFavorites.length !== 4;
}

function toggleFavorite(slotNum) {
  const idx = state.selectedFavorites.indexOf(slotNum);
  if (idx !== -1) {
    state.selectedFavorites.splice(idx, 1);
  } else {
    if (state.selectedFavorites.length >= 4) {
      state.selectedFavorites.shift();
    }
    state.selectedFavorites.push(slotNum);
  }
  renderFavoritePicker();
  if (state.selectedFavorites.length === 4) {
    applyGridPattern("diagonal");
  } else {
    render4x4Board();
  }
}

function applyGridPattern(pattern) {
  if (state.selectedFavorites.length !== 4) return;
  const f = state.selectedFavorites;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let pick = f[0];
      if (pattern === "diagonal") pick = f[(r + c) % 4];
      if (pattern === "rows")     pick = f[r % 4];
      if (pattern === "columns")  pick = f[c % 4];
      state.gridCells[r * 4 + c] = pick;
    }
  }
  render4x4Board();
}

function render4x4Board() {
  const board = document.getElementById("warhol4x4Board");
  board.innerHTML = "";

  for (let i = 0; i < 16; i++) {
    const cell = document.createElement("div");
    cell.className = "warhol-cell";
    cell.setAttribute("data-help", "Click this square to switch which of your 4 favorite pictures goes here!");

    let slotNum = state.gridCells[i];
    if (state.selectedFavorites.length > 0 && !state.selectedFavorites.includes(slotNum)) {
      slotNum = state.selectedFavorites[i % state.selectedFavorites.length];
      state.gridCells[i] = slotNum;
    }

    const url = slotNum ? localStorage.getItem(keyWarhol(slotNum)) : null;
    if (url) {
      cell.innerHTML = `<img src="${url}" alt="Tile ${i + 1}" />`;
    }

    cell.onclick = () => {
      if (state.selectedFavorites.length === 0) return;
      const curIdx = state.selectedFavorites.indexOf(state.gridCells[i]);
      const nextIdx = (curIdx + 1) % state.selectedFavorites.length;
      state.gridCells[i] = state.selectedFavorites[nextIdx];
      render4x4Board();
    };

    board.appendChild(cell);
  }
}

async function downloadFinal4x4Image() {
  if (state.selectedFavorites.length !== 4) {
    alert("Please select 4 variations first.");
    return;
  }

  const tileSize = 400; // 1600x1600 crisp final PNG
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = tileSize * 4;
  finalCanvas.height = tileSize * 4;
  const ctx = finalCanvas.getContext("2d");

  const loadImg = src => new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.src = src;
  });

  for (let idx = 0; idx < 16; idx++) {
    const slotNum = state.gridCells[idx];
    const url = localStorage.getItem(keyWarhol(slotNum));
    if (!url) continue;
    const img = await loadImg(url);
    const row = Math.floor(idx / 4);
    const col = idx % 4;
    ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
  }

  const link = document.createElement("a");
  link.download = keyFinal();
  link.href = finalCanvas.toDataURL("image/png");
  link.click();
}

/*****************************************************************
 * 9. RIGHT-CLICK HELPER POPUP + TEXT-TO-SPEECH
 *****************************************************************/
const helperPopup = document.getElementById("kidHelperPopup");
const helperTextEl = document.getElementById("kidHelperText");

function findHelpElement(el) {
  while (el && el !== document.body) {
    if (el.hasAttribute && el.hasAttribute("data-help")) return el;
    el = el.parentElement;
  }
  return null;
}

function showKidHelper(targetEl, clientX, clientY) {
  const text = targetEl.getAttribute("data-help");
  if (!text) return;

  helperTextEl.textContent = text;
  helperPopup.classList.add("visible");

  const pad = 14;
  const rect = helperPopup.getBoundingClientRect();
  let left = clientX + 12;
  let top = clientY + 12;
  if (left + rect.width > window.innerWidth - pad) {
    left = Math.max(pad, window.innerWidth - rect.width - pad);
  }
  if (top + rect.height > window.innerHeight - pad) {
    top = Math.max(pad, clientY - rect.height - 12);
  }
  helperPopup.style.left = `${left}px`;
  helperPopup.style.top = `${top}px`;
}

function hideKidHelper() {
  helperPopup.classList.remove("visible");
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

document.addEventListener("contextmenu", e => {
  const helpEl = findHelpElement(e.target);
  if (helpEl) {
    e.preventDefault();
    showKidHelper(helpEl, e.clientX, e.clientY);
  }
});

document.addEventListener("mousedown", e => {
  if (e.button === 0 && helperPopup.classList.contains("visible")) {
    if (!helperPopup.contains(e.target)) {
      hideKidHelper();
    }
  }
});

document.getElementById("closeHelpBtn").onclick = hideKidHelper;

document.getElementById("speakHelpBtn").onclick = () => {
  const msg = helperTextEl.textContent;
  if (!msg) return;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } else {
    alert("Your browser does not support read-aloud speech.");
  }
};

/*****************************************************************
 * 10. EVENT WIRING & INITIALIZATION
 *****************************************************************/
document.getElementById("switchUserBtn").onclick = () => {
  localStorage.removeItem("warhol_student_identity");
  state.identity = null;
  updateHeaderIdentity();
  showScreen("screenRoster");
  if (state.rosterRows.length === 0) loadMasterList();
  else renderTeacherButtons();
};

document.getElementById("backToTeachersBtn").onclick = renderTeacherButtons;
document.getElementById("retrySheetBtn").onclick = loadMasterList;

document.getElementById("choosePhotoBtn").onclick = () => {
  document.getElementById("imageUploadInput").click();
};

document.getElementById("imageUploadInput").onchange = e => {
  if (e.target.files && e.target.files[0]) {
    openCropperWithFile(e.target.files[0]);
    e.target.value = "";
  }
};

document.getElementById("resumeStudioBtn").onclick = () => {
  const rawName = document.getElementById("firstNameInput").value.trim();
  if (rawName) {
    state.studentName = sanitizeFileName(rawName);
    localStorage.setItem("warhol_active_first_name", rawName);
  }
  openEditorWithOriginal();
};

// Cropper Drag & Zoom Events
const cropCanvas = document.getElementById("cropCanvas");
cropCanvas.addEventListener("pointerdown", e => {
  isDraggingCrop = true;
  dragStartX = e.clientX - cropOffsetX;
  dragStartY = e.clientY - cropOffsetY;
  cropCanvas.setPointerCapture(e.pointerId);
});
cropCanvas.addEventListener("pointermove", e => {
  if (!isDraggingCrop) return;
  cropOffsetX = e.clientX - dragStartX;
  cropOffsetY = e.clientY - dragStartY;
  drawCropCanvas();
});
cropCanvas.addEventListener("pointerup", () => { isDraggingCrop = false; });

document.getElementById("cropZoomSlider").oninput = function () {
  cropZoom = Number(this.value);
  drawCropCanvas();
};

document.getElementById("cancelCropBtn").onclick = () => showScreen("screenUpload");
document.getElementById("confirmCropBtn").onclick = saveCroppedOriginal;

// Editor Actions
document.getElementById("applyBtn").onclick = () => applyFiltersToCanvas(true);
document.getElementById("saveVariationBtn").onclick = openSaveComparisonModal;
document.getElementById("compareCancelBtn").onclick = () => {
  document.getElementById("compareModal").classList.remove("open");
};
document.getElementById("reopenOriginalBtn").onclick = openEditorWithOriginal;
document.getElementById("changeBasePhotoBtn").onclick = enterNameAndUploadStep;
document.getElementById("unlockGridBtn").onclick = openGridBuilder;

// 4x4 Grid Actions
document.getElementById("backToEditorBtn").onclick = openEditorWithOriginal;
document.querySelectorAll(".pattern-btn").forEach(btn => {
  btn.onclick = () => applyGridPattern(btn.getAttribute("data-pattern"));
});
document.getElementById("downloadFinalBtn").onclick = downloadFinal4x4Image;

// Boot App
buildSlidersUI();
const savedIdentityRaw = localStorage.getItem("warhol_student_identity");
if (savedIdentityRaw) {
  try {
    state.identity = JSON.parse(savedIdentityRaw);
    enterNameAndUploadStep();
  } catch (e) {
    showScreen("screenRoster");
    loadMasterList();
  }
} else {
  showScreen("screenRoster");
  loadMasterList();
}
