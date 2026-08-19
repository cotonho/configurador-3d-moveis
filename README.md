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

## Tecnologias

- ShapeDiver Viewer v3 (API + Three.js)
- Three.js r160
- JavaScript puro (sem frameworks)
- Python `http.server` para o servidor local