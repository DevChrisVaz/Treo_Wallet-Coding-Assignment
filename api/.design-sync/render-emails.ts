// Lienzo local de los correos transaccionales, junto a los de la web y la app móvil.
// Renderiza los constructores reales de `src/` con datos de ejemplo y escribe un solo archivo,
// `review/canvas.html`, con cada correo incrustado (srcdoc): se abre con doble clic, sin servidor.
// Uso, desde api/:  npx tsx .design-sync/render-emails.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beneficiaryAddedEmail } from '../src/modules/beneficiaries/application/create-beneficiary.js';
import {
  identityUseAttemptEmail,
  loginNoticeEmail,
  registrationAttemptEmail,
  sessionClosedEmail,
  verificationCodeEmail,
} from '../src/modules/identity/application/email-templates.js';
import {
  scheduledFailureEmail,
  transferOtpEmail,
  transferReceiptEmail,
} from '../src/modules/transfers/application/transfer-emails.js';
import { Money } from '../src/shared/money.js';

interface Sample {
  readonly id: string;
  readonly name: string;
  readonly email: { readonly subject: string; readonly html: string };
}

const at = new Date('2026-10-15T21:54:00Z');
const group = (title: string, samples: Sample[]) => ({ title, samples });

const groups = [
  group('Identidad', [
    {
      id: 'IDN-05',
      name: 'Código de verificación',
      email: verificationCodeEmail({ fullName: 'Ana Gómez', code: '493817', minutes: 15 }),
    },
    { id: 'IDN-16', name: 'Datos de identidad en uso', email: identityUseAttemptEmail() },
    { id: 'IDN-01', name: 'Intento de registro', email: registrationAttemptEmail() },
    {
      id: 'IDN-18',
      name: 'Inicio de sesión',
      email: loginNoticeEmail({ at, client: 'Chrome en Linux', maskedIp: '187.190.12.x' }),
    },
    { id: 'IDN-19', name: 'Sesión cerrada por seguridad', email: sessionClosedEmail({ at }) },
  ]),
  group('Beneficiarios y transferencias', [
    {
      id: 'BEN-12',
      name: 'Beneficiario agregado',
      email: beneficiaryAddedEmail({
        name: 'Luis Pérez Ramírez',
        alias: 'Luis (renta)',
        clabe: '012345678901234567',
        at,
      }),
    },
    {
      id: 'TRF-15',
      name: 'Código de transferencia',
      email: transferOtpEmail({
        code: '123456',
        amount: Money.fromCents(125050n),
        destinationName: 'Luis Pérez Ramírez',
        clabeLast4: '4567',
        minutes: 10,
      }),
    },
    {
      id: 'TRF-35',
      name: 'Programada no realizada',
      email: scheduledFailureEmail({
        amount: Money.fromCents(125050n),
        destinationName: 'Luis Pérez Ramírez',
        clabeLast4: '4567',
        scheduledFor: at,
        reason: 'INSUFFICIENT_FUNDS',
      }),
    },
    {
      id: 'TRF-38',
      name: 'Comprobante de transferencia',
      email: transferReceiptEmail({
        transferId: '7c1f2a90-4b3e-4d8a-9a51-0e6f3b2c1d44',
        amount: Money.fromCents(125050n),
        destinationName: 'Luis Pérez Ramírez',
        clabeLast4: '4567',
        concept: 'Renta de octubre',
        reference: 42,
        at,
      }),
    },
  ]),
];

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const sections = groups
  .map(
    (g) => `<section class="group"><h1>${escapeText(g.title)}</h1><div class="boards">${g.samples
      .map(
        (s) =>
          `<div class="board"><div class="label">${s.id} · ${escapeText(s.name)}</div>` +
          `<div class="subject">Asunto: ${escapeText(s.email.subject)}</div>` +
          `<iframe title="${escapeAttr(s.id)}" style="width:560px;height:700px" srcdoc="${escapeAttr(s.email.html)}"></iframe></div>`,
      )
      .join('')}</div></section>`,
  )
  .join('');

const page = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Canvas — TreoWallet correos</title>
<style>
  :root { --bg:#eceeea; --dot:#c9cdc6; --ink:#1d2420; --muted:#68716b; }
  html, body { margin:0; height:100%; overflow:hidden; background:var(--bg); color:var(--ink);
    font:13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
  #viewport { position:fixed; inset:0; overflow:hidden; cursor:default;
    background-image:radial-gradient(var(--dot) 1px, transparent 1px); background-size:24px 24px; }
  body.panning #viewport, body.panning iframe { cursor:grab; }
  body.dragging #viewport, body.dragging iframe { cursor:grabbing; }
  body.panning iframe { pointer-events:none; }
  #world { position:absolute; left:0; top:0; transform-origin:0 0; padding:160px; width:max-content; }
  .group { margin:0 0 220px; }
  .group > h1 { font:600 44px/1.1 system-ui; margin:0 0 64px; letter-spacing:-.01em; }
  .boards { display:flex; gap:56px; align-items:flex-start; }
  .board > .label { font:500 14px system-ui; color:var(--muted); margin:0 0 4px; white-space:nowrap; }
  .board > .subject { font:400 12px system-ui; color:var(--muted); margin:0 0 10px; max-width:560px; }
  .board iframe { display:block; border:0; background:#fff; border-radius:6px;
    box-shadow:0 1px 2px rgba(0,0,0,.08), 0 10px 30px rgba(0,0,0,.08); }
  #hud { position:fixed; right:16px; bottom:16px; display:flex; align-items:center; gap:2px; padding:4px;
    background:#fff; border-radius:10px; box-shadow:0 2px 12px rgba(0,0,0,.15); user-select:none; }
  #hud button { border:0; background:none; font:500 13px system-ui; padding:6px 10px; border-radius:6px; cursor:pointer; color:var(--ink); }
  #hud button:hover { background:#f0f2ef; }
  #zoom { min-width:52px; text-align:center; font-variant-numeric:tabular-nums; color:var(--muted); }
  #help { position:fixed; left:16px; bottom:16px; padding:8px 12px; background:#fff; border-radius:10px;
    box-shadow:0 2px 12px rgba(0,0,0,.15); color:var(--muted); font-size:12px; }
</style>
</head>
<body>
<div id="viewport"><div id="world">${sections}</div></div>
<div id="help">Rueda: desplazar · Ctrl/⌘ + rueda: zoom · Espacio + arrastrar: mover · 0: ajustar · 1: 100 %</div>
<div id="hud">
  <button id="out" title="Alejar">−</button><span id="zoom">100 %</span><button id="in" title="Acercar">+</button>
  <button id="fit">Ajustar</button><button id="one">100 %</button>
</div>
<script>
(function () {
  const world = document.getElementById('world');
  const viewport = document.getElementById('viewport');
  const view = { x: 0, y: 0, z: 0.5 };
  const apply = () => {
    world.style.transform = 'translate(' + view.x + 'px, ' + view.y + 'px) scale(' + view.z + ')';
    document.getElementById('zoom').textContent = Math.round(view.z * 100) + ' %';
  };
  const zoomAt = (factor, cx, cy) => {
    const z = Math.min(4, Math.max(0.03, view.z * factor));
    view.x = cx - (cx - view.x) * (z / view.z);
    view.y = cy - (cy - view.y) * (z / view.z);
    view.z = z; apply();
  };
  const fit = () => {
    const w = world.scrollWidth, h = world.scrollHeight;
    const z = Math.min(innerWidth / w, innerHeight / h) * 0.95;
    view.z = z; view.x = (innerWidth - w * z) / 2; view.y = (innerHeight - h * z) / 2; apply();
  };
  const onWheel = (e, ox, oy) => {
    e.preventDefault();
    const scaled = ox || oy;
    const cx = (ox || 0) + e.clientX * (scaled ? view.z : 1), cy = (oy || 0) + e.clientY * (scaled ? view.z : 1);
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0025), cx, cy);
    else { view.x -= e.deltaX; view.y -= e.deltaY; apply(); }
  };
  viewport.addEventListener('wheel', (e) => onWheel(e), { passive: false });
  let drag = null;
  const startDrag = (e) => { drag = { x: e.screenX, y: e.screenY, vx: view.x, vy: view.y }; document.body.classList.add('dragging'); };
  const moveDrag = (e) => { if (!drag) return; view.x = drag.vx + e.screenX - drag.x; view.y = drag.vy + e.screenY - drag.y; apply(); };
  const endDrag = () => { drag = null; document.body.classList.remove('dragging'); };
  viewport.addEventListener('mousedown', (e) => { if (e.target === viewport || e.target === world || document.body.classList.contains('panning')) startDrag(e); });
  addEventListener('mousemove', moveDrag); addEventListener('mouseup', endDrag);
  const keys = (e) => {
    if (e.code === 'Space') { e.preventDefault(); document.body.classList.toggle('panning', e.type === 'keydown'); if (e.type === 'keyup') endDrag(); return; }
    if (e.type !== 'keydown') return;
    if (e.key === '0') fit();
    if (e.key === '1') zoomAt(1 / view.z, innerWidth / 2, innerHeight / 2);
    if (e.key === '+' || e.key === '=') zoomAt(1.25, innerWidth / 2, innerHeight / 2);
    if (e.key === '-') zoomAt(0.8, innerWidth / 2, innerHeight / 2);
  };
  addEventListener('keydown', keys); addEventListener('keyup', keys);
  document.getElementById('in').onclick = () => zoomAt(1.25, innerWidth / 2, innerHeight / 2);
  document.getElementById('out').onclick = () => zoomAt(0.8, innerWidth / 2, innerHeight / 2);
  document.getElementById('one').onclick = () => zoomAt(1 / view.z, innerWidth / 2, innerHeight / 2);
  document.getElementById('fit').onclick = fit;

  // Cada correo parte de 700 px de alto y se ajusta a su contenido; los eventos del lienzo se
  // reenvían desde dentro del iframe para que la rueda y el arrastre no se queden atrapados.
  document.querySelectorAll('iframe').forEach((iframe) => {
    iframe.addEventListener('load', () => {
      const doc = iframe.contentDocument, win = iframe.contentWindow;
      const fitHeight = () => { iframe.style.height = Math.ceil(doc.documentElement.scrollHeight) + 'px'; };
      fitHeight();
      new win.ResizeObserver(fitHeight).observe(doc.body);
      doc.documentElement.style.overflow = 'hidden';
      doc.addEventListener('wheel', (e) => { const r = iframe.getBoundingClientRect(); onWheel(e, r.left, r.top); }, { passive: false });
      doc.addEventListener('keydown', keys); doc.addEventListener('keyup', keys);
      doc.addEventListener('mousedown', (e) => { if (document.body.classList.contains('panning')) startDrag(e); });
    });
  });
  addEventListener('load', () => setTimeout(fit, 300));
  apply();
})();
</script>
</body>
</html>
`;

const out = join(dirname(fileURLToPath(import.meta.url)), 'review');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'canvas.html'), page);
console.log(`lienzo de correos en ${join(out, 'canvas.html')}`);
