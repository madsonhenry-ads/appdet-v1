# V2 Update - 2026-05-24 (updated 2026-05-25)

## Objetivo
Comparar páginas do concorrente (`v2-concorrente/`) com nossas páginas (`ingles/`) e aplicar melhorias.

## Arquivos do Concorrente Analisados
- `v2-concorrente/v2-login/` → `ingles/login.html`
- `v2-concorrente/v2-phone/` → `ingles/phone.html`
- `v2-concorrente/v2-quiz/` → `ingles/quiz/index.html`
- `v2-concorrente/v2-conversas/` → `ingles/conversas.html`
- `v2-concorrente/v2-bridge/` → `ingles/bridge.html`
- `v2-concorrente/v2-dashboard/` → `ingles/dashboard.html`
- `v2-concorrente/v2-landing/` → `ingles/landing.html`

## Melhorias Aplicadas

### phone.html
- **VSL Tynk**: iframe `play.tynk.ai/p/4527683d-...` via `loadVSL()` ativado ao entrar screen3
- **Micro trust section**: "Avg scan time: 47s", "deleted from servers", "never know"
- **Meta tags**: `apple-mobile-web-app-capable`, `theme-color`, `viewport-fit=cover`
- **preconnect**: Para fonts, Facebook CDN, Google Tag Manager
- **Geo DDI sync**: `sel.dispatchEvent(new Event("change"))` apos setar country code
- **Scripts com defer**: `tracking-utils`, `funnel-config`, `tracking`, `funnel-tracking`, `google-ads-loader`

### login.html
- **Honeypot anti-bot**: Campos ocultos `email_confirm`, `website_url`, `company_name`
- **Mobile-safety CSS**: `min-height: 44px` em botoes/inputs mobile, `safe-area-inset-bottom`
- **sentry-init.js**: Monitoramento de erros
- **CSS extras**: `zapspy.css`, `funnel-bridge.css`, `funnel-polish.css`
- **theme-dark**: Classe no body
- **funnel-config.js** + **google-ads-loader.js**: Tracking adicional
- **FunnelTracker EMAIL_CAPTURED**: Evento tracking apos submit
- **UTM capture**: `captureUTMs()` no head
- **keydown** ao inves de **keypress** para Enter

### quiz/index.html (v2 — 2026-05-25)
- **Refeito para 5 etapas** (igual concorrente): Q2 Motivacao, Q3 Readiness, Q4 Sofrimento, Q5 Conexao, Q6 Compromisso
- **Q1 oculto** (`GENDER_Q1_REMOVED_V1`): genero vem do modal dashboard via URL/localStorage
- **Destino**: `cta-unified.html` (nao mais `bridge.html`)
- **Cor brand**: `#00A884` / `#008069` (igual concorrente)
- **Analise**: reduzida de 10s para 6s (`ANALYSIS_MS = 6000`)
- **Score copy**: CTAs personalizados por nivel de suspeita (`QUIZ_SCORE_V9`)
- **Nudge**: botao inicial pulsa apos 5s de inatividade
- **Expired banner**: banner vermelho quando timer acaba
- **Tracking**: `FunnelTracker` adicionado (QUIZ_STARTED, QUIZ_QUESTION_ANSWERED, QUIZ_COMPLETED, QUIZ_CTA_CLICKED)

### conversas.html
- **Blur levels**: Aumentados (`blur(14px)` / `blur(8px)` para mais realismo)
- **facebook-domain-verification**: Meta tag
- **Mobile-safety CSS** + **honeypot**
- **funnel-config.js**, **google-ads-loader.js**, **sentry-init.js**
- **audio-vibration.js** com `defer`

### chat.html
- Criado com base no codigo fonte do concorrente (tinhamos versao basica)
- **Blur**: avatar `blur(8px)`, nome `blur(7px)`, texto `blur(12px)`
- **Evidence tags**: "🔴 FLAGGED — HIGH RISK"
- **Deleted tags**: "🗑️ DELETED MESSAGE"
- **Modal especifico**: Textos diferentes por tipo (photo/video/audio/location)
- **Pixel tracking no CTA**: `InitiateCheckout` com `sendToServer` antes do redirect
- **Unlock banner**: Contador dinamico de locked messages + flagged items
- **Mobile-safety**, **honeypot**, **sentry-init.js**, **theme-dark**
- **CSS extras**: `zapspy.css`, `funnel-bridge.css`, `funnel-polish.css`
- **Scripts**: `funnel-config.js`, `google-ads-loader.js`
- `loading="lazy"` + `decoding="async"` nas imagens
- `urgency-bar.js` com `defer`

### bridge.html
- **viewport-fit=cover**, **Cache-Control headers**
- **sentry-init.js**, **mobile-safety**, **honeypot**, **theme-dark**
- **CSS extras**: `zapspy.css`, `funnel-bridge.css`, `funnel-polish.css`
- **funnel-config.js** + **google-ads-loader.js**
- FacebookCAPI.init com `'Bridge Page'`

### landing.html & dashboard.html
- **sentry-init.js**, **mobile-safety**, **honeypot**, **theme-dark**
- **CSS extras**: `zapspy.css`, `funnel-bridge.css`, `funnel-polish.css`
- **funnel-config.js** + **google-ads-loader.js**

### Corrigido (2026-05-25)
- **sentry-init.js**: Criado arquivo ausente em `ingles/js/` (estava 404)

## Pixels Mantidos (seus, NAO do concorrente)
- `1123687999653173`
- `1533299911750042`

## Fluxo do Funil
```
bridge.html → login.html → dashboard.html → landing.html → phone.html
                                                                ↓
                                                         quiz/index.html
                                                                ↓
                                                    cta-unified.html → checkout
```
```
conversas.html → chat.html → cta-unified.html → checkout
```

## Navegacao
- Todas usam `TrackingUtils.appendUTMs()` para preservar UTMs
- Quiz com `from_phone=true` volta pra `phone.html?resume=true`
- Quiz direto vai pra `cta-unified.html` (checkout)
- Chat CTA dispara `InitiateCheckout` pixel antes do redirect

## Proximo Passo (2026-05-26)
1. Verificar se o quiz esta ok (5 etapas, layout, cores)
2. Comparar `cta-unified.html` com concorrente — parece estar diferente
3. Testar navegacao completa em mobile
4. Verificar paginas `light/` se precisam das mesmas atualizacoes
5. Validar se `retry/`, `expired/`, `offer/`, `lastchance/` precisam de atualizacoes
6. Testar pixel CAPI e tracking apos as mudancas