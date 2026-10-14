/* ===================================================================
   TTKPay — Heartbeat (visitantes online em tempo real)
   Pinga /api/heartbeat a cada 30s informando em qual página/etapa
   o visitante está. Usa sessionStorage key: hb_sid (sem colisão).
   =================================================================== */
(function () {
  'use strict';

  var ENDPOINT = 'https://api.piratatracking.online/api/heartbeat';
  var INTERVAL  = 30000; // 30s
  var FIRST_PING = 2000; // 2s após load

  // Detecta pixel_id automaticamente a partir da tag do SDK já carregada na página
  // (não requer nenhuma mudança nas páginas do funil)
  var pixelId = null;
  try {
    var sdkTag = document.querySelector('script[src*="/api/sdk?pixel="]');
    if (sdkTag) {
      pixelId = new URL(sdkTag.src).searchParams.get('pixel');
    }
  } catch(e) {}

  // Gera ou recupera o session ID desta aba
  var sid = sessionStorage.getItem('hb_sid');
  if (!sid) {
    sid = 'hb_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
    sessionStorage.setItem('hb_sid', sid);
  }

  // Captura UTMs da URL (first-touch: só salva se ainda não tiver)
  var utmData = {};
  try {
    var storedUtm = sessionStorage.getItem('hb_utm');
    if (storedUtm) {
      utmData = JSON.parse(storedUtm);
    } else {
      var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      var params = new URLSearchParams(window.location.search);
      UTM_KEYS.forEach(function(k) {
        var v = params.get(k);
        if (v) utmData[k] = v;
      });
      if (Object.keys(utmData).length > 0) {
        sessionStorage.setItem('hb_utm', JSON.stringify(utmData));
      }
    }
  } catch(e) {}

  function ping() {
    var page = window.HB_PAGE || 'unknown';
    var step = window.HB_STEP  || null;

    // Combina page + step para quiz (ex: 'quiz' + 1 → 'quiz_step_1')
    if (page === 'quiz' && step !== null) {
      page = 'quiz_step_' + step;
    }

    // Sincroniza window.agPage para o SDK heartbeat também usar o nome correto da etapa
    if (page !== 'unknown') {
      window.agPage = page;
    }

    var body = { sid: sid, page: page };
    if (step !== null) body.step = step;
    // Inclui pixel_id para permitir filtragem por pixel no painel Ao Vivo
    if (pixelId) body.pixel_id = pixelId;
    // Adiciona UTMs ao ping se disponíveis
    if (Object.keys(utmData).length > 0) body.utm = utmData;

    try {
      fetch(ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        keepalive: true
      }).catch(function () { /* silencia erros de rede */ });
    } catch (e) { /* fetch não disponível */ }
  }


  // Primeiro ping após 2s (página carregada e scripts executados)
  setTimeout(ping, FIRST_PING);

  // Pings subsequentes a cada 30s
  setInterval(ping, INTERVAL);

  // Ping imediato ao voltar para a aba (visibilidade)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') ping();
  });

})();
