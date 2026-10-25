// js/config.example.js
//
// Modelo de configuração do módulo — copie para js/config.js.
// O catálogo de móveis (ticket, models, catalog e preço por modelo) vive em
// js/catalog.js.
//
// Carregue nesta ordem:
//   <script src="js/catalog.js"></script>
//   <script src="js/config.js"></script>

(function () {
  var catalog = window.SD_CATALOG;
  if (!catalog || !Array.isArray(catalog.models)) {
    console.error(
      "config.js: window.SD_CATALOG nao encontrado. " +
        "Carregue js/catalog.js antes de js/config.js."
    );
  }

  var models = catalog && Array.isArray(catalog.models) ? catalog.models : [];
  var defaultPrice = Object.assign(
    { basePrice: 0, pricePerCubicMeter: 0, priceDimensions: [] },
    (catalog && catalog.price) || {}
  );

  function priceOf(model) {
    return Object.assign({}, defaultPrice, (model && model.price) || {});
  }

  function toRuntimeModel(model, index) {
    var m = model || {};
    var id = m.id || "model" + (index + 1);
    return {
      id: id,
      label: m.label || id,
      ticket: m.ticket,
      modelViewUrl: m.modelViewUrl,
      modelUnits: m.modelUnits || null,
      price: priceOf(m)
    };
  }

  var defaultStartup = models.filter(function (m) {
    return m && m.startup === true;
  });
  var addable = models.filter(function (m) {
    return m && m.addable === true;
  });

  // Seleção opcional pela página anterior:
  //   ?model=<id>  abre a sala com esse modelo como principal
  //   ?empty=1     abre a sala sem nenhum modelo (ou ?model=none)
  var params = null;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (e) {}
  var requestedId = params ? params.get("model") : null;
  var emptyRequested =
    !!params && (params.get("empty") === "1" || requestedId === "none");

  var startup = defaultStartup;
  if (emptyRequested) {
    startup = [];
  } else if (requestedId) {
    var chosen = models.find(function (m) {
      return m && m.id === requestedId;
    });
    if (chosen) {
      startup = [chosen];
    } else {
      console.warn(
        'config.js: modelo "' +
          requestedId +
          '" nao encontrado em js/catalog.js; usando o startup padrao.'
      );
    }
  }

  var main = emptyRequested ? {} : startup[0] || models[0] || {};
  var mainPrice = priceOf(main);

  if (!emptyRequested && (!main.ticket || !main.modelViewUrl)) {
    console.error(
      "config.js: o modelo principal precisa de ticket e modelViewUrl em js/catalog.js."
    );
  }

  window.SD_CONFIG = {
    // --- Derivados do catálogo (edite em js/catalog.js) ---
    ticket: main.ticket,
    modelViewUrl: main.modelViewUrl,
    productName: emptyRequested
      ? (catalog && catalog.emptyLabel) || "Sala vazia"
      : main.label || "Movel",
    currency: (catalog && catalog.currency) || "BRL",
    basePrice: mainPrice.basePrice,
    pricePerCubicMeter: mainPrice.pricePerCubicMeter,
    priceDimensions: mainPrice.priceDimensions,
    // Modelos carregados junto com a pagina (cena inicial).
    models: startup.map(toRuntimeModel),
    // Modelos que aparecem em "Adicionar movel".
    catalog: addable.map(toRuntimeModel),
    // true = abrir sem sessao inicial (?empty=1 ou ?model=none).
    startupEmpty: emptyRequested,

    // --- Configuracoes do modulo ---
    canvasId: "canvas",

    // Viewer: CDN oficial com versao fixa (ideal p/ multi-loja).
    // Troque version/cdnUrl por loja se precisar travar outra versao.
    // Para testes locais offline use: viewer: { onlyLocal: true }
    viewer: {
      version: "3.21.2"
      // cdnUrl: "https://viewer.shapediver.com/v3/3.21.2/bundle.js",
      // localUrl: "js/vendor/sdv.bundle.local.js",
      // onlyLocal: false, // true = ignora CDN, usa so o bundle local
      // disableLatestFallback: true // true = nao tenta /latest/ em producao
    },

    controls: {
      ignore: [
        "Email",
        "Email Subject",
        "SDTextInput",
        "Obj Export EOL",
        "Obj Export Object Names",
        "Email Export Format"
      ]
      // collision: false, // desliga a colisão entre móveis no arrasto (padrão: ligada)
    },

    room: {
      enabled: true,
      unitsPerMeter: 100,
      widthM: 5.0,
      depthM: 5.0,
      heightM: 3.0,
      wallThicknessM: 0.15,
      floorThicknessM: 0.1,
      // modelUnits: "in", // unidade padrão: mm | cm | m | in | ft
      // furnitureScale: 2.54, // opcional: trava a escala manual
      position: [0, 0, 0],
      hideScenery: true,
      dimensionsColor: 0xFFFFFF,
      dimensionsMaxDistance: 400,
      wallCulling: {
        enabled: true,
        hiddenOpacity: 0,
        visibleOpacity: 1,
        smoothness: 0.1,
        sideMargin: 200
      },
      debug: true,
      furnitureCenter: null
    },

    camera: {
      polarMin: 10, // limite da rotação para cima
      polarMax: 95, // limite da rotação para baixo
      zoomMin: 100, // limite de aproximação zoom
      zoomMax: 2000, // limite de afastamento zoom
      enablePan: true,
      enableRotation: true
    }
  };
})();
