const PINPAY_TOKEN = process.env.PINPAY_TOKEN;
const PINPAY_BASE  = 'https://api.usepinpay.com/functions/v1/api-v1';
const PAID_STATUSES = ['paid', 'approved', 'success', 'completed', 'confirmed', 'pago', 'aprovado', 'active'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!PINPAY_TOKEN) {
    return res.status(500).json({ success: false, error: 'PINPAY_TOKEN nao configurada nas variaveis do servidor Vercel.' });
  }

  try {
    const tx = req.query?.tx || req.query?.transactionKey || req.query?.code || req.query?.hash || req.query?.id;
    if (!tx) return res.status(400).json({ success: false, error: 'tx (transactionKey/id) obrigatorio' });

    // Estratégia 1: Tentar consulta direta /pix/{id} (funciona para IDs UUID antigos)
    let data = null;
    let found = false;

    const directUrl = PINPAY_BASE + '/pix/' + encodeURIComponent(tx);
    const directRes = await fetch(directUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + PINPAY_TOKEN.trim(),
        'Accept': 'application/json'
      }
    });

    if (directRes.ok) {
      data = await directRes.json().catch(() => ({}));
      found = true;
    }

    // Estratégia 2: Se direto falhou (404), buscar na listagem por ID
    if (!found) {
      const listUrl = PINPAY_BASE + '/transactions?limit=50';
      const listRes = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + PINPAY_TOKEN.trim(),
          'Accept': 'application/json'
        }
      });

      if (listRes.ok) {
        const listData = await listRes.json().catch(() => ({}));
        const transactions = listData.data || [];
        data = transactions.find(t => t.id === tx);
        if (data) found = true;
      }
    }

    if (!found || !data) {
      return res.status(200).json({
        success: true,
        paid: false,
        status: 'not_found',
        message: 'Transacao ainda nao encontrada, aguardando...'
      });
    }

    const paymentStatus = String(data.status || '').toLowerCase();
    const paid = PAID_STATUSES.includes(paymentStatus);

    return res.status(200).json({
      success: true,
      paid,
      status: paid ? 'approved' : paymentStatus,
      raw: data
    });
  } catch (err) {
    console.error('[payment-status] ERRO:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
