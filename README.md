# Configurador 3D de Móveis Paramétricos

Configurador 3D de móveis sob medida construído para o Trabalho de Conclusão de Curso (TCC): objetos paramétricos criados no **Grasshopper** são carregados no navegador com **ShapeDiver** e **Three.js**, dentro de uma sala virtual com interação, múltiplos móveis simultâneos e estimativa de preço em tempo real.

## Funcionalidades

- **Sala virtual em metros** — piso, paredes e culling dinâmico conforme a câmera (modo dollhouse); móveis ancorados no chão.
- **Múltiplos móveis simultâneos** — sessão principal (`main`) + catálogo para adicionar peças em tempo real, cada uma com sua própria unidade de modelo (`mm`/`cm`/`m`/`in`/`ft`, convertida sozinha para o cm da sala).
- **Mover e girar por peça** — arrasto no piso com trava nas paredes; slider de rotação −180°..180° com snap.
- **Cotas por peça selecionada** — 3 medidas que acompanham a câmera; sem seleção, mostra a cena toda.
- **Spawn inteligente** — peça nova nasce em ponto livre (espiral com checagem de sobreposição), uma única vez; rebuild após customize volta ao ponto e giro antigos (memória por sessão).
- **Câmera livre** — botão esquerdo orbita, botão direito desloca (pan XY), scroll aproxima/afasta, com limites de ângulo e distância.
- **Preço estimado total** — soma de todas as sessões, com regras de restrição e avisos na tela.
- **Filtro automático de cenário** — peças espúrias do modelo (piso espelhado, decoração) são excluídas da escala, das cotas e da ocupação.

## Como rodar

1. Copie `js/config.example.js` para `js/config.js` e preencha ticket/modelViewUrl do ShapeDiver.
2. Suba o servidor local:

```powershell
cd configurador3d
python -m http.server 8080
```

Depois abra `http://localhost:8080`.

> O ShapeDiver recomenda `localhost`/HTTPS — o ticket de exemplo só responde em `localhost:8080`.
> O `config.js` local (com ticket real) **não é versionado** — nunca o envie para o repositório. Quem clonar o projeto deve copiar o `config.example.js` e preencher o próprio ticket.
> Durante o desenvolvimento, abra o DevTools (F12) → aba Network → marque **Disable cache** e deixe o DevTools aberto. Sem isso o navegador segura `js/` antigo e os testes rodam código velho sem nenhum aviso visível.

## Estrutura

```
index.html            Página principal (sidebar + viewer)
css/styles.css        Layout, controles, etiquetas de cota
assets/               Ícones dos botões de mover/girar
js/config.example.js  Modelo de configuração — copie para config.js
js/config.js          (local, não versionado) Configuração com tickets reais
js/viewer-loader.js   Carrega o viewer (bundle local primeiro, CDN depois)
js/shapediver.js      Sessões, parâmetros e envio com debounce (multi-sessão)
js/room.js            Sala, escala/filtro/spawn/cotas por sessão, memória de pose
js/camera.js          Órbita nativa + pan XY + dolly customizados
js/menu.js            Sidebar: registro/seleção de móveis por sessão
js/furniture-move.js  Modo mover (arrasto no piso)
js/furniture-rotate.js Modo girar (slider com snap)
js/furniture-add.js   Catálogo: adiciona móveis em tempo real
js/constraints.js     Regras de restrição dos parâmetros
js/pricing.js         Estimativa de preço
js/main.js            Controles genéricos (sliders, dropdowns, cores) e status
js/vendor/            (não versionado) bundles locais para redes sem CDN
```

## Configurações principais (`js/config.js`)

| Chave | Descrição |
| --- | --- |
| `ticket` / `modelViewUrl` | Modelo da sessão única `main` |
| `models[]` | Sessões carregadas junto (`id`, `label`, `ticket`, `modelViewUrl`, `modelUnits`) |
| `catalog[]` | Móveis adicionáveis em tempo real (mesmo formato de `models[]`) |
| `room.widthM/depthM/heightM` | Dimensões da sala em metros |
| `room.modelUnits` | Unidade padrão dos modelos (`mm`/`cm`/`m`/`in`/`ft`) |
| `room.furnitureScale` | (opcional) trava a escala manual e ignora `modelUnits` |
| `room.maxFurniturePieceCm` | (opcional, default 400) teto absoluto p/ peça no filtro |
| `room.hideScenery` | Oculta decoração do modelo |
| `room.wallCulling` | Paredes somem conforme a câmera (`enabled`, margens, opacidades) |
| `room.debug` | Painel de medição chão × pés na tela |
| `camera.polarMin/polarMax/zoomMin/zoomMax` | Limites de órbita e distância |
| `controls.ignore` | Parâmetros ocultos da sidebar |
| `controls.groups` | Seções colapsáveis: `defaultCollapsed` (padrão true), `collapsed[]`, `expanded[]` por nome exato da seção |

## Controles genéricos (contrato com o modelo)

A sidebar monta os controles **a partir dos metadados do próprio modelo** — nenhum móvel precisa de configuração individual. Para um modelo novo se comportar bem, ele precisa expor:

| Metadado | Efeito | Se ausente |
| --- | --- | --- |
| `param.order` (número) | Ordem dos controles na sidebar | Mantém a ordem de chegada do modelo |
| `param.group.name` | Cabeçalho de seção agrupando controles | Controles aparecem sem cabeçalho |
| `param.choices` | Lista de opções | Numérico vira slider; texto sem opções **não renderiza** (ver limitação) |
| `modelUnits` (`mm`/`cm`/`m`/`in`/`ft`, no catálogo ou `room.modelUnits`) | Conversão automática p/ cm da sala | Assume a unidade global da sala |

Regras de renderização (iguais para todo móvel):

- Escolhas de cor → botões swatch; demais escolhas → dropdown.
- Numéricos → slider (inteiro detectado sondando `isValid`, sem depender do tipo declarado).
- Booleanos → checkbox; `file` e grupos `export`/`email` → ocultos.

**Limitações conhecidas:**

1. **Envio de escolhas espelha o formato atual.** Alguns `StringList` guardam o índice (`"0"`) em vez do texto (`"Shelves"`). O código detecta isso pelo valor atual do parâmetro e envia no mesmo formato **e tipo** (string `"1"` ou número `1`). Se um modelo futuro guardar as opções num terceiro formato, o `setParameter` será rejeitado com `isValid ... is not of type ...` no console — ver `choiceSendValue` em `js/main.js`.
2. **Parâmetro `String` sem opções nem min/max não gera controle.** Ex.: caminho de textura avulso. Seria necessário um campo de texto (`buildText`, ainda não implementado).
3. **Diagnóstico:** com `window.__DIM_VERBOSE = true` no console, os logs `[SCALE]/[SPAWN]/[EVICT]/[FILTRO]/[DIM-MESH]` mostram escala, spawn, expurgo, filtro de peças e composição das cotas. Em uso normal o console fica limpo (só erros).

## Tecnologias

- ShapeDiver Viewer v3.21.2 (API + Three.js embutido)
- Three.js r160 (cópia separada p/ utilitários — há warning de instância duplicada, sem impacto funcional)
- JavaScript puro (sem frameworks)
- Python `http.server` para o servidor local
