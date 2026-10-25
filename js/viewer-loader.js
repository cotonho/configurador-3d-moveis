(function () {
  function buildSources() {
    // Lido aqui (lazy) porque config.js pode carregar antes ou depois.
    var cfg = (window.SD_CONFIG && window.SD_CONFIG.viewer) || {};
    var version = cfg.version || "3.21.2";
    var cdnPrimary =
      cfg.cdnUrl || "https://viewer.shapediver.com/v3/" + version + "/bundle.js";
    var localUrl = cfg.localUrl || "js/vendor/sdv.bundle.local.js";

    if (cfg.onlyLocal) {
      // Fase de testes locais sem depender de rede externa.
      return [{ type: "script", url: localUrl }];
    }
    var list = [{ type: "script", url: cdnPrimary }];
    list.push({ type: "script", url: localUrl });
    if (!cfg.disableLatestFallback) {
      list.push({
        type: "script",
        url: "https://viewer.shapediver.com/v3/latest/bundle.js"
      });
    }
    return list;
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error("script falhou: " + url));
      };
      document.head.appendChild(s);
    });
  }

  async function load() {
    var SOURCES = buildSources();
    for (var i = 0; i < SOURCES.length; i++) {
      var src = SOURCES[i];
      try {
        if (src.type === "script") {
          await loadScript(src.url);
          if (window.SDV && window.SDV.createViewport && window.SDV.createSession) {
            console.log("viewer-loader: SDV carregado de " + src.url);
            return;
          }
          throw new Error("SDV nao definido apos carregar " + src.url);
        } else {
          var mod = await import(src.url);
          window.SDV = {
            createViewport: mod.createViewport,
            createSession: mod.createSession
          };
          console.log("viewer-loader: SDV carregado de " + src.url);
          return;
        }
      } catch (error) {
        console.warn("viewer-loader: fonte falhou (" + src.url + "): " + error.message);
      }
    }
    throw new Error("Nenhuma fonte do viewer disponivel");
  }

  load()
    .then(function () {
      window.dispatchEvent(new CustomEvent("sdv-bundle-ready"));
    })
    .catch(function (error) {
      console.error("viewer-loader:", error);
      window.dispatchEvent(
        new CustomEvent("sdv-bundle-failed", { detail: { error: error } })
      );
    });
})();