/* ===================================================================
   TTKPay — Back-Redirect Universal (compartilhado por todo o funil)
   Ao apertar "voltar", envia o usuário instantaneamente para /back/
   preservando 100% dos parâmetros de rastreamento (UTMs, src, etc).
   Não dispara na própria rota /back/ para evitar loops.
   =================================================================== */
(function () {
  'use strict';

  if (window.__TTK_BACK_REDIRECT_INIT) return;
  window.__TTK_BACK_REDIRECT_INIT = true;

  // Não executa se já estiver na página de downsell /back ou no /back/checkout
  if (window.location.pathname.indexOf('/back') !== -1) return;

  // Só ativa back-redirect nas páginas de oferta (/4, /5, /6)
  var currentPath = window.location.pathname;
  var isAllowed = /\/(4|5|6)(\/|$)/.test(currentPath);
  if (!isAllowed) return;

  function buildBackUrl() {
    var dest = new URL('/back/', window.location.origin);
    var currentParams = new URLSearchParams(window.location.search);
    currentParams.forEach(function (v, k) {
      dest.searchParams.set(k, v);
    });
    return dest.toString();
  }

  // Prepara o gatilho na pilha de histórico
  try {
    history.pushState({ backRedirect: true }, '', window.location.href);
  } catch (e) {}

  var redirected = false;
  window.addEventListener('popstate', function () {
    if (redirected) return;
    redirected = true;
    var targetUrl = buildBackUrl();
    // location.replace garante troca atômica no WebView sem quebrar o histórico
    window.location.replace(targetUrl);
  });
})();
