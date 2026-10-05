window.SD_CONFIG = {
  // Ticket do modelo principal (sessão "main"). Abaixo vai o modelo de
  // teste público do ShapeDiver — troque pelo ticket do seu modelo.
  ticket: "50eb2a26ddaa432ca18288b8a120ef194fa35bb813e4f43ae89d657991a865f9deaa20a1c840e47cdf6dbc019cd16ae15a9a6b3a7d91722455299d6bd29b1f26b3ff3b7adaac1df3d50f3ba4d010a560180dff8f745c946dadb41167a3431e223d69b32743f167-5b9465f92a0cf9c235b8ea315aab0cd5",
  modelViewUrl: "https://sdr7euc1.eu-central-1.shapediver.com",
  // Sessões extras carregadas junto (opcional). Sem isso, vale só
  // ticket/modelViewUrl acima como sessão única "main".
  // models: [
  //   { id: "cadeira", label: "Cadeira", ticket: "...", modelViewUrl: "...", modelUnits: "mm" }
  // ],
  // Catálogo de móveis para adicionar em tempo real (desenvolvedor cadastra).
  // modelUnits por modelo: mm | cm | m | in | ft (cai em room.modelUnits se omitido).
  catalog: [
    {
      id: "Armario", label: "Armario",
      ticket: "50eb2a26ddaa432ca18288b8a120ef194fa35bb813e4f43ae89d657991a865f9deaa20a1c840e47cdf6dbc019cd16ae15a9a6b3a7d91722455299d6bd29b1f26b3ff3b7adaac1df3d50f3ba4d010a560180dff8f745c946dadb41167a3431e223d69b32743f167-5b9465f92a0cf9c235b8ea315aab0cd5",
      modelViewUrl: "https://sdr7euc1.eu-central-1.shapediver.com",
      modelUnits: "in"
    }
  ],
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
    // modelUnits: "in", // unidade do modelo: mm | cm | m | in | ft (converte sozinho p/ a sala)
    // furnitureScale: 2.54, // opcional: trava a escala manual e ignora modelUnits
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
