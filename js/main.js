(function () {
  const config = window.SD_CONFIG;
  const overlay = document.getElementById("overlay");
  const warningsEl = document.getElementById("warnings");
  const priceEl = document.getElementById("price");
  const nameEl = document.getElementById("product-name");

  nameEl.textContent = config.productName;

  function hexToRgb(hex) {
    const value = hex.replace(/^0x/i, "#").replace("#", "");
    const r = parseInt(value.substring(0, 2), 16) / 255;
    const g = parseInt(value.substring(2, 4), 16) / 255;
    const b = parseInt(value.substring(4, 6), 16) / 255;
    return { r, g, b };
  }

  function rgbToHex(r, g, b) {
    const unit = Math.abs(Number(r)) <= 1 && Math.abs(Number(g)) <= 1 && Math.abs(Number(b)) <= 1;
    const to255 = (v) => (unit ? Math.round(Number(v) * 255) : Number(v));
    const hex = (v) =>
      Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return "#" + hex(to255(r)) + hex(to255(g)) + hex(to255(b));
  }

  function colorToHex(value) {
    if (typeof value === "string") {
      const hex = value.replace(/^0x/i, "#");
      return /^#[0-9a-fA-F]{6,8}$/.test(hex) ? hex.substring(0, 7) : null;
    }
    if (Array.isArray(value) && value.length >= 3) {
      return rgbToHex(value[0], value[1], value[2]);
    }
    if (value && typeof value === "object") {
      if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
        return rgbToHex(value.r, value.g, value.b);
      }
    }
    return null;
  }

  function restoreColorValue(hex, original) {
    const { r, g, b } = hexToRgb(hex);
    if (Array.isArray(original)) {
      const out = [r, g, b];
      if (original.length >= 4) out.push(original[3]);
      return out;
    }
    if (original && typeof original === "object") {
      return { r, g, b, a: original.a !== undefined ? original.a : 1 };
    }
    if (typeof original === "string" && original.indexOf("0x") !== -1) {
      return "0x" + hex.replace("#", "") + "ff";
    }
    return hex;
  }

  function currentValues() {
    const values = {};
    window.shapediverAPI.getParameters().forEach((p) => {
      values[p.name] = p.value;
    });
    return values;
  }

  function renderWarnings(messages) {
    warningsEl.innerHTML = "";
    messages.forEach((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      warningsEl.appendChild(item);
    });
    warningsEl.classList.toggle("visible", messages.length > 0);
  }

  function renderPrice(values) {
    priceEl.textContent = window.pricing.format(
      window.pricing.calculate(values, config),
      config.currency
    );
  }

  function applyConstraintsAndSend(param, proposedValue) {
    const next = currentValues();
    next[param.name] = proposedValue;

    const result = window.constraints.apply(next);
    const finalValue = result.values[param.name];

    renderWarnings(result.errors);
    renderPrice(result.values);
    window.shapediverAPI.setParameter(param, finalValue);

    return finalValue;
  }

  const registry = new Map();

  function registerRow(row, param) {
    if (!registry.has(row)) {
      registry.set(row, param);
    }
  }

  function syncRow(row, param) {
    if (row._slider) {
      row._slider.value = param.value;
      row._valueOut.textContent = Number(param.value).toFixed(2);
    }
    if (row._check) {
      row._check.checked = Boolean(param.value);
    }
    if (row._color) {
      row._color.value = colorToHex(param.value) || "#808080";
    }
    if (row._options) {
      const current = String(param.value);
      const indexFallback = /^\d+$/.test(current) ? Number(current) : -1;
      row._options.querySelectorAll(".choice-btn").forEach((btn, i) => {
        const isSelected =
          String(btn.dataset.value) === current || i === indexFallback;
        btn.classList.toggle("selected", isSelected);
      });
    }
  }

  function syncAll() {
    registry.forEach((param, row) => syncRow(row, param));
  }

  function buildSlider(param) {
    const min = Number(param.min);
    const max = Number(param.max);
    if (isNaN(min) || isNaN(max)) {
      return null;
    }

    const label = document.createElement("label");
    label.className = "control-label";
    label.textContent = param.name;

    const valueOut = document.createElement("span");
    valueOut.className = "control-value";
    valueOut.textContent = Number(param.value).toFixed(2);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.value = param.value;
    slider.step = "any";
    slider.className = "control-slider";

    const row = document.createElement("div");
    row.className = "control-row";
    row.append(label, valueOut, slider);
    row._slider = slider;
    row._valueOut = valueOut;
    registerRow(row, param);

    slider.addEventListener("input", () => {
      const finalValue = applyConstraintsAndSend(param, Number(slider.value));
      slider.value = finalValue;
      valueOut.textContent = Number(finalValue).toFixed(2);
    });

    return row;
  }

  function choiceLabel(choice) {
    if (choice && typeof choice === "object") {
      return choice.name || String(choice.value);
    }
    return String(choice);
  }

  function choiceValue(choice) {
    if (choice && typeof choice === "object") {
      return choice.value;
    }
    return choice;
  }

  function buildChoice(param) {
    const choices = Array.isArray(param.choices) ? param.choices : [];
    if (choices.length === 0) {
      return null;
    }

    const label = document.createElement("div");
    label.className = "control-label";
    label.textContent = param.name;

    const options = document.createElement("div");
    options.className = "choice-options";

    const current = String(param.value);
    const indexFallback = /^\d+$/.test(current) ? Number(current) : -1;

    choices.forEach((choice, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.dataset.value = choiceValue(choice);

      const swatch = colorToHex(choiceValue(choice));
      if (swatch) {
        btn.classList.add("choice-swatch");
        btn.style.background = swatch;
        btn.title = choiceLabel(choice);
      } else {
        btn.textContent = choiceLabel(choice);
      }

      if (String(choiceValue(choice)) === current || i === indexFallback) {
        btn.classList.add("selected");
      }

      btn.addEventListener("click", () => {
        options.querySelectorAll(".choice-btn").forEach((b) => {
          b.classList.remove("selected");
        });
        btn.classList.add("selected");
        applyConstraintsAndSend(param, choiceValue(choice));
      });

      options.appendChild(btn);
    });

    const row = document.createElement("div");
    row.className = "control-row";
    row.append(label, options);
    row._options = options;
    registerRow(row, param);
    return row;
  }

  function buildColor(param) {
    const label = document.createElement("label");
    label.className = "control-label";
    label.textContent = param.name;

    const input = document.createElement("input");
    input.type = "color";
    input.className = "control-color";
    input.value = colorToHex(param.value) || "#808080";

    const row = document.createElement("div");
    row.className = "control-row";
    row.append(label, input);
    row._color = input;
    registerRow(row, param);

    input.addEventListener("input", () => {
      const value = restoreColorValue(input.value, param.value);
      window.shapediverAPI.setParameter(param, value);
      renderPrice(currentValues());
    });

    return row;
  }

  function buildBool(param) {
    const label = document.createElement("label");
    label.className = "control-label";
    label.textContent = param.name;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "control-check";
    check.checked = Boolean(param.value);

    const row = document.createElement("div");
    row.className = "control-row";
    row.append(label, check);
    row._check = check;
    registerRow(row, param);

    check.addEventListener("change", () => {
      window.shapediverAPI.setParameter(param, check.checked);
      renderPrice(currentValues());
    });

    return row;
  }

  function isIgnored(param) {
    const ignored =
      (config.controls && config.controls.ignore) || [];
    if (ignored.indexOf(param.name) !== -1) {
      return true;
    }
    const group = param.group && param.group.name ? String(param.group.name) : "";
    if (/export|email/i.test(group)) {
      return true;
    }
    return false;
  }

  function buildControl(param) {
    if (isIgnored(param)) {
      return null;
    }
    const type = String(param.type || "").toLowerCase();
    if (type === "file") {
      return null;
    }
    if (type === "bool" || type === "boolean") {
      return buildBool(param);
    }
    if (type === "color") {
      return buildColor(param);
    }
    if (Array.isArray(param.choices) && param.choices.length > 0) {
      return buildChoice(param);
    }
    if (colorToHex(param.value)) {
      return buildColor(param);
    }
    return buildSlider(param);
  }

  window.controlsUI = {
    buildControl,
    applyConstraintsAndSend,
    syncAll
  };

  function refresh() {
    const { values, errors } = window.constraints.apply(currentValues());
    renderWarnings(errors);
    renderPrice(values);
    syncAll();
  }

  async function init() {
    overlay.classList.add("visible");

    try {
      await window.shapediverAPI.init(config);
      window.shapediverAPI.setOnChanged(refresh);

      refresh();
    } catch (error) {
      console.error("Falha ao carregar o modelo:", error);
      const detail = document.createElement("span");
      detail.className = "overlay-detail";
      detail.textContent =
        error && error.message ? error.message : String(error);
      const p = overlay.querySelector("p");
      p.textContent = "Falha ao carregar o modelo 3D.";
      p.appendChild(document.createElement("br"));
      p.appendChild(detail);
    } finally {
      overlay.classList.remove("visible");
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();