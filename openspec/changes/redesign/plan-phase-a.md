# TreoWallet Redesign — Phase A (Prototype) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the redesign as a reviewable prototype on branch `design/redesign`: tokens v2, both component kits restyled and extended, every screen re-composed as canvas stories, and a parity canvas — without touching the real routes/screens.

**Architecture:** One worktree, three projects. `/design-tokens` gets additive v2 tokens plus shared helpers (icon concept map, nav destinations, day grouping, hero amount sizing). Web (`web/components/ui`, `web/components/layout`) and mobile (`mobile/src/components/ui`) implement the same anatomy with their own tech. Screens exist only as design-sync preview stories (`web/.design-sync/previews/AppShell.tsx`, `mobile/.design-sync/previews/Screen.tsx`) sharing story names, so a parity canvas pairs them.

**Tech Stack:** TypeScript, Tailwind v4 (web), React Native + react-native-web (mobile canvases), Lucide 1.48.0 (`lucide-react`, `lucide-react-native`), `react-native-svg` (Expo-pinned 15.15.4), Vitest + Testing Library + vitest-axe (web, tokens), Jest + jest-expo + RNTL (mobile), design-sync converter + Playwright 1.61.1 (canvases).

**Spec:** `openspec/changes/redesign/` — `proposal.md`, `design.md` (D1–D10), `specs/*/spec.md` (DSG-13…17, WEB-24…31, MOB-18…22), `tasks.md` (this plan covers tasks 1.1–5.4; Phase B tasks 6–8 get their own plan after the visual approval in 5.4).

**Execution order** (task numbers follow `tasks.md`; some depend on later-numbered ones): 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.4 → 3.5 → 3.3 → 3.6 → 4.1 → 4.2 (without the `select.tsx` sub-step) → 4.4 → 4.5 (finishes the `select.tsx` sub-step) → 4.3 → 5.1 → 5.2 → 5.3 → 5.4.

## Global Constraints

- All UI copy in Spanish (es-MX). Code comments in Spanish, matching the repo.
- No component defines its own colors, sizes, spacing or radii: everything comes from `@devchrisvaz/wallet-design-tokens` (DSG-01). On web that means token utilities (`bg-surface-hero`, `text-fg-on-hero-muted`, …) or `var(--dt-*)`; on mobile, `theme.*`.
- Lime (`#B4E717`) only on dark surfaces (`surface.hero` / `#1C4B42`); never text on light surfaces (DSG-14).
- Text contrast ≥ 4.5:1, UI boundaries ≥ 3:1 (DSG-04). Touch targets ≥ 44 px.
- Money is a decimal string end to end; arithmetic only with `toCents` / `centsToDecimalString` from `@devchrisvaz/wallet-contract` (BigInt). Never `Number`, `parseFloat` or float math on amounts.
- Dates shown in `America/Mexico_City`.
- Existing component APIs stay source-compatible: only additive optional props.
- Lucide pinned at exactly `1.48.0` (released 2026-09-24; newer releases are under two weeks old). `react-native-svg` at the Expo-pinned `15.15.4` (`npx expo install react-native-svg`).
- Projects stay independent: no cross-project imports; web and mobile consume tokens via `file:../design-tokens` with `install-links=true`.
- Phase A never edits `web/app/**`, `web/components/{auth,accounts,beneficiaries,transfers}/**`, `mobile/src/app/**`, `mobile/src/features/**`, `mobile/src/navigation/**`.
- Commits: Conventional Commits, project as scope, trailers `Task: redesign#<n.m>` and `Refs: <IDs>`, plus the session's `Co-Authored-By` line. One task = one commit (or more), never one commit for two tasks. Test titles start with the requirement ID.

## Review Focus

1. **Movements around midnight in Mexico City** — a movement at `05:30Z` belongs to the previous CDMX day; grouping by UTC date would mislabel it. Test in Task 2.3 (`dayLabel`) and 4.4 (mobile list).
2. **Very large balances in the hero** — `$1,234,567,890.00` must stay on one line in a 390 px phone on both platforms. Shared `heroAmountSize` rule (Task 2.3) plus tests in Tasks 3.4 and 4.4.
3. **Movements from a previous year** — the day header must include the year (`28 dic 2025`), otherwise December and January collide. Test in Task 2.3.
4. **Keyboard users in the bottom sheet** — focus must move into the sheet, Tab must not escape it, Escape must close it and return focus to the opener. Tests in Task 3.5.
5. **Tab bar covering the last row** — scrollable content in the app shape must reserve the tab bar height (plus safe area) so the last movement or button is reachable. Tests in Tasks 3.6 (web) and 4.2 (mobile `Screen`).

---

## Working conventions

- **Worktree root:** `WT="/home/morgan-desktop/Projects/Coding Assignments/Treo/.claude/worktrees/design-redesign"`. Every command below runs from `$WT/<project>` unless stated otherwise.
- **Reinstalling tokens in consumers (critical):** `install-links=true` copies the package at install time, and npm keeps the old copy for `file:` deps. After every change to `/design-tokens`: `cd $WT/design-tokens && npm run build && cd $WT/web && npm install @devchrisvaz/wallet-design-tokens@file:../design-tokens && cd $WT/mobile && npm install @devchrisvaz/wallet-design-tokens@file:../design-tokens`. Revert any lockfile churn unrelated to the tokens entry.
- **Web checks:** `npm run lint && npm run typecheck && npm test` (Vitest). **Mobile checks:** `npm run lint && npm run typecheck && npm test` (Jest). **Tokens checks:** `npm run lint && npm run typecheck && npm test && npm run generate && git diff --exit-code generated/`.
- **Canvas rebuild (per app):** `node .design-sync/build-ui.mjs && node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle && node .ds-sync/package-validate.mjs ./ds-bundle && node .design-sync/review/install.mjs`. Single-preview loop: `node .ds-sync/lib/preview-rebuild.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle --components <Names>` then `node .ds-sync/package-capture.mjs --out ./ds-bundle --components <Names>`.
- **Review server (Task 1.3):** `node web/.design-sync/review/serve.mjs --web web/ds-bundle --mobile mobile/ds-bundle --port 4310` from `$WT` → `http://127.0.0.1:4310/web/.canvas.html`, `/mobile/.canvas.html`, `/parity.html`.

## Canonical story data (both platforms, identical values)

Use exactly these values in every screen story so web/mobile pairs compare like for like:

```ts
const NOW = new Date('2026-10-13T18:00:00Z'); // 12:00 en Ciudad de México
const user = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };
const principal = { id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51', name: 'Principal', clabe: '646180157000009719', balance: '25000.00', currency: 'MXN' as const, createdAt: '2026-09-30T15:00:00Z' };
const ahorro = { id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a52', name: 'Ahorro', clabe: '646180157000001234', balance: '10000.00', currency: 'MXN' as const, createdAt: '2026-09-30T15:00:00Z' };
const dailyLimit = { limit: '50000.00', used: '18500.00', remaining: '31500.00', resetsAt: '2026-10-14T06:00:00Z', timeZone: 'America/Mexico_City' as const };
const luis = { id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61', name: 'Luis Pérez Ramírez', alias: 'Luis', clabe: '646180157000005678', createdAt: '2026-10-01T15:00:00Z' };
const mama = { id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c62', name: 'María Gómez', alias: 'Mamá', clabe: '646180157000004321', createdAt: '2026-10-01T15:00:00Z' };
// Últimos movimientos de Principal (más reciente primero). Hoy: 1, ayer: 2, 9 oct: 1, 30 sept: 1.
const movements = [
  { id: 'mv-1', type: 'TRANSFER_OUT' as const, amount: '-1250.00', balanceAfter: '25000.00', concept: 'Renta', reference: '1', counterparty: { name: 'Luis', clabeLast4: '5678' }, transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a', occurredAt: '2026-10-13T16:42:00Z' },
  { id: 'mv-2', type: 'TRANSFER_IN' as const, amount: '450.00', balanceAfter: '26250.00', concept: 'Pago de la comida', reference: '9', counterparty: { name: 'Andrea Ruiz', clabeLast4: '8842' }, transferId: '3b5d7f9a-1c2e-4b4d-8f6a-0c2e4a6b8d91', occurredAt: '2026-10-12T23:10:00Z' },
  { id: 'mv-3', type: 'TRANSFER_OUT' as const, amount: '-150.00', balanceAfter: '25800.00', concept: 'Despensa', reference: '1', counterparty: { name: 'Mamá', clabeLast4: '4321' }, transferId: '9b3e4c0a-7c2d-4e6a-8c7b-0a2f3e4d5c6b', occurredAt: '2026-10-12T15:05:00Z' },
  { id: 'mv-4', type: 'OWN_TRANSFER_OUT' as const, amount: '-3000.00', balanceAfter: '25950.00', concept: 'Ahorro quincenal', reference: '15', counterparty: { name: 'Ahorro', clabeLast4: '1234' }, transferId: '8a2d3b9f-6b1c-4d5f-9b6a-9f1e2d3c4b5a', occurredAt: '2026-10-09T18:20:00Z' },
  { id: 'mv-5', type: 'DEPOSIT' as const, amount: '28950.00', balanceAfter: '28950.00', concept: 'Depósito inicial', reference: '1', counterparty: null, transferId: '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b', occurredAt: '2026-09-30T15:05:00Z' },
];
// Transferencia del flujo sin código: Principal → Luis, $1,250.00, "Renta", ref. 1.
// Transferencia del flujo con código: Principal → Luis, $15,000.00, "Renta", ref. 1 (mayor a $10,000.00).
```

## Shared story names (parity pairs)

| Story | Web (`AppShell.tsx`) | Mobile (`Screen.tsx`) |
|---|---|---|
| `Login` | ✓ | ✓ |
| `Home`, `HomeEmpty`, `HomeLoading`, `HomeError` | ✓ | ✓ |
| `Movements`, `MovementsEmpty` | ✓ | ✓ |
| `TransferRecipient` | ✓ (own accounts + beneficiaries) | ✓ (beneficiaries) |
| `TransferAmount`, `TransferReview`, `TransferUncertain`, `TransferRejected` (INSUFFICIENT_FUNDS at review), `TransferOtp` ($15,000.00), `TransferCompleted`, `TransferFailed` (OTP_ATTEMPTS_EXHAUSTED) | ✓ | ✓ |
| `Register`, `VerifyEmail`, `Beneficiaries`, `BeneficiariesEmpty`, `NewBeneficiary`, `TransferDetail`, `MovementsFilters` (sheet open) | ✓ | — |
| `StartupLoading`, `StartupOffline`, `LoginRateLimited`, `TransferRecipientEmpty`, `TransferRetrying` | — | ✓ |

## File structure

**`/design-tokens`**
- Modify `src/colors.ts` — palette `green200`; semantic `surface.canvas`, `surface.hero`, `text.onHeroMuted`, `accent.onDark`.
- Modify `src/scale.ts` — `typography.displayXl`, `iconSize`, `avatarSize`, `elevation.raised|sheet`, `layout`, `breakpoints`.
- Modify `src/css.ts` — new CSS variables, Tailwind `@theme` breakpoints/containers/shadows.
- Modify `src/native.ts` — new tokens in the RN theme.
- Modify `src/contrast.ts` — new pairs.
- Create `src/icons.ts` — `iconConcepts`, `IconConcept`, `iconNames`, `movementIcon`, `toneIcon`.
- Create `src/navigation.ts` — `navDestinations`, `NavDestination`.
- Create `src/dates.ts` — `dayKey`, `dayLabel`, `groupByDay`.
- Modify `src/conventions.ts` — `heroAmountSize`, `splitCents`.
- Modify `src/index.ts` — export the three new modules.
- Tests: modify `test/tokens.test.ts`, `test/css.test.ts`, `test/native.test.ts`, `test/contrast.test.ts`, `test/conventions.test.ts`; create `test/icons.test.ts`, `test/dates.test.ts`, `test/navigation.test.ts`.
- Regenerate `generated/tokens.css`, `generated/tailwind.css`; bump `package.json` to `1.1.0`.

**`/web`** (kit in `components/ui`, shells in `components/layout`)
- Create `components/ui/Icon.tsx` (+ `IconButton`), `Avatar.tsx`, `TabBar.tsx`, `SideNav.tsx`, `TopBar.tsx`, `AppHeader.tsx`, `BalanceHero.tsx`, `QuickActions.tsx`, `ListSection.tsx`, `MovementList.tsx`, `BottomSheet.tsx`, `Stepper.tsx`, `FlowHeader.tsx`; tests `icons.test.tsx`, `navigation.test.tsx`, `home.test.tsx`, `overlays.test.tsx`.
- Modify `components/ui/{field,Button,AmountField,OtpField,AccountCard,MovementRow,InlineAlert,EmptyState,Skeleton,Receipt,DailyLimitMeter,Wordmark}.tsx`; update `data.test.tsx`, `feedback.test.tsx`, `fields.test.tsx`, `Button.test.tsx` only where markup changes.
- Create `components/layout/AppShell.tsx`, `BrandShell.tsx`; test `layout/shells.test.tsx`.
- Modify `lib/money.ts` — `sumAmounts`.
- Modify `package.json` — `lucide-react@1.48.0`.
- design-sync: modify `.design-sync/entry.ts`, `.design-sync/config.json`, `.design-sync/tailwind.css`; create `.design-sync/previews/AppShell.tsx` and previews for the new kit components; delete `.design-sync/previews/PageShell.tsx`; create `.design-sync/review/{canvas.html,parity.html,serve.mjs,install.mjs,parity-check.mjs}`.

**`/mobile`** (kit in `src/components/ui`)
- Create `src/components/ui/{icon,avatar,tab-bar,app-header,balance-hero,quick-actions,list-section,movement-list,bottom-sheet,stepper,flow-header,brand-screen}.tsx`; tests in `src/components/ui/__tests__/{icons,navigation,home,overlays}.test.tsx`.
- Modify `src/components/ui/{button,text-field,amount-field,otp-field,select,account-card,movement-row,inline-alert,empty-state,skeleton,receipt,daily-limit-meter,privacy-overlay}.tsx`, `src/components/ui/index.ts`, `src/components/screen.tsx`.
- Modify `src/lib/display.ts` — `sumAmounts`.
- Modify `package.json`, `jest.config.js` — Lucide + `react-native-svg`.
- design-sync: modify `.design-sync/config.json`, `.design-sync/docs/*`; rewrite `.design-sync/previews/Screen.tsx`; previews for new kit components; create `.design-sync/review/{canvas.html,install.mjs}`.

---

## Task 1.1: Commit the web design-sync setup to `main`

**Files:**
- Add (already on disk in the main checkout): `web/.design-sync/{config.json,NOTES.md,conventions.md,build-ui.mjs,entry.ts,tailwind.css,docs/*,previews/*}`
- Modify: `.gitignore` (already modified on disk)

**Interfaces:** Produces the committed design-sync inputs that the worktree inherits.

- [ ] **Step 1: Verify nothing generated is staged**

Run (from the main checkout root): `git status --short web/ .gitignore`
Expected: `?? web/.design-sync/` and ` M .gitignore`; `web/.ds-sync/`, `web/ds-bundle/`, `web/.design-sync/.cache/` must NOT appear (gitignored).

- [ ] **Step 2: Commit**

```bash
git add .gitignore web/.design-sync
git commit -m "chore(web): version the design-sync setup for Claude Design

Synthetic package build (build-ui.mjs), explicit DS surface (entry.ts),
static Tailwind compile with the agent vocabulary, conventions header,
category stubs and every authored preview, including the screen map.

Task: redesign#1.1
Refs: DSG-17

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 1.2: Commit the mobile design-sync setup to `main`

**Files:** Add `mobile/.design-sync/{config.json,NOTES.md,conventions.md,build-ui.mjs,entry.ts,fonts.css,docs/*,previews/*}`

- [ ] **Step 1:** `git status --short mobile/` → only `?? mobile/.design-sync/` (no `.ds-sync`, `ds-bundle`, `.cache`).
- [ ] **Step 2: Commit**

```bash
git add mobile/.design-sync
git commit -m "chore(mobile): version the design-sync setup for Claude Design

React Native kit compiled with react-native-web, SafeAreaProvider wrapper,
Work Sans per-weight faces, conventions header, category stubs and every
authored preview, including the 390x844 screen map.

Task: redesign#1.2
Refs: DSG-17

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 1.3: Worktree, tooling and review server

**Files:**
- Create: `web/.design-sync/review/serve.mjs`, `web/.design-sync/review/install.mjs`, `web/.design-sync/review/canvas.html`, `mobile/.design-sync/review/install.mjs`, `mobile/.design-sync/review/canvas.html`
- Modify: `web/.design-sync/NOTES.md`, `mobile/.design-sync/NOTES.md` (section "Revisión local")

**Interfaces:**
- Produces: `serve.mjs --web <dir> --mobile <dir> --port <n>` serving `/web/*` and `/mobile/*` from the two bundles on one origin; `install.mjs` copies `review/canvas.html` (and on web `review/parity.html`) into `ds-bundle/` as dot-files.

- [ ] **Step 1: Create the worktree**

```bash
cd "/home/morgan-desktop/Projects/Coding Assignments/Treo"
git worktree add .claude/worktrees/design-redesign -b design/redesign main
```
Expected: `Preparing worktree (new branch 'design/redesign')`.

- [ ] **Step 2: Install every project and stage the converter**

```bash
WT="/home/morgan-desktop/Projects/Coding Assignments/Treo/.claude/worktrees/design-redesign"
MAIN="/home/morgan-desktop/Projects/Coding Assignments/Treo"
(cd "$WT/design-tokens" && npm ci && npm run build)
(cd "$WT/contract" && npm ci && npm run build)
(cd "$WT/web" && npm ci)
(cd "$WT/mobile" && npm ci)
cp -r "$MAIN/web/.ds-sync" "$WT/web/.ds-sync"
cp -r "$MAIN/mobile/.ds-sync" "$WT/mobile/.ds-sync"
```
Expected: all installs exit 0; `ls "$WT/mobile/.ds-sync/node_modules/react-native-web/package.json"` exists. (If the main checkout's `.ds-sync` is gone, re-stage per each app's `NOTES.md` "Preparar".)

- [ ] **Step 3: Write the review server** — `web/.design-sync/review/serve.mjs`

```js
#!/usr/bin/env node
// Servidor local de revisión del rediseño: sirve los bundles de design-sync de la web y de la app
// móvil bajo un mismo origen (/web/* y /mobile/*), para que el lienzo de paridad pueda superponer y
// medir ambos marcos. Uso: node serve.mjs --web <dir> --mobile <dir> [--port 4310]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const roots = { web: resolve(arg('web', 'web/ds-bundle')), mobile: resolve(arg('mobile', 'mobile/ds-bundle')) };
const here = fileURLToPath(new URL('.', import.meta.url));
const port = Number.parseInt(arg('port', '4310'), 10);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const [, first, ...rest] = path.split('/');
  const base = first === 'web' || first === 'mobile' ? roots[first] : here;
  const relative = first === 'web' || first === 'mobile' ? rest.join('/') : [first, ...rest].join('/');
  const file = normalize(join(base, relative || 'index.html'));
  if (!file.startsWith(base + sep) && file !== base) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`revisión en http://127.0.0.1:${port}/  (web: /web/.canvas.html, móvil: /mobile/.canvas.html, paridad: /parity.html)`);
});
```

Note: `/parity.html` is served from `review/` itself (the `here` root), so it never needs copying.

- [ ] **Step 4: Copy the canvas and write the installers**

Copy the canvas built earlier in this session into both apps (same file; it reads `_ds_bundle.js` relative to itself):
```bash
SP=/tmp/claude-1000/-home-morgan-desktop-Projects-Coding-Assignments-Treo/cab4da6e-b520-4766-8199-59105a449a3a/scratchpad
cp "$SP/canvas.html" "$WT/web/.design-sync/review/canvas.html"
cp "$SP/canvas.html" "$WT/mobile/.design-sync/review/canvas.html"
```
If that scratchpad file is gone, recreate it from the main checkout's served copy: `cp "$MAIN/web/ds-bundle/.canvas.html" "$WT/web/.design-sync/review/canvas.html"` (same for mobile).

Then edit both copies: in the line `const SCREENS = new Set(['PageShell', 'Screen']);` change to `new Set(['AppShell', 'Screen']);`.

`web/.design-sync/review/install.mjs` (and an identical `mobile/.design-sync/review/install.mjs`):
```js
#!/usr/bin/env node
// Copia el lienzo local al bundle recién construido (package-build vacía ds-bundle en cada build).
import { copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = resolve(here, '..', '..', 'ds-bundle');
if (!existsSync(out)) throw new Error(`No existe ${out}: corre package-build primero`);
copyFileSync(join(here, 'canvas.html'), join(out, '.canvas.html'));
console.log(`lienzo instalado en ${join(out, '.canvas.html')}`);
```

- [ ] **Step 5: Build both canvases and start the server**

```bash
cd "$WT/web" && node .design-sync/build-ui.mjs && node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle && node .design-sync/review/install.mjs
cd "$WT/mobile" && node .design-sync/build-ui.mjs && node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle && node .design-sync/review/install.mjs
cd "$WT" && node web/.design-sync/review/serve.mjs --web web/ds-bundle --mobile mobile/ds-bundle --port 4310   # background
```
Expected: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4310/web/.canvas.html` → `200`; same for `/mobile/.canvas.html`.

- [ ] **Step 6: Document in both NOTES.md** — append:

```markdown
## Revisión local

- `review/canvas.html` es el lienzo (pantallas primero, luego componentes por grupo). `package-build`
  vacía `ds-bundle/`: después de cada build corre `node .design-sync/review/install.mjs`.
- `web/.design-sync/review/serve.mjs` sirve ambos bundles en un solo origen (`/web/*`, `/mobile/*`)
  y el lienzo de paridad en `/parity.html`.
```

- [ ] **Step 7: Commit (in the worktree)**

```bash
cd "$WT" && git add web/.design-sync/review mobile/.design-sync/review web/.design-sync/NOTES.md mobile/.design-sync/NOTES.md
git commit -m "chore(web): add the local review server and canvases for the redesign

Task: redesign#1.3
Refs: DSG-17

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 2.1: Tokens v2

**Files:**
- Modify: `design-tokens/src/colors.ts`, `src/scale.ts`, `src/css.ts`, `src/native.ts`, `package.json` (version `1.1.0`)
- Test: `design-tokens/test/tokens.test.ts`, `test/css.test.ts`, `test/native.test.ts`
- Regenerate: `generated/tokens.css`, `generated/tailwind.css`

**Interfaces:**
- Produces (TS, from `@devchrisvaz/wallet-design-tokens`): `theme.colors.surface.canvas`, `theme.colors.surface.hero`, `theme.colors.text.onHeroMuted`, `theme.colors.accent.onDark`; `typography.displayXl`; `iconSize = { sm: 16, md: 20, lg: 24 }`; `avatarSize = { sm: 32, md: 40, lg: 56 }`; `elevation.raised`, `elevation.sheet` (`{ css, native }`); `layout = { tabBarHeight: 64, appColumnMax: 480, sidebarWidth: 248, contentMax: 1200 }`; `breakpoints = { app: 480, dashboard: 1024 }`.
- Produces (CSS/Tailwind): colors `surface-canvas`, `surface-hero`, `fg-on-hero-muted`, `accent-on-dark`; `text-display-xl`; `shadow-raised`, `shadow-sheet`; `max-w-app`, `max-w-content`, `w-sidebar`; variants `app:` (≥ 30rem) and `dashboard:` (≥ 64rem); variables `--dt-layout-tab-bar-height`, `--dt-layout-app-column-max`, `--dt-layout-sidebar-width`, `--dt-layout-content-max`, `--dt-icon-{sm,md,lg}`, `--dt-avatar-{sm,md,lg}`.
- Produces (native, `@devchrisvaz/wallet-design-tokens/native`): `theme.typography.displayXl`, `theme.iconSize`, `theme.avatarSize`, `theme.elevation.{card,raised,sheet}`, `theme.layout`.

- [ ] **Step 1: Write the failing tests**

Append to `test/tokens.test.ts`:
```ts
describe('lenguaje visual v2', () => {
  it('DSG-13 el lienzo de la app es la arena de Treo y el hero es verde profundo', () => {
    expect(theme.colors.surface.canvas).toBe('#F6F5F2');
    expect(theme.colors.surface.hero).toBe('#1C4B42');
  });

  it('DSG-14 el lima solo existe como acento sobre oscuro', () => {
    expect(theme.colors.accent.onDark).toBe('#B4E717');
    expect(theme.colors.text.onHeroMuted).toBe('#BFCDCA');
  });

  it('DSG-16 los tokens vigentes conservan su valor', () => {
    expect(theme.colors.surface.default).toBe('#FFFFFF');
    expect(theme.colors.surface.subtle).toBe('#F6F5F2');
    expect(theme.colors.surface.inverse).toBe('#1C4B42');
    expect(theme.colors.accent.brand).toBe('#31C454');
  });
});
```

Append to `test/css.test.ts`:
```ts
describe('tokens v2 en CSS', () => {
  it.each([
    ['--dt-surface-canvas: #F6F5F2;'],
    ['--dt-surface-hero: #1C4B42;'],
    ['--dt-fg-on-hero-muted: #BFCDCA;'],
    ['--dt-accent-on-dark: #B4E717;'],
    ['--dt-text-display-xl: 3rem;'],
    ['--dt-text-display-xl-line-height: 3.5rem;'],
    ['--dt-layout-tab-bar-height: 64px;'],
    ['--dt-layout-app-column-max: 480px;'],
    ['--dt-layout-sidebar-width: 248px;'],
    ['--dt-layout-content-max: 1200px;'],
    ['--dt-icon-md: 20px;'],
    ['--dt-avatar-md: 40px;'],
  ])('DSG-16 tokens.css define %s', (declaration) => {
    expect(tokensCss).toContain(declaration);
  });

  it('DSG-16 Tailwind expone los puntos de cambio de la app y del dashboard', () => {
    expect(tailwindCss).toContain('--breakpoint-app: 30rem;');
    expect(tailwindCss).toContain('--breakpoint-dashboard: 64rem;');
  });

  it('DSG-16 Tailwind expone anchos, sombras y el display mayor', () => {
    expect(tailwindCss).toContain('--container-app: var(--dt-layout-app-column-max);');
    expect(tailwindCss).toContain('--container-content: var(--dt-layout-content-max);');
    expect(tailwindCss).toContain('--container-sidebar: var(--dt-layout-sidebar-width);');
    expect(tailwindCss).toContain('--shadow-raised: var(--dt-shadow-raised);');
    expect(tailwindCss).toContain('--shadow-sheet: var(--dt-shadow-sheet);');
    expect(tailwindCss).toContain('--text-display-xl: var(--dt-text-display-xl);');
  });
});
```

Append to `test/native.test.ts`:
```ts
describe('tokens v2 en React Native', () => {
  it('DSG-16 el display mayor usa Work Sans SemiBold 48/56', () => {
    expect(nativeTheme.typography.displayXl).toMatchObject({ fontFamily: 'WorkSans_600SemiBold', fontSize: 48, lineHeight: 56 });
  });

  it('DSG-16 iconos, avatares, layout y elevaciones coinciden con la fuente', () => {
    expect(nativeTheme.iconSize).toEqual({ sm: 16, md: 20, lg: 24 });
    expect(nativeTheme.avatarSize).toEqual({ sm: 32, md: 40, lg: 56 });
    expect(nativeTheme.layout).toEqual({ tabBarHeight: 64, appColumnMax: 480, sidebarWidth: 248, contentMax: 1200 });
    expect(nativeTheme.elevation.raised.elevation).toBe(4);
    expect(nativeTheme.elevation.sheet.elevation).toBe(16);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/tokens.test.ts test/css.test.ts test/native.test.ts`
Expected: FAIL — `surface.canvas` undefined, missing CSS declarations, `nativeTheme.iconSize` undefined. The existing "incluye cada color del tema exactamente una vez" test also fails once colors are added in Step 3 until `cssColorTokens` is extended (that is expected and fixed in Step 3).

- [ ] **Step 3: Implement**

`src/colors.ts` — add to `palette` after `slate200`:
```ts
  green200: '#BFCDCA', // texto atenuado sobre el hero: 6.56:1 sobre green900
```
In `ThemeColors`: `surface` gets `canvas: PaletteColor; hero: PaletteColor;`; `text` gets `onHeroMuted: PaletteColor;`; `accent` becomes `{ brand: PaletteColor; onDark: PaletteColor }`.
In `lightColors`: `surface` adds `canvas: palette.sand50, hero: palette.green900,`; `text` adds `onHeroMuted: palette.green200,`; `accent: { brand: palette.green500, onDark: palette.lime400 },`.

`src/scale.ts` — in `typography`, before `display`:
```ts
  displayXl: { fontSize: 48, lineHeight: 56, fontWeight: 600, letterSpacing: -0.5 },
```
Add to `elevation` (after `card`):
```ts
  raised: {
    css: '0 4px 12px rgb(0 26 5 / 0.08), 0 1px 3px rgb(0 26 5 / 0.1)',
    native: { shadowColor: '#001A05', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  },
  sheet: {
    css: '0 -8px 24px rgb(0 26 5 / 0.12)',
    native: { shadowColor: '#001A05', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 16 },
  },
```
(update its doc comment to "Tres niveles: tarjeta, flotante y hoja inferior.") Append:
```ts
/** Tamaños de icono en px (Lucide, trazo de 2 px). */
export const iconSize = { sm: 16, md: 20, lg: 24 } as const;

/** Tamaños de avatar en px: movimientos (md), menú de la cuenta (sm) y estados vacíos (lg). */
export const avatarSize = { sm: 32, md: 40, lg: 56 } as const;

/** Medidas de layout compartidas por la web y la app móvil (paridad, D3 y D5 del rediseño). */
export const layout = { tabBarHeight: 64, appColumnMax: 480, sidebarWidth: 248, contentMax: 1200 } as const;

/** Puntos de cambio de la web en px: columna de app centrada y forma de dashboard. */
export const breakpoints = { app: 480, dashboard: 1024 } as const;
```

`src/css.ts` — in `cssColorTokens` add after `surface-inverse`: `{ path: 'surface.canvas', name: 'surface-canvas' }, { path: 'surface.hero', name: 'surface-hero' },`; after `fg-on-inverse`: `{ path: 'text.onHeroMuted', name: 'fg-on-hero-muted' },`; after `accent`: `{ path: 'accent.onDark', name: 'accent-on-dark' },`. Import `avatarSize, breakpoints, iconSize, layout` from `./scale`. In `rootDeclarations`, replace the single `--dt-shadow-card` line with:
```ts
    ...Object.entries(elevation).map(([level, value]) => `--dt-shadow-${level}: ${value.css};`),
    ...Object.entries(layout).map(([name, value]) => `--dt-layout-${kebab(name)}: ${value}px;`),
    ...Object.entries(iconSize).map(([size, value]) => `--dt-icon-${size}: ${value}px;`),
    ...Object.entries(avatarSize).map(([size, value]) => `--dt-avatar-${size}: ${value}px;`),
```
In `renderTailwindCss`: rename `reset` to `staticTheme` and append to it:
```ts
    ...Object.entries(breakpoints).map(([name, px]) => `--breakpoint-${name}: ${rem(px)};`),
```
In `inline`, replace `'--shadow-card: var(--dt-shadow-card);'` with:
```ts
    ...Object.keys(elevation).map((level) => `--shadow-${level}: var(--dt-shadow-${level});`),
    '--container-app: var(--dt-layout-app-column-max);',
    '--container-content: var(--dt-layout-content-max);',
    '--container-sidebar: var(--dt-layout-sidebar-width);',
```
and pass `staticTheme` to `block('@theme', staticTheme)`.

`src/native.ts` — import `avatarSize, iconSize, layout` and set in `theme`:
```ts
  elevation: { card: elevation.card.native, raised: elevation.raised.native, sheet: elevation.sheet.native },
  iconSize,
  avatarSize,
  layout,
```

`package.json`: `"version": "1.1.0"`.

- [ ] **Step 4: Regenerate and run all tokens checks**

Run: `npm run generate && npm run lint && npm run typecheck && npm test`
Expected: PASS (the generated-files test passes because `generate` rewrote them).

- [ ] **Step 5: Commit**

```bash
git add design-tokens
git commit -m "feat(design-tokens): add the v2 tokens for the redesign

Canvas and hero surfaces, muted text and lime accent for dark surfaces,
display-xl, icon and avatar sizes, raised and sheet elevations, shared
layout measures and the app/dashboard breakpoints in all three outputs.

Task: redesign#2.1
Refs: DSG-13, DSG-16

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 2.2: Contrast pairs for the dark surfaces

**Files:** Modify `design-tokens/src/contrast.ts`; test `design-tokens/test/contrast.test.ts`, `test/tokens.test.ts`

- [ ] **Step 1: Write the failing tests**

`test/contrast.test.ts`, append:
```ts
describe('pares del hero (DSG-14)', () => {
  it.each([
    ['text.onInverse', 'surface.hero'],
    ['text.onHeroMuted', 'surface.hero'],
    ['accent.onDark', 'surface.hero'],
    ['text.primary', 'accent.onDark'],
  ])('DSG-14 %s sobre %s está declarado y cumple 4.5:1', (fg, bg) => {
    expect(contrastPairs.some((pair) => pair.fg === fg && pair.bg === bg)).toBe(true);
    expect(contrastRatio(resolveToken(theme, fg), resolveToken(theme, bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('DSG-14 el lima como texto sobre blanco no llega a 4.5:1', () => {
    expect(contrastRatio(theme.colors.accent.onDark, theme.colors.surface.default)).toBeLessThan(4.5);
  });
});
```
`test/tokens.test.ts`, inside `describe('lenguaje visual v2')`:
```ts
  it('DSG-14 ningún token de texto, estado o dinero es lima', () => {
    const textColors = [
      ...leaves(theme.colors.text),
      ...Object.values(theme.colors.status).map((tone) => tone.fg),
      ...leaves(theme.colors.money),
    ];
    expect(textColors).not.toContain('#B4E717');
  });
```

- [ ] **Step 2:** `npx vitest run test/contrast.test.ts test/tokens.test.ts` → FAIL (pairs not declared).

- [ ] **Step 3: Implement** — in `src/contrast.ts`, extend the first group to include the canvas and add the hero pairs:
```ts
  ...['surface.default', 'surface.subtle', 'surface.brand', 'surface.canvas'].flatMap((bg) => [
```
and before `ui('action.primary', 'surface.default')`:
```ts
  text('text.onInverse', 'surface.hero'),
  text('text.onHeroMuted', 'surface.hero'),
  text('accent.onDark', 'surface.hero'),
  text('text.primary', 'accent.onDark'),
```
Update the doc comment: "El lima (`accent.onDark`) solo aparece sobre el hero."

- [ ] **Step 4:** `npm test` → PASS (the existing "cubre todos los textos" test now also covers `text.onHeroMuted`).
- [ ] **Step 5: Commit** — `test(design-tokens): verify contrast on the hero surface` with `Task: redesign#2.2`, `Refs: DSG-14`.

## Task 2.3: Icon concepts, navigation, day grouping and hero sizing

**Files:**
- Create: `design-tokens/src/icons.ts`, `src/navigation.ts`, `src/dates.ts`; tests `test/icons.test.ts`, `test/navigation.test.ts`, `test/dates.test.ts`
- Modify: `src/conventions.ts`, `src/index.ts`, `test/conventions.test.ts`

**Interfaces (exported from the package root):**
- `iconConcepts: readonly ['home','movements','transfer','beneficiaries','logout','moneyIn','moneyOut','deposit','ownTransfer','success','error','warning','info','close','back','forward','expand','filter','account']`; `type IconConcept`; `iconNames: Record<IconConcept, string>` (Lucide PascalCase names); `movementIcon: Record<MovementTypeKey, IconConcept>`; `toneIcon: Record<Tone, IconConcept>`.
- `navDestinations: { home|movements|transfer|beneficiaries: { label: string; icon: IconConcept } }`; `type NavDestination`.
- `dayKey(date: Date | string): string` (`YYYY-MM-DD` in CDMX); `dayLabel(iso: string, now?: Date): string`; `groupByDay<T>(items: readonly T[], dateOf: (item: T) => string, now?: Date): DayGroup<T>[]` with `interface DayGroup<T> { key: string; label: string; items: T[] }`.
- `heroAmountSize(formatted: string): 'displayXl' | 'display' | 'h1'`; `splitCents(formatted: string): [whole: string, cents: string]`.

- [ ] **Step 1: Write the failing tests**

`test/icons.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { iconConcepts, iconNames, movementIcon, movementType, toneIcon } from '../src/index';

describe('mapa de iconos', () => {
  it('DSG-15 cubre los doce conceptos de la especificación', () => {
    for (const concept of ['home', 'movements', 'transfer', 'beneficiaries', 'logout', 'moneyIn', 'moneyOut', 'deposit', 'ownTransfer', 'success', 'error', 'warning'] as const) {
      expect(iconConcepts).toContain(concept);
    }
  });

  it('DSG-15 cada concepto tiene un nombre de Lucide en PascalCase', () => {
    for (const concept of iconConcepts) expect(iconNames[concept]).toMatch(/^[A-Z][A-Za-z0-9]+$/);
  });

  it('DSG-15 cada tipo de movimiento tiene su icono', () => {
    expect(Object.keys(movementIcon).sort()).toEqual(Object.keys(movementType).sort());
    expect(movementIcon.TRANSFER_IN).toBe('moneyIn');
    expect(movementIcon.DEPOSIT).toBe('deposit');
  });

  it('DSG-15 el error usa el icono de error', () => {
    expect(toneIcon.danger).toBe('error');
  });
});
```

`test/navigation.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { iconConcepts, navDestinations } from '../src/index';

describe('destinos de navegación', () => {
  it('DSG-17 web y móvil comparten etiquetas e iconos', () => {
    expect(navDestinations).toEqual({
      home: { label: 'Inicio', icon: 'home' },
      movements: { label: 'Movimientos', icon: 'movements' },
      transfer: { label: 'Transferir', icon: 'transfer' },
      beneficiaries: { label: 'Beneficiarios', icon: 'beneficiaries' },
    });
    for (const { icon } of Object.values(navDestinations)) expect(iconConcepts).toContain(icon);
  });
});
```

`test/dates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { dayKey, dayLabel, groupByDay } from '../src/index';

const NOW = new Date('2026-10-13T18:00:00Z'); // 12:00 del 13 de octubre en Ciudad de México

describe('días en Ciudad de México', () => {
  it('DSG-17 dayKey usa la fecha de Ciudad de México, no la de UTC', () => {
    expect(dayKey('2026-10-13T05:30:00Z')).toBe('2026-10-12');
    expect(dayKey('2026-10-13T06:30:00Z')).toBe('2026-10-13');
  });

  it.each([
    ['2026-10-13T16:42:00Z', 'Hoy'],
    ['2026-10-13T05:30:00Z', 'Ayer'],
    ['2026-10-12T23:10:00Z', 'Ayer'],
    ['2026-10-09T18:20:00Z', '9 oct'],
    ['2025-12-28T18:00:00Z', '28 dic 2025'],
  ])('DSG-17 %s se agrupa como "%s"', (iso, label) => {
    expect(dayLabel(iso, NOW)).toBe(label);
  });

  it('DSG-17 groupByDay respeta el orden y agrupa días consecutivos', () => {
    const items = ['2026-10-13T16:42:00Z', '2026-10-12T23:10:00Z', '2026-10-12T15:05:00Z', '2026-10-09T18:20:00Z'];
    const groups = groupByDay(items, (iso) => iso, NOW);
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([['Hoy', 1], ['Ayer', 2], ['9 oct', 1]]);
  });
});
```

Append to `test/conventions.test.ts`:
```ts
describe('monto del hero', () => {
  it.each([
    ['$35,000.00', 'displayXl'],
    ['$350,000.00', 'displayXl'],
    ['$3,500,000.00', 'display'],
    ['$35,000,000.00', 'display'],
    ['$1,234,567,890.00', 'h1'],
  ] as const)('DSG-13 %s usa %s para caber en una línea a 390 px', (formatted, size) => {
    expect(heroAmountSize(formatted)).toBe(size);
  });

  it('DSG-13 splitCents separa los centavos para mostrarlos más chicos', () => {
    expect(splitCents('$35,000.00')).toEqual(['$35,000', '.00']);
  });
});
```
(add `heroAmountSize, splitCents` to that file's import from `'../src/index'`).

- [ ] **Step 2:** `npx vitest run test/icons.test.ts test/navigation.test.ts test/dates.test.ts test/conventions.test.ts` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/icons.ts`:
```ts
import type { Tone } from './conventions';
import { movementType } from './conventions';

/**
 * Conceptos con icono. Web y móvil usan el mismo icono de Lucide por concepto (DSG-15): cada
 * cliente importa los componentes de su librería y una prueba compara contra `iconNames`.
 */
export const iconConcepts = [
  'home', 'movements', 'transfer', 'beneficiaries', 'logout',
  'moneyIn', 'moneyOut', 'deposit', 'ownTransfer',
  'success', 'error', 'warning', 'info',
  'close', 'back', 'forward', 'expand', 'filter', 'account',
] as const;

export type IconConcept = (typeof iconConcepts)[number];

/** Nombre del componente de Lucide (1.48.0) de cada concepto. */
export const iconNames = {
  home: 'House',
  movements: 'ReceiptText',
  transfer: 'Send',
  beneficiaries: 'Users',
  logout: 'LogOut',
  moneyIn: 'ArrowDownLeft',
  moneyOut: 'ArrowUpRight',
  deposit: 'Landmark',
  ownTransfer: 'Repeat2',
  success: 'CircleCheck',
  error: 'CircleAlert',
  warning: 'TriangleAlert',
  info: 'Info',
  close: 'X',
  back: 'ChevronLeft',
  forward: 'ChevronRight',
  expand: 'ChevronDown',
  filter: 'SlidersHorizontal',
  account: 'UserRound',
} as const satisfies Record<IconConcept, string>;

/** Icono del avatar de cada tipo de movimiento. */
export const movementIcon = {
  DEPOSIT: 'deposit',
  TRANSFER_IN: 'moneyIn',
  TRANSFER_OUT: 'moneyOut',
  OWN_TRANSFER_IN: 'ownTransfer',
  OWN_TRANSFER_OUT: 'ownTransfer',
} as const satisfies Record<keyof typeof movementType, IconConcept>;

/** Icono de cada tono de alerta. */
export const toneIcon = {
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  neutral: 'info',
} as const satisfies Record<Tone, IconConcept>;
```

`src/navigation.ts`:
```ts
import type { IconConcept } from './icons';

/** Destinos de la navegación principal (pestañas y navegación lateral), iguales en web y móvil. */
export const navDestinations = {
  home: { label: 'Inicio', icon: 'home' },
  movements: { label: 'Movimientos', icon: 'movements' },
  transfer: { label: 'Transferir', icon: 'transfer' },
  beneficiaries: { label: 'Beneficiarios', icon: 'beneficiaries' },
} as const satisfies Record<string, { label: string; icon: IconConcept }>;

export type NavDestination = keyof typeof navDestinations;
```

`src/dates.ts`:
```ts
/** Agrupación por día de Ciudad de México, igual en web y móvil (listas de movimientos). */
const TIME_ZONE = 'America/Mexico_City';

const keyParts = new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const shortDay = new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' });
const shortDayYear = new Intl.DateTimeFormat('es-MX', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' });

/** Día de Ciudad de México en formato `YYYY-MM-DD`. */
export function dayKey(date: Date | string): string {
  const parts = Object.fromEntries(keyParts.formatToParts(new Date(date)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function previousDay(key: string): string {
  const [year, month, day] = key.split('-').map((value) => Number.parseInt(value, 10)) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/** "Hoy", "Ayer", "9 oct" o, en otro año, "28 dic 2025". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const key = dayKey(iso);
  const today = dayKey(now);
  if (key === today) return 'Hoy';
  if (key === previousDay(today)) return 'Ayer';
  const format = key.slice(0, 4) === today.slice(0, 4) ? shortDay : shortDayYear;
  return format.format(new Date(iso)).replace(/\./g, '');
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Agrupa elementos ya ordenados en grupos de días consecutivos, sin reordenar. */
export function groupByDay<T>(items: readonly T[], dateOf: (item: T) => string, now: Date = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const key = dayKey(dateOf(item));
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(dateOf(item), now), items: [item] });
  }
  return groups;
}
```

`src/conventions.ts`, append:
```ts
/**
 * Tamaño tipográfico del saldo del hero según su largo, para que quepa en una línea a 390 px con
 * el mismo criterio en web y móvil.
 */
export function heroAmountSize(formatted: string): 'displayXl' | 'display' | 'h1' {
  if (formatted.length <= 11) return 'displayXl';
  if (formatted.length <= 14) return 'display';
  return 'h1';
}

/** Separa `$35,000.00` en `['$35,000', '.00']` para mostrar los centavos en un tamaño menor. */
export function splitCents(formatted: string): [string, string] {
  const dot = formatted.lastIndexOf('.');
  return dot < 0 ? [formatted, ''] : [formatted.slice(0, dot), formatted.slice(dot)];
}
```

`src/index.ts` — add `export * from './dates'; export * from './icons'; export * from './navigation';`.

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test && npm run build && npm run check:no-node-imports` → PASS.
- [ ] **Step 5: Reinstall tokens in web and mobile** (see Working conventions) and confirm `grep '"version"' web/node_modules/@devchrisvaz/wallet-design-tokens/package.json` → `1.1.0`.
- [ ] **Step 6: Commit** — `feat(design-tokens): share icons, navigation, day grouping and hero sizing` with `Task: redesign#2.3`, `Refs: DSG-15, DSG-17, DSG-13`. Include the web and mobile `package-lock.json` changes for the tokens entry only in a separate `chore(web)`/`chore(mobile)` commit with the same `Task:` trailer.

## Task 3.1: Web `Icon`, `IconButton` and `Avatar`

**Files:**
- Modify: `web/package.json` (+ lock) — `npm install lucide-react@1.48.0 --save-exact`
- Create: `web/components/ui/Icon.tsx`, `web/components/ui/Avatar.tsx`
- Test: `web/components/ui/icons.test.tsx`

**Interfaces:**
- Produces: `ICONS: Record<IconConcept, LucideIcon>`; `Icon(props: { name: IconConcept; size?: 'sm'|'md'|'lg'; label?: string; className?: string })`; `IconButton(props: { icon: IconConcept; label: string; onClick?: () => void; href?: string; tone?: 'default'|'onDark'; className?: string })`; `Avatar(props: { tone?: 'brand'|'success'|'neutral'|'hero'; size?: 'sm'|'md'|'lg'; initials?: string; icon?: IconConcept })`; `initials(name: string): string`.

- [ ] **Step 1: Install** — `npm install lucide-react@1.48.0 --save-exact`; expected `"lucide-react": "1.48.0"` in `package.json`.

- [ ] **Step 2: Write the failing test** — `web/components/ui/icons.test.tsx`:
```tsx
import { iconConcepts, iconNames } from '@devchrisvaz/wallet-design-tokens';
import * as Lucide from 'lucide-react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, initials } from './Avatar';
import { ICONS, Icon, IconButton } from './Icon';

describe('Icon', () => {
  it.each(iconConcepts)('DSG-15 %s usa el icono del mapa compartido', (concept) => {
    expect(ICONS[concept]).toBe((Lucide as unknown as Record<string, unknown>)[iconNames[concept]]);
  });

  it('DSG-15 un icono decorativo se oculta a los lectores de pantalla', () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('DSG-15 un icono con etiqueta se anuncia como imagen', () => {
    render(<Icon name="error" label="Error" />);
    expect(screen.getByRole('img', { name: 'Error' })).toBeInTheDocument();
  });

  it('DSG-15 un botón solo con icono tiene nombre accesible', () => {
    render(<IconButton icon="close" label="Cerrar" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Cerrar' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Avatar', () => {
  it.each([
    ['Ana Gómez Castillo', 'AG'],
    ['Ángel', 'Á'],
    ['  luis   pérez ', 'LP'],
  ])('DSG-17 las iniciales de "%s" son %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('DSG-17 el avatar es decorativo', () => {
    const { container } = render(<Avatar initials="AG" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
```

- [ ] **Step 3:** `npx vitest run components/ui/icons.test.tsx` → FAIL (`./Icon` not found).

- [ ] **Step 4: Implement** — `web/components/ui/Icon.tsx`:
```tsx
import { iconSize, type IconConcept } from '@devchrisvaz/wallet-design-tokens';
import {
  ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck,
  House, Info, Landmark, LogOut, ReceiptText, Repeat2, Send, SlidersHorizontal, TriangleAlert,
  UserRound, Users, X, type LucideIcon,
} from 'lucide-react';

/** Componente de Lucide de cada concepto; una prueba lo compara con `iconNames` del paquete (DSG-15). */
export const ICONS = {
  home: House, movements: ReceiptText, transfer: Send, beneficiaries: Users, logout: LogOut,
  moneyIn: ArrowDownLeft, moneyOut: ArrowUpRight, deposit: Landmark, ownTransfer: Repeat2,
  success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info,
  close: X, back: ChevronLeft, forward: ChevronRight, expand: ChevronDown,
  filter: SlidersHorizontal, account: UserRound,
} as const satisfies Record<IconConcept, LucideIcon>;

export interface IconProps {
  name: IconConcept;
  size?: keyof typeof iconSize;
  /** Solo cuando el icono comunica algo sin texto al lado; si no, es decorativo. */
  label?: string;
  className?: string;
}

/** Icono de línea del sistema (DSG-15): decorativo salvo que tenga etiqueta. */
export function Icon({ name, size = 'md', label, className = '' }: IconProps) {
  const Glyph = ICONS[name];
  const px = iconSize[size];
  const classes = `shrink-0 ${className}`.trim();
  return label ? (
    <Glyph role="img" aria-label={label} width={px} height={px} strokeWidth={2} className={classes} />
  ) : (
    <Glyph aria-hidden="true" focusable="false" width={px} height={px} strokeWidth={2} className={classes} />
  );
}

export interface IconButtonProps {
  icon: IconConcept;
  /** Obligatoria: es el único nombre accesible del botón. */
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: 'default' | 'onDark';
  className?: string;
}

/** Botón o enlace solo con icono, de 44 px y con nombre accesible (DSG-15). */
export function IconButton({ icon, label, onClick, href, tone = 'default', className = '' }: IconButtonProps) {
  const classes = `inline-flex size-11 items-center justify-center rounded-pill ${
    tone === 'onDark' ? 'text-fg-on-inverse hover:bg-fg-on-inverse/10' : 'text-fg hover:bg-surface-subtle'
  } ${className}`.trim();
  return href ? (
    <a href={href} aria-label={label} className={classes}><Icon name={icon} size="lg" /></a>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={classes}><Icon name={icon} size="lg" /></button>
  );
}
```

`web/components/ui/Avatar.tsx`:
```tsx
import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { Icon } from './Icon';

const TONES = {
  brand: 'bg-surface-brand text-action',
  success: 'bg-success-soft text-success',
  neutral: 'bg-neutral-soft text-fg',
  hero: 'bg-surface-hero text-accent-on-dark',
} as const;

const SIZES = { sm: 'size-8 text-caption', md: 'size-10 text-label', lg: 'size-14 text-h3' } as const;

export interface AvatarProps {
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  initials?: string;
  icon?: IconConcept;
}

/** Círculo con iniciales o icono (movimientos, cuenta, estados vacíos). Siempre decorativo. */
export function Avatar({ tone = 'brand', size = 'md', initials: text, icon }: AvatarProps) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-pill font-medium ${TONES[tone]} ${SIZES[size]}`}>
      {icon ? <Icon name={icon} size={size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm'} /> : text}
    </span>
  );
}

/** Iniciales de las dos primeras palabras de un nombre, en mayúsculas. */
export function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('es-MX')).join('');
}
```

- [ ] **Step 5:** `npx vitest run components/ui/icons.test.tsx && npm run lint && npm run typecheck` → PASS.
- [ ] **Step 6: Commit** — `feat(web): add Icon, IconButton and Avatar` with `Task: redesign#3.1`, `Refs: DSG-15, DSG-17`.

## Task 3.2: Restyle the web kit

**Files:**
- Modify: `web/components/ui/{field,Button,AmountField,OtpField,AccountCard,MovementRow,InlineAlert,EmptyState,Skeleton,Receipt,DailyLimitMeter,Wordmark}.tsx`
- Test: `web/components/ui/data.test.tsx`, `feedback.test.tsx`, `fields.test.tsx`, `Button.test.tsx`, `Wordmark.test.tsx` (only expectations whose markup changes)

**Interfaces (additive props only):**
- `Button`: `icon?: IconConcept` (leading). Height 48.
- `AmountField`: `variant?: 'default' | 'hero'`.
- `AccountCard`: `onSelect?: () => void` (makes name+balance a toggle button with `aria-pressed`).
- `EmptyState`: `icon?: IconConcept`.
- `Wordmark`: `tone?: 'default' | 'inverse'`.
- `MovementRow`: same props; new anatomy.

- [ ] **Step 1: Write/adjust failing tests**

In `data.test.tsx` → `describe('MovementRow')`, replace the expectations of the existing full-row test with:
```tsx
    expect(row).toHaveTextContent('Ref. 1234');
    expect(row).toHaveTextContent('13 oct 2026, 10:42'); // completo para lectores de pantalla
    expect(row).toHaveTextContent('Saldo $26,500.00');
```
and add:
```tsx
  it('WEB-29 muestra un avatar con el icono del tipo de movimiento', () => {
    const { container } = renderRow({ movement: movement() });
    expect(container.querySelector('li span[aria-hidden="true"] svg')).not.toBeNull();
  });
```
In `data.test.tsx` add an AccountCard selection test:
```tsx
  it('WEB-28 la tarjeta seleccionable anuncia su estado', async () => {
    const onSelect = vi.fn();
    render(<AccountCard account={PRINCIPAL} selected onSelect={onSelect} />);
    const toggle = screen.getByRole('button', { name: /Principal/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggle);
    expect(onSelect).toHaveBeenCalledOnce();
  });
```
In `feedback.test.tsx` add:
```tsx
  it('DSG-15 la alerta de error lleva el icono de error, decorativo', () => {
    const { container } = render(<InlineAlert tone="danger">No tienes saldo suficiente.</InlineAlert>);
    expect(container.querySelector('[role="alert"] svg')).toHaveAttribute('aria-hidden', 'true');
  });
```
In `Wordmark.test.tsx` add:
```tsx
  it('DSG-13 la variante inversa usa el texto sobre superficie invertida', () => {
    const { container } = render(<Wordmark tone="inverse" />);
    expect(container.querySelectorAll('.text-fg-on-inverse')).toHaveLength(2);
  });
```
(Use the imports each file already has; add `vi`, `userEvent` where missing.)

- [ ] **Step 2:** `npx vitest run components/ui` → FAIL on the new/changed expectations.

- [ ] **Step 3: Implement the restyle**

`field.tsx` — `CONTROL_CLASSES`:
```ts
export const CONTROL_CLASSES =
  'min-h-13 w-full rounded-md border border-border-input bg-surface px-4 text-body text-fg ' +
  'aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-fg-muted';
```
(`FieldFrame` unchanged.)

`Button.tsx` — in `BASE` change `min-h-11` → `min-h-12`; add `icon?: IconConcept` to `ButtonProps` and render `{icon ? <Icon name={icon} /> : null}` before `children` in the non-loading branch (and inside the invisible span in the loading branch so width is kept).

`AmountField.tsx` — add `variant?: 'default' | 'hero'` to the props type and destructure it; for `hero` render:
```tsx
      <div className="flex items-baseline justify-center gap-1 border-b-2 border-border-input py-4 focus-within:border-action">
        <span aria-hidden="true" className="text-display text-fg-muted">$</span>
        <input autoComplete="off" {...props} type="text" inputMode="decimal" id={ids.id}
          aria-invalid={ids.invalid || undefined} aria-describedby={ids.describedBy}
          className={`w-full min-w-0 bg-transparent text-center text-display text-fg tabular-nums outline-none ${className}`.trim()} />
      </div>
```
inside the same `FieldFrame`; `default` keeps today's markup.

`OtpField.tsx` — no change beyond `CONTROL_CLASSES`.

`AccountCard.tsx` — article classes become `grid gap-2 rounded-md bg-surface p-5 shadow-card ${selected ? 'ring-2 ring-action' : ''}`; balance `text-h2 text-fg tabular-nums`; when `onSelect` is passed, wrap the `h3` and balance in
```tsx
<button type="button" aria-pressed={selected} onClick={onSelect} className="grid gap-2 rounded-sm text-left">…</button>
```
keeping the CLABE toggle outside that button (no nested interactive elements).

`MovementRow.tsx`:
```tsx
import { formatMXN, type Movement } from '@devchrisvaz/wallet-contract';
import { movementIcon } from '@devchrisvaz/wallet-design-tokens';
import { MONEY_CLASSES, MOVEMENT_TYPE } from '@/lib/conventions';
import { formatDateTime, formatTime } from '@/lib/format';
import { signedAmount } from '@/lib/money';
import { Avatar } from './Avatar';

/**
 * Fila del historial (WEB-14, WEB-29): avatar por tipo, tipo, contraparte y concepto, hora y
 * referencia, monto con signo y saldo. La fecha completa queda para lectores de pantalla: la lista
 * la agrupa visualmente por día.
 */
export function MovementRow({ movement }: { movement: Movement }) {
  const { direction, label } = MOVEMENT_TYPE[movement.type];
  const detail = [movement.counterparty?.name, movement.concept].filter(Boolean).join(' · ');
  const dateTime = formatDateTime(movement.occurredAt);
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar tone={direction === 'in' ? 'success' : 'neutral'} icon={movementIcon[movement.type]} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="truncate text-label text-fg">{label}</p>
        <p className="truncate text-caption text-fg-secondary">{detail}</p>
        <p className="text-caption text-fg-muted">
          <time dateTime={movement.occurredAt}>
            <span className="sr-only">{dateTime.slice(0, dateTime.lastIndexOf(',') + 2)}</span>
            {formatTime(movement.occurredAt)}
          </time>
          {' · '}Ref. {movement.reference}
        </p>
      </div>
      <div className="grid shrink-0 justify-items-end gap-0.5 text-right">
        <p className={`text-label whitespace-nowrap tabular-nums ${MONEY_CLASSES[direction]}`}>
          {signedAmount(direction, movement.amount)}
        </p>
        <p className="text-caption text-fg-muted tabular-nums">Saldo {formatMXN(movement.balanceAfter)}</p>
      </div>
    </li>
  );
}
```

`InlineAlert.tsx` — root classes `flex gap-3 rounded-md p-4 text-body-sm ${TONE_CLASSES[tone]}`; first child `<Icon name={toneIcon[tone]} />` (import `toneIcon`), then `<div className="grid gap-1">{title}{children}</div>`.

`EmptyState.tsx` — add `icon?: IconConcept`; root `grid justify-items-center gap-3 rounded-lg bg-surface px-6 py-10 text-center shadow-card`; before the title `{icon ? <Avatar size="lg" icon={icon} /> : null}`.

`Skeleton.tsx` — `bg-surface-subtle` → `bg-border` (visible on the canvas, same as mobile `border.default`); `card` variant `h-36 w-full rounded-md` unchanged.

`Receipt.tsx` — section classes `grid gap-4 rounded-lg bg-surface p-6 shadow-card`; above the title row add `<Avatar size="lg" tone={transfer.status === 'COMPLETED' ? 'success' : 'neutral'} icon={transfer.status === 'COMPLETED' ? 'success' : 'info'} />`; amount `text-display-xl` → keep `text-display` (receipts stay smaller than the hero).

`DailyLimitMeter.tsx` — wrap with a header row: `<div className="flex items-baseline justify-between gap-4"><p className="text-label text-fg">Límite diario</p><p className="text-caption text-fg-muted tabular-nums">{formatMXN(dailyLimit.limit)}</p></div>` above the meter; keep the "Te quedan $X hoy" sentence and every `aria-*` attribute.

`Wordmark.tsx`:
```tsx
export interface WordmarkProps {
  variant?: 'full' | 'compact';
  /** `inverse` sobre superficies oscuras (navegación lateral, pantallas de marca). */
  tone?: 'default' | 'inverse';
  className?: string;
}

export function Wordmark({ variant = 'full', tone = 'default', className = '' }: WordmarkProps) {
  const size = variant === 'compact' ? 'text-h3' : 'text-h2';
  const inverse = tone === 'inverse';
  return (
    <span className={`${size} font-semibold ${className}`.trim()}>
      <span className={inverse ? 'text-fg-on-inverse' : 'text-fg'}>Treo</span>
      <span className={inverse ? 'text-fg-on-inverse' : 'text-action'}>Wallet</span>
    </span>
  );
}
```

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → PASS (all existing web tests included).
- [ ] **Step 5: Commit** — `feat(web): restyle the kit with the elevated visual language` with `Task: redesign#3.2`, `Refs: DSG-13, DSG-17`.

## Task 3.3: Web navigation — `TabBar`, `SideNav`, `TopBar`, `AppHeader`

**Files:**
- Create: `web/components/ui/{TabBar,SideNav,TopBar,AppHeader}.tsx`
- Test: `web/components/ui/navigation.test.tsx`

**Interfaces:**
- Consumes: `Icon`, `Avatar`, `initials` (3.1); `BottomSheet` (3.5 — implement 3.5 first if executing strictly in order, or stub-import and finish after 3.5); `navDestinations`, `NavDestination` (2.3); `Button` with `icon` (3.2); `Wordmark tone` (3.2).
- Produces: `interface NavItem { key: NavDestination; href: string }`; `TabBar({ items, current, position?: 'fixed'|'static', className? })`; `SideNav({ items, current, user: { name: string; email: string }, onLogout?: () => void, className? })`; `TopBar({ title, action?: ReactNode, className? })`; `AppHeader({ user, title?: string, onLogout?: () => void, className? })`.

> Execute Task 3.5 before this task (AppHeader opens a `BottomSheet`).

- [ ] **Step 1: Write the failing test** — `web/components/ui/navigation.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';
import { SideNav } from './SideNav';
import { TabBar, type NavItem } from './TabBar';

const WEB_ITEMS: NavItem[] = [
  { key: 'home', href: '/' },
  { key: 'movements', href: '/movements' },
  { key: 'transfer', href: '/transfers/new' },
  { key: 'beneficiaries', href: '/beneficiaries' },
];
const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };

describe('TabBar', () => {
  it('WEB-27 muestra las cuatro pestañas y marca la actual', () => {
    render(<TabBar items={WEB_ITEMS} current="movements" position="static" />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    expect(within(nav).getByRole('link', { name: 'Movimientos' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });
});

describe('SideNav', () => {
  it('WEB-26 marca el destino actual y cierra sesión', async () => {
    const onLogout = vi.fn();
    render(<SideNav items={WEB_ITEMS} current="beneficiaries" user={USER} onLogout={onLogout} />);
    expect(screen.getByRole('link', { name: 'Beneficiarios' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});

describe('AppHeader', () => {
  it('WEB-27 saluda con el nombre y el avatar abre el menú de la cuenta', async () => {
    const onLogout = vi.fn();
    render(<AppHeader user={USER} onLogout={onLogout} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByRole('dialog', { name: 'Tu cuenta' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('WEB-27 en otras pestañas muestra el título de la página', () => {
    render(<AppHeader user={USER} title="Movimientos" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Movimientos' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2:** `npx vitest run components/ui/navigation.test.tsx` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`TabBar.tsx`:
```tsx
import { navDestinations, type NavDestination } from '@devchrisvaz/wallet-design-tokens';
import { Icon } from './Icon';

export interface NavItem {
  key: NavDestination;
  href: string;
}

export interface TabBarProps {
  items: readonly NavItem[];
  current: NavDestination | null;
  /** `static` para mostrarla dentro de una tarjeta (previews); en la app va fija abajo. */
  position?: 'fixed' | 'static';
  className?: string;
}

/**
 * Barra de pestañas de la forma de app (WEB-27). La pestaña actual lleva el icono en lima dentro de
 * una píldora verde profundo (lima solo sobre oscuro, DSG-14).
 */
export function TabBar({ items, current, position = 'fixed', className = '' }: TabBarProps) {
  return (
    <nav
      aria-label="Principal"
      className={`${position === 'fixed' ? 'fixed inset-x-0 bottom-0 z-20' : ''} border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] ${className}`.trim()}
    >
      <ul className="mx-auto flex h-(--dt-layout-tab-bar-height) max-w-app">
        {items.map(({ key, href }) => {
          const { label, icon } = navDestinations[key];
          const active = key === current;
          return (
            <li key={key} className="flex-1">
              <a href={href} aria-current={active ? 'page' : undefined} className="flex h-full flex-col items-center justify-center gap-1 text-caption">
                <span className={`flex h-8 w-16 items-center justify-center rounded-pill ${active ? 'bg-surface-hero text-accent-on-dark' : 'text-fg-muted'}`}>
                  <Icon name={icon} size="lg" />
                </span>
                <span className={active ? 'font-medium text-action' : 'text-fg-muted'}>{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

`SideNav.tsx`:
```tsx
import { navDestinations, type NavDestination } from '@devchrisvaz/wallet-design-tokens';
import { Avatar, initials } from './Avatar';
import { Icon } from './Icon';
import type { NavItem } from './TabBar';
import { Wordmark } from './Wordmark';

export interface SideNavProps {
  items: readonly NavItem[];
  current: NavDestination | null;
  user: { name: string; email: string };
  onLogout?: () => void;
  className?: string;
}

const ITEM = 'flex min-h-11 items-center gap-3 rounded-md px-3 text-label';

/** Navegación lateral del dashboard (WEB-26): verde profundo, destino actual en lima. */
export function SideNav({ items, current, user, onLogout, className = '' }: SideNavProps) {
  return (
    <aside className={`sticky top-0 h-dvh w-sidebar shrink-0 flex-col gap-8 bg-surface-hero px-4 py-6 text-fg-on-inverse ${className}`.trim()}>
      <div className="px-3"><Wordmark variant="compact" tone="inverse" /></div>
      <nav aria-label="Principal" className="flex-1">
        <ul className="grid gap-1">
          {items.map(({ key, href }) => {
            const { label, icon } = navDestinations[key];
            const active = key === current;
            return (
              <li key={key}>
                <a href={href} aria-current={active ? 'page' : undefined}
                  className={`${ITEM} ${active ? 'bg-fg-on-inverse/10 text-accent-on-dark' : 'text-fg-on-hero-muted hover:bg-fg-on-inverse/10 hover:text-fg-on-inverse'}`}>
                  <Icon name={icon} />
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="grid gap-3 border-t border-fg-on-inverse/10 pt-4">
        <div className="flex items-center gap-3 px-3">
          <Avatar tone="brand" size="sm" initials={initials(user.name)} />
          <div className="min-w-0">
            <p className="truncate text-label">{user.name}</p>
            <p className="truncate text-caption text-fg-on-hero-muted">{user.email}</p>
          </div>
        </div>
        {onLogout ? (
          <button type="button" onClick={onLogout} className={`${ITEM} text-fg-on-hero-muted hover:bg-fg-on-inverse/10 hover:text-fg-on-inverse`}>
            <Icon name="logout" />
            Cerrar sesión
          </button>
        ) : null}
      </div>
    </aside>
  );
}
```

`TopBar.tsx`:
```tsx
import type { ReactNode } from 'react';

/** Barra superior del dashboard (WEB-26): título de la página y acción principal. */
export function TopBar({ title, action, className = '' }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <header className={`items-center justify-between gap-4 py-8 ${className}`.trim()}>
      <h1 className="text-h1 text-fg">{title}</h1>
      {action}
    </header>
  );
}
```

`AppHeader.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Avatar, initials } from './Avatar';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

export interface AppHeaderProps {
  user: { name: string; email: string };
  /** Título de la pestaña; sin él, saluda con el nombre (Inicio). */
  title?: string;
  onLogout?: () => void;
  className?: string;
}

/** Encabezado de la forma de app (WEB-27): saludo o título y el menú de la cuenta. */
export function AppHeader({ user, title, onLogout, className = '' }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;
  return (
    <header className={`flex items-center justify-between gap-4 px-5 pt-6 pb-4 ${className}`.trim()}>
      {title ? (
        <h1 className="text-h2 text-fg">{title}</h1>
      ) : (
        <div>
          <p className="text-body-sm text-fg-secondary">Hola,</p>
          <p className="text-h2 text-fg">{firstName}</p>
        </div>
      )}
      <button type="button" aria-label="Menú de la cuenta" aria-haspopup="dialog" onClick={() => setOpen(true)} className="rounded-pill">
        <Avatar tone="hero" initials={initials(user.name)} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Tu cuenta">
        <div className="grid gap-5">
          <div className="flex items-center gap-3">
            <Avatar tone="brand" initials={initials(user.name)} />
            <div className="min-w-0">
              <p className="truncate text-label text-fg">{user.name}</p>
              <p className="truncate text-caption text-fg-muted">{user.email}</p>
            </div>
          </div>
          {onLogout ? <Button variant="secondary" icon="logout" onClick={onLogout}>Cerrar sesión</Button> : null}
        </div>
      </BottomSheet>
    </header>
  );
}
```

- [ ] **Step 4:** `npx vitest run components/ui/navigation.test.tsx && npm run lint && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** — `feat(web): add the tab bar, side nav, top bar and app header` with `Task: redesign#3.3`, `Refs: WEB-26, WEB-27`.

## Task 3.4: Web `BalanceHero`, `QuickActions`, `ListSection`, `MovementList`

**Files:**
- Create: `web/components/ui/{BalanceHero,QuickActions,ListSection,MovementList}.tsx`
- Modify: `web/lib/money.ts` (`sumAmounts`); test `web/lib/money.test.ts`
- Test: `web/components/ui/home.test.tsx`

**Interfaces:**
- Produces: `sumAmounts(amounts: readonly string[]): string`; `BalanceHero({ total: string; available: string; actions?: ReactNode })`; `interface QuickAction { key: string; label: string; icon: IconConcept; href?: string; onClick?: () => void }`; `QuickActions({ actions: readonly QuickAction[] })`; `ListSection({ title?: string; action?: ReactNode; children: ReactNode; className? })`; `MovementList({ movements: readonly Movement[]; now?: Date })`.

- [ ] **Step 1: Write the failing tests**

Append to `web/lib/money.test.ts`:
```ts
describe('sumAmounts', () => {
  it('WEB-28 suma los saldos en centavos sin punto flotante', () => {
    expect(sumAmounts(['25000.00', '10000.00'])).toBe('35000.00');
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30');
    expect(sumAmounts([])).toBe('0.00');
  });
});
```
`web/components/ui/home.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { movement } from '@/test/fixtures';
import { BalanceHero } from './BalanceHero';
import { MovementList } from './MovementList';
import { QuickActions } from './QuickActions';

describe('BalanceHero', () => {
  it('WEB-28 muestra el total completo para lectores de pantalla y el disponible de hoy', () => {
    render(<BalanceHero total="35000.00" available="31500.00" />);
    const hero = screen.getByRole('region', { name: 'Saldo total' });
    expect(hero).toHaveTextContent('$35,000.00');
    expect(hero).toHaveTextContent('Disponible hoy $31,500.00');
  });

  it('DSG-13 un saldo muy grande baja de tamaño para caber en una línea', () => {
    render(<BalanceHero total="1234567890.00" available="0.00" />);
    const amount = screen.getByTestId('hero-amount');
    expect(amount).toHaveClass('text-h1');
    expect(amount).not.toHaveClass('text-display-xl');
  });
});

describe('QuickActions', () => {
  it('WEB-28 cada acción tiene texto visible', () => {
    render(<QuickActions actions={[{ key: 't', label: 'Transferir', icon: 'transfer', href: '/transfers/new' }]} />);
    expect(screen.getByRole('link', { name: 'Transferir' })).toHaveAttribute('href', '/transfers/new');
  });
});

describe('MovementList', () => {
  it('WEB-29 agrupa por día de Ciudad de México', () => {
    const now = new Date('2026-10-13T18:00:00Z');
    render(
      <MovementList
        now={now}
        movements={[
          movement({ id: 'a', occurredAt: '2026-10-13T16:42:00Z' }),
          movement({ id: 'b', occurredAt: '2026-10-13T05:30:00Z' }),
          movement({ id: 'c', occurredAt: '2026-10-09T18:20:00Z' }),
        ]}
      />,
    );
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Hoy', 'Ayer', '9 oct']);
    expect(within(screen.getByRole('region', { name: 'Ayer' })).getAllByRole('listitem')).toHaveLength(1);
  });
});
```

- [ ] **Step 2:** `npx vitest run lib/money.test.ts components/ui/home.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`web/lib/money.ts` — add `centsToDecimalString` to the contract import and:
```ts
/** Suma de montos en centavos con BigInt (WEB-28, WEB-21). */
export function sumAmounts(amounts: readonly string[]): string {
  return centsToDecimalString(amounts.reduce((total, amount) => total + toCents(amount), 0n));
}
```

`BalanceHero.tsx`:
```tsx
import { formatMXN } from '@devchrisvaz/wallet-contract';
import { heroAmountSize, splitCents } from '@devchrisvaz/wallet-design-tokens';
import { useId, type ReactNode } from 'react';

const AMOUNT_SIZE = { displayXl: 'text-display-xl', display: 'text-display', h1: 'text-h1' } as const;

export interface BalanceHeroProps {
  /** Saldo total en pesos como string decimal (`sumAmounts`). */
  total: string;
  /** Lo que queda del límite diario. */
  available: string;
  actions?: ReactNode;
}

/** Hero del saldo (WEB-28, DSG-13): verde profundo, resplandor lima y centavos más chicos. */
export function BalanceHero({ total, available, actions }: BalanceHeroProps) {
  const titleId = useId();
  const formatted = formatMXN(total);
  const [whole, cents] = splitCents(formatted);
  return (
    <section aria-labelledby={titleId} className="relative overflow-hidden rounded-lg bg-surface-hero p-6 text-fg-on-inverse">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-pill"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--dt-accent-on-dark) 35%, transparent), transparent 70%)' }}
      />
      <h2 id={titleId} className="relative text-label text-fg-on-hero-muted">Saldo total</h2>
      <p data-testid="hero-amount" className={`relative mt-1 whitespace-nowrap tabular-nums ${AMOUNT_SIZE[heroAmountSize(formatted)]}`}>
        <span className="sr-only">{formatted}</span>
        <span aria-hidden="true">{whole}<span className="text-h3">{cents}</span></span>
      </p>
      <p className="relative mt-3 inline-flex min-h-7 items-center rounded-pill bg-accent-on-dark px-3 text-caption font-medium text-fg tabular-nums">
        Disponible hoy {formatMXN(available)}
      </p>
      {actions ? <div className="relative mt-6">{actions}</div> : null}
    </section>
  );
}
```

`QuickActions.tsx`:
```tsx
import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { Icon } from './Icon';

export interface QuickAction {
  key: string;
  label: string;
  icon: IconConcept;
  href?: string;
  onClick?: () => void;
}

/** Acciones rápidas sobre el hero: círculo con icono lima y texto visible (WEB-28). */
export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
  return (
    <ul className="flex gap-6">
      {actions.map(({ key, label, icon, href, onClick }) => {
        const content = (
          <>
            <span className="flex size-12 items-center justify-center rounded-pill bg-fg-on-inverse/10 text-accent-on-dark">
              <Icon name={icon} size="lg" />
            </span>
            <span className="text-caption font-medium text-fg-on-inverse">{label}</span>
          </>
        );
        const classes = 'flex flex-col items-center gap-2 rounded-md';
        return (
          <li key={key}>
            {href ? <a href={href} className={classes}>{content}</a> : <button type="button" onClick={onClick} className={classes}>{content}</button>}
          </li>
        );
      })}
    </ul>
  );
}
```

`ListSection.tsx`:
```tsx
import { useId, type ReactNode } from 'react';

export interface ListSectionProps {
  title?: string;
  /** Por ejemplo, "Ver todos". */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Tarjeta de lista con encabezado opcional (DSG-17). */
export function ListSection({ title, action, children, className = '' }: ListSectionProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={title ? titleId : undefined} className={`rounded-lg bg-surface px-5 py-4 shadow-card ${className}`.trim()}>
      {title || action ? (
        <div className="flex items-center justify-between gap-4 pb-2">
          {title ? <h2 id={titleId} className="text-h3 text-fg">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
```

`MovementList.tsx`:
```tsx
import type { Movement } from '@devchrisvaz/wallet-contract';
import { groupByDay } from '@devchrisvaz/wallet-design-tokens';
import { MovementRow } from './MovementRow';

/** Movimientos agrupados por día de Ciudad de México (WEB-29). */
export function MovementList({ movements, now }: { movements: readonly Movement[]; now?: Date }) {
  return (
    <div className="grid gap-2">
      {groupByDay(movements, (item) => item.occurredAt, now).map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h3 className="pt-2 pb-1 text-caption font-medium text-fg-muted">{group.label}</h3>
          <ul className="divide-y divide-border">
            {group.items.map((item) => <MovementRow key={item.id} movement={item} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(web): add the balance hero, quick actions and grouped movement list` with `Task: redesign#3.4`, `Refs: WEB-28, WEB-29`.

## Task 3.5: Web `BottomSheet`, `Stepper` and `FlowHeader`

**Files:**
- Create: `web/components/ui/{BottomSheet,Stepper,FlowHeader}.tsx`
- Test: `web/components/ui/overlays.test.tsx`

**Interfaces:**
- Produces: `BottomSheet({ open: boolean; onClose: () => void; title: string; children: ReactNode })`; `Stepper({ current: number; total: number; label: string })`; `FlowHeader({ title: string; step: number; total: number; stepLabel: string; closeHref: string })`.

- [ ] **Step 1: Write the failing test** — `web/components/ui/overlays.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BottomSheet } from './BottomSheet';
import { Stepper } from './Stepper';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Filtros</button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Filtrar movimientos">
        <button type="button">Aplicar</button>
        <button type="button">Limpiar</button>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet', () => {
  it('DSG-17 mueve el foco adentro y no deja que Tab salga', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtrar movimientos' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 5; i += 1) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('DSG-17 Escape cierra y regresa el foco al control que la abrió', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Filtros' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe('Stepper', () => {
  it('WEB-30 anuncia el paso actual', () => {
    render(<Stepper current={3} total={5} label="Revisión" />);
    expect(screen.getByText('Paso 3 de 5 · Revisión')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('group', { name: 'Paso 3 de 5: Revisión' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2:** `npx vitest run components/ui/overlays.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`BottomSheet.tsx`:
```tsx
'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Icon';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Hoja inferior modal (DSG-17): en teléfono sube desde abajo; en el dashboard es un panel centrado.
 * Atrapa el foco, Escape la cierra y el foco vuelve al control que la abrió.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => (opener.current as HTMLElement | null)?.focus?.();
  }, [open]);

  if (!open) return null;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center dashboard:items-center" onKeyDown={onKeyDown}>
      <div aria-hidden="true" className="absolute inset-0 bg-surface-hero/60" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative grid w-full max-w-app gap-4 rounded-t-lg bg-surface px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-sheet dashboard:max-w-md dashboard:rounded-lg dashboard:pb-6"
      >
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-pill bg-border dashboard:hidden" />
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-h3 text-fg">{title}</h2>
          <IconButton icon="close" label="Cerrar" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
```

`Stepper.tsx`:
```tsx
/** Indicador de pasos del flujo de transferencia (WEB-30): barras y "Paso n de m · Etiqueta". */
export function Stepper({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div role="group" aria-label={`Paso ${current} de ${total}: ${label}`} className="grid gap-2">
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={`h-1 flex-1 rounded-pill ${index < current ? 'bg-action' : 'bg-border'}`} />
        ))}
      </div>
      <p aria-live="polite" className="text-caption text-fg-muted">Paso {current} de {total} · {label}</p>
    </div>
  );
}
```

`FlowHeader.tsx`:
```tsx
import { IconButton } from './Icon';
import { Stepper } from './Stepper';

export interface FlowHeaderProps {
  title: string;
  step: number;
  total: number;
  stepLabel: string;
  closeHref: string;
}

/** Encabezado del flujo de transferencia: cerrar, título y pasos (WEB-30). */
export function FlowHeader({ title, step, total, stepLabel, closeHref }: FlowHeaderProps) {
  return (
    <header className="grid gap-4 px-5 pt-4 pb-2 dashboard:px-0">
      <div className="flex items-center gap-2">
        <IconButton icon="close" label="Salir de la transferencia" href={closeHref} className="-ml-3" />
        <h1 className="text-h3 text-fg">{title}</h1>
      </div>
      <Stepper current={step} total={total} label={stepLabel} />
    </header>
  );
}
```

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(web): add the bottom sheet, stepper and flow header` with `Task: redesign#3.5`, `Refs: DSG-17, WEB-30`.

## Task 3.6: Web `AppShell` and `BrandShell`

**Files:**
- Create: `web/components/layout/AppShell.tsx`, `web/components/layout/BrandShell.tsx`
- Test: `web/components/layout/shells.test.tsx`

**Interfaces:**
- Consumes: `TabBar`, `SideNav`, `TopBar`, `AppHeader`, `NavItem` (3.3); `SkipLink`, `MAIN_CONTENT_ID` from `PageShell.tsx` (existing).
- Produces: `AppShell({ current: NavDestination | null; title: string; primaryAction?: ReactNode; user; onLogout?; mode?: 'tabs' | 'flow'; items?: readonly NavItem[]; children })`; `BrandShell({ title: string; children })`; `DEFAULT_NAV_ITEMS: NavItem[]`.

- [ ] **Step 1: Write the failing test** — `web/components/layout/shells.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';
import { BrandShell } from './BrandShell';

const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };

describe('AppShell', () => {
  it('WEB-24 tiene navegación lateral (dashboard) y pestañas (app)', () => {
    render(<AppShell current="home" title="Inicio" user={USER}><p>Contenido</p></AppShell>);
    const navs = screen.getAllByRole('navigation', { name: 'Principal' });
    expect(navs).toHaveLength(2);
    expect(navs[0]?.closest('aside')).toHaveClass('hidden', 'dashboard:flex');
    expect(navs[1]).toHaveClass('dashboard:hidden');
  });

  it('WEB-27 el contenido reserva el alto de la barra de pestañas', () => {
    render(<AppShell current="home" title="Inicio" user={USER}><p>Contenido</p></AppShell>);
    expect(screen.getByRole('main')).toHaveClass('pb-[calc(var(--dt-layout-tab-bar-height)+env(safe-area-inset-bottom)+1.5rem)]');
  });

  it('WEB-27 en el flujo de transferencia no hay barra de pestañas', () => {
    render(<AppShell current="transfer" title="Transferir" user={USER} mode="flow"><p>Paso</p></AppShell>);
    expect(screen.getAllByRole('navigation', { name: 'Principal' })).toHaveLength(1);
  });
});

describe('BrandShell', () => {
  it('WEB-31 muestra el Wordmark sobre la superficie de marca y el contenido en una hoja', () => {
    render(<BrandShell title="Inicia sesión"><form aria-label="Inicio de sesión" /></BrandShell>);
    expect(screen.getByRole('heading', { level: 1, name: 'Inicia sesión' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Inicio de sesión' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2:** `npx vitest run components/layout/shells.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`AppShell.tsx`:
```tsx
import type { NavDestination } from '@devchrisvaz/wallet-design-tokens';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/ui/AppHeader';
import { SideNav } from '@/components/ui/SideNav';
import { TabBar, type NavItem } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { MAIN_CONTENT_ID, SkipLink } from './PageShell';

export const DEFAULT_NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', href: '/' },
  { key: 'movements', href: '/movements' },
  { key: 'transfer', href: '/transfers/new' },
  { key: 'beneficiaries', href: '/beneficiaries' },
];

export interface AppShellProps {
  current: NavDestination | null;
  title: string;
  primaryAction?: ReactNode;
  user: { name: string; email: string };
  onLogout?: () => void;
  /** `flow`: el flujo de transferencia, sin barra de pestañas ni encabezado de la app en teléfono. */
  mode?: 'tabs' | 'flow';
  items?: readonly NavItem[];
  children: ReactNode;
}

/**
 * Estructura con sesión (WEB-24): forma de app bajo 1024 px (columna de 480 px, encabezado y
 * pestañas) y forma de dashboard desde 1024 px (navegación lateral, barra superior y contenido de
 * hasta 1200 px).
 */
export function AppShell({ current, title, primaryAction, user, onLogout, mode = 'tabs', items = DEFAULT_NAV_ITEMS, children }: AppShellProps) {
  const tabs = mode === 'tabs';
  return (
    <div className="min-h-dvh bg-surface-canvas dashboard:flex">
      <SkipLink />
      <SideNav items={items} current={current} user={user} onLogout={onLogout} className="hidden dashboard:flex" />
      <div className="mx-auto w-full max-w-app dashboard:max-w-content dashboard:px-10">
        {tabs ? <AppHeader user={user} title={current === 'home' ? undefined : title} onLogout={onLogout} className="dashboard:hidden" /> : null}
        <TopBar title={title} action={primaryAction} className="hidden dashboard:flex" />
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className={`grid gap-5 px-5 focus-visible:outline-none dashboard:px-0 dashboard:pb-10 ${
            tabs ? 'pb-[calc(var(--dt-layout-tab-bar-height)+env(safe-area-inset-bottom)+1.5rem)]' : 'pb-6'
          }`}
        >
          {children}
        </main>
      </div>
      {tabs ? <TabBar items={items} current={current} className="dashboard:hidden" /> : null}
    </div>
  );
}
```

`BrandShell.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/ui/Wordmark';
import { MAIN_CONTENT_ID, SkipLink } from './PageShell';

/**
 * Pantallas públicas sobre la superficie de marca (WEB-31): a pantalla completa en la forma de app
 * (verde arriba, hoja blanca abajo) y en panel dividido en el dashboard.
 */
export function BrandShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-hero dashboard:flex-row">
      <SkipLink />
      <div className="mx-auto flex w-full max-w-app items-end px-5 pt-16 pb-8 dashboard:max-w-none dashboard:flex-1 dashboard:items-center dashboard:justify-center dashboard:p-16">
        <div className="grid gap-3">
          <Wordmark tone="inverse" />
          <p className="text-body text-fg-on-hero-muted">Tu billetera digital en pesos mexicanos.</p>
        </div>
      </div>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto grid w-full max-w-app flex-1 content-start gap-6 rounded-t-lg bg-surface px-5 pt-8 pb-10 focus-visible:outline-none dashboard:max-w-none dashboard:flex-1 dashboard:content-center dashboard:rounded-none dashboard:px-16"
      >
        <div className="mx-auto grid w-full max-w-md gap-6">
          <h1 className="text-h1 text-fg">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(web): add the responsive app shell and brand shell` with `Task: redesign#3.6`, `Refs: WEB-24, WEB-26, WEB-27, WEB-31`.

## Task 4.1: Mobile `Icon`, `IconButton` and `Avatar`

**Files:**
- Modify: `mobile/package.json` (+ lock), `mobile/jest.config.js`
- Create: `mobile/src/components/ui/icon.tsx`, `mobile/src/components/ui/avatar.tsx`; export both from `src/components/ui/index.ts`
- Test: `mobile/src/components/ui/__tests__/icons.test.tsx`

**Interfaces:**
- Produces: `ICONS: Record<IconConcept, LucideIcon>`; `Icon({ name: IconConcept; size?: 'sm'|'md'|'lg'; color: string; label?: string })`; `IconButton({ icon: IconConcept; label: string; onPress: () => void; tone?: 'default'|'onDark' })`; `Avatar({ tone?: 'brand'|'success'|'neutral'|'hero'; size?: 'sm'|'md'|'lg'; initials?: string; icon?: IconConcept })`; `initials(name: string): string` — same rules as web.

- [ ] **Step 1: Install**

```bash
npx expo install react-native-svg            # → 15.15.4
npm install lucide-react-native@1.48.0 --save-exact
```
In `jest.config.js` change the replacement to also transform Lucide and SVG:
```js
    nodeModules.replace(/\)\)$/, '|@devchrisvaz|lucide-react-native|react-native-svg))'),
```
Mobile design-sync (`.design-sync/build-ui.mjs`) needs nothing: `react-native-svg` ships web files picked by the existing `.web.*` resolution.

If rendering any Lucide icon in Jest fails with a `requireNativeComponent`/`RNSVG…` error, add this to `jest.setup.ts` (renders SVG primitives as plain `View`s; module identity, which the `ICONS` test compares, is unaffected):
```ts
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Primitive = ({ children, ...props }: { children?: React.ReactNode }) => React.createElement(View, props, children);
  return new Proxy({ __esModule: true, default: Primitive }, { get: (target, key) => (key in target ? target[key as keyof typeof target] : Primitive) });
});
```

- [ ] **Step 2: Write the failing test** — `src/components/ui/__tests__/icons.test.tsx`:
```tsx
import { iconConcepts, iconNames } from '@devchrisvaz/wallet-design-tokens';
import { render, screen } from '@testing-library/react-native';
import * as Lucide from 'lucide-react-native';

import { theme } from '@/theme';

import { Avatar, ICONS, Icon, IconButton, initials } from '..';

describe('Icon', () => {
  test.each(iconConcepts)('DSG-15 %s usa el icono del mapa compartido', (concept) => {
    expect(ICONS[concept]).toBe((Lucide as unknown as Record<string, unknown>)[iconNames[concept]]);
  });

  test('DSG-15 un icono con etiqueta se anuncia como imagen', async () => {
    await render(<Icon name="error" label="Error" color={theme.colors.status.danger.fg} />);
    expect(screen.getByLabelText('Error')).toBeOnTheScreen();
  });

  test('DSG-15 un botón solo con icono tiene nombre accesible', async () => {
    await render(<IconButton icon="close" label="Cerrar" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeOnTheScreen();
  });
});

describe('Avatar', () => {
  test.each([
    ['Ana Gómez Castillo', 'AG'],
    ['Ángel', 'Á'],
    ['  luis   pérez ', 'LP'],
  ])('DSG-17 las iniciales de "%s" son %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  test('DSG-17 el avatar es decorativo', async () => {
    await render(<Avatar initials="AG" />);
    expect(screen.queryByText('AG')).toBeNull(); // oculto a la accesibilidad por defecto
    expect(screen.getByText('AG', { includeHiddenElements: true })).toBeTruthy();
  });
});
```

- [ ] **Step 3:** `npx jest src/components/ui/__tests__/icons.test.tsx` → FAIL.

- [ ] **Step 4: Implement**

`icon.tsx`:
```tsx
import { iconSize, type IconConcept } from '@devchrisvaz/wallet-design-tokens';
import {
  ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck,
  House, Info, Landmark, LogOut, ReceiptText, Repeat2, Send, SlidersHorizontal, TriangleAlert,
  UserRound, Users, X, type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { theme } from '@/theme';

/** Componente de Lucide de cada concepto; una prueba lo compara con `iconNames` (DSG-15). */
export const ICONS = {
  home: House, movements: ReceiptText, transfer: Send, beneficiaries: Users, logout: LogOut,
  moneyIn: ArrowDownLeft, moneyOut: ArrowUpRight, deposit: Landmark, ownTransfer: Repeat2,
  success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info,
  close: X, back: ChevronLeft, forward: ChevronRight, expand: ChevronDown,
  filter: SlidersHorizontal, account: UserRound,
} as const satisfies Record<IconConcept, LucideIcon>;

interface IconProps {
  name: IconConcept;
  size?: keyof typeof iconSize;
  color: string;
  /** Solo cuando el icono comunica algo sin texto al lado; si no, es decorativo. */
  label?: string;
}

/** Icono de línea del sistema (DSG-15): decorativo salvo que tenga etiqueta. */
export function Icon({ name, size = 'md', color, label }: IconProps) {
  const Glyph = ICONS[name];
  return label ? (
    <Glyph size={iconSize[size]} color={color} strokeWidth={2} accessible accessibilityRole="image" accessibilityLabel={label} />
  ) : (
    <Glyph size={iconSize[size]} color={color} strokeWidth={2} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
  );
}

interface IconButtonProps {
  icon: IconConcept;
  /** Obligatoria: es el único nombre accesible del botón. */
  label: string;
  onPress: () => void;
  tone?: 'default' | 'onDark';
}

/** Botón solo con icono, de 44 px y con nombre accesible (DSG-15). */
export function IconButton({ icon, label, onPress, tone = 'default' }: IconButtonProps) {
  const color = tone === 'onDark' ? theme.colors.text.onInverse : theme.colors.text.primary;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={styles.button}>
      <Icon name={icon} size="lg" color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: theme.touchTarget, height: theme.touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
});
```

`avatar.tsx`:
```tsx
import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Icon } from './icon';

const { colors } = theme;

const TONES = {
  brand: { bg: colors.surface.brand, fg: colors.action.primary },
  success: { bg: colors.status.success.bg, fg: colors.status.success.fg },
  neutral: { bg: colors.status.neutral.bg, fg: colors.text.primary },
  hero: { bg: colors.surface.hero, fg: colors.accent.onDark },
} as const;

// Mismo peso que la web (`font-medium`): el texto chico usa la familia de 500.
const TEXT = {
  sm: { ...theme.typography.caption, fontFamily: theme.typography.label.fontFamily },
  md: theme.typography.label,
  lg: theme.typography.h3,
} as const;
const ICON_SIZE = { sm: 'sm', md: 'md', lg: 'lg' } as const;

interface AvatarProps {
  tone?: keyof typeof TONES;
  size?: 'sm' | 'md' | 'lg';
  initials?: string;
  icon?: IconConcept;
}

/** Círculo con iniciales o icono (movimientos, cuenta, estados vacíos). Siempre decorativo. */
export function Avatar({ tone = 'brand', size = 'md', initials: text, icon }: AvatarProps) {
  const { bg, fg } = TONES[tone];
  const dimension = theme.avatarSize[size];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: dimension, height: dimension, backgroundColor: bg }]}
    >
      {icon ? <Icon name={icon} size={ICON_SIZE[size]} color={fg} /> : <Text style={[TEXT[size], { color: fg }]}>{text}</Text>}
    </View>
  );
}

/** Iniciales de las dos primeras palabras de un nombre, en mayúsculas (igual que la web). */
export function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('es-MX')).join('');
}

const styles = StyleSheet.create({
  circle: { borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
});
```

Export in `index.ts`: `export { Avatar, initials } from './avatar'; export { ICONS, Icon, IconButton } from './icon';`.

- [ ] **Step 5:** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 6: Commit** — `feat(mobile): add Icon, IconButton and Avatar with Lucide` with `Task: redesign#4.1`, `Refs: DSG-15, DSG-17`.

## Task 4.2: Restyle the mobile kit

**Files:**
- Modify: `mobile/src/components/ui/{button,text-field,amount-field,select,account-card,movement-row,inline-alert,empty-state,receipt,daily-limit-meter,privacy-overlay}.tsx`, `mobile/src/components/screen.tsx`
- Test: `mobile/src/components/ui/__tests__/{display,controls}.test.tsx` (only where markup changes)

**Interfaces (additive props only):** `Button.icon?: IconConcept`; `AmountField.variant?: 'default' | 'hero'`; `EmptyState.icon?: IconConcept`; `Screen.header?: ReactNode`, `Screen.tabBar?: boolean` (adds bottom padding of `layout.tabBarHeight` + inset). Same anatomy and values as Task 3.2.

- [ ] **Step 1: Write the failing tests** — in `display.test.tsx` (`MovementRow`):
```tsx
  test('MOB-20 muestra hora, referencia y saldo, con avatar por tipo', async () => {
    await render(<MovementRow movement={movement({})} />);
    expect(screen.getByText('19:05 · Ref. 1')).toBeOnTheScreen();
    expect(screen.getByText('Saldo $24,850.00')).toBeOnTheScreen();
    expect(screen.getByTestId('movement-avatar', { includeHiddenElements: true })).toBeTruthy();
  });
```
In `display.test.tsx` (`InlineAlert`):
```tsx
  test('DSG-15 la alerta de error lleva su icono, decorativo', async () => {
    await render(<InlineAlert tone="danger" message="No tienes saldo suficiente." />);
    expect(screen.getByTestId('inline-alert-icon', { includeHiddenElements: true })).toBeTruthy();
  });
```
Add a `Screen` test file case in `src/components/__tests__/screen.test.tsx` (create):
```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Screen } from '../screen';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

test('MOB-18 con barra de pestañas, el contenido reserva su alto para no quedar tapado', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Screen tabBar><Text>Último movimiento</Text></Screen>
    </SafeAreaProvider>,
  );
  expect(screen.getByTestId('screen-scroll')).toHaveProp(
    'contentContainerStyle',
    expect.arrayContaining([expect.objectContaining({ paddingBottom: theme.layout.tabBarHeight + theme.spacing[6] })]),
  );
});
```

- [ ] **Step 2:** `npx jest src/components` → FAIL on the new expectations.

- [ ] **Step 3: Implement** (values mirror Task 3.2 exactly):
- `button.tsx`: `base.minHeight: 48`; optional `icon` rendered with `<Icon name={icon} color={palette.text} />` before the label.
- `text-field.tsx`: `frame.minHeight: 52`, `frame.borderRadius: theme.radius.md`, `frame.paddingHorizontal: theme.spacing[4]`.
- `amount-field.tsx`: `variant: 'hero'` renders a centered `TextInput` with `{ ...theme.typography.display, ...theme.amount, textAlign: 'center' }`, a `$` prefix in `theme.typography.display` / `text.muted`, no box border and a 2 px bottom border `border.input` (`border.focus` when focused).
- `select.tsx`: closed control matches `text-field` frame (52, `radius.md`) with an `expand` icon on the right; its modal content uses the new `BottomSheet` (Task 4.5) — do this sub-step after 4.5.
- `account-card.tsx`: `card.backgroundColor: surface.default`, `balance: { ...theme.typography.h2, ...theme.amount }`.
- `movement-row.tsx`: row `alignItems: 'center'`, `gap: spacing[3]`, `paddingVertical: spacing[3]`, no own border (the list draws dividers); leading `<View testID="movement-avatar"><Avatar tone={direction === 'in' ? 'success' : 'neutral'} icon={movementIcon[movement.type]} /></View>`; lines: label (`label`), detail (`caption`, `text.secondary`, `numberOfLines={1}`), `${formatTime(occurredAt)} · Ref. ${reference}` (`caption`, `text.muted`) with `accessibilityLabel` of the full `formatDateTime`; right: amount (`label` + `amount`, money color) and `Saldo $…` (`caption`, `text.muted`). Add `formatTime(iso)` to `src/lib/display.ts` mirroring web (`hourCycle: 'h23'`, CDMX).
- `inline-alert.tsx`: row layout `{ flexDirection: 'row', gap: spacing[3], padding: spacing[4] }`, leading `<View testID="inline-alert-icon"><Icon name={toneIcon[tone]} color={colors.fg} /></View>`.
- `empty-state.tsx`: optional `icon` → `<Avatar size="lg" icon={icon} />` above the title; container `backgroundColor: surface.default`, `borderRadius: radius.lg`, `...theme.elevation.card`.
- `receipt.tsx`: card `radius.lg`, `padding: spacing[6]`, leading `<Avatar size="lg" tone=… icon=… />` exactly as web.
- `daily-limit-meter.tsx`: header row "Límite diario" (`label`) + formatted limit (`caption`, `text.muted`) above the track; keep the "Te quedan $X hoy" text and accessibility props.
- `privacy-overlay.tsx`: `backgroundColor: theme.colors.surface.hero`.
- `screen.tsx`: `safe.backgroundColor: surface.canvas`; render `header` above the `ScrollView`; set `contentContainerStyle={[styles.content, tabBar ? { paddingBottom: theme.layout.tabBarHeight + theme.spacing[6] } : null]}` (array form: the test matches it; the tab bar itself adds the bottom inset).

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → PASS (every existing mobile test included).
- [ ] **Step 5: Commit** — `feat(mobile): restyle the kit with the elevated visual language` with `Task: redesign#4.2`, `Refs: DSG-13, DSG-17`.

## Task 4.3: Mobile `TabBar` and `AppHeader`

**Files:**
- Create: `mobile/src/components/ui/tab-bar.tsx`, `mobile/src/components/ui/app-header.tsx`; export from `index.ts`
- Test: `mobile/src/components/ui/__tests__/navigation.test.tsx`

**Interfaces:**
- Consumes: `Icon`, `Avatar`, `initials` (4.1); `BottomSheet` (4.5 — execute 4.5 first); `navDestinations`, `NavDestination` (2.3).
- Produces: `TabBar({ items: readonly NavDestination[]; current: NavDestination | null; onSelect: (key: NavDestination) => void })`; `AppHeader({ user: { name: string; email: string }; title?: string; onLogout?: () => void })`.

- [ ] **Step 1: Write the failing test** — `__tests__/navigation.test.tsx`:
```tsx
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppHeader, TabBar } from '..';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 34 } };
const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };

describe('TabBar', () => {
  test('MOB-18 muestra Inicio, Movimientos y Transferir y marca la actual', async () => {
    const onSelect = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TabBar items={['home', 'movements', 'transfer']} current="movements" onSelect={onSelect} />
      </SafeAreaProvider>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Inicio', 'Movimientos', 'Transferir']);
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toBeSelected();
    fireEvent.press(screen.getByRole('tab', { name: 'Transferir' }));
    expect(onSelect).toHaveBeenCalledWith('transfer');
  });

  test('MOB-18 suma el área segura inferior a su alto', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TabBar items={['home']} current="home" onSelect={() => {}} />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('tab-bar')).toHaveStyle({ height: 64 + 34 });
  });
});

describe('AppHeader', () => {
  test('MOB-18 el avatar abre el menú con Cerrar sesión', async () => {
    const onLogout = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppHeader user={USER} onLogout={onLogout} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Ana')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByTestId('bottom-sheet');
    fireEvent.press(within(sheet).getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2:** `npx jest src/components/ui/__tests__/navigation.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`tab-bar.tsx`:
```tsx
import { navDestinations, type NavDestination } from '@devchrisvaz/wallet-design-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Icon } from './icon';

interface TabBarProps {
  items: readonly NavDestination[];
  current: NavDestination | null;
  onSelect: (key: NavDestination) => void;
}

/** Barra de pestañas (MOB-18), con la misma anatomía que la de la web (DSG-17). */
export function TabBar({ items, current, onSelect }: TabBarProps) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View testID="tab-bar" accessibilityRole="tablist" style={[styles.bar, { height: theme.layout.tabBarHeight + bottom, paddingBottom: bottom }]}>
      {items.map((key) => {
        const { label, icon } = navDestinations[key];
        const active = key === current;
        return (
          <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={() => onSelect(key)} style={styles.item}>
            <View style={[styles.pill, active && styles.pillActive]}>
              <Icon name={icon} size="lg" color={active ? theme.colors.accent.onDark : theme.colors.text.muted} />
            </View>
            <Text style={[styles.label, active ? styles.labelActive : null]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: theme.colors.surface.default, borderTopWidth: 1, borderTopColor: theme.colors.border.default },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing[1] },
  pill: { width: 64, height: 32, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: theme.colors.surface.hero },
  label: { ...theme.typography.caption, color: theme.colors.text.muted },
  labelActive: { fontFamily: theme.typography.label.fontFamily, color: theme.colors.action.primary },
});
```

`app-header.tsx`:
```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Avatar, initials } from './avatar';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';

interface AppHeaderProps {
  user: { name: string; email: string };
  /** Título de la pestaña; sin él, saluda con el nombre (Inicio). */
  title?: string;
  onLogout?: () => void;
}

/** Encabezado de la app (MOB-18): saludo o título y el menú de la cuenta. */
export function AppHeader({ user, title, onLogout }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;
  return (
    <View style={styles.header}>
      {title ? (
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      ) : (
        <View>
          <Text style={styles.hello}>Hola,</Text>
          <Text style={styles.title}>{firstName}</Text>
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Menú de la cuenta" onPress={() => setOpen(true)}>
        <Avatar tone="hero" initials={initials(user.name)} />
      </Pressable>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Tu cuenta">
        <View style={styles.account}>
          <Avatar tone="brand" initials={initials(user.name)} />
          <View style={styles.accountText}>
            <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
            <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
          </View>
        </View>
        {onLogout ? <Button label="Cerrar sesión" icon="logout" variant="secondary" onPress={onLogout} /> : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[4], paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[6], paddingBottom: theme.spacing[4] },
  hello: { ...theme.typography.bodySm, color: theme.colors.text.secondary },
  title: { ...theme.typography.h2, color: theme.colors.text.primary },
  account: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  accountText: { flex: 1, minWidth: 0 },
  name: { ...theme.typography.label, color: theme.colors.text.primary },
  email: { ...theme.typography.caption, color: theme.colors.text.muted },
});
```

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(mobile): add the tab bar and app header` with `Task: redesign#4.3`, `Refs: MOB-18`.

## Task 4.4: Mobile `BalanceHero`, `QuickActions`, `ListSection`, `MovementList`

**Files:**
- Create: `mobile/src/components/ui/{balance-hero,quick-actions,list-section,movement-list}.tsx`; export from `index.ts`
- Modify: `mobile/src/lib/display.ts` (`sumAmounts`, `formatTime` if not added in 4.2); test `src/lib/__tests__/money-format.test.ts`
- Test: `mobile/src/components/ui/__tests__/home.test.tsx`

**Interfaces:** `sumAmounts(amounts: readonly string[]): string`; `BalanceHero({ total: string; available: string; actions?: ReactNode })`; `QuickAction { key; label; icon: IconConcept; onPress: () => void }`; `QuickActions({ actions })`; `ListSection({ title?: string; action?: ReactNode; children })`; `MovementList({ movements: readonly Movement[]; now?: Date })`.

- [ ] **Step 1: Write the failing tests**

`money-format.test.ts`, append:
```ts
describe('sumAmounts', () => {
  test('MOB-19 suma los saldos en centavos sin punto flotante', () => {
    expect(sumAmounts(['25000.00', '10000.00'])).toBe('35000.00');
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30');
    expect(sumAmounts([])).toBe('0.00');
  });
});
```
`__tests__/home.test.tsx`:
```tsx
import type { Movement } from '@devchrisvaz/wallet-contract';
import { render, screen } from '@testing-library/react-native';

import { theme } from '@/theme';

import { BalanceHero, MovementList } from '..';

const movement = (id: string, occurredAt: string): Movement => ({
  id, type: 'TRANSFER_OUT', amount: '-150.00', balanceAfter: '24850.00', concept: 'Despensa', reference: '1',
  counterparty: { name: 'Mamá', clabeLast4: '4321' }, transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a', occurredAt,
});

describe('BalanceHero', () => {
  test('MOB-19 anuncia el total completo y muestra el disponible de hoy', async () => {
    await render(<BalanceHero total="35000.00" available="31500.00" />);
    expect(screen.getByLabelText('Saldo total $35,000.00')).toBeOnTheScreen();
    expect(screen.getByText('Disponible hoy $31,500.00')).toBeOnTheScreen();
  });

  test('DSG-13 un saldo muy grande baja de tamaño para caber en una línea', async () => {
    await render(<BalanceHero total="1234567890.00" available="0.00" />);
    expect(screen.getByTestId('hero-amount', { includeHiddenElements: true })).toHaveStyle({ fontSize: theme.typography.h1.fontSize });
  });
});

describe('MovementList', () => {
  test('MOB-20 agrupa por día de Ciudad de México: las 05:30 UTC son "Ayer"', async () => {
    await render(
      <MovementList
        now={new Date('2026-10-13T18:00:00Z')}
        movements={[movement('a', '2026-10-13T16:42:00Z'), movement('b', '2026-10-13T05:30:00Z'), movement('c', '2026-10-09T18:20:00Z')]}
      />,
    );
    expect(screen.getAllByRole('header').map((node) => node.props.children)).toEqual(['Hoy', 'Ayer', '9 oct']);
  });
});
```

- [ ] **Step 2:** `npx jest src/lib src/components/ui/__tests__/home.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/display.ts` — import `centsToDecimalString` and add:
```ts
/** Suma de montos en centavos con BigInt (MOB-19, MOB-15). */
export function sumAmounts(amounts: readonly string[]): string {
  return centsToDecimalString(amounts.reduce((total, amount) => total + toCents(amount), 0n));
}
```

`balance-hero.tsx`:
```tsx
import { formatMXN } from '@devchrisvaz/wallet-contract';
import { heroAmountSize, splitCents } from '@devchrisvaz/wallet-design-tokens';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { theme } from '@/theme';

interface BalanceHeroProps {
  /** Saldo total en pesos como string decimal (`sumAmounts`). */
  total: string;
  /** Lo que queda del límite diario. */
  available: string;
  actions?: ReactNode;
}

/** Hero del saldo (MOB-19, DSG-13): igual que el de la web, con el resplandor lima en SVG. */
export function BalanceHero({ total, available, actions }: BalanceHeroProps) {
  const formatted = formatMXN(total);
  const [whole, cents] = splitCents(formatted);
  const amountStyle = theme.typography[heroAmountSize(formatted)];
  return (
    <View style={styles.hero}>
      <Svg width={192} height={192} style={styles.glow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.colors.accent.onDark} stopOpacity={0.35} />
            <Stop offset="0.7" stopColor={theme.colors.accent.onDark} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={96} cy={96} r={96} fill="url(#glow)" />
      </Svg>
      <View accessible accessibilityLabel={`Saldo total ${formatted}`}>
        <Text style={styles.title}>Saldo total</Text>
        <Text testID="hero-amount" numberOfLines={1} style={[amountStyle, theme.amount, styles.amount]}>
          {whole}
          <Text style={[theme.typography.h3, styles.amount]}>{cents}</Text>
        </Text>
      </View>
      <View style={styles.chip}>
        <Text style={styles.chipText}>{`Disponible hoy ${formatMXN(available)}`}</Text>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: 'hidden', borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface.hero, padding: theme.spacing[6] },
  glow: { position: 'absolute', top: -64, right: -64 },
  title: { ...theme.typography.label, color: theme.colors.text.onHeroMuted },
  amount: { color: theme.colors.text.onInverse, marginTop: theme.spacing[1] },
  chip: { alignSelf: 'flex-start', marginTop: theme.spacing[3], minHeight: 28, justifyContent: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent.onDark, paddingHorizontal: theme.spacing[3] },
  chipText: { ...theme.typography.caption, ...theme.amount, fontFamily: theme.typography.label.fontFamily, color: theme.colors.text.primary },
  actions: { marginTop: theme.spacing[6] },
});
```

`quick-actions.tsx`:
```tsx
import type { IconConcept } from '@devchrisvaz/wallet-design-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { Icon } from './icon';

export interface QuickAction {
  key: string;
  label: string;
  icon: IconConcept;
  onPress: () => void;
}

/** Acciones rápidas sobre el hero (MOB-19): círculo con icono lima y texto visible. */
export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
  return (
    <View style={styles.row}>
      {actions.map(({ key, label, icon, onPress }) => (
        <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
          <View style={styles.circle}><Icon name={icon} size="lg" color={theme.colors.accent.onDark} /></View>
          <Text style={styles.label}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.spacing[6] },
  action: { alignItems: 'center', gap: theme.spacing[2] },
  circle: { width: 48, height: 48, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  label: { ...theme.typography.caption, fontFamily: theme.typography.label.fontFamily, color: theme.colors.text.onInverse },
});
```
(`rgba(255,255,255,0.1)` mirrors web `bg-fg-on-inverse/10`; it is the only non-token literal and is the documented translucency of `text.onInverse`. Keep it in this one style.)

`list-section.tsx`:
```tsx
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

interface ListSectionProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}

/** Tarjeta de lista con encabezado opcional (DSG-17), como la de la web. */
export function ListSection({ title, action, children }: ListSectionProps) {
  return (
    <View style={styles.card}>
      {title || action ? (
        <View style={styles.header}>
          {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : <View />}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[4], ...theme.elevation.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[4], paddingBottom: theme.spacing[2] },
  title: { ...theme.typography.h3, color: theme.colors.text.primary },
});
```

`movement-list.tsx`:
```tsx
import type { Movement } from '@devchrisvaz/wallet-contract';
import { groupByDay } from '@devchrisvaz/wallet-design-tokens';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { MovementRow } from './movement-row';

/** Movimientos agrupados por día de Ciudad de México (MOB-20), como en la web. */
export function MovementList({ movements, now }: { movements: readonly Movement[]; now?: Date }) {
  return (
    <View style={styles.list}>
      {groupByDay(movements, (item) => item.occurredAt, now).map((group) => (
        <View key={group.key}>
          <Text accessibilityRole="header" style={styles.day}>{group.label}</Text>
          {group.items.map((item, index) => (
            <View key={item.id} style={index > 0 ? styles.divider : null}>
              <MovementRow movement={item} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing[2] },
  day: { ...theme.typography.caption, fontFamily: theme.typography.label.fontFamily, color: theme.colors.text.muted, paddingTop: theme.spacing[2], paddingBottom: theme.spacing[1] },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border.default },
});
```

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(mobile): add the balance hero, quick actions and grouped movement list` with `Task: redesign#4.4`, `Refs: MOB-19, MOB-20`.

## Task 4.5: Mobile `BottomSheet`, `Stepper`, `FlowHeader`, `BrandScreen`

**Files:**
- Create: `mobile/src/components/ui/{bottom-sheet,stepper,flow-header,brand-screen}.tsx`; export from `index.ts`
- Test: `mobile/src/components/ui/__tests__/overlays.test.tsx`

**Interfaces:** `BottomSheet({ open: boolean; onClose: () => void; title: string; children })` (testID `bottom-sheet`); `Stepper({ current: number; total: number; label: string })`; `FlowHeader({ title; step; total; stepLabel; onClose: () => void })`; `BrandScreen({ title: string; children })`.

- [ ] **Step 1: Write the failing test** — `__tests__/overlays.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomSheet, BrandScreen, Stepper } from '..';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

describe('BottomSheet', () => {
  test('DSG-17 el botón atrás de Android la cierra', async () => {
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BottomSheet open onClose={onClose} title="Cuenta de origen"><Text>Principal</Text></BottomSheet>
      </SafeAreaProvider>,
    );
    fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('DSG-17 tiene botón Cerrar con nombre accesible', async () => {
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BottomSheet open onClose={onClose} title="Cuenta de origen"><Text>Principal</Text></BottomSheet>
      </SafeAreaProvider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Stepper', () => {
  test('MOB-21 anuncia el paso actual', async () => {
    await render(<Stepper current={4} total={5} label="Código" />);
    expect(screen.getByLabelText('Paso 4 de 5: Código')).toBeOnTheScreen();
    expect(screen.getByText('Paso 4 de 5 · Código')).toBeOnTheScreen();
  });
});

describe('BrandScreen', () => {
  test('MOB-22 muestra el Wordmark sobre la superficie de marca y el título en la hoja', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BrandScreen title="Inicia sesión"><Text>Formulario</Text></BrandScreen>
      </SafeAreaProvider>,
    );
    expect(screen.getByLabelText('TreoWallet')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Inicia sesión' })).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2:** `npx jest src/components/ui/__tests__/overlays.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`bottom-sheet.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { IconButton } from './icon';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Hoja inferior modal (DSG-17): misma anatomía que la de la web; atrás (Android) la cierra. */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal testID="bottom-sheet-modal" visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.backdrop} onPress={onClose} />
        <View testID="bottom-sheet" accessibilityViewIsModal style={[styles.sheet, { paddingBottom: theme.spacing[6] + bottom }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <IconButton icon="close" label="Cerrar" onPress={onClose} />
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.surface.hero, opacity: 0.6 },
  sheet: { gap: theme.spacing[4], borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surface.default, paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[3], ...theme.elevation.sheet },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: theme.radius.pill, backgroundColor: theme.colors.border.default },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[4] },
  title: { ...theme.typography.h3, color: theme.colors.text.primary },
  body: { gap: theme.spacing[5] },
});
```

`stepper.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

/** Indicador de pasos (MOB-21), como el de la web. */
export function Stepper({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`Paso ${current} de ${total}: ${label}`} style={styles.container}>
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, index) => (
          <View key={index} style={[styles.bar, index < current ? styles.done : null]} />
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.text}>{`Paso ${current} de ${total} · ${label}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing[2] },
  bars: { flexDirection: 'row', gap: theme.spacing[1] },
  bar: { flex: 1, height: 4, borderRadius: theme.radius.pill, backgroundColor: theme.colors.border.default },
  done: { backgroundColor: theme.colors.action.primary },
  text: { ...theme.typography.caption, color: theme.colors.text.muted },
});
```

`flow-header.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

import { IconButton } from './icon';
import { Stepper } from './stepper';

interface FlowHeaderProps {
  title: string;
  step: number;
  total: number;
  stepLabel: string;
  onClose: () => void;
}

/** Encabezado del flujo de transferencia: cerrar, título y pasos (MOB-21). */
export function FlowHeader({ title, step, total, stepLabel, onClose }: FlowHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.close}><IconButton icon="close" label="Salir de la transferencia" onPress={onClose} /></View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      </View>
      <Stepper current={step} total={total} label={stepLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.spacing[4], paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  close: { marginLeft: -theme.spacing[3] },
  title: { ...theme.typography.h3, color: theme.colors.text.primary },
});
```

`brand-screen.tsx`:
```tsx
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Wordmark } from './wordmark';

/** Pantallas públicas sobre la superficie de marca (MOB-22), como `BrandShell` de la web. */
export function BrandScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.brand}>
        <Wordmark tone="inverse" />
        <Text style={styles.tagline}>Tu billetera digital en pesos mexicanos.</Text>
      </View>
      <ScrollView style={styles.sheet} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface.hero },
  brand: { gap: theme.spacing[3], paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[16], paddingBottom: theme.spacing[8] },
  tagline: { ...theme.typography.body, color: theme.colors.text.onHeroMuted },
  sheet: { flex: 1, backgroundColor: theme.colors.surface.default, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  content: { gap: theme.spacing[6], paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[8], paddingBottom: theme.spacing[10] },
  title: { ...theme.typography.h1, color: theme.colors.text.primary },
});
```
Then finish the `select.tsx` sub-step of Task 4.2 (modal → `BottomSheet`).

- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(mobile): add the bottom sheet, stepper, flow header and brand screen` with `Task: redesign#4.5`, `Refs: DSG-17, MOB-21, MOB-22`.

## Task 5.1: Web screen stories

**Files:**
- Modify: `web/.design-sync/entry.ts` (export the new kit + `AppShell`, `BrandShell`, `DEFAULT_NAV_ITEMS`; drop `PageShell`), `web/.design-sync/config.json` (`componentSrcMap`: `"AppShell": "../../../components/layout/AppShell.tsx"`, `"BrandShell": "../../../components/layout/BrandShell.tsx"`; `overrides`: `"AppShell": {"cardMode": "column"}`), `web/.design-sync/docs/` (category stubs for the new kit components: Navigation → TabBar, SideNav, TopBar, AppHeader; Wallet → BalanceHero, QuickActions, ListSection, MovementList; Feedback → Stepper, BottomSheet; Brand → Avatar, Icon, IconButton)
- Delete: `web/.design-sync/previews/PageShell.tsx`
- Create: `web/.design-sync/previews/AppShell.tsx` (all screen stories), plus one preview per new kit component (`TabBar.tsx`, `SideNav.tsx`, `BalanceHero.tsx`, `MovementList.tsx`, `BottomSheet.tsx`, `Stepper.tsx`, `Avatar.tsx`, `Icon.tsx`, …) with 2–4 stories each
- Modify: existing previews whose component API grew (`AccountCard.tsx`: add `Selectable`; `AmountField.tsx`: add `Hero`; `EmptyState.tsx`: add `WithIcon`; `Wordmark.tsx`: add `Inverse`)

**Interfaces:** consumes every component from Tasks 3.1–3.6; produces story exports with the shared names listed in "Shared story names".

- [ ] **Step 1: Write `AppShell.tsx` stories.** Every story is a complete page; signed-in stories use `<AppShell current=… title=… user={user} primaryAction={<a className={buttonClasses('primary')} href="#">Nueva transferencia</a>}>`; transfer stories use `mode="flow"` with `<FlowHeader … closeHref="#" />` and, on desktop, a two-column body `grid gap-8 dashboard:grid-cols-[minmax(0,1fr)_320px]` with the step on the left and a `ListSection title="Resumen"` on the right (`hidden dashboard:block`). Public stories use `<BrandShell title=…>`. Data: the canonical data block at the top of the file, verbatim. Story contents (port copy/fields from the real screen components named in brackets):

| Story | Content |
|---|---|
| `Login` | BrandShell "Inicia sesión": TextField Correo, TextField Contraseña, Button "Iniciar sesión" (full width), link "¿No tienes cuenta? Regístrate" [`components/auth/LoginForm.tsx`] |
| `Register` | BrandShell "Crea tu cuenta": the RegisterForm fields with their hints, Button "Crear cuenta" [`RegisterForm.tsx`] |
| `VerifyEmail` | BrandShell "Verifica tu correo": success InlineAlert, Correo prefilled, OtpField, Button "Verificar correo", ghost "Reenviar código" [`VerifyEmailForm.tsx`] |
| `Home` | AppShell home: `BalanceHero total={sumAmounts([principal.balance, ahorro.balance])} available={dailyLimit.remaining} actions={<QuickActions actions={[{key:'t',label:'Transferir',icon:'transfer',href:'#'},{key:'m',label:'Movimientos',icon:'movements',href:'#'}]} />}`; then `grid gap-5 dashboard:grid-cols-2`: left = AccountCards (principal `selected`, both with `onSelect`) + `ListSection` with DailyLimitMeter; right = `ListSection title="Últimos movimientos" action={<a href="#" className="text-label text-action">Ver todos</a>}` with `<MovementList movements={movements} now={NOW} />` |
| `HomeEmpty` | Hero with total `0.00`, EmptyState icon `account` "Aún no tienes cuentas" + action "Volver a cargar" [`AccountsOverviewScreen.tsx`] |
| `HomeLoading` | Hero area as `Skeleton variant="card"`, two card skeletons, list of line skeletons (LoadingState) |
| `HomeError` | ErrorState with `new TypeError('Failed to fetch')` and "Reintentar" |
| `Movements` | AppShell movements: account segmented switch (two `buttonClasses('secondary')`/`('primary')` pills Principal/Ahorro), a "Filtros" `Button variant="ghost" icon="filter"`, `ListSection` with `MovementList`, "Cargar más" |
| `MovementsEmpty` | Same header + EmptyState icon `movements` "No hay movimientos en este periodo" + "Limpiar filtros" |
| `MovementsFilters` | `Movements` with `<BottomSheet open title="Filtrar movimientos">` containing the Desde/Hasta TextFields (`type="date"`), the type checkboxes and "Aplicar"/"Limpiar" [`MovementsScreen.tsx`] |
| `TransferRecipient` | flow step 1/5 "Destinatario": `ListSection title="Tus cuentas"` with an option row for Ahorro (Avatar `ownTransfer`), `ListSection title="Beneficiarios"` with Luis and Mamá (Avatar initials), each row a full-width button with `forward` icon |
| `TransferAmount` | flow 2/5 "Monto": recipient summary row (Luis · CLABE •••• 5678), `AmountField variant="hero" defaultValue="1,250.00"`, Select Cuenta de origen (Principal · $25,000.00), TextField Concepto "Renta", TextField Referencia "1", primary "Continuar" |
| `TransferReview` | flow 3/4 "Revisión" (no OTP → total 4): amount `text-display`, `ListSection` rows Desde/Para/Concepto/Referencia, primary "Enviar", ghost "Editar" [`ConfirmStep.tsx`] |
| `TransferUncertain` | `TransferReview` + warning InlineAlert "No pudimos confirmar el estado de tu transferencia" + primary "Reintentar" |
| `TransferRejected` | `TransferReview` + danger InlineAlert INSUFFICIENT_FUNDS copy + secondary "Corregir" |
| `TransferOtp` | flow 4/5 "Código" for $15,000.00: copy "Te enviamos un código de 6 dígitos a an***@example.com", OtpField, primary "Confirmar", ghost "Reenviar código" [`OtpStep.tsx`] |
| `TransferCompleted` | flow 4/4 "Comprobante": `Receipt` (completed, $1,250.00) + secondary "Ver mis cuentas", ghost "Hacer otra transferencia" [`ReceiptStep.tsx`] |
| `TransferFailed` | flow 5/5 "Comprobante": Receipt FAILED + danger InlineAlert OTP_ATTEMPTS_EXHAUSTED + primary "Intentar de nuevo" |
| `Beneficiaries` | AppShell beneficiaries: list of beneficiary rows (Avatar initials, alias, name, CLABE •••• last4, secondary "Transferir") + primary "Agregar beneficiario" in `primaryAction` and, on phone, a full-width button at the top [`BeneficiariesScreen.tsx`] |
| `BeneficiariesEmpty` | EmptyState icon `beneficiaries` "Aún no tienes beneficiarios" + "Agregar beneficiario" |
| `NewBeneficiary` | AppShell beneficiaries, title "Agregar beneficiario": NewBeneficiaryForm fields + primary "Agregar beneficiario" [`NewBeneficiaryForm.tsx`] |
| `TransferDetail` | AppShell current `null`, title "Transferencia": Receipt (completed, $5,000.00) + secondary "Ver mis cuentas" [`TransferDetailScreen.tsx`] |

- [ ] **Step 2: Kit-component previews.** For each new kit component, 2–4 stories (e.g. `TabBar.tsx`: `Home`, `Movements` with `position="static"`; `BalanceHero.tsx`: `Default`, `WithActions`, `LargeBalance` (`1234567890.00`); `MovementList.tsx`: `Today`, `AcrossDays`; `Stepper.tsx`: `Step1`, `Step3`, `Last`; `BottomSheet.tsx`: `AccountMenu` (`open`, `cardMode: "single"`, `viewport: "480x520"` in `config.json` overrides); `SideNav.tsx`: `Home` inside a 248×640 frame).

- [ ] **Step 3: Build, validate, capture**

```bash
node .design-sync/build-ui.mjs
node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
node .design-sync/review/install.mjs
node .ds-sync/package-capture.mjs --out ./ds-bundle
```
Expected: validate `✓ bundle is complete`; render check lists every component clean; capture lists the new cells as "need grading". Apply any `[GRID_OVERFLOW]` suggestion to `config.json` and rerun the targeted rebuild.

- [ ] **Step 4: Grade.** For screen stories, capture full-page shots at **1280** and **390** wide (body padding removed) with the scratchpad `screens.mjs` approach (or `parity-check.mjs` from Task 5.3 once it exists), read them, and write `.design-sync/.cache/review/AppShell.grade.json` and one grade file per new component (`{"cells": {"<Story>": {"verdict": "good", "note": "…"}}}`). Rubric: styled (tokens, Work Sans), complete (nothing collapsed or clipped, tab bar not covering content), faithful (copy and states match the real screen), and at 390 the app shape (no side nav, tab bar present except in flow).

- [ ] **Step 5: Commit** — `feat(web): compose every redesigned screen as a canvas story` with `Task: redesign#5.1`, `Refs: WEB-24, WEB-26, WEB-27, WEB-28, WEB-29, WEB-30, WEB-31`.

## Task 5.2: Mobile screen stories

**Files:**
- Rewrite: `mobile/.design-sync/previews/Screen.tsx` with the shared story names; create previews for the new kit components (`TabBar.tsx`, `AppHeader.tsx`, `BalanceHero.tsx`, `MovementList.tsx`, `Stepper.tsx`, `BottomSheet.tsx`, `Avatar.tsx`, `Icon.tsx`, `FlowHeader.tsx`, `BrandScreen.tsx`, `QuickActions.tsx`, `ListSection.tsx`)
- Modify: `mobile/.design-sync/docs/` (category stubs for the new components, same groups as web), `mobile/.design-sync/config.json` (`overrides` for new components: `{"cardMode": "column"}`; `BottomSheet`: `{"cardMode": "single", "viewport": "390x520"}`)

**Interfaces:** consumes every component from Tasks 4.1–4.5; story names exactly as in "Shared story names".

- [ ] **Step 1: Write the stories.** Every story renders `<View style={{ width: 390, height: 844 }}>`. Tab screens: `<View style={{ flex: 1 }}><Screen tabBar header={<AppHeader user={user} title={…} />}>…</Screen><TabBar items={['home','movements','transfer']} current=… onSelect={noop} /></View>`. Flow screens: `<Screen header={<FlowHeader … onClose={noop} />} footer={…}>`. Public: `<BrandScreen title=…>`. Same content table as Task 5.1 for the shared names (mobile has no own-account option in `TransferRecipient`, no filters, no beneficiaries management). Mobile-only stories:

| Story | Content |
|---|---|
| `StartupLoading` | centered Wordmark + `ActivityIndicator` on `surface.default` (root-navigator) |
| `StartupOffline` | centered Wordmark, "No pudimos conectar con TreoWallet", body copy, primary "Reintentar" |
| `LoginRateLimited` | `Login` + warning InlineAlert RATE_LIMITED + "Podrás intentar de nuevo en 42 s." + disabled primary |
| `TransferRecipientEmpty` | flow 1 with EmptyState icon `beneficiaries` "Aún no tienes beneficiarios" + "Regístralos en la web de TreoWallet…" |
| `TransferRetrying` | `TransferReview` + warning InlineAlert "Perdimos la conexión. Reintentaremos la misma operación (1 de 5)." + loading primary "Enviar" |

- [ ] **Step 2: Build, validate, capture** (same commands as Task 5.1 Step 3, from `mobile/`). Expected: validate clean; `[CSS_RUNTIME]` informational.

- [ ] **Step 3: Grade** from full-page shots at 390×844 and write `.design-sync/.cache/review/Screen.grade.json` + per-component grade files (same rubric).

- [ ] **Step 4: Commit** — `feat(mobile): compose every redesigned screen as a canvas story` with `Task: redesign#5.2`, `Refs: MOB-18, MOB-19, MOB-20, MOB-21, MOB-22`.

## Task 5.3: Parity canvas and parity check

**Files:**
- Create: `web/.design-sync/review/parity.html`, `web/.design-sync/review/parity-check.mjs`
- Modify: `web/.ds-sync/package.json` (dev tooling, gitignored): `npm i pixelmatch@7 pngjs@7` inside `web/.ds-sync`

**Interfaces:** `parity.html` reads `/web/_ds_bundle.js` and `/mobile/_ds_bundle.js` headers only to list stories; pairs = story names present in both `AppShell` (web) and `Screen` (mobile). `parity-check.mjs --base http://127.0.0.1:4310 --out <dir>` writes `<dir>/<Story>-{web,mobile,diff}.png` and `<dir>/report.json` (`[{ story, diffRatio }]`).

- [ ] **Step 1: Write `parity.html`** — single page, no dependencies:
```html
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Paridad web / móvil</title>
<style>
  body { margin: 0; font: 13px/1.4 system-ui; background: #eceeea; color: #1d2420; }
  header { position: sticky; top: 0; z-index: 2; display: flex; gap: 16px; align-items: center; padding: 12px 24px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
  main { display: grid; gap: 64px; padding: 32px 24px 96px; }
  h2 { font: 600 22px system-ui; margin: 0 0 12px; }
  .row { display: flex; gap: 32px; align-items: flex-start; }
  .frame { display: grid; gap: 6px; } .frame span { color: #68716b; }
  iframe { border: 0; background: #fff; border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
  .stack { position: relative; width: 390px; height: 844px; }
  .stack iframe { position: absolute; inset: 0; }
  .stack .top { opacity: 0; pointer-events: none; }
  body.overlay .stack .top { opacity: .5; }
</style></head>
<body>
<header><strong>Paridad web / móvil</strong><label><input id="overlay" type="checkbox"> Superponer web sobre móvil (50 %)</label><span id="count"></span></header>
<main id="pairs"></main>
<script>
(async () => {
  const header = async (app) => JSON.parse(/@ds-bundle: (\{.*?\}) \*\//.exec(await (await fetch(`/${app}/_ds_bundle.js`)).text())[1]);
  const path = (h, name) => h.components.find((c) => c.name === name).sourcePath.replace(/\.jsx$/, '.html');
  const cells = async (app, html) => {
    const probe = Object.assign(document.createElement('iframe'), { src: `/${app}/${html}?story=__probe__`, style: 'position:fixed;left:-9999px;width:10px;height:10px' });
    document.body.append(probe);
    await new Promise((r) => (probe.onload = r));
    for (let i = 0; i < 100 && !probe.contentWindow.__dsCells; i += 1) await new Promise((r) => setTimeout(r, 50));
    const list = probe.contentWindow.__dsCells || [];
    probe.remove();
    return list;
  };
  const [web, mobile] = await Promise.all([header('web'), header('mobile')]);
  const webHtml = path(web, 'AppShell'), mobileHtml = path(mobile, 'Screen');
  const [webStories, mobileStories] = await Promise.all([cells('web', webHtml), cells('mobile', mobileHtml)]);
  const flush = (iframe) => iframe.addEventListener('load', () => { iframe.contentDocument.body.style.padding = '0'; });
  const frame = (app, html, story, w, h, cls = '') => {
    const f = Object.assign(document.createElement('iframe'), { src: `/${app}/${html}?story=${story}`, width: w, height: h, className: cls });
    flush(f);
    return f;
  };
  const list = document.getElementById('pairs');
  const all = [...new Set([...webStories, ...mobileStories])];
  document.getElementById('count').textContent = `${all.filter((s) => webStories.includes(s) && mobileStories.includes(s)).length} parejas`;
  for (const story of all) {
    const section = document.createElement('section');
    section.innerHTML = `<h2>${story}</h2><div class="row"></div>`;
    const row = section.querySelector('.row');
    const add = (label, node) => { const d = document.createElement('div'); d.className = 'frame'; d.append(Object.assign(document.createElement('span'), { textContent: label }), node); row.append(d); };
    if (webStories.includes(story)) add('Web · 1280×800', frame('web', webHtml, story, 1280, 800));
    const stack = document.createElement('div'); stack.className = 'stack';
    if (mobileStories.includes(story)) stack.append(frame('mobile', mobileHtml, story, 390, 844));
    if (webStories.includes(story)) stack.append(frame('web', webHtml, story, 390, 844, mobileStories.includes(story) ? 'top' : ''));
    add(mobileStories.includes(story) ? (webStories.includes(story) ? 'Móvil · 390×844 (+ web superpuesta)' : 'Móvil · 390×844') : 'Web · 390×844', stack);
    if (webStories.includes(story) && mobileStories.includes(story)) add('Web · 390×844', frame('web', webHtml, story, 390, 844));
    list.append(section);
  }
  document.getElementById('overlay').addEventListener('change', (e) => document.body.classList.toggle('overlay', e.target.checked));
})();
</script>
</body></html>
```

- [ ] **Step 2: Write `parity-check.mjs`**
```js
#!/usr/bin/env node
// Captura cada pareja (web y móvil a 390×844, sin el margen de la tarjeta) y mide la proporción de
// píxeles distintos. Guía para la revisión de paridad (WEB-25), no una prueba binaria: las
// diferencias de suavizado del texto son esperables.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = createRequire(resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '.ds-sync', 'package.json'));
const { chromium } = tools('playwright');
const { PNG } = tools('pngjs');
const pixelmatch = tools('pixelmatch').default ?? tools('pixelmatch');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://127.0.0.1:4310');
const out = resolve(arg('out', '.design-sync/.cache/parity'));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const headerOf = async (app) => JSON.parse(/@ds-bundle: (\{.*?\}) \*\//.exec(await (await fetch(`${base}/${app}/_ds_bundle.js`)).text())[1]);
const htmlOf = (h, name) => h.components.find((c) => c.name === name).sourcePath.replace(/\.jsx$/, '.html');
const storiesOf = async (url) => { await page.goto(`${url}?story=__probe__`); return page.evaluate(() => window.__dsCells ?? []); };
const shot = async (url, file) => {
  await page.goto(url);
  await page.addStyleTag({ content: 'body{padding:0 !important}' });
  await page.waitForFunction(() => document.getElementById('r0')?.childElementCount > 0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file });
  return PNG.sync.read((await import('node:fs')).readFileSync(file));
};

const webUrl = `${base}/web/${htmlOf(await headerOf('web'), 'AppShell')}`;
const mobileUrl = `${base}/mobile/${htmlOf(await headerOf('mobile'), 'Screen')}`;
const mobileStories = new Set(await storiesOf(mobileUrl));
const pairs = (await storiesOf(webUrl)).filter((s) => mobileStories.has(s));
const report = [];
for (const story of pairs) {
  const a = await shot(`${webUrl}?story=${story}`, join(out, `${story}-web.png`));
  const b = await shot(`${mobileUrl}?story=${story}`, join(out, `${story}-mobile.png`));
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.15 });
  writeFileSync(join(out, `${story}-diff.png`), PNG.sync.write(diff));
  report.push({ story, diffRatio: Number((changed / (a.width * a.height)).toFixed(4)) });
}
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.table(report);
await browser.close();
```

- [ ] **Step 3: Run it**

```bash
cd "$WT/web" && (cd .ds-sync && npm i pixelmatch@7 pngjs@7) && node .design-sync/review/parity-check.mjs --base http://127.0.0.1:4310
```
Expected: a table with one row per shared story. Read every `*-diff.png` whose `diffRatio` > 0.03; for each, decide whether the difference is structural (fix the web or mobile component/story so both match the anatomy in `design.md` D4/D7) or antialiasing (ignore). Iterate until no structural difference remains; record the final table in `web/.design-sync/NOTES.md` under "Paridad".

- [ ] **Step 4: Commit** — `feat(web): add the parity canvas and parity check for the redesign` with `Task: redesign#5.3`, `Refs: WEB-25`.

## Task 5.4: Visual review with the user (gate)

**Files:** Modify `openspec/changes/redesign/design.md` (close "Open Questions"), `openspec/changes/redesign/tasks.md` (check 1.1–5.4).

- [ ] **Step 1:** Rebuild both canvases (Working conventions), restart the review server, and run `parity-check.mjs`.
- [ ] **Step 2:** Hand the user: `http://127.0.0.1:4310/web/.canvas.html`, `/mobile/.canvas.html`, `/parity.html`, plus the before canvases from `main` for comparison. State the parity table.
- [ ] **Step 3:** Iterate on feedback: each change goes through the owning task's component/test/story, then rebuild + parity check. Commit each round with `Task: redesign#5.4`.
- [ ] **Step 4:** On explicit visual approval, write the closed values into `design.md` (final `text.onHeroMuted`, elevation values, icon choices, hero glow), mark tasks 1.1–5.4 `[x]` in `tasks.md`, validate (`openspec validate redesign --strict`), commit `docs(openspec): record the approved redesign` with `Task: redesign#5.4`, `Refs: DSG-13, DSG-16, WEB-25`.
- [ ] **Step 5:** Write `plan-phase-b.md` (tasks 6–8) from the approved state, with the same structure as this plan.
