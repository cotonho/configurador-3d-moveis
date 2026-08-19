(function () {
  const DIM_PATTERN = /(length|width|height|depth|comprimento|comprid|largura|altura|profundidade|profundid)/i;

  window.pricing = {
    calculate(values, config) {
      const explicit = Array.isArray(config.priceDimensions)
        ? config.priceDimensions
        : [];
      const dims = Object.keys(values)
        .filter((name) => {
          if (explicit.length > 0) {
            return explicit.some((d) => name.toLowerCase() === String(d).toLowerCase());
          }
          return DIM_PATTERN.test(name);
        })
        .map((name) => Number(values[name]));

      let volume = 1;
      dims.forEach((d) => {
        volume *= d;
      });

      return config.basePrice + volume * (config.pricePerCubicMeter || 0);
    },

    format(value, currency) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currency || "BRL"
      }).format(value);
    }
  };
})();