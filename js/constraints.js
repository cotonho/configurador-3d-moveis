(function () {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function key(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // Regras de dominio. Cada regra declara:
  //  - test: condicao que caracteriza estado INVALIDO
  //  - fix:  correcao a aplicar (usa chaves normalizadas por constraints.key)
  //  - message: mensagem exibida ao usuario quando a correcao e aplicada
  // O modulo NUNCA envia estado invalido ao servidor: tudo que chega aqui
  // sai corrigido (ou, se impossivel corrigir, sinalizado em errors).
  const RULES = [
    {
      id: "width_not_exceeding_length",
      test: (v) =>
        v.length !== undefined && v.width !== undefined && Number(v.width) > Number(v.length),
      fix: (v) => ({ width: v.length }),
      message: "A largura foi limitada ao comprimento do movel."
    }
  ];

  window.constraints = {
    apply(values) {
      const result = { ...values };
      const messages = [];
      const appliedRules = [];
      let changed = true;
      let guard = 0;

      while (changed && guard < RULES.length * 3) {
        changed = false;
        guard += 1;

        const norm = {};
        const keyToName = {};
        Object.keys(result).forEach((name) => {
          const k = this.key(name);
          norm[k] = result[name];
          keyToName[k] = name;
        });

        RULES.forEach((rule) => {
          if (rule.test(norm)) {
            const fixed = rule.fix(norm);
            if (fixed) {
              Object.keys(fixed).forEach((k) => {
                const name = keyToName[k] || k;
                result[name] = fixed[k];
                changed = true;
              });
            }
            if (appliedRules.indexOf(rule.id) === -1) {
              appliedRules.push(rule.id);
              messages.push(rule.message);
            }
          }
        });
      }

      return { values: result, errors: messages, appliedRules };
    },

    clampToRange(value, param) {
      if (param === undefined || param.min === undefined || param.max === undefined) {
        return value;
      }
      return clamp(Number(value), Number(param.min), Number(param.max));
    },

    key
  };
})();
