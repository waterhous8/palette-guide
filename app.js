const photoInput = document.querySelector("#photoInput");
const canvas = document.querySelector("#photoCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const emptyState = document.querySelector("#emptyState");
const medianRadius = document.querySelector("#medianRadius");
const medianValue = document.querySelector("#medianValue");
const applyFilterButton = document.querySelector("#applyFilter");
const suggestions = document.querySelector("#suggestions");
const targetSwatch = document.querySelector("#targetSwatch");
const mixSwatch = document.querySelector("#mixSwatch");
const pigmentName = document.querySelector("#pigmentName");
const pigmentColor = document.querySelector("#pigmentColor");
const addPigmentButton = document.querySelector("#addPigment");
const paletteRows = document.querySelector("#paletteRows");
const paletteCount = document.querySelector("#paletteCount");
const fixedBrushSize = 75;

const pigmentLibrary = [
  { name: "titanium white", rgb: [246, 244, 232] },
  { name: "naples yellow", rgb: [236, 205, 112] },
  { name: "yellow ochre", rgb: [184, 132, 46] },
  { name: "cadmium orange", rgb: [221, 91, 31] },
  { name: "pale rose blush", rgb: [226, 158, 158] },
  { name: "alizarin crimson", rgb: [128, 20, 42] },
  { name: "raw umber", rgb: [91, 65, 39] },
  { name: "burnt umber", rgb: [99, 48, 29] },
  { name: "cerulean blue", rgb: [42, 122, 165] },
  { name: "cadmium yellow", rgb: [246, 199, 35] },
  { name: "cadmium red", rgb: [190, 42, 32] },
  { name: "transparent red oxide", rgb: [142, 55, 28] },
  { name: "ivory black", rgb: [20, 22, 22] }
];

let selectedPigments = new Set([
  "titanium white",
  "yellow ochre",
  "cadmium orange",
  "alizarin crimson",
  "raw umber",
  "ivory black"
]);
let originalImageData = null;
let displayImageData = null;
let isPointerDown = false;
let selectedPoint = null;
let selectedTargetColor = null;

renderPaletteEditor();

medianRadius.addEventListener("input", () => {
  medianValue.value = medianRadius.value;
});

applyFilterButton.addEventListener("click", () => {
  applyMedianFilter();
});

photoInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const bitmap = await createImageBitmap(file);
  loadBitmap(bitmap);
});

addPigmentButton.addEventListener("click", () => {
  addPigment();
});

pigmentName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addPigment();
  }
});

paletteRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-index]");
  if (button) {
    const index = Number(button.dataset.removeIndex);
    selectedPigments.delete(pigmentLibrary[index].name);
    pigmentLibrary.splice(index, 1);
    renderPaletteEditor();
    refreshCurrentSuggestion();
  }
});

paletteRows.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-pigment-index]");
  if (!checkbox) return;
  const pigment = pigmentLibrary[Number(checkbox.dataset.pigmentIndex)];
  if (checkbox.checked) {
    selectedPigments.add(pigment.name);
  } else {
    selectedPigments.delete(pigment.name);
  }
  renderPaletteEditor();
  refreshCurrentSuggestion();
});

canvas.addEventListener("pointerdown", (event) => {
  if (!displayImageData) return;
  event.preventDefault();
  event.stopPropagation();
  const point = getCanvasPoint(event);
  isPointerDown = true;
  selectedPoint = point;
  canvas.setPointerCapture(event.pointerId);
  suggestForBrush(point);
  redraw();
});

canvas.addEventListener("pointermove", (event) => {
  if (!isPointerDown || !displayImageData) return;
  event.preventDefault();
  event.stopPropagation();
  const point = getCanvasPoint(event);
  selectedPoint = point;
  suggestForBrush(point);
  redraw();
});

canvas.addEventListener("pointerup", () => {
  if (!displayImageData) return;
  isPointerDown = false;
});

canvas.addEventListener("dragstart", (event) => {
  event.preventDefault();
});

canvas.addEventListener("pointercancel", () => {
  isPointerDown = false;
});

function loadBitmap(bitmap) {
  const maxSide = 1100;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  displayImageData = medianLikeFilter(originalImageData, Number(medianRadius.value));
  selectedPoint = null;
  selectedTargetColor = null;
  emptyState.hidden = true;
  setEnabled(true);
  redraw();
  resetSuggestions("Photo loaded. Click any area to get a pigment recipe.");
}

function applyMedianFilter() {
  if (!originalImageData) return;
  setBusy(true);
  window.setTimeout(() => {
    const amount = Number(medianRadius.value);
    displayImageData = amount === 0
      ? new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height)
      : medianLikeFilter(originalImageData, amount);
    if (selectedPoint) suggestForBrush(selectedPoint);
    redraw();
    setBusy(false);
  }, 80);
}

function medianLikeFilter(imageData, amount) {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);
  const out = output.data;
  const source = data;
  if (amount === 0) {
    out.set(source);
    return output;
  }
  const effectiveAmount = Math.min(120, amount * 1.2);
  const radius = Math.max(1, Math.round(effectiveAmount / 10));
  const step = effectiveAmount >= 84 ? 4 : effectiveAmount >= 48 ? 3 : effectiveAmount >= 24 ? 2 : 1;
  const valuesR = [];
  const valuesG = [];
  const valuesB = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      valuesR.length = 0;
      valuesG.length = 0;
      valuesB.length = 0;
      for (let dy = -radius; dy <= radius; dy += step) {
        const sy = clamp(y + dy, 0, height - 1);
        for (let dx = -radius; dx <= radius; dx += step) {
          const sx = clamp(x + dx, 0, width - 1);
          const sourceIndex = (sy * width + sx) * 4;
          valuesR.push(source[sourceIndex]);
          valuesG.push(source[sourceIndex + 1]);
          valuesB.push(source[sourceIndex + 2]);
        }
      }
      valuesR.sort((a, b) => a - b);
      valuesG.sort((a, b) => a - b);
      valuesB.sort((a, b) => a - b);
      const middle = Math.floor(valuesR.length / 2);
      const outputIndex = (y * width + x) * 4;
      out[outputIndex] = valuesR[middle];
      out[outputIndex + 1] = valuesG[middle];
      out[outputIndex + 2] = valuesB[middle];
      out[outputIndex + 3] = source[(y * width + x) * 4 + 3];
    }
  }

  return output;
}

function redraw() {
  if (!displayImageData) return;
  ctx.putImageData(displayImageData, 0, 0);
  drawBrushPreview();
}

function drawBrushPreview() {
  if (!selectedPoint) return;
  const size = fixedBrushSize;
  const half = size / 2;
  const x = clamp(selectedPoint.x - half, 0, canvas.width - size);
  const y = clamp(selectedPoint.y - half, 0, canvas.height - size);
  ctx.save();
  ctx.fillStyle = selectedTargetColor
    ? `rgba(${selectedTargetColor[0]}, ${selectedTargetColor[1]}, ${selectedTargetColor[2]}, 0.72)`
    : "rgba(255, 255, 255, 0.18)";
  ctx.strokeStyle = "rgba(23, 107, 101, 0.95)";
  ctx.lineWidth = Math.max(2, Math.round(canvas.width / 360));
  ctx.fillRect(x, y, size, size);
  ctx.strokeRect(x, y, size, size);
  ctx.restore();
}

function sampleBrushColor(point) {
  const radius = fixedBrushSize / 2;
  const minX = Math.max(0, Math.floor(point.x - radius));
  const maxX = Math.min(canvas.width - 1, Math.ceil(point.x + radius));
  const minY = Math.max(0, Math.floor(point.y - radius));
  const maxY = Math.min(canvas.height - 1, Math.ceil(point.y + radius));
  const data = displayImageData.data;
  const samples = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (Math.hypot(x - point.x, y - point.y) > radius) continue;
      const index = (y * canvas.width + x) * 4;
      samples.push([data[index], data[index + 1], data[index + 2]]);
    }
  }

  return samples.length ? medianColor(samples) : null;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * canvas.width);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * canvas.height);
  return {
    x: clamp(x, 0, canvas.width - 1),
    y: clamp(y, 0, canvas.height - 1)
  };
}

function suggestForBrush(point) {
  if (getActivePigments().length < 1) {
    resetSuggestions("Check at least one pigment to build your palette.");
    return;
  }
  const target = sampleBrushColor(point);
  if (!target) {
    resetSuggestions("Try a larger brush or click further inside the photo.");
    return;
  }
  selectedTargetColor = target;
  const recipes = findRecipes(target);
  const best = recipes[0];
  const mixed = mixRecipe(best.parts);
  targetSwatch.style.background = rgbCss(target);
  mixSwatch.style.background = rgbCss(mixed);
  suggestions.innerHTML = `
    <h2>Mixture Suggestions</h2>
    <p>Target sampled from the pixels inside the brush.</p>
    ${recipes.map((recipe, index) => recipeMarkup(recipe, index)).join("")}
  `;
}

function findRecipes(target) {
  const pairs = [];
  const activePigments = getActivePigments();
  if (activePigments.length === 1) {
    const only = activePigments[0];
    return [{
      parts: [{ ...only, ratio: 1 }],
      mixed: only.rgb,
      score: colorDistance(target, only.rgb)
    }];
  }
  for (let i = 0; i < activePigments.length; i++) {
    for (let j = i; j < activePigments.length; j++) {
      for (let k = j; k < activePigments.length; k++) {
        const options = scoreRatios(target, [activePigments[i], activePigments[j], activePigments[k]]);
        pairs.push(...options);
      }
    }
  }

  const unique = new Map();
  for (const option of pairs.sort((a, b) => a.score - b.score)) {
    const key = option.parts.map((part) => part.name).sort().join("|");
    if (!unique.has(key)) unique.set(key, option);
    if (unique.size >= 3) break;
  }
  return [...unique.values()];
}

function addPigment() {
  const name = pigmentName.value.trim();
  if (!name) {
    pigmentName.focus();
    return;
  }

  const existing = pigmentLibrary.find((pigment) => pigment.name.toLowerCase() === name.toLowerCase());
  const nextPigment = {
    name,
    rgb: hexToRgb(pigmentColor.value)
  };

  if (existing) {
    existing.rgb = nextPigment.rgb;
  } else {
    pigmentLibrary.push(nextPigment);
    selectedPigments.add(nextPigment.name);
  }

  pigmentName.value = "";
  renderPaletteEditor();
  refreshCurrentSuggestion();
}

function renderPaletteEditor() {
  const selectedCount = getActivePigments().length;
  paletteCount.textContent = `${selectedCount} selected`;
  paletteRows.innerHTML = pigmentLibrary.map((pigment, index) => `
    <div class="palette-row">
      <input type="checkbox" ${selectedPigments.has(pigment.name) ? "checked" : ""} data-pigment-index="${index}" aria-label="Use ${escapeHtml(pigment.name)}">
      <span class="palette-swatch" style="background: ${rgbCss(pigment.rgb)}"></span>
      <span>${escapeHtml(pigment.name)}</span>
      <button type="button" aria-label="Remove ${escapeHtml(pigment.name)}" data-remove-index="${index}">Remove</button>
    </div>
  `).join("");
}

function getActivePigments() {
  return pigmentLibrary.filter((pigment) => selectedPigments.has(pigment.name));
}

function refreshCurrentSuggestion() {
  if (selectedPoint && displayImageData) {
    suggestForBrush(selectedPoint);
    redraw();
  }
}

function scoreRatios(target, selected) {
  const ratios = [
    [0.72, 0.18, 0.10],
    [0.62, 0.28, 0.10],
    [0.50, 0.35, 0.15],
    [0.45, 0.45, 0.10],
    [0.34, 0.33, 0.33]
  ];

  return ratios.map((ratio) => {
    const partMap = new Map();
    selected.forEach((pigment, index) => {
      const current = partMap.get(pigment.name);
      if (current) {
        current.ratio += ratio[index];
      } else {
        partMap.set(pigment.name, { ...pigment, ratio: ratio[index] });
      }
    });
    const parts = [...partMap.values()].filter((part) => part.ratio > 0.001);
    const mixed = mixRecipe(parts);
    return {
      parts,
      mixed,
      score: colorDistance(target, mixed)
    };
  });
}

function mixRecipe(parts) {
  const total = parts.reduce((sum, part) => sum + part.ratio, 0);
  const rgb = [0, 0, 0];
  for (const part of parts) {
    const weight = part.ratio / total;
    rgb[0] += part.rgb[0] * weight;
    rgb[1] += part.rgb[1] * weight;
    rgb[2] += part.rgb[2] * weight;
  }
  return rgb.map(Math.round);
}

function recipeMarkup(recipe, index) {
  return `
    <div class="recipe">
      <div class="recipe-head">
        <strong>${index === 0 ? "Closest match" : `Alternative ${index + 1}`}</strong>
      </div>
      <div class="ratio-grid">
        ${recipe.parts.map((part) => `
          <div class="ratio-row">
            <span>${escapeHtml(part.name)}</span>
            <span>${Math.round(part.ratio * 100)}%</span>
            <div class="bar" style="grid-column: 1 / -1">
              <span style="width: ${Math.round(part.ratio * 100)}%; background: ${rgbCss(part.rgb)}"></span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function medianColor(colors) {
  const channels = [0, 1, 2].map((channel) =>
    colors.map((color) => color[channel]).sort((a, b) => a - b)
  );
  const middle = Math.floor(colors.length / 2);
  return channels.map((channel) => channel[middle]);
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

function setEnabled(enabled) {
  medianRadius.disabled = !enabled;
  applyFilterButton.disabled = !enabled;
}

function setBusy(isBusy) {
  applyFilterButton.disabled = isBusy;
  document.body.classList.toggle("is-filtering", isBusy);
  applyFilterButton.textContent = isBusy ? "⌛ Filtering..." : "Apply Median Filter";
}

function resetSuggestions(message) {
  targetSwatch.style.background = "";
  mixSwatch.style.background = "";
  suggestions.innerHTML = `
    <h2>Mixture Suggestions</h2>
    <p>${message}</p>
  `;
}

function rgbCss(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ];
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
