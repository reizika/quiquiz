# Quiz / Funil TikTok Recompensas — Memória do Projeto

## O que é este projeto
Funil de vendas estático (HTML/JS) hospedado na Vercel.
Simula uma plataforma de recompensas do TikTok e cobra taxas IOF/confirmação via PIX (PinPay).
Tracking server-side via agTracker SDK + TikTok Events API.

## Pasta local
`C:\Users\Usuario\Desktop\temp_site1_extract\quiz com tracking so que meu`

## Deploy
```powershell
# Na pasta do projeto:
vercel --prod
```

## Fluxo do funil
```
index.html (quiz) → pressel.html → ... → página 5 (checkout principal)
    → up1/index.html (oferta upsell 1) → up1/1/index.html (checkout PIX upsell 1)
    → up2/index.html → up2/2/index.html
    → ... até up10 ...
    → success.html
```

## Estrutura de pastas
```
/                    — quiz inicial (páginas 1-4)
index.html           — página 1 do quiz
back/                — oferta back (R$15,00)
up1/ a up10/         — páginas de oferta dos upsells
  index.html         — página de oferta (exibe produto, botão comprar)
  1/ (ou 2/, 3/...)  — checkout PIX (gera QR code, faz polling)
    index.html
api/
  generate_qr_gateway.js   — Vercel serverless: gera PIX na PinPay
  payment-status.js        — Vercel serverless: consulta status do pagamento
assets/
  lead-params.js     — propaga parâmetros UTM entre páginas
success.html         — página de sucesso final
```

## Preços (centavos no gateway, reais no frontend)
| Oferta | Valor |
|--------|-------|
| Principal (pág 5) | R$20,00 |
| Back | R$15,00 |
| Upsell 1 | R$24,00 |
| Upsell 2 | R$26,00 |
| Upsell 3 | R$25,00 |
| Upsell 4 | R$22,00 |
| Upsell 5 | R$32,76 |
| Upsell 6 | R$38,93 |
| Upsell 7 | R$24,42 |
| Upsell 8 | R$19,46 |
| Upsell 9 | R$14,73 |
| Upsell 10 | R$46,31 |

## Gateway de pagamento: PinPay
- Campo correto para webhook: `webhook_url` (NÃO `notification_url`)
- Base URL: `https://api.usepinpay.com/functions/v1/api-v1`
- Token: variável de ambiente `PINPAY_TOKEN` no Vercel (sk_live_...)
- Webhook recebido pelo VPS em: `https://api.piratatracking.online/api/webhooks/universal?token=wh_t18r28wl42k84lpe3bwpo7_1789739165126`

## Tracking: agTracker SDK
```html
<!-- Incluir no <head> de cada página do funil -->
<script src="https://api.piratatracking.online/api/sdk?pixel=7dbda3d7-84b3-474f-8ee1-24c324ea0ac8" async></script>
```

UUID do pixel interno (para o SDK): `7dbda3d7-84b3-474f-8ee1-24c324ea0ac8`
Pixel ID TikTok real: `D9N9GTRC77U5M57UQ78G`

## API do agTracker (window.agTracker)
```js
window.agTracker.initiateCheckout(valor, email, phone)  // quando abre checkout
window.agTracker.purchase(valor, email, phone, { content_name, content_ids, content_type, quantity })  // quando pagamento aprovado
window.agTracker.viewContent(valor, { content_name, content_ids })  // ao entrar na página de oferta
window.agTracker.addPaymentInfo(valor, details)          // na página de checkout ao carregar
window.agTracker.getCheckoutId()                         // retorna o checkoutSessionId desta sessão
```

## Sessão de pagamento (generate_qr_gateway.js)
Após criar o PIX na PinPay, o Vercel:
1. Recebe `txId` da resposta
2. Chama `/api/register-payment` no VPS associando `txId` ao `checkoutSessionId`
3. Retorna `payment_code`, `pix_copy_paste`, `qrCodeImage` para o frontend

## Modal PIX (checkouts up1/1 a up10/10)
- Sistema ativo: IIFE que injeta `#pixOverlay` via `document.body.insertAdjacentHTML`
- Funções ativas: `pixIniciar`, `pixIniciarPolling`, `pixIniciarTimer`, `abrirPixModal`, `fecharPixModal`
- `pixIniciarPolling` chama `window.agTracker.purchase()` quando status === 'approved'
- Cache do PIX gerado: `sessionStorage['pix_data_uupN']` (evita gerar novo PIX ao reabrir modal)

## Dados do lead
Salvos em `sessionStorage['lead_data']`: `{ nome, email, phone }`
Propagados entre páginas via URLSearchParams

## Serviços de terceiros
- **Microsoft Clarity**: tag `xw7tadv8q2` (em todas as páginas)
- **xTracky**: API de integração alternativa (`api.xtracky.com`) para rastrear por UTM

## Variáveis de ambiente Vercel
- `PINPAY_TOKEN` — token PinPay (sk_live_...)
- Configurar em: vercel.com → projeto → Settings → Environment Variables

## ATENÇÃO — Regra importante
No `viewContent` das páginas de oferta (upN/index.html): **sempre usar a variável `IOF` declarada no próprio arquivo**, nunca valor hardcoded. Ex: `agTracker.viewContent(IOF, {...})`.

---

## Histórico de mudanças (agosto/2026)

| Arquivo | O que foi feito |
|---------|-----------------|
| `api/generate_qr_gateway.js` | Campo `notification_url` → **`webhook_url`** — PinPay só reconhece este campo para disparar webhook de confirmação de pagamento |
| `api/generate_qr_gateway.js` | Adicionado call fire-and-forget para `/api/register-payment` após criar PIX — associa `txId` ao `checkoutSessionId` no VPS antes do webhook chegar |
| VPS `src/routes/track.js` | Adicionado endpoint **`/api/register-payment`**: grava `payment_id` (txId da PinPay) na sessão de rastreamento |
| VPS `src/routes/webhooks.js` | Adicionado fallback de busca por `payment_id` — VPS encontra a sessão com ttclid/ttp mesmo quando PinPay não inclui metadata no webhook |
| Banco PostgreSQL | `ALTER TABLE tracking_sessions ADD COLUMN payment_id TEXT` + índice criado |
| `up1/1` a `up10/10` `index.html` | Removido código morto: `startPolling`, `startTimer`, `showSuccessScreen`, vars `PIX_CODE/PAYMENT_CODE/pollingInterval` |
| `up1/1` a `up10/10` `index.html` | Removido `<div id="pixOverlay">` hardcoded do HTML (era duplicata — a IIFE já injeta via JS) |
| `up1/index.html` | `viewContent` corrigido: valor `17.12` hardcoded → agora usa variável `IOF` (R$23,40) |
| `up2/index.html` | `viewContent` corrigido: `26.32` → `var IOF = 26.00` + `viewContent(IOF)` |
| `up3/index.html` | `viewContent` corrigido: `25.9` → `var IOF = 25.00` + `viewContent(IOF)` + typo `c<script>` removido |
| `up4/index.html` | `viewContent` corrigido: `24.36` (errado) → `var IOF = 22.00` + `viewContent(IOF)` |
| `up5/index.html` | `viewContent` corrigido: `21.42` (errado) → `var IOF = 32.76` + `viewContent(IOF)` |
| `up6/index.html` | `viewContent` corrigido: `32.74` (errado) → `var IOF = 38.93` + `viewContent(IOF)` |
| `up7/index.html` | `viewContent` ausente → adicionado: `var IOF = 24.42` + `viewContent(IOF)` |
| `up8/index.html` | `viewContent` corrigido: `38.94` (errado) → `var IOF = 19.46` + `viewContent(IOF)` |
| `up9/index.html` | `viewContent` ausente → adicionado: `var IOF = 14.73` + `viewContent(IOF)` |
| `up10/index.html` | `viewContent` ausente → adicionado: `var IOF = 46.31` + `viewContent(IOF)` |
