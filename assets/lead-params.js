/* lead-params.js — lê em/ph/fn da URL e enriquece sessionStorage(lead_data) */
(function () {
  try {
    var p = new URLSearchParams(window.location.search);
    var em = p.get('em') || p.get('email') || '';
    var ph = p.get('ph') || p.get('phone') || '';
    var fn = p.get('fn') || p.get('name') || p.get('nome') || '';
    if (em || ph || fn) {
      var ld = {};
      try { ld = JSON.parse(sessionStorage.getItem('lead_data') || '{}'); } catch(e) {}
      if (em) ld.email = em;
      if (ph) ld.phone = ph;
      if (fn) ld.nome  = fn;
      sessionStorage.setItem('lead_data', JSON.stringify(ld));
    }
  } catch(e) {}
})();
