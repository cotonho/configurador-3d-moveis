# Configurador 3D de Móveis Paramétricos

Configurador 3D de móveis sob medida construído para o Trabalho de Conclusão de Curso (TCC): um objeto paramétrico criado no **Grasshopper** é carregado no navegador com **ShapeDiver** e **Three.js**, dentro de uma sala virtual com interação e estimativa de preço em tempo real.

## Funcionalidades

- **Sala virtual em metros** — piso, paredes e transparência dinâmica conforme a câmera; móvel ancorado no chão pelos pés.
- **Interação direta no móvel** — clique no móvel abre um menu flutuante com os parâmetros paramétricos (sem painel lateral tradicional).
- **Preço estimado em tempo real** — regras de preço aplicadas conforme os parâmetros e avisos exibidos na tela.
- **Filtro automático de cenário** — o pôster e os fundos de decoração do modelo são ocultados para o bbox do móvel ficar preciso.
- **Escala configurável** — o móvel pode ser ampliado sem descolar do chão (ancoragem pelos pés).

## Como rodar

1. Copie `js/config.example.js` para `js/config.js` e cole o seu ticket do ShapeDiver no campo `ticket`.
2. Suba o servidor local:

```powershell
cd configurador3d
python -m http.server 8080
```

Depois abra `http://localhost:8080`.

> Durante o desenvolvimento, abra o DevTools (F12) → aba Network → marque **Disable cache** e deixe o DevTools aberto. Sem isso o navegador segura `js/` antigo e os testes rodam código velho sem nenhum aviso visível.

> O ShapeDiver recomenda `localhost`/HTTPS — o ticket de exemplo só responde em `localhost:8080`.
> O `config.js` local (com ticket real) **não é versionado** — nunca o envie para o repositório. Quem clonar o projeto deve copiar o `config.example.js` e preencher o próprio ticket.

## Estrutura

```
index.html            Página principal (sem painel lateral, com #status-bar)
js/config.example.js  Modelo de configuração (ticket, sala, escala) — copie para config.js
js/config.js          (local, não versionado) Configuração com o ticket real
js/viewer-loader.js   Carrega o viewer (bundle local primeiro, CDN depois)
js/shapediver.js      Sessão e parâmetros do ShapeDiver
js/room.js            Sala virtual, ancoragem no chão e transparência
js/menu.js            Menu flutuante de interação no móvel
js/constraints.js     Regras de restrição dos parâmetros
js/pricing.js         Estimativa de preço e avisos
js/main.js            Controles (ControlsUI) e status bar
js/vendor/            (não versionado) bundles locais para redes sem CDN
```

## Configurações principais (`js/config.js`)

| Chave | Descrição |
| --- | --- |
| `ticket` | Ticket do modelo ShapeDiver |
| `room.widthM/depthM/heightM` | Dimensões da sala em metros |
| `room.furnitureScale` | Escala aplicada ao móvel (ancorada nos pés) |
| `room.furnitureOffset` | Posição inicial do móvel: `[x, y]` (largura, profundidade) |
| `room.hideScenery` | Oculta decoração do modelo (pôster/fundos) |
| `room.debug` | Exibe na tela a medição chão × pés do móvel |

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

- ShapeDiver Viewer v3 (API + Three.js)
- Three.js r160
- JavaScript puro (sem frameworks)
- Python `http.server` para o servidor local