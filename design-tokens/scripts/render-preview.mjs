// Arma la referencia visual del sistema de diseño (DSG-11) a partir del módulo de tokens.
// Es una página local para revisar el sistema en el navegador; no forma parte del paquete.

const escape = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Formato es-MX con operaciones de texto, solo para los ejemplos de esta página. */
const mxn = (amount) => {
  const [integer, fraction = '00'] = amount.split('.');
  return `$${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`;
};

const GROUPS = [
  ['Superficies', 'surface.'],
  ['Texto', 'text.'],
  ['Acción', 'action.'],
  ['Bordes y foco', 'border.'],
  ['Acento', 'accent.'],
  ['Estados', 'status.'],
  ['Dinero', 'money.'],
];

export function renderPreviewHtml(tokens, tokensCss) {
  const { theme, cssColorTokens, contrastPairs, contrastRatio, resolveToken } = tokens;

  const swatches = GROUPS.map(([title, prefix]) => {
    const items = cssColorTokens
      .filter(({ path }) => path.startsWith(prefix))
      .map(
        ({ name, path }) => `
        <li class="swatch">
          <span class="chip" style="background: var(--dt-${name})"></span>
          <code>--dt-${name}</code>
          <span class="meta">${path} · ${resolveToken(theme, path)}</span>
        </li>`,
      )
      .join('');
    return `<section class="group"><h3>${title}</h3><ul class="swatches">${items}</ul></section>`;
  }).join('');

  const pairs = contrastPairs
    .map(({ fg, bg, min }) => {
      const ratio = contrastRatio(resolveToken(theme, fg), resolveToken(theme, bg));
      const kind = min === 3 ? 'Interfaz' : 'Texto';
      return `
      <tr data-pair="${fg}|${bg}">
        <td><span class="sample" style="color: ${resolveToken(theme, fg)}; background: ${resolveToken(theme, bg)}">Aa $1,250.00</span></td>
        <td><code>${fg}</code></td>
        <td><code>${bg}</code></td>
        <td class="num">${ratio.toFixed(2)}</td>
        <td>${kind} ≥ ${min}</td>
      </tr>`;
    })
    .join('');

  const type = Object.entries(tokens.typography)
    .map(
      ([name, style]) => `
      <div class="type-row">
        <span class="meta">${name} · ${style.fontSize}/${style.lineHeight} · ${style.fontWeight}</span>
        <span style="font-size: ${style.fontSize}px; line-height: ${style.lineHeight}px; font-weight: ${style.fontWeight}; letter-spacing: ${style.letterSpacing}px">Envía dinero a quien quieras</span>
      </div>`,
    )
    .join('');

  const badges = Object.entries(tokens.transferStatus)
    .map(
      ([status, { tone, label }]) =>
        `<span class="badge tone-${tone}" title="${status}">${label}</span>`,
    )
    .join('');

  const movements = [
    ['TRANSFER_IN', 'Luis Pérez', 'Renta de octubre', '13 oct, 10:42', '1500.00'],
    ['TRANSFER_OUT', 'Mamá', 'Despensa', '12 oct, 19:05', '850.50'],
    ['OWN_TRANSFER_OUT', 'Ahorro', 'Apartado mensual', '1 oct, 08:00', '3000.00'],
    ['DEPOSIT', 'Tesorería', 'Depósito inicial', '30 sep, 09:15', '25000.00'],
  ]
    .map(([type, counterparty, concept, date, amount]) => {
      const { label, direction } = tokens.movementType[type];
      const { sign } = tokens.money[direction];
      return `
      <li class="movement">
        <div>
          <p class="label">${label}</p>
          <p class="muted">${counterparty} · ${concept}</p>
          <p class="caption">${date}</p>
        </div>
        <p class="amount amount-${direction}">${sign}${mxn(amount)}</p>
      </li>`;
    })
    .join('');

  const alerts = [
    ['danger', tokens.problemMessage('INSUFFICIENT_FUNDS')],
    ['warning', 'Esta transferencia necesita el código que te enviamos por correo.'],
    ['success', 'Listo. Enviaste $1,500.00 a Luis.'],
    ['info', 'Las transferencias entre tus cuentas no cuentan para el límite diario.'],
  ]
    .map(
      ([tone, text]) =>
        `<p class="alert tone-${tone}" role="${tone === 'danger' ? 'alert' : 'status'}">${escape(text)}</p>`,
    )
    .join('');

  const messages = Object.entries(tokens.problemMessages)
    .map(([code, text]) => `<tr><td><code>${code}</code></td><td>${escape(text)}</td></tr>`)
    .join('');

  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TreoWallet · Sistema de diseño</title>
<!-- Generado por scripts/preview.mjs desde src/: no editar a mano. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600&display=swap">
<style>
${tokensCss}
* { box-sizing: border-box; }
html { color-scheme: light; }
body { margin: 0; background: var(--dt-surface); color: var(--dt-fg); font-family: var(--dt-font-sans); font-size: var(--dt-text-body); line-height: var(--dt-text-body-line-height); }
main { max-width: 72rem; margin: 0 auto; padding-block: 3rem; padding-inline: 1rem; display: grid; gap: 3rem; }
h1, h2, h3 { margin: 0; text-wrap: balance; }
h2 { font-size: var(--dt-text-h2); line-height: var(--dt-text-h2-line-height); font-weight: 500; letter-spacing: var(--dt-text-h2-letter-spacing); }
h3 { font-size: var(--dt-text-label); font-weight: 500; color: var(--dt-fg-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
p { margin: 0; }
code { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 0.8125rem; }
.meta, .caption { font-size: var(--dt-text-caption); line-height: var(--dt-text-caption-line-height); color: var(--dt-fg-muted); }
.muted { color: var(--dt-fg-secondary); font-size: var(--dt-text-body-sm); }
.label { font-weight: 500; }
header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--dt-border); padding-bottom: 1.5rem; }
.wordmark { font-size: var(--dt-text-h1); font-weight: 600; letter-spacing: -0.5px; color: var(--dt-fg); }
.wordmark span { color: var(--dt-action); }
.intro { max-width: 40rem; color: var(--dt-fg-secondary); }
.section { display: grid; gap: 1.5rem; }
.groups { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.group { display: grid; gap: 0.75rem; align-content: start; }
.swatches { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.swatch { display: grid; grid-template-columns: 2.5rem 1fr; grid-template-rows: auto auto; column-gap: 0.75rem; align-items: center; }
.chip { grid-row: span 2; width: 2.5rem; height: 2.5rem; border-radius: var(--dt-radius-sm); border: 1px solid var(--dt-border); }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: var(--dt-text-body-sm); }
th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--dt-border); vertical-align: middle; }
th { font-weight: 500; color: var(--dt-fg-secondary); }
.num { font-variant-numeric: tabular-nums; }
.sample { display: inline-block; padding: 0.25rem 0.5rem; border-radius: var(--dt-radius-sm); font-weight: 500; white-space: nowrap; }
.type-row { display: grid; gap: 0.25rem; padding-block: 0.75rem; border-bottom: 1px solid var(--dt-border); }
.components { display: grid; gap: 2rem; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); }
.panel { display: grid; gap: 1rem; align-content: start; min-width: 0; }
.row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
.btn { min-height: 44px; padding: 0 1.5rem; border-radius: var(--dt-radius-pill); border: 1px solid transparent; font: inherit; font-weight: 500; font-size: var(--dt-text-label); cursor: pointer; transition: background-color var(--dt-motion-fast) var(--dt-ease-standard); }
.btn:focus-visible { outline: var(--dt-focus-width) solid var(--dt-focus); outline-offset: var(--dt-focus-offset); }
.btn-primary { background: var(--dt-action); color: var(--dt-fg-on-action); }
.btn-primary:hover, .btn-primary.is-active { background: var(--dt-action-active); color: var(--dt-fg-on-action-active); }
.btn-secondary { background: var(--dt-surface); color: var(--dt-action); border-color: var(--dt-action); }
.btn-ghost { background: transparent; color: var(--dt-action); }
.btn-destructive { background: var(--dt-surface); color: var(--dt-danger); border-color: var(--dt-danger); }
.btn:disabled { background: var(--dt-action-disabled); color: var(--dt-fg-disabled); border-color: transparent; cursor: not-allowed; }
.badge { display: inline-flex; align-items: center; min-height: 1.75rem; padding: 0 0.75rem; border-radius: var(--dt-radius-pill); font-size: var(--dt-text-caption); font-weight: 500; }
.tone-success { background: var(--dt-success-soft); color: var(--dt-success); }
.tone-warning { background: var(--dt-warning-soft); color: var(--dt-warning); }
.tone-danger { background: var(--dt-danger-soft); color: var(--dt-danger); }
.tone-info { background: var(--dt-info-soft); color: var(--dt-info); }
.tone-neutral { background: var(--dt-neutral-soft); color: var(--dt-neutral); }
.alert { padding: 0.75rem 1rem; border-radius: var(--dt-radius-md); font-size: var(--dt-text-body-sm); }
.account { background: var(--dt-surface-brand); border-radius: var(--dt-radius-md); padding: 1.25rem; display: grid; gap: 0.5rem; box-shadow: var(--dt-shadow-card); }
.balance { font-size: var(--dt-text-display); line-height: var(--dt-text-display-line-height); font-weight: 600; letter-spacing: var(--dt-text-display-letter-spacing); font-variant-numeric: tabular-nums; }
.meter { display: grid; gap: 0.5rem; }
.meter-track { height: 0.5rem; border-radius: var(--dt-radius-pill); background: var(--dt-neutral-soft); overflow: hidden; }
.meter-fill { height: 100%; width: 37%; background: var(--dt-accent); }
.movements { list-style: none; margin: 0; padding: 0; }
.movement { display: flex; justify-content: space-between; gap: 1rem; padding-block: 0.75rem; border-bottom: 1px solid var(--dt-border); }
.amount { font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
.amount-in { color: var(--dt-money-in); }
.amount-out { color: var(--dt-money-out); }
.field { display: grid; gap: 0.375rem; }
.field label { font-size: var(--dt-text-label); font-weight: 500; }
.field input { min-height: 44px; padding: 0 0.875rem; border: 1px solid var(--dt-border-input); border-radius: var(--dt-radius-sm); font: inherit; color: var(--dt-fg); background: var(--dt-surface); }
.field input:focus-visible { outline: var(--dt-focus-width) solid var(--dt-focus); outline-offset: var(--dt-focus-offset); }
.field.has-error input { border-color: var(--dt-danger); }
.field .help { font-size: var(--dt-text-caption); color: var(--dt-fg-muted); }
.field.has-error .help { color: var(--dt-danger); }
.otp input { letter-spacing: 0.75em; font-size: var(--dt-text-h3); font-variant-numeric: tabular-nums; }
.privacy { background: var(--dt-surface-inverse); color: var(--dt-fg-on-inverse); border-radius: var(--dt-radius-lg); padding: 2rem; display: grid; place-items: center; min-height: 10rem; }
.privacy .wordmark, .privacy .wordmark span { color: var(--dt-fg-on-inverse); }
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
</style>
</head>
<body>
<main>
  <header>
    <p class="wordmark">Treo<span>Wallet</span></p>
    <p class="intro">Sistema de diseño de TreoWallet: identidad de treo.mx con ajustes WCAG AA. Referencia local generada desde <code>design-tokens/src</code>.</p>
  </header>

  <section class="section">
    <h2>Color</h2>
    <div class="groups">${swatches}</div>
  </section>

  <section class="section">
    <h2>Contraste de los pares permitidos</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Ejemplo</th><th>Color</th><th>Superficie</th><th>Relación</th><th>Mínimo</th></tr></thead>
        <tbody>${pairs}</tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <h2>Tipografía · Work Sans</h2>
    <div>${type}</div>
  </section>

  <section class="section">
    <h2>Componentes</h2>
    <div class="components">
      <div class="panel">
        <h3>Botones</h3>
        <div class="row">
          <button class="btn btn-primary" type="button">Enviar</button>
          <button class="btn btn-primary is-active" type="button">Enviar (activo)</button>
          <button class="btn btn-primary" type="button" disabled>Enviando…</button>
        </div>
        <div class="row">
          <button class="btn btn-secondary" type="button">Agregar beneficiario</button>
          <button class="btn btn-ghost" type="button">Cancelar</button>
          <button class="btn btn-destructive" type="button">Cerrar sesión</button>
        </div>
        <h3>Estados de transferencia</h3>
        <div class="row">${badges}</div>
        <h3>Alertas</h3>
        <div class="panel">${alerts}</div>
      </div>
      <div class="panel">
        <h3>Cuenta</h3>
        <article class="account">
          <p class="label">Principal</p>
          <p class="caption">CLABE •••• 9719</p>
          <p class="balance">${mxn('25000.00')}</p>
        </article>
        <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="50000" aria-valuenow="18500" aria-label="Límite diario usado">
          <div class="meter-track"><div class="meter-fill"></div></div>
          <p class="muted">Te quedan ${mxn('31500.00')} hoy</p>
        </div>
        <h3>Movimientos</h3>
        <ul class="movements">${movements}</ul>
      </div>
      <div class="panel">
        <h3>Campos</h3>
        <div class="field">
          <label for="amount">Monto</label>
          <input id="amount" inputmode="decimal" value="1500.00">
          <p class="help">Hasta 2 decimales, sin comas.</p>
        </div>
        <div class="field has-error">
          <label for="amount-error">Monto</label>
          <input id="amount-error" inputmode="decimal" value="100.005" aria-invalid="true" aria-describedby="amount-error-help">
          <p class="help" id="amount-error-help">El monto admite máximo 2 decimales</p>
        </div>
        <div class="field otp">
          <label for="otp">Código de 6 dígitos</label>
          <input id="otp" inputmode="numeric" autocomplete="one-time-code" value="482913">
        </div>
        <h3>Pantalla de privacidad (móvil)</h3>
        <div class="privacy"><p class="wordmark">Treo<span>Wallet</span></p></div>
      </div>
    </div>
  </section>

  <section class="section">
    <h2>Mensajes de error</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Código</th><th>Mensaje</th></tr></thead>
        <tbody>${messages}</tbody>
      </table>
    </div>
  </section>
</main>
</body>
</html>
`;
}
