// js/catalog.example.js
//
// Catálogo único de móveis do configurador.
//
// COMO USAR
//   1. Copie este arquivo para js/catalog.js.
//   2. Preencha ticket e modelViewUrl de cada modelo.
//   3. Carregue catalog.js ANTES de config.js no HTML:
//        <script src="js/catalog.js"></script>
//        <script src="js/config.js"></script>
//
// CAMPOS
//   id            identificador único, sem espaços (ex.: "estante")
//   label         nome exibido no botão e no título
//   ticket        ticket do modelo no ShapeDiver
//   modelViewUrl  servidor do modelo (ex.: https://sdr7euc1.eu-central-1.shapediver.com)
//   modelUnits    unidade nativa do modelo: mm | cm | m | in | ft
//   startup       true  = carrega junto com a página (cena inicial)
//   addable       true  = aparece em "Adicionar móvel"
//   price         regra de preço deste modelo:
//                   basePrice           valor fixo
//                   pricePerCubicMeter  preço por m³
//                   priceDimensions     parâmetros usados como dimensões
//
//   Se price for omitido, vale SD_CATALOG.price (preço padrão).
//   O primeiro modelo com startup:true é o modelo principal ("main").
//   Um modelo pode ter startup:true e addable:true ao mesmo tempo.

window.SD_CATALOG = {
  // Moeda usada na tela. Os preços são somados nesta moeda.
  currency: "BRL",

  // Nome exibido quando a sala abre vazia (?empty=1).
  emptyLabel: "Sala vazia",

  // Preço padrão: usado por qualquer modelo que não declare o próprio price.
  price: {
    basePrice: 499,
    pricePerCubicMeter: 120,
    priceDimensions: ["Length"]
  },

  models: [
    {
      // Modelo principal: carrega sozinho ao abrir a página.
      id: "main",
      label: "Armario Modular",
      ticket: "50eb2a26ddaa432ca18288b8a120ef194fa35bb813e4f43ae89d657991a865f9deaa20a1c840e47cdf6dbc019cd16ae15a9a6b3a7d91722455299d6bd29b1f26b3ff3b7adaac1df3d50f3ba4d010a560180dff8f745c946dadb41167a3431e223d69b32743f167-5b9465f92a0cf9c235b8ea315aab0cd5",
      modelViewUrl: "https://sdr7euc1.eu-central-1.shapediver.com",
      modelUnits: "in",
      startup: true,
      addable: false,
      price: {
        basePrice: 499,
        pricePerCubicMeter: 120,
        priceDimensions: ["Length"]
      }
    },
    {
      // Modelo do catálogo: aparece em "Adicionar móvel".
      // Cada clique cria uma instância nova (id "Armario-1", "Armario-2", ...).
      id: "Armario",
      label: "Armario",
      ticket: "50eb2a26ddaa432ca18288b8a120ef194fa35bb813e4f43ae89d657991a865f9deaa20a1c840e47cdf6dbc019cd16ae15a9a6b3a7d91722455299d6bd29b1f26b3ff3b7adaac1df3d50f3ba4d010a560180dff8f745c946dadb41167a3431e223d69b32743f167-5b9465f92a0cf9c235b8ea315aab0cd5",
      modelViewUrl: "https://sdr7euc1.eu-central-1.shapediver.com",
      modelUnits: "in",
      startup: false,
      addable: true,
      price: {
        basePrice: 499,
        pricePerCubicMeter: 120,
        priceDimensions: ["Length"]
      }
    }
  ]
};
