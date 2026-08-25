window.SD_CONFIG = {
  ticket: "COLE_AQUI_SEU_TICKET_SHAPEDIVER",
  modelViewUrl: "https://sdr7euc1.eu-central-1.shapediver.com",
  canvasId: "canvas",
  productName: "Armario Modular",
  basePrice: 499,
  pricePerCubicMeter: 120,
  currency: "BRL",
  priceDimensions: ["Length"],
  controls: {
    ignore: [
      "Email",
      "Email Subject",
      "SDTextInput",
      "Obj Export EOL",
      "Obj Export Object Names",
      "Email Export Format"
    ]
  },
room: {
    enabled: true,
    unitsPerMeter: 100,
    widthM: 3.2,
    depthM: 2.8,
    heightM: 2.7,
    wallThicknessM: 0.15,
    floorThicknessM: 0.1,
    furnitureScale: 3,
    position: [0, 0, 0],
    hideScenery: true,
wallCulling: {
      enabled: true,
      hiddenOpacity: 0,
      visibleOpacity: 1,
      smoothness: 0.1,
      sideMargin: 0
    },
    debug: true,
    furnitureCenter: null
  }
};