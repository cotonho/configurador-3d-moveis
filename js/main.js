console.log("main.js carregado - v3-multisession");
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

  function currentValues(sessionId) {
    const values = {};
    window.shapediverAPI.getParameters(sessionId).forEach((p) => {
      values[p.name] = p.value;
    });
    return values;
  }

  function ownerSessionOf(param) {
    const api = window.shapediverAPI;
    if (typeof api.getSessions !== "function") {
      return null;
    }
    const found = api.getSessions().find((s) =>
      api.getParameters(s.id).some((p) => p === param)
    );
    return found ? found.id : null;
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

  // Soma o preço de todas as sessões (base por móvel + dimensões).
  function totalPrice() {
    const api = window.shapediverAPI;
    if (typeof api.getSessions !== "function") {
      return window.pricing.calculate(currentValues(), config);
    }
    return api.getSessions().reduce(
      (sum, s) => sum + window.pricing.calculate(currentValues(s.id), config),
      0
    );
  }

  function applyConstraintsAndSend(param, proposedValue) {
    if (typeof proposedValue === "number" && isNaN(proposedValue)) {
      console.error("main.js: valor NaN bloqueado para o parametro", param.name);
      return param.value;
    }
    const sessionId = ownerSessionOf(param);
    const next = currentValues(sessionId);
    next[param.name] = proposedValue;

    const result = window.constraints.apply(next);
    const finalValue = result.values[param.name];

    renderWarnings(result.errors);
    priceEl.textContent = window.pricing.format(totalPrice(), config.currency);
    window.shapediverAPI.setParameter(param, finalValue, sessionId);

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
      row._valueOut.textContent = Number(param.value).toFixed(
        row._dec !== undefined ? row._dec : 2
      );
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
    if (row._select && Array.isArray(row._choiceValues)) {
      const current = String(param.value);
      const indexFallback = /^\d+$/.test(current) ? Number(current) : -1;
      const values = row._choiceValues;
      let sel = values.findIndex((v) => String(v) === current);
      if (sel < 0 && indexFallback >= 0 && indexFallback < values.length) {
        sel = indexFallback;
      }
      if (sel >= 0) {
        row._select.selectedIndex = sel;
      }
    }
  }

  function syncAll() {
    registry.forEach((param, row) => syncRow(row, param));
  }

  // Detecta parâmetro inteiro sondando o validador (sem depender de strings
  // de tipo): rejeita x.5 mas aceita o arredondado => inteiro.
  function isIntParam(param) {
    try {
      if (!param || typeof param.isValid !== "function") return false;
      const base = typeof param.min === "number" ? param.min : 0;
      const probe = base + 0.5;
      return !param.isValid(probe, false) && !!param.isValid(Math.round(probe), false);
    } catch (e) {
      return false;
    }
  }

  function buildSlider(param) {
    const min = Number(param.min);
    const max = Number(param.max);
    if (isNaN(min) || isNaN(max)) {
      return null;
    }
    const dec = isIntParam(param) ? 0 : 2;

    const label = document.createElement("label");
    label.className = "control-label";
    label.textContent = param.name;

    const valueOut = document.createElement("span");
    valueOut.className = "control-value";
    valueOut.textContent = Number(param.value).toFixed(dec);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.value = param.value;
    slider.step = dec === 0 ? "1" : "any";
    slider.className = "control-slider";

    const row = document.createElement("div");
    row.className = "control-row";
    row.append(label, valueOut, slider);
    row._slider = slider;
    row._valueOut = valueOut;
    row._dec = dec;
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
        applyConstraintsAndSend(param, choiceSendValue(param, choice, i));
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

  // Dropdown genérico p/ listas longas (ex. features com muitas opções):
  // mesma fonte de dados dos botões, com a mesma resolução de valor atual.
  // Alguns StringList guardam o ÍNDICE ("0") em vez do texto da opção.
  // Detecta pelo valor atual: se ele não bate com nenhum texto de opção
  // mas é numérico, envia o índice no MESMO TIPO do valor atual (string
  // "1" ou número 1); senão envia o valor cru. Genérico para qualquer
  // móvel, sem configuração individual.
  function choiceSendValue(param, choice, index) {
    const v = choiceValue(choice);
    try {
      const texts = (param.choices || []).map((c) => String(choiceValue(c)));
      const current = String(param.value);
      if (
        texts.indexOf(current) === -1 &&
        /^\d+$/.test(current) &&
        Number.isInteger(index) &&
        index >= 0
      ) {
        return typeof param.value === "number" ? index : String(index);
      }
    } catch (e) {}
    return v;
  }

  function buildDropdown(param) {
    const choices = Array.isArray(param.choices) ? param.choices : [];
    if (choices.length === 0) {
      return null;
    }
    const label = document.createElement("label");
    label.className = "control-label";
    label.textContent = param.name;

    const select = document.createElement("select");
    select.className = "control-select";
    const values = choices.map(choiceValue);
    choices.forEach((choice) => {
      const opt = document.createElement("option");
      opt.textContent = choiceLabel(choice);
      select.appendChild(opt);
    });
    const current = String(param.value);
    const indexFallback = /^\d+$/.test(current) ? Number(current) : -1;
    let sel = values.findIndex((v) => String(v) === current);
    if (sel < 0 && indexFallback >= 0 && indexFallback < values.length) {
      sel = indexFallback;
    }
    select.selectedIndex = sel >= 0 ? sel : 0;

    const row = document.createElement("div");
    row.className = "control-row";
    row.append(label, select);
    row._select = select;
    row._choiceValues = values;
    registerRow(row, param);

    select.addEventListener("change", () => {
      const i = select.selectedIndex;
      if (i >= 0 && i < values.length) {
        applyConstraintsAndSend(param, choiceSendValue(param, choices[i], i));
      }
    });
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
      // Escolhas de cor: botões swatch (precisam ser visuais). Todo o resto
      // (texto, seleção única ou não): dropdown — compacto e genérico para
      // qualquer móvel, sem configuração individual.
      const allSwatch = param.choices.every((c) => colorToHex(choiceValue(c)));
      if (allSwatch) {
        return buildChoice(param);
      }
      return buildDropdown(param);
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
    const api = window.shapediverAPI;
    const sessions =
      typeof api.getSessions === "function" && api.getSessions().length
        ? api.getSessions()
        : [{ id: null }];
    const allErrors = [];
    sessions.forEach((s) => {
      const { errors } = window.constraints.apply(currentValues(s.id));
      errors.forEach((e) => allErrors.push(e));
    });
    renderWarnings(allErrors);
    priceEl.textContent = window.pricing.format(totalPrice(), config.currency);
    syncAll();
  }

  window.addEventListener("sdv-customize-failed", (event) => {
    const detail = (event && event.detail) || {};
    renderWarnings([
      "Falha ao atualizar " +
        (detail.sessionId || "o modelo") +
        ": " +
        (detail.message || "erro desconhecido")
    ]);
  });

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