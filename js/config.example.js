window.SD_CONFIG = {
  ticket: "COLE_AQUI_SEU_TICKET_SHAPEDIVER",
  modelViewUrl: "https://sdr7euc1.eu-central-1.shapediver.com",
  // Segundo móvel (e seguintes): descomente e preencha. Sem isso, vale só
  // ticket/modelViewUrl acima como sessão única "main".
  // models: [
  //   { id: "main", label: "Armário", ticket: "...", modelViewUrl: "...", modelUnits: "in" },
  //   { id: "cadeira", label: "Cadeira", ticket: "...", modelViewUrl: "...", modelUnits: "mm" }
  // ],
  // Catálogo de móveis para adicionar em tempo real (desenvolvedor cadastra).
  // modelUnits por modelo: mm | cm | m | in | ft (cai em room.modelUnits se omitido).
  // catalog: [
  //   { id: "cadeira", label: "Cadeira", ticket: "...", modelViewUrl: "...", modelUnits: "mm" },
  //   { id: "mesa", label: "Mesa", ticket: "...", modelViewUrl: "...", modelUnits: "mm" }
  // ],
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
    // Regra de controles (automática, sem config por móvel): escolhas de cor
    // viram botões swatch; todo o resto vira slider, dropdown, checkbox etc.
    // Ordem e agrupamento vêm de param.order / param.group.name do modelo.
    // Seções colapsáveis (genérico): estado inicial por nome exato da seção.
    // Padrão: todas começam guardadas; defaultCollapsed: false abre tudo.
    // collapsed/expanded: exceções por seção.
    // groups: {
    //   defaultCollapsed: true,
    //   collapsed: ["BAY FEATURE"],
    //   expanded: ["PARAMETERS"]
    // }
  },
room: {
    enabled: true,
    unitsPerMeter: 100,
    widthM: 3.2,
    depthM: 2.8,
    heightM: 2.7,
    wallThicknessM: 0.15,
    floorThicknessM: 0.1,
    modelUnits: "in", // unidade do modelo: mm | cm | m | in | ft (converte sozinho p/ a sala)
    // furnitureScale: 2.54, // opcional: trava a escala manual e ignora modelUnits
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
  },
  camera: {
    polarMin: 10,
    polarMax: 89,
    zoomMin: 100,
    zoomMax: 900,
    enablePan: true,
    enableRotation: true
  }
};