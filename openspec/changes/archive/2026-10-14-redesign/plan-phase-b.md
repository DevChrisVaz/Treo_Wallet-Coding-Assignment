# TreoWallet Redesign — Phase B (Application) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved redesign (Phase A canvases, user approval 2026-10-14) to the real screens of the web and the mobile app — layouts, navigation, Home, Movements, the stepped transfer flow and the public/brand screens — keeping every existing behavior (session, idempotency, OTP, retries, error copy by `code`, accessibility), verify parity on the real screens, document it and integrate `design/redesign` into `main` locally.

**Architecture:** Two parallel tracks from `design/redesign`. Track W rewires `web/app/**` onto the v2 kit: an `(app)` layout that mounts a client `AppFrame` (AppShell + next/link + shared account selection + logout), BrandShell for the public pages, and screen components re-composed exactly as the approved `web/.design-sync/previews/AppShell.tsx` stories but fed by the real TanStack Query reads and Server Actions. Track M moves the Expo Router tree to `(app)/(tabs)` (Inicio, Movimientos) with the transfer flow as stack screens outside the tabs, and splits every screen into a route-aware container (`*-screen.tsx`) and a pure view (`*-view.tsx`, props only) that renders what `mobile/.design-sync/previews/Screen.tsx` renders. After both tracks merge, Phase 8 captures the real screens (web: real Next app against a fake API with Playwright; mobile: the pure views inside the design-sync react-native-web harness), compares them with the approved stories, updates docs and design-sync, and merges to `main` with `--no-ff` (never pushed).

**Tech Stack:** Next.js 16 App Router + React 19 + Tailwind v4 + TanStack Query 5 + react-hook-form (web), Vitest + Testing Library + vitest-axe (web unit/DOM), `@playwright/test` 1.61.1 (web e2e, new devDependency, chromium-1228 already cached), Expo SDK 57 + expo-router 57 (`expo-router/js-tabs`) + React Native 0.86 (mobile), Jest + jest-expo + RNTL 14 (mobile), design-sync + react-native-web 0.21 + Playwright 1.61.1 + pixelmatch/pngjs from `.ds-sync/` (canvases and parity).

**Spec:** `openspec/changes/redesign/` — `proposal.md`, `design.md` (D1–D10), `specs/design-system/spec.md` (DSG-13…17), `specs/web-app/spec.md` (WEB-24…31), `specs/mobile-app/spec.md` (MOB-18…22), `tasks.md` (this plan covers Phase B: tasks 6.1–6.7, 7.1–7.5, 8.1–8.4; one plan task per `tasks.md` item, same numbers). Behaviors that must survive: `openspec/changes/web-app/specs/web-app/spec.md` (WEB-01…WEB-23) and `openspec/changes/mobile-app/specs/mobile-app/spec.md` (MOB-01…MOB-17). Binding rulings: `.superpowers/sdd/plan-phase-a/global-constraints.md` and the `Ruling:` lines of `.superpowers/sdd/plan-phase-a/progress.md` (R1–R46); Phase A final review: `.superpowers/sdd/plan-phase-a/final-review.md`.

**Visual source of truth:** web — every exported story of `web/.design-sync/previews/AppShell.tsx` (and `BrandShell.tsx`); mobile — every exported story of `mobile/.design-sync/previews/Screen.tsx` (and `BrandScreen.tsx`), as they are on `design/redesign` when Phase B starts (after the Phase A fix wave below). Each real screen renders what its story renders, wired to real data; where a binding requirement adds something the story does not show (named in the task), the requirement wins and 8.1 classifies it "por diseño".

**Execution order:** P0 (controller pre-flight, including the merge of `main` into `design/redesign` — R42) → in parallel: Track W `6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6 → 6.7` and Track M `7.1 → 7.2 → 7.3 → 7.4 → 7.5` → merge both into `design/redesign` → `8.1 → 8.2 → 8.3 → 8.4`.

## Global Constraints

Carried over from Phase A (still binding):
- All UI copy in Spanish (es-MX). Code comments in Spanish, matching the repo.
- No component defines its own colors, sizes, spacing or radii: everything comes from `@devchrisvaz/wallet-design-tokens` (DSG-01). On web that means token utilities (`bg-surface-hero`, `text-fg-on-hero-muted`, …) or `var(--dt-*)`; on mobile, `theme.*` (R3: 48→`theme.spacing[12]`, 32→`[8]`, 64→`[16]`, 40→`[10]`, 4→`[1]`). The mobile scan `src/__tests__/design-system-usage.test.ts` must keep passing.
- Lime (`#B4E717`) only on dark surfaces; never text on light surfaces (DSG-14). Text contrast ≥ 4.5:1, UI boundaries ≥ 3:1 (DSG-04). Touch targets ≥ 44 px (R15).
- Interactive elements on dark surfaces add `focus-visible:outline-accent-on-dark` (R13).
- Money is a decimal string end to end; arithmetic only with `toCents` / `centsToDecimalString` from `@devchrisvaz/wallet-contract` (BigInt). Never `Number`, `parseFloat` or float math on amounts. Totals with `sumAmounts` (`web/lib/money.ts`, `mobile/src/lib/display.ts`).
- Dates shown in `America/Mexico_City`; day grouping only through `groupByDay`/`dayLabel` of the tokens package (I-3 fix: lazy formatters, UTC−6 fallback, fixed Spanish month table).
- Existing component APIs stay source-compatible: only additive optional props (each kit change below is additive and named in its task).
- Lucide pinned at exactly `1.48.0`; `react-native-svg` at `15.15.4`. No new runtime dependency in either app. The only new dependency of Phase B is the web devDependency `@playwright/test@1.61.1` (Task 6.7).
- Projects stay independent: no cross-project imports; web and mobile consume tokens via `file:../design-tokens` with `install-links=true`.
- One `<h1>` exposed per page at every width (R17): with AppShell mounted, the shell owns the page `h1` (phone: AppHeader greeting/title; desktop: TopBar; flow: FlowHeader) and screens never render their own `h1`.
- Commits: Conventional Commits with the project as scope; trailers `Task: redesign#<n.m>` and `Refs: <IDs>`; last line `Co-Authored-By: Claude <Model> 5.5 <noreply@anthropic.com>` naming the model that authored the commit (R8). One task = one commit or more, never one commit for two tasks. Test titles start with the requirement ID. `git add` explicit paths only (never `-A`/`.`).
- R7 gates before every commit, in the touched project: `npm run format:check && npm run lint && npm run typecheck && npm test` (fix formatting with `npm run format`). All must exit 0.

New for Phase B:
- Phase A's restriction on `web/app/**`, `web/components/{auth,accounts,beneficiaries,transfers}/**`, `mobile/src/app/**`, `mobile/src/features/**`, `mobile/src/navigation/**` is lifted: those are what Phase B edits.
- Existing behavior tests keep passing. A test is changed only when a requirement of this change supersedes what it pins; the task then names the test and the superseding ID (e.g. "superseded by WEB-30: the step title lives in FlowHeader"). Assertions about API calls, payloads, idempotency keys, cursors, error messages by `code` and focus movement are never weakened — only relocated (new role/name/region).
- No API or contract changes: the clients use only existing endpoints (`GET /me` and `?limit=` already exist in `contract/openapi.yaml`). `contract/**`, `api/**` and `design-tokens/**` are read-only for both tracks.
- `problemMessage(code)` texts and the copy derived from it (`describeProblem`, `errorMessage`) are unchanged. Screen titles, step titles, button labels and state copy follow the approved stories (D8, WEB-25); where a story's copy differs from today's, the task lists the test it updates.
- Parity rule (WEB-25): a real web screen at 390 px is compared with its mobile pair; differences are fixed unless they are one of the agreed "por diseño" cases listed in `web/.design-sync/NOTES.md` ("Paridad") or named in this plan.
- Ruling R36 (controller): the stepper total switching from 5 to 4 once the amount is known (no code needed) stays as approved.
- Ruling R37: the web adopts the approved stories' copy and warning tone for the uncertain state and the failed step; per-code `problemMessage` texts stay unchanged; every test updated for those titles cites WEB-30.
- Ruling R38: the web recipient step lists **all** own accounts (Principal and Ahorro) plus the beneficiaries; with an own-account recipient, the amount step's origin excludes it and defaults to the other account; a `?from=` still preselects the origin unless it is the recipient. 8.1 marks the extra own-account row "por diseño (R38)".
- Ruling R39: `@playwright/test@1.61.1` is accepted as a web devDependency, run only by `npm run test:e2e`.
- Ruling R40: the mobile container/view split (pure `*-view.tsx`, guarded by a test) and the Stepper single-announcement fix are accepted.
- Ruling R41: 8.4 merges into `main` in the main checkout only after every gate passes and only if `git status` there is clean (otherwise stop and report); afterwards `npm install` (never `npm ci`) in the main checkout's `design-tokens`, `web` and `mobile`; never stop, restart or kill the user's processes (Expo 8081, API 4000, anything else); never push; the final report tells the user to restart Expo with `--clear`.
- Ruling R42: `main` moved tonight (another local session: contract 1.2.0; tokens 1.1.0 with `transferStatus` SCHEDULED/CANCELLED and new `problemMessages`; the bonus specs; ai-log "Sesión 4 — Bonus"; the mobile biometric unlock). P0 merges `main` into `design/redesign` before the tracks branch, sets design-tokens to **1.2.0** (two independent additive 1.1.0 lines) and reinstalls; the redesign's ai-log entry is "Sesión 5"; 8.4 merges `main` again, re-gates, restyles with the kit any bonus UI that came in, and merges into `main` only if the checkout is clean, on `main`, `main` did not move during the gates and nothing conflicts — otherwise it stops and leaves `design/redesign` ready with a report.
- Ruling R43 (amends R34): the undo instruction is `git reset --hard <PRE_MERGE>` with the SHA recorded right before the merge, never `2713c6e` (that would delete the bonus commits).
- Ruling R44: where spec text and the approved stories differ, the stories win — WEB-26 ("Agregar beneficiario" as the Beneficiarios top-bar action), WEB-25 (Register without a fixed footer), WEB-29/D9 (centered filters panel on desktop); 8.1 records the three as "por diseño" in `web/.design-sync/NOTES.md`.
- Ruling R45: every pre-flight finding (`plan-phase-b-preflight.md` #1–#31) is applied as written, except #1's version (→ R42: 1.2.0) and #21 (→ R44).
- Ruling R46: the redesign keeps the biometric unlock intact — `src/app/_layout.tsx` keeps `<UnlockGate>` wrapping the navigator, above what restores the session (MOB-25: no `/auth/refresh` before unlocking); `navigation/root-navigator.tsx` keeps exporting `StartupLoading`; `login-screen.tsx` keeps `unlockPreference.offerAfterLogin()` after a password login; Home keeps `<UnlockOffer />` restyled with the kit; `<UnlockSwitch />` moves into the account-menu BottomSheet next to "Cerrar sesión"; every unlock test stays green.
- Worktrees: R4's Phase A worktree paths are superseded. Phase B uses only `.claude/worktrees/design-redesign-b-web` (`design/redesign-b-web`), `.claude/worktrees/design-redesign-b-mobile` (`design/redesign-b-mobile`) and, for 8.x, `.claude/worktrees/design-redesign` (`design/redesign`); never commit to `design/redesign-web` or `design/redesign-mobile`, and never touch another session's worktrees or processes.
- Kit changes made by a track stay inside that track's app. A track never edits the other app, `design-tokens`, `contract`, `api`, `docs`, `openspec` or any `.design-sync/` folder (those belong to Phase 8 on the merged branch).

## Review Focus

The five likeliest failure modes that the existing suites would not catch, each pinned to a test in its owning task:

1. **Double submit after the flow is split into steps** — the "Enviar" button moves into a fixed `StepActions` footer and `ConfirmStep` is rebuilt; the synchronous `inFlight` lock and the single idempotency key per attempt must survive. Pinned: Task 6.5 `WEB-30 WEB-17 con doble clic en "Enviar" en la revisión crea una sola transferencia y el botón indica que se envía`; Task 7.5 keeps `MOB-09 un doble toque en Enviar hace una sola petición y el botón queda deshabilitado` green on the new footer.
2. **Session expiry mid-flow** — the step flow now lives under the `(app)` client frame; a `401` from `createTransfer` must still send the user to `/login?next=%2Ftransfers%2Fnew&reason=expired` instead of showing a generic rejection. Pinned: Task 6.5 `WEB-22 si la sesión terminó al enviar, lleva al inicio de sesión con el regreso al flujo`.
3. **Keyboard trap in the filters sheet** — date inputs inside `BottomSheet`: Tab must stay inside, Escape inside a date field must not close the sheet (it dismisses the field's picker), Escape elsewhere closes and returns focus to "Filtros", and the page behind must not scroll. Pinned: Task 6.4 `DSG-17 WEB-29 Escape en una fecha no cierra la hoja; en otro control la cierra y el foco vuelve a "Filtros"` and `DSG-17 con la hoja abierta la página no se desplaza detrás` (jsdom), Task 6.7 `DSG-17 WEB-29 la hoja de filtros atrapa el foco…` (real browser).
4. **CDMX midnight and new-year grouping on the real lists** — a movement at `05:30Z` is "Ayer" in CDMX; on 1 January a movement of 31 December 23:30 CDMX is "Ayer", not "31 dic 2025". Pinned: Task 6.4 `WEB-29 agrupa por día de Ciudad de México…`, Task 7.4 `MOB-20 un movimiento de las 05:30 UTC de hoy aparece bajo "Ayer"` and `MOB-20 el 1 de enero, un movimiento de las 23:30 del 31 de diciembre aparece bajo "Ayer"`.
5. **Horizontal overflow at 320 px and clipped hero amounts with large text** — long names, the fixed step footer, the 4-tab bar and the hero at 200 % text must never make the page scroll sideways or cut the balance. Pinned: Task 6.7 `WEB-24 WEB-23 a <width> px ninguna pantalla se desplaza a lo ancho…` and `WEB-28 con el texto al 200 % el saldo del hero no se corta`; Tasks 6.3/7.3 hero tests (M-5).

---

## Execution layout

### P0 — Controller pre-flight (before dispatching any Phase B task)

- [ ] **P0.1 Fix wave.** Confirm the Phase A fix wave is committed on `design/redesign` (I-1 MovementRow time-only prop passed by MovementList, I-2 mobile MovementRow accessibility label with "· Ref.", I-3 tokens `dates.ts` lazy formatters + UTC−6 fallback + month table, M-1 Receipt icon from `toneIcon`, M-2 web DailyLimitMeter header opt-in, M-9 mobile hero mirror width cap + `focusRing.width`, RNW `aria-hidden` fix).
- [ ] **P0.2 Merge `main` (R42).** In `.claude/worktrees/design-redesign` (`WT`):
```bash
cd "$WT" && git status --short            # must print nothing
git merge --no-ff main -m "merge: main (bonus specs, contract 1.2.0, design-tokens states, biometric unlock) into design/redesign"
```
  Then: set `design-tokens/package.json` `version` to `1.2.0` (two independent additive 1.1.0 lines) and the version line of `design-tokens/README.md`; regenerate the outputs with the package's own scripts (`cd design-tokens && npm run generate`); `npm install` (not `ci`) in `contract`, `design-tokens`, `web` and `mobile` (in that order) so the `file:` copies and the lockfiles match; commit (`chore(design-tokens): release 1.2.0 with the redesign and the bonus states` with `design-tokens/{package.json,package-lock.json,README.md,generated/*,preview/index.html}` as touched, then `chore(web): reinstall the shared packages` and `chore(mobile): reinstall the shared packages` with each app's `package-lock.json`; `Task: redesign#P0`, `Refs: DSG-16`). If the merge conflicts in a file the redesign changed, stop and report (no track starts).
- [ ] **P0.3 Gates on the merged branch.** `contract`: `npm run format:check && npm run lint && npm run typecheck && npm test`; `design-tokens`: the same plus `npm run generate && git diff --exit-code generated/`; `web`, `mobile`: R7. `api`: unchanged by the redesign; its unit tests run without services — `cd api && npm ci && npm run lint && npm run typecheck && npm run test:unit` (the integration project needs PostgreSQL and `.env`; skip it here, it is not affected). All must exit 0.
- [ ] **P0.4 Canvases and base.** After the fixer's last commit and the merge, rebuild both canvases once with the 8.1 Step 3 commands, `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4310/web/.canvas.html` and `/mobile/.canvas.html` (200 each), and record the HEAD as `PHASE_B_BASE` in `progress.md`. If 4310 does not answer, start it in the background (Phase A's command): `(cd "$WT" && node web/.design-sync/review/serve.mjs --web web/ds-bundle --mobile mobile/ds-bundle --port 4310)`; never stop it.
- [ ] **P0.5** From here on do **not** rebuild `web/ds-bundle` or `mobile/ds-bundle` in `$WT` until Task 8.1 Step 1 has captured the approved baseline (the review server serves those folders).
- [ ] **P0.6** Create the track worktrees from the repo root (`/home/morgan-desktop/Projects/Coding Assignments/Treo`):

```bash
cd "/home/morgan-desktop/Projects/Coding Assignments/Treo"
git worktree add .claude/worktrees/design-redesign-b-web -b design/redesign-b-web design/redesign
git worktree add .claude/worktrees/design-redesign-b-mobile -b design/redesign-b-mobile design/redesign
for WT in .claude/worktrees/design-redesign-b-web .claude/worktrees/design-redesign-b-mobile; do
  (cd "$WT/contract" && npm ci && npm run build)
  (cd "$WT/design-tokens" && npm ci && npm run build)
done
(cd .claude/worktrees/design-redesign-b-web/web && npm ci)
(cd .claude/worktrees/design-redesign-b-mobile/mobile && npm ci)
```
Expected: both installs succeed; `npm test` passes in each app before any change (record the counts). The mobile tree now contains the biometric unlock (`src/features/unlock/*`, `src/session/unlock-preference.ts`, `__mocks__/expo-local-authentication.ts`, `src/test-utils/render-root.tsx`, `expo-local-authentication`): Track M keeps it intact (R46).

### Tracks and file ownership

| Track | Worktree | Branch | Tasks | Owns (may edit) | Never edits |
|---|---|---|---|---|---|
| W | `.claude/worktrees/design-redesign-b-web` | `design/redesign-b-web` | 6.1 → 6.7 | `web/**` except `web/.design-sync/**` | `mobile/**`, `design-tokens/**`, `contract/**`, `api/**`, `docs/**`, `openspec/**`, `.gitignore` (root), any `.design-sync/` |
| M | `.claude/worktrees/design-redesign-b-mobile` | `design/redesign-b-mobile` | 7.1 → 7.5 | `mobile/**` except `mobile/.design-sync/**` | `web/**`, `design-tokens/**`, `contract/**`, `api/**`, `docs/**`, `openspec/**`, `.gitignore` (root), any `.design-sync/` |
| Close | `.claude/worktrees/design-redesign` | `design/redesign` | 8.1 → 8.4 | everything above plus `web/.design-sync/**`, `mobile/.design-sync/**`, `docs/ai-log.md`, `openspec/changes/redesign/tasks.md`, design-tokens comments/tests (8.3/8.4) | `api/**`, `contract/**` |

Within a track, tasks run sequentially in one worktree (one implementer per task, a reviewer after each). Kit changes are allowed only inside the track's own app and only the ones named in the task.

### Merge (controller, after 6.7 and 7.5 are complete and reviewed)

```bash
cd "/home/morgan-desktop/Projects/Coding Assignments/Treo/.claude/worktrees/design-redesign"
git merge --no-ff design/redesign-b-web -m "merge: design/redesign-b-web (Phase B web screens) into design/redesign"
(cd web && npm ci && npm run format:check && npm run lint && npm run typecheck && npm test)
git merge --no-ff design/redesign-b-mobile -m "merge: design/redesign-b-mobile (Phase B mobile screens) into design/redesign"
(cd mobile && npm ci && npm run format:check && npm run lint && npm run typecheck && npm test)
```
Expected: both merges clean (disjoint folders). If a merge conflicts, it can only be in a file outside the ownership table — stop and rule.

## Working conventions

- `WT_W="/home/morgan-desktop/Projects/Coding Assignments/Treo/.claude/worktrees/design-redesign-b-web"`, `WT_M="…/design-redesign-b-mobile"`, `WT="…/design-redesign"`. Commands run from `$WT_x/<app>` unless stated otherwise.
- Web single test: `npx vitest run <path>`; web e2e (Task 6.7 on): `npm run test:e2e` (starts the fake API and `next dev` itself). Mobile single test: `npx jest <path>`.
- Web test doubles: `vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }))`, `vi.mock('next/navigation', () => import('@/test/support/next-navigation'))` (`router`, `setLocation`), `renderWithClient` from `@/test/support/render`, fixtures `USER`, `PRINCIPAL` (CLABE …9719), `AHORRO` (…9722), `OVERVIEW` (remaining `38000.00`), `BENEFICIARY` (Luis, …9735), `movement()`, `transfer()`, `pendingOtpTransfer()`, `problem()` from `@/test/fixtures`.
- Mobile test doubles: `createFakeApi().on(method, path, ...replies)`, `json`, `problem` from `@/test-utils/fake-api`; `renderApp({ fake, routes, initialUrl })` from `@/test-utils/render-app` (routes are relative to the app root, e.g. `'transfer/send'`, `'(tabs)/movements'`); fixtures `principal`, `ahorro`, `overview()`, `luis`, `mama` from `@/test-utils/fixtures`; `transfer()` from `@/test-utils/transfer-fixtures`. RNTL 14: `await render(...)`, `await fireEvent.press(...)`.
- Commit template (one per task unless the task splits it):

```bash
git add <explicit paths>
git commit -F - <<'EOF'
<type>(<scope>): <subject in English, imperative, lower case>

Task: redesign#<n.m>
Refs: <IDs>
Co-Authored-By: Claude <Model> 5.5 <noreply@anthropic.com>
EOF
```

## File structure (Phase B)

**`/web`**
- Create `components/layout/AppFrame.tsx` (+ `AppFrame.test.tsx`), `components/ui/RouterLink.tsx`, `components/ui/StepActions.tsx`, `lib/client/account-selection.tsx` (+ test), `lib/client/transfer-steps.ts` (+ test), `components/accounts/MovementsIndexScreen.tsx` (+ test), `components/accounts/MovementFilters.tsx`, `components/transfers/RecipientStep.tsx` (+ test), `components/transfers/TransferSummary.tsx`, `app/(app)/movements/page.tsx`, `app/(public)/public-pages.test.ts`, `test/screens.a11y.test.tsx`, `playwright.config.ts`, `e2e/fake-api.mjs`, `e2e/support.ts`, `e2e/layout.spec.ts`, `e2e/keyboard.spec.ts`, `e2e/overlays.spec.ts`, `e2e/a11y.spec.ts`, `.gitignore`.
- Rename `components/layout/PageShell.tsx` → `components/layout/SkipLink.tsx` and `PageShell.test.tsx` → `SkipLink.test.tsx` (the `PageShell` component is deleted; `SkipLink` and `MAIN_CONTENT_ID` stay).
- Delete `components/layout/AppHeader.tsx`, `components/layout/AppHeader.test.tsx` (AppNav/LogoutButton; their WEB-05 tests move to `AppFrame.test.tsx`).
- Modify `app/layout.tsx`, `app/(app)/layout.tsx` (+ test), `app/(public)/layout.tsx`, every page under `app/(app)` and `app/(public)`, `app/(public)/login/page.test.ts`, every screen under `components/{auth,accounts,beneficiaries,transfers}` and its tests, `components/layout/{AppShell,BrandShell,shells.test}.tsx`, kit `components/ui/{TabBar,SideNav,Icon,QuickActions,FlowHeader,Stepper,BottomSheet,MovementList,AccountCard,BalanceHero,Receipt}.tsx` and their tests (`navigation`, `icons`, `home`, `overlays`, `data`), `lib/navigation.ts` (+ test), `lib/client/{queries,query-keys,transfer-flow}.ts` (+ test), `test/support/transfer-flow.ts`, `test/accessibility.test.tsx`, `package.json`, `package-lock.json`.

**`/mobile`**
- Create `src/app/(app)/(tabs)/_layout.tsx`, `src/app/(app)/(tabs)/movements.tsx`, `src/navigation/app-tab-bar.tsx`, `src/navigation/startup-views.tsx`, `src/navigation/__tests__/tabs.test.tsx`, `src/features/accounts/selection.tsx` (+ test), `src/features/accounts/account-header.ts`, `src/features/accounts/home-view.tsx`, `src/features/accounts/movements-view.tsx`, `src/features/auth/login-view.tsx`, `src/features/transfer/recipient-view.tsx`, `src/features/transfer/transfer-flow-view.tsx`, `src/features/transfer/flow-steps.ts` (+ test), `src/features/transfer/retry-limits.ts`, `src/lib/loadable.ts`, `src/__tests__/views-are-pure.test.ts`.
- Move `src/app/(app)/index.tsx` → `src/app/(app)/(tabs)/index.tsx`; delete `src/app/(app)/accounts/[accountId].tsx`, `src/features/transfer/attempt-actions.tsx` (folded into the flow view).
- Modify `src/app-services.tsx`, `src/components/screen.tsx` (+ test), kit `src/components/ui/{tab-bar,icon,button,stepper,balance-hero}.tsx` and tests (`navigation`, `overlays`, `home`, `controls`), `src/features/accounts/{home-screen,movements-screen,queries}.ts(x)` and tests, `src/features/auth/login-screen.tsx` (+ test), `src/features/transfer/{beneficiary-picker-screen,transfer-flow-screen,form-view,review-view,otp-view,outcome-view,transfer-attempt}.ts(x)` and tests, `src/navigation/root-navigator.tsx`, `src/test-utils/fixtures.ts`.

**Close (merged branch)** — `web/.design-sync/{tailwind.css,conventions.md,NOTES.md,config.json,entry.ts,previews/*,review/parity-real.mjs}`, `mobile/.design-sync/{config.json,entry.ts,conventions.md,NOTES.md,previews/Screen.tsx,previews/*}`, `web/README.md`, `mobile/README.md`, `design-tokens/README.md`, `design-tokens/src/scale.ts` (comment), `design-tokens/test/tokens.test.ts`, `design-tokens/test/fixtures/tokens-1.0.0.css`, `docs/ai-log.md`, `openspec/changes/redesign/tasks.md`.

---
## Task 6.1: Web `(app)` and `(public)` layouts on the new shells and navigation

Track W. Mounts AppShell (via a client `AppFrame`) on every signed-in page, routes the kit's internal links through `next/link`, adds the `/movements` route that `DEFAULT_NAV_ITEMS` expects, shares the selected account between Home and Movements, moves logout to the side nav and the avatar menu, and removes the screens' own `h1`s (R17). The `(public)` layout is simplified in 6.2, together with the public pages' move to BrandShell.

**Files:**
- Create: `web/components/ui/RouterLink.tsx`, `web/components/layout/AppFrame.tsx`, `web/components/layout/AppFrame.test.tsx`, `web/lib/client/account-selection.tsx`, `web/lib/client/account-selection.test.tsx`, `web/components/accounts/MovementsIndexScreen.tsx`, `web/components/accounts/MovementsIndexScreen.test.tsx`, `web/app/(app)/movements/page.tsx`
- Modify: `web/components/ui/TabBar.tsx`, `web/components/ui/SideNav.tsx`, `web/components/ui/Icon.tsx` (`IconButton` href branch), `web/components/ui/QuickActions.tsx`, `web/components/ui/navigation.test.tsx`, `web/components/ui/home.test.tsx`, `web/components/layout/AppShell.tsx`, `web/components/layout/shells.test.tsx`, `web/lib/navigation.ts`, `web/lib/navigation.test.ts`, `web/app/(app)/layout.tsx`, `web/app/(app)/layout.test.ts`, `web/components/accounts/AccountsOverviewScreen.tsx`, `web/components/accounts/MovementsScreen.tsx`, `web/components/beneficiaries/BeneficiariesScreen.tsx`, `web/app/(app)/beneficiaries/new/page.tsx`, `web/app/(app)/transfers/[transferId]/page.tsx`
- Delete: `web/components/layout/AppHeader.tsx`, `web/components/layout/AppHeader.test.tsx` (AppNav/LogoutButton are replaced by SideNav, TabBar and the avatar menu; their WEB-05 cases move to `AppFrame.test.tsx`; the AppNav `aria-current` case is superseded by WEB-26/WEB-27; its `WEB-23 no tiene problemas de accesibilidad` axe case is replaced by the axe case added to `AppFrame.test.tsx` below)

**Interfaces:**
- Consumes: `AppShell({ current, title, primaryAction, user, onLogout, mode, items, children })` and `DEFAULT_NAV_ITEMS` (`components/layout/AppShell.tsx`); `TabBar`, `SideNav`, `NavItem` (`components/ui/TabBar.tsx`, `SideNav.tsx`); `buttonClasses` (`components/ui/Button.tsx`); `logout` (`app/actions/auth.ts`); `useAccountsOverview` (`lib/client/queries.ts`); `LoadingState`, `ErrorState` (`components/states/states.tsx`); `EmptyState` (`components/ui/EmptyState.tsx`); `NavDestination` (tokens).
- Produces: `RouterLink(props: RouterLinkProps)`, `RouterLinkProvider`, `type RouterLinkProps`, `type LinkComponent`; `AppFrame({ user, children })`, `useLogout()`; `appSection(pathname): AppSection` with `interface AppSection { current: NavDestination | null; title: string; mode: 'tabs' | 'flow'; primary: 'transfer' | 'beneficiary' }`; `AccountSelectionProvider`, `useAccountSelection(): { accountId: string | null; select(accountId: string): void }`, `selectedAccount(accounts, accountId)`; `MovementsIndexScreen()`; route `/movements`.

- [ ] **Step 1: Write the failing tests**

`web/lib/navigation.test.ts` — append the `describe` (keep the existing `safeNextPath`/`loginPath` cases; merge the `import` into the file's top imports):
```ts
import { appSection } from './navigation';

const ID = '0b7d6f5e-4c3b-4a29-8187-6f5e4d3c2b1a';

describe('appSection', () => {
  it.each([
    ['/', { current: 'home', title: 'Inicio', mode: 'tabs', primary: 'transfer' }],
    ['/movements', { current: 'movements', title: 'Movimientos', mode: 'tabs', primary: 'transfer' }],
    [`/accounts/${ID}/movements`, { current: 'movements', title: 'Movimientos', mode: 'tabs', primary: 'transfer' }],
    ['/transfers/new', { current: 'transfer', title: 'Transferir', mode: 'flow', primary: 'transfer' }],
    [`/transfers/${ID}`, { current: null, title: 'Transferencia', mode: 'tabs', primary: 'transfer' }],
    ['/beneficiaries', { current: 'beneficiaries', title: 'Beneficiarios', mode: 'tabs', primary: 'beneficiary' }],
    ['/beneficiaries/new', { current: 'beneficiaries', title: 'Agregar beneficiario', mode: 'tabs', primary: 'transfer' }],
  ] as const)('WEB-26 WEB-27 %s tiene su destino, su título y su forma', (path, expected) => {
    expect(appSection(path)).toEqual(expected);
  });
});
```

`web/lib/client/account-selection.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AHORRO, PRINCIPAL } from '@/test/fixtures';
import { AccountSelectionProvider, selectedAccount, useAccountSelection } from './account-selection';

function Chooser({ label }: { label: string }) {
  const { accountId, select } = useAccountSelection();
  return (
    <button type="button" onClick={() => select(AHORRO.id)}>
      {label}: {accountId ?? 'ninguna'}
    </button>
  );
}

describe('selección de cuenta', () => {
  it('WEB-28 WEB-29 con el proveedor, Inicio y Movimientos comparten la cuenta elegida', async () => {
    render(
      <AccountSelectionProvider>
        <Chooser label="Inicio" />
        <Chooser label="Movimientos" />
      </AccountSelectionProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Inicio/ }));
    expect(screen.getByRole('button', { name: /^Movimientos/ })).toHaveTextContent(AHORRO.id);
  });

  it('WEB-28 sin proveedor la selección es local al componente', async () => {
    render(<Chooser label="Inicio" />);
    expect(screen.getByRole('button')).toHaveTextContent('ninguna');
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent(AHORRO.id);
  });

  it('WEB-28 si la cuenta elegida ya no existe, se usa la primera', () => {
    expect(selectedAccount([PRINCIPAL, AHORRO], AHORRO.id)).toBe(AHORRO);
    expect(selectedAccount([PRINCIPAL, AHORRO], 'otra')).toBe(PRINCIPAL);
    expect(selectedAccount([PRINCIPAL, AHORRO], null)).toBe(PRINCIPAL);
    expect(selectedAccount([], null)).toBeUndefined();
  });
});
```

`web/components/layout/AppFrame.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logout } from '@/app/actions/auth';
import { queryKeys } from '@/lib/client/query-keys';
import { OVERVIEW, PRINCIPAL } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { AppFrame } from './AppFrame';

vi.mock('@/app/actions/auth', () => ({ logout: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));
// Marca los enlaces de next/link para distinguirlos de un <a> que recargaría la página.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>
      {children}
    </a>
  ),
}));

const logoutMock = vi.mocked(logout);
const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };

function renderFrame(path: string) {
  setLocation(path);
  return renderWithClient(
    <AppFrame user={USER}>
      <p>Contenido</p>
    </AppFrame>,
  );
}

function sideNav(): HTMLElement {
  const aside = screen.getAllByRole('navigation', { name: 'Principal' })[0]?.closest('aside');
  if (!aside) throw new Error('Sin navegación lateral');
  return aside;
}

beforeEach(() => {
  logoutMock.mockReset();
});

describe('AppFrame', () => {
  it('WEB-26 WEB-27 en Movimientos marca el destino actual en la navegación lateral y en las pestañas', () => {
    renderFrame(`/accounts/${PRINCIPAL.id}/movements`);
    const [side, tabs] = screen.getAllByRole('navigation', { name: 'Principal' });
    expect(within(side!).getByRole('link', { name: 'Movimientos' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs!).getAllByRole('link')).toHaveLength(4);
    const tab = within(tabs!).getByRole('link', { name: 'Movimientos' });
    expect(tab).toHaveAttribute('aria-current', 'page');
    expect(tab).toHaveAttribute('href', '/movements');
    expect(within(tabs!).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('WEB-24 los destinos y la acción principal navegan con next/link, sin recargar la página', () => {
    renderFrame('/');
    for (const link of screen.getAllByRole('link', { name: 'Beneficiarios' })) {
      expect(link).toHaveAttribute('data-next-link');
    }
    const primary = screen.getByRole('link', { name: 'Nueva transferencia' });
    expect(primary).toHaveAttribute('href', '/transfers/new');
    expect(primary).toHaveAttribute('data-next-link');
  });

  it('WEB-26 en Beneficiarios la acción principal es "Agregar beneficiario"', () => {
    renderFrame('/beneficiaries');
    expect(screen.getByRole('link', { name: 'Agregar beneficiario' })).toHaveAttribute(
      'href',
      '/beneficiaries/new',
    );
  });

  it('WEB-27 en el flujo de transferencia no hay pestañas ni menú de la cuenta', () => {
    renderFrame('/transfers/new');
    expect(screen.getAllByRole('navigation', { name: 'Principal' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Menú de la cuenta' })).not.toBeInTheDocument();
  });

  it('WEB-23 en Inicio el saludo es el h1 de la forma de app y "Inicio" el del dashboard', () => {
    renderFrame('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument();
  });

  it('WEB-26 WEB-05 "Cerrar sesión" de la navegación lateral cierra la sesión, borra la caché y lleva al inicio de sesión', async () => {
    logoutMock.mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    const { client } = renderFrame('/');
    client.setQueryData(queryKeys.accounts, OVERVIEW);

    await user.click(within(sideNav()).getByRole('button', { name: 'Cerrar sesión' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(client.getQueryData(queryKeys.accounts)).toBeUndefined();
  });

  it('WEB-27 WEB-05 el menú del avatar cierra la sesión', async () => {
    logoutMock.mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    renderFrame('/');

    await user.click(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByRole('dialog', { name: 'Tu cuenta' });
    await user.click(within(sheet).getByRole('button', { name: 'Cerrar sesión' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  it('WEB-05 aunque la acción falle, lleva al inicio de sesión', async () => {
    logoutMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderFrame('/');
    await user.click(within(sideNav()).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  it('WEB-05 un doble clic en "Cerrar sesión" cierra la sesión una sola vez', async () => {
    logoutMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderFrame('/');
    await user.dblClick(within(sideNav()).getByRole('button', { name: 'Cerrar sesión' }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('WEB-23 la estructura de la app no tiene problemas de accesibilidad', async () => {
    const { container } = renderFrame('/');
    // jsdom no aplica `display: none`: las dos navegaciones y los dos encabezados están a la vez en el DOM
    // (lo cubre e2e/a11y.spec.ts en la tarea 6.7).
    expect(
      await axe(container, { rules: { 'landmark-unique': { enabled: false }, 'landmark-no-duplicate-banner': { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
```
(Add `import { axe } from 'vitest-axe';` to the file's top imports.)

`web/components/accounts/MovementsIndexScreen.test.tsx`:
```tsx
import { waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffGet } from '@/lib/client/bff';
import { AccountSelectionProvider, useAccountSelection } from '@/lib/client/account-selection';
import { AHORRO, OVERVIEW, PRINCIPAL } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { MovementsIndexScreen } from './MovementsIndexScreen';

vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

beforeEach(() => {
  vi.mocked(bffGet).mockReset();
  vi.mocked(bffGet).mockResolvedValue(OVERVIEW);
  setLocation('/movements');
});

function ChooseAhorro() {
  const { select } = useAccountSelection();
  useEffect(() => select(AHORRO.id), [select]);
  return null;
}

describe('MovementsIndexScreen', () => {
  it('WEB-29 /movements abre el historial de la primera cuenta', async () => {
    renderWithClient(<MovementsIndexScreen />);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/accounts/${PRINCIPAL.id}/movements`),
    );
  });

  it('WEB-28 WEB-29 /movements abre el historial de la cuenta elegida en Inicio', async () => {
    renderWithClient(
      <AccountSelectionProvider>
        <ChooseAhorro />
        <MovementsIndexScreen />
      </AccountSelectionProvider>,
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenLastCalledWith(`/accounts/${AHORRO.id}/movements`),
    );
    expect(router.replace).not.toHaveBeenCalledWith(`/accounts/${PRINCIPAL.id}/movements`);
  });
});
```

`web/components/ui/navigation.test.tsx` — append (reuse the file's `WEB_ITEMS` and `USER`; merge the `import` into the file's top imports):
```tsx
import { RouterLinkProvider, type RouterLinkProps } from './RouterLink';

function AppLink({ children, ...props }: RouterLinkProps) {
  return (
    <a data-app-link="" {...props}>
      {children}
    </a>
  );
}

describe('RouterLink', () => {
  it('WEB-24 con el proveedor de la app, pestañas y navegación lateral usan su enlace', () => {
    render(
      <RouterLinkProvider value={AppLink}>
        <TabBar items={WEB_ITEMS} current="home" position="static" />
        <SideNav items={WEB_ITEMS} current="home" user={USER} />
      </RouterLinkProvider>,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(8);
    for (const link of links) expect(link).toHaveAttribute('data-app-link');
  });

  it('WEB-24 sin proveedor (lienzos de design-sync) son enlaces <a> normales', () => {
    render(<TabBar items={WEB_ITEMS} current="home" position="static" />);
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('data-app-link');
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
  });
});
```

`web/components/ui/home.test.tsx` — append (add `IconButton` from `./Icon` and `RouterLinkProvider`/`RouterLinkProps` from `./RouterLink` to the file's top imports, and define the same `AppLink` helper):
```tsx
describe('enlaces internos del kit', () => {
  it('WEB-24 las acciones rápidas y el botón de icono con destino usan el enlace de la app', () => {
    render(
      <RouterLinkProvider value={AppLink}>
        <QuickActions actions={[{ key: 't', label: 'Transferir', icon: 'transfer', href: '/transfers/new' }]} />
        <IconButton icon="close" label="Salir de la transferencia" href="/" />
      </RouterLinkProvider>,
    );
    expect(screen.getByRole('link', { name: 'Transferir' })).toHaveAttribute('data-app-link');
    expect(screen.getByRole('link', { name: 'Salir de la transferencia' })).toHaveAttribute('data-app-link');
  });
});
```

`web/components/layout/shells.test.tsx` — append inside `describe('AppShell', …)`:
```tsx
  it('WEB-24 en el dashboard el contenido mide hasta 1200 px sin contar el margen lateral', () => {
    render(
      <AppShell current="home" title="Inicio" user={USER}>
        <p>Contenido</p>
      </AppShell>,
    );
    const content = screen.getByRole('main').parentElement;
    expect(content).toHaveClass('max-w-app', 'dashboard:max-w-content');
    expect(content).not.toHaveClass('dashboard:px-10');
    expect(content?.parentElement).toHaveClass('dashboard:px-10');
  });
```

`web/app/(app)/layout.test.ts` — append (imports: `type ReactElement` from `react`, `AppFrame, type AppFrameProps` from `@/components/layout/AppFrame`, `USER` from `@/test/fixtures`):
```ts
  it('WEB-26 WEB-27 con sesión monta la estructura de la app con el nombre y el correo del usuario', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    resetRequest({ headers: { 'x-wallet-path': PATH }, cookies: { sid: SESSION_ID } });

    const element = (await renderLayout()) as ReactElement<AppFrameProps>;

    expect(element.type).toBe(AppFrame);
    expect(element.props.user).toEqual({ name: USER.fullName, email: USER.email });
  });
```

- [ ] **Step 2: Run them** — `npx vitest run lib/navigation.test.ts lib/client/account-selection.test.tsx components/layout/AppFrame.test.tsx components/accounts/MovementsIndexScreen.test.tsx components/ui/navigation.test.tsx components/ui/home.test.tsx components/layout/shells.test.tsx "app/(app)/layout.test.ts"` → FAIL: missing modules `./AppFrame`, `./account-selection`, `./MovementsIndexScreen`, `./RouterLink`; `appSection` not exported; the shell's content wrapper still has `dashboard:px-10`; the layout returns `PageShell`.

- [ ] **Step 3: Implement**

`web/components/ui/RouterLink.tsx`:
```tsx
'use client';

import { createContext, useContext, type AnchorHTMLAttributes, type ComponentType } from 'react';

export type RouterLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
};

export type LinkComponent = ComponentType<RouterLinkProps>;

const LinkContext = createContext<LinkComponent | null>(null);

/**
 * La app monta aquí `next/link` (AppFrame) para navegar sin recargar la página ni perder la caché
 * de TanStack Query. Sin proveedor (lienzos de design-sync, pruebas del kit) es un `<a>` normal.
 */
export const RouterLinkProvider = LinkContext.Provider;

/** Enlace interno del kit: pestañas, navegación lateral, acciones rápidas y botones de icono. */
export function RouterLink({ children, ...props }: RouterLinkProps) {
  const Component = useContext(LinkContext);
  return Component ? <Component {...props}>{children}</Component> : <a {...props}>{children}</a>;
}
```

In `TabBar.tsx` and `SideNav.tsx` replace each `<a href={href} aria-current=… className=…>…</a>` with `<RouterLink href={href} aria-current=… className=…>…</RouterLink>` (same props and children; add `import { RouterLink } from './RouterLink';`). In `Icon.tsx`, the `IconButton` `href` branch becomes `<RouterLink href={href} aria-label={label} className={classes}>`. In `QuickActions.tsx`, the `href` branch becomes `<RouterLink href={href} className={classes}>`. No other change to those components.

`web/components/layout/AppShell.tsx` — the max width moves to an inner wrapper so the 1200 px of `layout.contentMax` (D5) is content, not content plus padding (final review, 6.1 triage). Replace the content `div`:
```tsx
      <div className="w-full min-w-0 dashboard:px-10">
        <div className="mx-auto w-full max-w-app dashboard:max-w-content">
          {/* AppHeader, TopBar y main: sin cambios */}
        </div>
      </div>
```

`web/lib/navigation.ts` — append:
```ts
import type { NavDestination } from '@devchrisvaz/wallet-design-tokens';

export interface AppSection {
  current: NavDestination | null;
  title: string;
  mode: 'tabs' | 'flow';
  /** Acción principal de la barra superior del dashboard. */
  primary: 'transfer' | 'beneficiary';
}

const MOVEMENTS_PATH = /^\/accounts\/[^/]+\/movements$/;

/** Destino actual, título y forma de cada ruta con sesión (WEB-26, WEB-27). */
export function appSection(pathname: string): AppSection {
  if (pathname === '/transfers/new') {
    return { current: 'transfer', title: 'Transferir', mode: 'flow', primary: 'transfer' };
  }
  if (pathname.startsWith('/transfers/')) {
    return { current: null, title: 'Transferencia', mode: 'tabs', primary: 'transfer' };
  }
  if (pathname === '/movements' || MOVEMENTS_PATH.test(pathname)) {
    return { current: 'movements', title: 'Movimientos', mode: 'tabs', primary: 'transfer' };
  }
  if (pathname === '/beneficiaries/new') {
    return { current: 'beneficiaries', title: 'Agregar beneficiario', mode: 'tabs', primary: 'transfer' };
  }
  if (pathname.startsWith('/beneficiaries')) {
    return { current: 'beneficiaries', title: 'Beneficiarios', mode: 'tabs', primary: 'beneficiary' };
  }
  return { current: 'home', title: 'Inicio', mode: 'tabs', primary: 'transfer' };
}
```
(Put the `import type` at the top of the file with the other imports.)

`web/lib/client/account-selection.tsx`:
```tsx
'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AccountSelection {
  accountId: string | null;
  select: (accountId: string) => void;
}

const SelectionContext = createContext<AccountSelection | null>(null);

/** Cuenta elegida, compartida por Inicio y Movimientos mientras dura la sesión (WEB-28, WEB-29). */
export function AccountSelectionProvider({ children }: { children: ReactNode }) {
  const [accountId, select] = useState<string | null>(null);
  const value = useMemo(() => ({ accountId, select }), [accountId]);
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

/** Sin proveedor (pruebas de una pantalla sola), la selección es local al componente. */
export function useAccountSelection(): AccountSelection {
  const shared = useContext(SelectionContext);
  const [accountId, select] = useState<string | null>(null);
  return shared ?? { accountId, select };
}

/** La cuenta elegida si sigue existiendo; si no, la primera. */
export function selectedAccount<T extends { id: string }>(
  accounts: readonly T[],
  accountId: string | null,
): T | undefined {
  return accounts.find((account) => account.id === accountId) ?? accounts[0];
}
```

`web/components/layout/AppFrame.tsx`:
```tsx
'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useRef, type ReactNode } from 'react';
import { logout } from '@/app/actions/auth';
import { buttonClasses } from '@/components/ui/Button';
import { RouterLinkProvider, type LinkComponent } from '@/components/ui/RouterLink';
import { AccountSelectionProvider } from '@/lib/client/account-selection';
import { appSection } from '@/lib/navigation';
import { AppShell } from './AppShell';

export interface AppFrameProps {
  user: { name: string; email: string };
  children: ReactNode;
}

/** next/link con la firma del kit: navega sin recargar y conserva la caché. */
const NextLink: LinkComponent = ({ href, children, ...props }) => (
  <Link href={href} {...props}>
    {children}
  </Link>
);

const PRIMARY = {
  transfer: { href: '/transfers/new', label: 'Nueva transferencia' },
  beneficiary: { href: '/beneficiaries/new', label: 'Agregar beneficiario' },
} as const;

/** Cierra la sesión (WEB-05); aunque la acción falle, borra la caché y lleva al inicio de sesión. */
export function useLogout(): () => Promise<void> {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Candado síncrono: un segundo clic llega antes de que termine el primero (como el "Cerrando…" de antes).
  const busy = useRef(false);
  return useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await logout();
    } catch {
      // La cookie y la sesión se borran en el servidor; sin respuesta, la próxima petición sin
      // sesión válida también termina en el inicio de sesión.
    }
    // Los datos de la sesión no deben quedar en la caché del navegador.
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  }, [queryClient, router]);
}

/**
 * Estructura de las pantallas con sesión (WEB-24, WEB-26, WEB-27): AppShell con el destino, el título
 * y la forma de la ruta actual, enlaces de Next, la cuenta elegida compartida y el cierre de sesión
 * desde la navegación lateral y desde el menú del avatar.
 */
export function AppFrame({ user, children }: AppFrameProps) {
  const section = appSection(usePathname());
  const onLogout = useLogout();
  const primary = PRIMARY[section.primary];
  return (
    <RouterLinkProvider value={NextLink}>
      <AccountSelectionProvider>
        <AppShell
          current={section.current}
          title={section.title}
          mode={section.mode}
          user={user}
          onLogout={() => void onLogout()}
          primaryAction={
            <Link href={primary.href} className={buttonClasses('primary')}>
              {primary.label}
            </Link>
          }
        >
          {children}
        </AppShell>
      </AccountSelectionProvider>
    </RouterLinkProvider>
  );
}
```

`web/app/(app)/layout.tsx` — keep the session check verbatim; replace the imports of `AppNav`, `LogoutButton`, `PageShell` with `import { AppFrame } from '@/components/layout/AppFrame';` and the return with:
```tsx
  const { user } = current.session;
  return <AppFrame user={{ name: user.fullName, email: user.email }}>{children}</AppFrame>;
```

`web/components/accounts/MovementsIndexScreen.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ErrorState, LoadingState } from '@/components/states/states';
import { EmptyState } from '@/components/ui/EmptyState';
import { selectedAccount, useAccountSelection } from '@/lib/client/account-selection';
import { useAccountsOverview } from '@/lib/client/queries';

/** `/movements` (pestaña Movimientos): abre el historial de la cuenta elegida o de la primera. */
export function MovementsIndexScreen() {
  const router = useRouter();
  const overview = useAccountsOverview();
  const { accountId } = useAccountSelection();
  const target = overview.data ? selectedAccount(overview.data.accounts, accountId) : undefined;

  useEffect(() => {
    if (target) router.replace(`/accounts/${target.id}/movements`);
  }, [router, target]);

  if (overview.isError) {
    return (
      <ErrorState
        title="No pudimos cargar tus cuentas"
        error={overview.error}
        onRetry={() => void overview.refetch()}
      />
    );
  }
  if (overview.data?.accounts.length === 0) {
    return (
      <EmptyState
        icon="account"
        title="Aún no tienes cuentas"
        description="Tus cuentas Principal y Ahorro se abren al verificar tu correo."
      />
    );
  }
  return <LoadingState label="Cargando movimientos" />;
}
```

`web/app/(app)/movements/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { MovementsIndexScreen } from '@/components/accounts/MovementsIndexScreen';

export const metadata: Metadata = { title: 'Movimientos · TreoWallet' };

export default function MovementsIndexPage() {
  return <MovementsIndexScreen />;
}
```

Remove the screens' own page headings now that the shell owns the `h1` (R17, final-review 6.1–6.6 item): in `AccountsOverviewScreen.tsx` delete the header `div` with `<h1>Tus cuentas</h1>` and its "Nueva transferencia" link (the TopBar carries it; 6.3 rewrites the screen); in `MovementsScreen.tsx` delete `<h1 className="text-h1">Movimientos</h1>`; in `BeneficiariesScreen.tsx` delete the `<h1>` but keep the "Agregar beneficiario" link (6.6 restyles it); in `app/(app)/beneficiaries/new/page.tsx` delete `<h1 className="text-h1">Agregar beneficiario</h1>`; in `app/(app)/transfers/[transferId]/page.tsx` delete `<h1 className="text-h1">Transferencia</h1>`. Keep the `h1` of `app/(app)/transfers/new/page.tsx` (flow mode has no shell title; 6.5 replaces it with FlowHeader).

Delete `web/components/layout/AppHeader.tsx` and `web/components/layout/AppHeader.test.tsx` (`git rm`). Check nothing else imports them: `grep -rn "layout/AppHeader" web --include=*.ts --include=*.tsx` must print nothing outside `.design-sync/`.

- [ ] **Step 4: Run** — the Step 2 command → PASS; then `npm test` → all green (no test still imports `components/layout/AppHeader`).
- [ ] **Step 5: R7 gates** — `npm run format:check && npm run lint && npm run typecheck && npm test`.
- [ ] **Step 6: Commit** (two commits):
  1. `feat(web): route the kit's internal links through the app router and size the dashboard content` — `web/components/ui/{RouterLink,TabBar,SideNav,Icon,QuickActions}.tsx`, `web/components/ui/{navigation,home}.test.tsx`, `web/components/layout/{AppShell,shells.test}.tsx`; `Task: redesign#6.1`, `Refs: WEB-24, WEB-26, WEB-27`.
  2. `feat(web): mount the redesigned shell on the signed-in pages` — the remaining files of this task (including the two deletions); `Task: redesign#6.1`, `Refs: WEB-24, WEB-26, WEB-27, WEB-05, WEB-29`.

## Task 6.2: Web login, registration and verification on the brand surface

Track W. Mirrors the stories `Login`, `Register` and `VerifyEmail` of `web/.design-sync/previews/AppShell.tsx` with the real forms. The WEB-11/WEB-12 tests keep passing unchanged (form behavior is not touched).

**Files:**
- Modify: `web/app/(public)/layout.tsx`, `web/app/(public)/login/page.tsx`, `web/app/(public)/register/page.tsx`, `web/app/(public)/verify-email/page.tsx`, `web/app/(public)/login/page.test.ts`, `web/components/auth/LoginForm.tsx`, `web/components/auth/RegisterForm.tsx`, `web/components/auth/VerifyEmailForm.tsx`, `web/components/auth/{LoginForm,RegisterForm,VerifyEmailForm}.test.tsx`, `web/app/layout.tsx`, `web/components/layout/AppShell.tsx`, `web/components/layout/BrandShell.tsx`
- Create: `web/app/(public)/public-pages.test.ts`
- Rename: `web/components/layout/PageShell.tsx` → `web/components/layout/SkipLink.tsx`, `web/components/layout/PageShell.test.tsx` → `web/components/layout/SkipLink.test.tsx` (`git mv`; the `PageShell` component and its test case are deleted — superseded by WEB-24/WEB-31, whose `shells.test.tsx` cases already pin the focusable `main` and the Wordmark)

**Interfaces:**
- Consumes: `BrandShell({ title, children })` (`components/layout/BrandShell.tsx`), `Button` (`className` passes through), `InlineAlert`, `TextField`, `OtpField`.
- Produces: pages returning `<BrandShell title=…>`; `SkipLink`, `MAIN_CONTENT_ID` from `components/layout/SkipLink.tsx`; `LoginForm`/`RegisterForm` render a fragment `[form, invitation paragraph]`.

- [ ] **Step 1: Write the failing tests**

`web/app/(public)/public-pages.test.ts`:
```ts
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandShell } from '@/components/layout/BrandShell';
import { sessionStore } from '@/lib/server/session-store';
import { resetRequest } from '@/test/support/next-headers';
import { SESSION_ID } from '@/test/support/session';
import LoginPage from './login/page';
import RegisterPage from './register/page';
import VerifyEmailPage from './verify-email/page';

vi.mock('next/headers', () => import('@/test/support/next-headers'));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

type Shell = ReactElement<{ title: string }>;
const props = (searchParams: Record<string, string> = {}) =>
  ({ searchParams: Promise.resolve(searchParams), params: Promise.resolve({}) }) as never;

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  resetRequest();
});

describe('pantallas públicas de marca', () => {
  it('WEB-31 el inicio de sesión va sobre la superficie de marca con el título "Inicia sesión"', async () => {
    const page = (await LoginPage(props())) as Shell;
    expect(page.type).toBe(BrandShell);
    expect(page.props.title).toBe('Inicia sesión');
  });

  it('WEB-31 el registro va sobre la superficie de marca con el título "Crea tu cuenta"', () => {
    const page = RegisterPage() as Shell;
    expect(page.type).toBe(BrandShell);
    expect(page.props.title).toBe('Crea tu cuenta');
  });

  it('WEB-31 la verificación va sobre la superficie de marca con el título "Verifica tu correo"', async () => {
    const page = (await VerifyEmailPage(props({ email: 'ana@example.com', registered: '1' }))) as Shell;
    expect(page.type).toBe(BrandShell);
    expect(page.props.title).toBe('Verifica tu correo');
  });
});
```

`web/app/(public)/login/page.test.ts` — the helper must find `LoginForm` inside `BrandShell` (single child now): replace `page.props.children.find(…)` with `[page.props.children].flat().find(…)` and type the page as `ReactElement<{ children: unknown }>`. The four WEB-22/WEB-03 cases are unchanged.

`web/components/auth/LoginForm.test.tsx` — append:
```tsx
  it('WEB-31 WEB-25 el botón ocupa todo el ancho y la invitación al registro va fuera del formulario', () => {
    const { container } = render(<LoginForm />);
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toHaveClass('w-full');
    const invitation = screen.getByRole('link', { name: 'Regístrate' });
    expect(container.querySelector('form')?.contains(invitation)).toBe(false);
    expect(invitation).toHaveClass('min-h-11');
  });
```
(The file already imports `render` and `screen` from Testing Library.) Add the same case to `RegisterForm.test.tsx` with `'Crear cuenta'` and the link `'Inicia sesión'`.

`web/components/auth/VerifyEmailForm.test.tsx` — append:
```tsx
  it('WEB-31 WEB-25 tras el registro el aviso usa el tono de éxito y las acciones van apiladas', () => {
    render(<VerifyEmailForm email="ana@example.com" registered />);
    expect(screen.getByText(REGISTERED_MESSAGE).closest('.bg-success-soft')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Verificar correo' }).parentElement).toHaveClass('grid', 'gap-3');
  });
```
(Add `REGISTERED_MESSAGE` to the file's import from `./VerifyEmailForm`; the existing WEB-11 case that reads `getByRole('status')` keeps passing because a success alert is also a status.)

- [ ] **Step 2: Run** — `npx vitest run "app/(public)" components/auth` → FAIL (pages return fragments; button lacks `w-full`; the notice is `info`).

- [ ] **Step 3: Implement**
  - `app/(public)/layout.tsx`: `export default function PublicLayout({ children }: LayoutProps<'/'>) { return children; }` (each page brings its BrandShell, which has its own SkipLink and `main`).
  - `login/page.tsx`: keep the redirect logic; return `<BrandShell title="Inicia sesión"><LoginForm redirectTo={redirectTo} notice={reason === 'expired' ? 'expired' : undefined} /></BrandShell>`. `register/page.tsx`: `<BrandShell title="Crea tu cuenta"><RegisterForm /></BrandShell>`. `verify-email/page.tsx`: `<BrandShell title="Verifica tu correo"><VerifyEmailForm … /></BrandShell>`. Remove the pages' `<h1>` (BrandShell renders it).
  - `LoginForm.tsx` — mirror story `Login`: return `<>` + `<form noValidate onSubmit={onSubmit} className="grid gap-4">` with the alerts (unchanged), the two TextFields, `<Button type="submit" loading={isSubmitting} loadingLabel="Entrando…" className="w-full">Iniciar sesión</Button>` + `</form>` + `<p className="text-center text-body-sm text-fg-secondary">¿No tienes cuenta?{' '}<Link href="/register" className="inline-flex min-h-11 items-center font-medium text-action underline underline-offset-2">Regístrate</Link></p>` + `</>`.
  - `RegisterForm.tsx` — same pattern as story `Register`: form `grid gap-4`, fields and hints unchanged, `Button … className="w-full"` "Crear cuenta", the "¿Ya tienes cuenta? Inicia sesión" paragraph after the form with the same classes as above.
  - `VerifyEmailForm.tsx` — mirror story `VerifyEmail`: form `grid gap-4`; the notice `<InlineAlert tone="success">` (was `info`; superseded by WEB-31/WEB-25: the approved story shows the success tone); the two buttons in `<div className="grid gap-3">` (was `flex flex-wrap gap-3`).
  - `git mv web/components/layout/PageShell.tsx web/components/layout/SkipLink.tsx` and delete the `PageShell` component and `PageShellProps` from it (keep `MAIN_CONTENT_ID` and `SkipLink` verbatim); `git mv web/components/layout/PageShell.test.tsx web/components/layout/SkipLink.test.tsx` and delete its `describe('PageShell', …)` block. Update the imports in `AppShell.tsx`, `BrandShell.tsx` to `./SkipLink`.
  - `app/layout.tsx`: delete `<SkipLink />` and its import — every page now renders exactly one through AppShell or BrandShell (WEB-23; asserted in a real browser by Task 6.7).
- [ ] **Step 4: Run** — `npx vitest run "app/(public)" components/auth components/layout` → PASS; `grep -rn "PageShell" web --include=*.ts --include=*.tsx | grep -v .design-sync` → nothing.
- [ ] **Step 5: R7 gates.**
- [ ] **Step 6: Commit** — `feat(web): show the public pages on the brand surface`; `Task: redesign#6.2`; `Refs: WEB-31, WEB-25, WEB-11, WEB-12`.

## Task 6.3: Web Home — hero, selectable cards and the latest 5 movements

Track W. Mirrors stories `Home`, `HomeEmpty`, `HomeLoading`, `HomeError` of `web/.design-sync/previews/AppShell.tsx` (function bodies `Home`, `HomeEmpty`, `HomeLoading`, `HomeError`; `HomeShell` is replaced by the real AppFrame from 6.1). Canned data → real data: `principal`/`ahorro` → `overview.data.accounts`, `dailyLimit` → `overview.data.dailyLimit`, `movements` → `useLatestMovements(selected.id)`, `href="#"` → real routes, `noop` → `select(account.id)` / `refetch`. Also folds the final-review items for 6.3: AccountCard focus ring on the whole card, M-5 (web hero clipped with large text) and M-2 (no duplicated daily-limit heading).

**Files:**
- Modify: `web/components/accounts/AccountsOverviewScreen.tsx`, `web/components/accounts/AccountsOverviewScreen.test.tsx`, `web/lib/client/queries.ts`, `web/lib/client/query-keys.ts`, `web/components/ui/AccountCard.tsx`, `web/components/ui/BalanceHero.tsx`, `web/components/ui/data.test.tsx`, `web/components/ui/home.test.tsx`

**Interfaces:**
- Consumes: `BalanceHero({ total, available, actions })`, `QuickActions({ actions: QuickAction[] })` (`{ key, label, icon, href? }`), `AccountCard({ account, selected, onSelect })`, `ListSection({ title, action, children, className })`, `DailyLimitMeter({ dailyLimit, …header opt-in prop added by the fix wave })`, `MovementList({ movements, now? })` (it passes the MovementRow time-only prop itself), `EmptyState({ icon, title, description, action })`, `Skeleton`, `LoadingState`, `ErrorState`, `sumAmounts` (`lib/money.ts`), `useAccountSelection`/`selectedAccount` (6.1), `bffGet`.
- Produces: `useLatestMovements(accountId: string | undefined)` → `UseQueryResult<Movement[]>`; `LATEST_MOVEMENTS_LIMIT = 5`; `queryKeys.latestMovements(accountId)` = `['movements', accountId, 'latest']` (under `allMovements`, so the receipt's invalidation refreshes it).

- [ ] **Step 1: Write the failing tests**

In `web/components/accounts/AccountsOverviewScreen.test.tsx`, replace the single-response mocks by a reads helper (every `bffGetMock.mockResolvedValue(OVERVIEW)` becomes `reads()`; the midnight case uses a mutable overview; the retry case keeps `mockRejectedValueOnce` before `reads()` — a `…Once` value wins over the implementation):
```tsx
import type { AccountsOverview, MovementPage } from '@devchrisvaz/wallet-contract';
import { AHORRO, DAILY_LIMIT, OVERVIEW, PRINCIPAL, movement } from '@/test/fixtures';

const LATEST: Record<string, MovementPage> = {
  [PRINCIPAL.id]: { items: [movement({ id: 'p1', concept: 'Renta de octubre' })], nextCursor: null },
  [AHORRO.id]: { items: [movement({ id: 'a1', concept: 'Apartado quincenal' })], nextCursor: null },
};

/** Lecturas de Inicio: el resumen y los últimos movimientos de cada cuenta. */
function reads(overview: () => AccountsOverview = () => OVERVIEW) {
  bffGetMock.mockImplementation(async (path: string) => {
    if (path === 'accounts') return overview();
    const latest = LATEST[path.split('/')[1] ?? ''];
    if (latest && path.endsWith('/movements')) return latest;
    throw new Error(`Lectura inesperada: ${path}`);
  });
}
```
The midnight case becomes: `let current = atMidnight('0.00'); reads(() => current); …; current = atMidnight('50000.00'); await client.invalidateQueries(…)` (same assertions). The retry case: `reads(); bffGetMock.mockRejectedValueOnce(new ProblemError(500, { code: 'INTERNAL_ERROR' }));` (same assertions, `toHaveBeenCalledTimes(2)` becomes `expect(bffGetMock.mock.calls.filter(([p]) => p === 'accounts')).toHaveLength(2)` because the movements read now also goes through `bffGet`).

Update (superseded) and add:
```tsx
  // Sustituye a "WEB-14 cada cuenta lleva a su historial y a transferir desde ella": en el rediseño las
  // tarjetas seleccionan (WEB-28) y el hero lleva las acciones de la cuenta elegida.
  it('WEB-28 las acciones rápidas transfieren desde la cuenta elegida y abren sus movimientos', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByRole('link', { name: 'Transferir' })).toHaveAttribute(
      'href',
      `/transfers/new?from=${PRINCIPAL.id}`,
    );
    expect(screen.getByRole('link', { name: 'Movimientos' })).toHaveAttribute(
      'href',
      `/accounts/${PRINCIPAL.id}/movements`,
    );
  });

  it('WEB-28 el hero muestra el saldo total sumado sin punto flotante y lo disponible hoy', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByTestId('hero-amount')).toHaveTextContent('$35,000.00');
    expect(screen.getByText('Disponible hoy $38,000.00')).toBeVisible();
  });

  it('WEB-28 la primera cuenta queda seleccionada y la lista trae sus últimos 5 movimientos', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByRole('button', { name: 'Principal' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText(/Renta de octubre/)).toBeVisible();
    expect(bffGetMock).toHaveBeenCalledWith(`accounts/${PRINCIPAL.id}/movements`, { limit: '5' });
  });

  it('WEB-28 al seleccionar Ahorro la tarjeta queda marcada, la lista muestra los de Ahorro y "Ver todos" abre su historial', async () => {
    reads();
    const user = userEvent.setup();
    renderWithClient(<AccountsOverviewScreen />);

    await user.click(await screen.findByRole('button', { name: 'Ahorro' }));

    expect(screen.getByRole('button', { name: 'Ahorro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Principal' })).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByText(/Apartado quincenal/)).toBeVisible();
    expect(bffGetMock).toHaveBeenCalledWith(`accounts/${AHORRO.id}/movements`, { limit: '5' });
    expect(screen.getByRole('link', { name: 'Ver todos' })).toHaveAttribute(
      'href',
      `/accounts/${AHORRO.id}/movements`,
    );
  });

  it('WEB-28 el límite diario se muestra una sola vez, sin un encabezado repetido', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);
    await screen.findByText('Te quedan $38,000.00 hoy');
    expect(screen.queryAllByRole('heading', { name: /Límite diario/ }).length).toBeLessThanOrEqual(1);
  });
```
Superseded by WEB-28 (the loading state now has the hero, cards and list skeletons, two `status` regions): in `'WEB-20 muestra un estado de carga mientras espera'` replace `screen.getByRole('status')` with `screen.getAllByRole('status')[0]` (same text assertion `'Cargando tus cuentas'`).

`web/components/ui/data.test.tsx` — append inside `describe('AccountCard', …)`:
```tsx
  it('WEB-23 el anillo de foco rodea toda la tarjeta seleccionable, no solo el nombre', () => {
    render(<AccountCard account={PRINCIPAL} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Principal' })).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:after:outline-2',
      'focus-visible:after:outline-offset-2',
      'focus-visible:after:outline-focus',
    );
  });
```
`web/components/ui/home.test.tsx` — append inside `describe('BalanceHero', …)`:
```tsx
  it('WEB-28 DSG-13 con el texto agrandado el monto pasa de línea en lugar de cortarse', () => {
    render(<BalanceHero total="35000.00" available="31500.00" />);
    const amount = screen.getByTestId('hero-amount');
    expect(amount).not.toHaveClass('whitespace-nowrap');
    expect(amount).toHaveClass('[overflow-wrap:anywhere]');
  });
```

- [ ] **Step 2: Run** — `npx vitest run components/accounts/AccountsOverviewScreen.test.tsx components/ui/data.test.tsx components/ui/home.test.tsx` → FAIL (no hero, no selection, no latest-movements read, old classes).

- [ ] **Step 3: Implement**

`web/lib/client/query-keys.ts` — add `latestMovements: (accountId: string) => ['movements', accountId, 'latest'] as const,`.

`web/lib/client/queries.ts` — add (import `type Movement, type MovementPage` from the contract):
```ts
/** Movimientos que muestra Inicio por cuenta (WEB-28; D9: el mismo endpoint con `limit=5`). */
export const LATEST_MOVEMENTS_LIMIT = 5;

export function useLatestMovements(accountId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.latestMovements(accountId ?? ''),
    queryFn: () =>
      bffGet<MovementPage>(`accounts/${accountId}/movements`, {
        limit: String(LATEST_MOVEMENTS_LIMIT),
      }),
    enabled: accountId !== undefined,
    select: (page): Movement[] => page.items.slice(0, LATEST_MOVEMENTS_LIMIT),
  });
}
```

`web/components/ui/AccountCard.tsx` — on the `onSelect` name button add `focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus` to its className (the `::after` is the stretched target from R31, so the ring now outlines the whole card). `web/components/ui/BalanceHero.tsx` — in the `data-testid="hero-amount"` paragraph replace `whitespace-nowrap` with `[overflow-wrap:anywhere]` (the size tiers of `heroAmountSize` still keep it on one line at 100 % text; with larger text it wraps instead of being clipped by `overflow-hidden`, M-5).

`web/components/accounts/AccountsOverviewScreen.tsx` — rewrite (keep the WEB-13 doc comment, extended):
```tsx
'use client';

import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/states/states';
import { AccountCard } from '@/components/ui/AccountCard';
import { BalanceHero } from '@/components/ui/BalanceHero';
import { Button } from '@/components/ui/Button';
import { DailyLimitMeter } from '@/components/ui/DailyLimitMeter';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSection } from '@/components/ui/ListSection';
import { MovementList } from '@/components/ui/MovementList';
import { QuickActions } from '@/components/ui/QuickActions';
import { Skeleton } from '@/components/ui/Skeleton';
import { selectedAccount, useAccountSelection } from '@/lib/client/account-selection';
import { useAccountsOverview, useLatestMovements } from '@/lib/client/queries';
import { sumAmounts } from '@/lib/money';

/**
 * Inicio (WEB-28, amplía WEB-13): hero con el saldo total (suma en centavos, sin floats) y lo que
 * queda del límite diario tal como lo devuelve la API, tarjetas que seleccionan la cuenta, el medidor
 * del límite y los últimos 5 movimientos de la cuenta elegida con "Ver todos".
 */
export function AccountsOverviewScreen() {
  const overview = useAccountsOverview();
  const { accountId, select } = useAccountSelection();
  const accounts = overview.data?.accounts ?? [];
  const selected = selectedAccount(accounts, accountId);

  if (overview.isPending) {
    return (
      <>
        <Skeleton variant="card" />
        <div className="grid gap-5 dashboard:grid-cols-2">
          <LoadingState label="Cargando tus cuentas" variant="card" count={2} />
          <ListSection>
            <LoadingState label="Cargando movimientos" count={4} />
          </ListSection>
        </div>
      </>
    );
  }
  if (overview.isError) {
    return (
      <ErrorState
        title="No pudimos cargar tus cuentas"
        error={overview.error}
        onRetry={() => void overview.refetch()}
      />
    );
  }
  const { dailyLimit } = overview.data;
  if (!selected) {
    return (
      <>
        <BalanceHero total="0.00" available={dailyLimit.remaining} />
        <EmptyState
          icon="account"
          title="Aún no tienes cuentas"
          description="Tus cuentas Principal y Ahorro se abren al verificar tu correo."
          action={
            <Button variant="secondary" onClick={() => void overview.refetch()}>
              Volver a cargar
            </Button>
          }
        />
      </>
    );
  }
  const history = `/accounts/${selected.id}/movements`;
  return (
    <>
      <BalanceHero
        total={sumAmounts(accounts.map((account) => account.balance))}
        available={dailyLimit.remaining}
        actions={
          <QuickActions
            actions={[
              { key: 'transfer', label: 'Transferir', icon: 'transfer', href: `/transfers/new?from=${selected.id}` },
              { key: 'movements', label: 'Movimientos', icon: 'movements', href: history },
            ]}
          />
        }
      />
      <div className="grid gap-5 dashboard:grid-cols-2">
        <div className="grid content-start gap-5">
          <section aria-label="Cuentas" className="grid gap-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                selected={account.id === selected.id}
                onSelect={() => select(account.id)}
              />
            ))}
          </section>
          <ListSection>
            {/* Las mismas props que la historia `Home` (el encabezado del medidor es opcional). */}
            <DailyLimitMeter dailyLimit={dailyLimit} />
          </ListSection>
        </div>
        <ListSection
          title="Últimos movimientos"
          action={
            <Link href={history} className="inline-flex min-h-11 items-center text-label text-action">
              Ver todos
            </Link>
          }
        >
          <LatestMovements accountId={selected.id} />
        </ListSection>
      </div>
    </>
  );
}

function LatestMovements({ accountId }: { accountId: string }) {
  const latest = useLatestMovements(accountId);
  if (latest.isPending) return <LoadingState label="Cargando movimientos" count={4} />;
  if (latest.isError) {
    return (
      <ErrorState
        title="No pudimos cargar los movimientos"
        error={latest.error}
        onRetry={() => void latest.refetch()}
      />
    );
  }
  if (latest.data.length === 0) {
    return <p className="py-3 text-body-sm text-fg-secondary">Aún no hay movimientos en esta cuenta.</p>;
  }
  return <MovementList movements={latest.data} />;
}
```
`DailyLimitMeter`: give it exactly the props the `Home` story passes after the fix wave (read `components/ui/DailyLimitMeter.tsx` for the opt-in header prop name and `previews/AppShell.tsx` `Home` for whether the story opts in); there must be no other "Límite diario" heading on the page (M-2). The screen returns fragments: AppShell's `main` is already `grid gap-5`, as in the story.

- [ ] **Step 4: Run** — Step 2 command → PASS; `npm test` → green.
- [ ] **Step 5: R7 gates.**
- [ ] **Step 6: Commit** — `feat(web): redesign Home with the balance hero, selectable cards and latest movements`; `Task: redesign#6.3`; `Refs: WEB-28, WEB-13, WEB-23, DSG-13`.

## Task 6.4: Web Movements grouped by day with filters in a sheet

Track W. Mirrors stories `Movements`, `MovementsEmpty`, `MovementsFilters` (functions `MovementsToolbar`, `MovementsHistory`, `MovementsFilters` in `web/.design-sync/previews/AppShell.tsx`). Canned → real: the two `aria-pressed` buttons → one per account of `useAccountsOverview()`, the `MovementList` data → the pages of the existing `useInfiniteQuery`, "Cargar más" → `fetchNextPage`, the sheet's fields → the WEB-14 filters with "Aplicar"/"Limpiar". All WEB-14 behaviors stay (cursor reset on filter change, `INVALID_CURSOR` reload, inverted range on "Hasta", "Cargar más" hidden on the last page). Folds the final-review items for 6.4: M-4 (no landmark per day, heading level prop), M-7 (background scroll lock), Escape inside the sheet's date fields, R16 class assertions; the MovementRow sr-only date is resolved by I-1 (MovementList passes the time-only prop).

**Files:**
- Create: `web/components/accounts/MovementFilters.tsx`
- Modify: `web/components/accounts/MovementsScreen.tsx`, `web/components/accounts/MovementsScreen.test.tsx`, `web/components/ui/MovementList.tsx`, `web/components/ui/BottomSheet.tsx`, `web/components/ui/home.test.tsx`, `web/components/ui/overlays.test.tsx`

**Interfaces:**
- Consumes: `BottomSheet({ open, onClose, title, children })`, `Button` (`variant`, `icon`, `aria-haspopup`), `buttonClasses`, `ListSection`, `MovementList`, `TextField`, `EmptyState`, `LoadingState`, `ErrorState`, `useAccountsOverview`, `useAccountSelection` (6.1), `MOVEMENT_TYPE` (`lib/conventions.ts`), `MovementFilters` type (`lib/client/query-keys.ts`).
- Produces: `MovementList({ movements, now?, headingLevel?: 2 | 3 })` (additive, default `3`; days are `div`s, not landmarks); `BottomSheet` locks `document.body` scroll while open and ignores Escape whose target is a date/time input; `MovementFiltersForm({ initial, onApply, onClear })` in `components/accounts/MovementFilters.tsx`.

- [ ] **Step 1: Write the failing tests**

`web/components/accounts/MovementsScreen.test.tsx` — add helpers and rewrite the filter cases to go through the sheet (superseded by WEB-29: the filters live in a sheet and apply with "Aplicar"; every assertion on the request parameters is kept as is):
```tsx
type User = ReturnType<typeof userEvent.setup>;

async function openFilters(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Filtros' }));
  return screen.getByRole('dialog', { name: 'Filtrar movimientos' });
}

/** Abre la hoja, llena lo indicado y pulsa "Aplicar". */
async function applyFilters(user: User, { from, to, types = [] }: { from?: string; to?: string; types?: string[] }) {
  const sheet = await openFilters(user);
  if (from) await user.type(within(sheet).getByLabelText('Desde'), from);
  if (to) await user.type(within(sheet).getByLabelText('Hasta'), to);
  for (const type of types) await user.click(within(sheet).getByRole('checkbox', { name: type }));
  await user.click(within(sheet).getByRole('button', { name: 'Aplicar' }));
}

function rows() {
  return within(screen.getByRole('region', { name: 'Movimientos' })).getAllByRole('listitem');
}
```
Case by case: `WEB-14 muestra los movimientos…` and `WEB-14 "Cargar más"…` read rows with `rows()` instead of `within(getByRole('list', { name: 'Movimientos' }))`; `WEB-14 al cambiar el tipo a "Depósito"…` uses `await applyFilters(user, { types: ['Depósito'] })`; `WEB-14 filtra por rango de fechas y por varios tipos` uses `await applyFilters(user, { from: '2026-10-01', to: '2026-10-13', types: ['Transferencia recibida', 'Traspaso recibido'] })`; `WEB-20 sin movimientos en el periodo…` uses `applyFilters(user, { from: '2026-01-01' })` then clicks "Limpiar filtros" and checks the reloaded list; the reopened sheet's "Desde" is empty. The inverted-range case becomes:
```tsx
  it('WEB-14 WEB-29 con "Desde" posterior a "Hasta" marca "Hasta", no aplica ni consulta la API hasta corregirlo', async () => {
    reads(() => PAGE_2);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText('Depósito inicial');

    const sheet = await openFilters(user);
    await user.type(within(sheet).getByLabelText('Hasta'), '2026-10-11');
    await user.type(within(sheet).getByLabelText('Desde'), '2026-10-12');
    const to = within(sheet).getByLabelText('Hasta');
    expect(to).toHaveAttribute('aria-invalid', 'true');
    expect(to).toHaveAccessibleDescription(/Elige una fecha igual o posterior a la de Desde\./);
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('dialog', { name: 'Filtrar movimientos' })).toBeInTheDocument();
    expect(movementCalls().some((params) => params.from === '2026-10-12')).toBe(false);

    await user.clear(within(sheet).getByLabelText('Desde'));
    await user.type(within(sheet).getByLabelText('Desde'), '2026-10-01');
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar' }));

    await waitFor(() =>
      expect(movementCalls().at(-1)).toMatchObject({ from: '2026-10-01', to: '2026-10-11', cursor: undefined }),
    );
    expect(screen.queryByRole('dialog', { name: 'Filtrar movimientos' })).not.toBeInTheDocument();
  });
```
The account case (superseded by WEB-29: segmented control instead of a native select):
```tsx
  it('WEB-14 WEB-29 el selector de cuenta marca la actual y cambia de cuenta', async () => {
    reads(() => PAGE_1);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    const group = await screen.findByRole('group', { name: 'Cuenta' });
    expect(within(group).getByRole('button', { name: 'Principal' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(group).getByRole('button', { name: 'Ahorro' }));
    expect(router.push).toHaveBeenCalledWith(`/accounts/${AHORRO.id}/movements`);
  });
```
New cases:
```tsx
  it('WEB-29 agrupa por día de Ciudad de México: "Hoy", "Ayer" (también a las 05:30 UTC de hoy) y "9 oct"', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-13T18:00:00Z'), toFake: ['Date'] });
    reads(() => ({
      items: [
        movement({ id: 'h', concept: 'Comida', occurredAt: '2026-10-13T16:42:00Z' }),
        movement({ id: 'm', concept: 'Medianoche', occurredAt: '2026-10-13T05:30:00Z' }),
        movement({ id: 'n', concept: 'Nueve', occurredAt: '2026-10-09T18:20:00Z' }),
      ],
      nextCursor: null,
    }));
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText(/Medianoche/);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Hoy', 'Ayer', '9 oct']);
    expect(screen.getByText(/Medianoche/).closest('ul')?.previousElementSibling).toHaveTextContent('Ayer');
  });

  it('DSG-17 WEB-29 Escape en una fecha no cierra la hoja; en otro control la cierra y el foco vuelve a "Filtros"', async () => {
    reads(() => PAGE_1);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    const sheet = await openFilters(user);
    await user.click(within(sheet).getByLabelText('Desde'));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Filtrar movimientos' })).toBeInTheDocument();
    within(sheet).getByRole('button', { name: 'Aplicar' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Filtrar movimientos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros' })).toHaveFocus();
  });

  it('DSG-17 con la hoja abierta la página no se desplaza detrás', async () => {
    reads(() => PAGE_1);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    const sheet = await openFilters(user);
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(within(sheet).getByRole('button', { name: 'Cerrar' }));
    expect(document.body.style.overflow).toBe('');
  });
```
(The movements mock uses `PAGE_1`/`PAGE_2` and the `reads`/`movementCalls` helpers that the file already has; with `toFake: ['Date']` only `Date` is faked, so TanStack Query and user-event keep real timers. Add `afterEach(() => { vi.useRealTimers(); });` next to the file's `beforeEach` so a failing case never leaks the fake clock.)

`web/components/ui/home.test.tsx` — append inside `describe('MovementList', …)` (M-4):
```tsx
  it('WEB-23 WEB-29 los días no son regiones y su nivel de encabezado se elige', () => {
    render(<MovementList movements={[movement()]} now={new Date('2026-10-13T18:00:00Z')} headingLevel={2} />);
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });
```
Two existing cases of the same file query day regions that no longer exist (superseded by WEB-23/M-4: days are not landmarks): in `WEB-29 agrupa por día de Ciudad de México` and `WEB-29 las filas del día muestran solo la hora…` add `const day = (name: string) => screen.getByRole('heading', { name }).nextElementSibling as HTMLElement;` and replace `within(screen.getByRole('region', { name: 'Ayer' }))` with `within(day('Ayer'))` and `within(screen.getByRole('region', { name: 'Hoy' }))` with `within(day('Hoy'))` (same assertions).
`web/components/ui/overlays.test.tsx` — extend `describe('BottomSheet R16', …)`: assert the dialog panel `toHaveClass('flex', 'flex-col', 'max-h-[85dvh]')` and the body wrapper `toHaveClass('min-h-0', 'overflow-y-auto')` (deferred R16 minor).

- [ ] **Step 2: Run** — `npx vitest run components/accounts/MovementsScreen.test.tsx components/ui/home.test.tsx components/ui/overlays.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`web/components/ui/MovementList.tsx` — additive `headingLevel` and a non-landmark day wrapper (keep passing the MovementRow time-only prop the fix wave added):
```tsx
export function MovementList({
  movements,
  now,
  headingLevel = 3,
}: {
  movements: readonly Movement[];
  now?: Date;
  /** 3 dentro de una tarjeta con título (Inicio); 2 cuando la lista va directo bajo el h1 (Movimientos). */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="grid gap-2">
      {groupByDay(movements, (item) => item.occurredAt, now).map((group) => (
        <div key={group.key}>
          <Heading className="pt-2 pb-1 text-caption font-medium text-fg-muted">{group.label}</Heading>
          <ul className="divide-y divide-border">{/* las mismas filas de hoy, con la prop de solo hora */}</ul>
        </div>
      ))}
    </div>
  );
}
```
`web/components/ui/BottomSheet.tsx` — inside the `open` effect: save `const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';` and restore it in the cleanup; in `onDocumentKeyDown`, before closing on Escape: `if (event.target instanceof HTMLInputElement && ['date', 'time', 'datetime-local', 'month', 'week'].includes(event.target.type)) return;` (Escape there dismisses the field's picker, Review Focus #3).

`web/components/accounts/MovementFilters.tsx`:
```tsx
'use client';

import type { MovementType } from '@devchrisvaz/wallet-contract';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import type { MovementFilters } from '@/lib/client/query-keys';
import { MOVEMENT_TYPE } from '@/lib/conventions';

const TYPE_ORDER = Object.keys(MOVEMENT_TYPE) as MovementType[];
/** Error de "Hasta" cuando el rango está invertido; la API respondería 422 (WEB-14). */
const INVERTED_RANGE = 'Elige una fecha igual o posterior a la de Desde.';

/** Las fechas son `AAAA-MM-DD`, así que se comparan bien como texto. */
export function isInvertedRange(filters: MovementFilters): boolean {
  return filters.from !== '' && filters.to !== '' && filters.from > filters.to;
}

/**
 * Filtros del historial en la hoja inferior (WEB-29): se editan como borrador y se aplican con
 * "Aplicar"; un rango invertido marca "Hasta" y no se aplica (WEB-14).
 */
export function MovementFiltersForm({
  initial,
  onApply,
  onClear,
}: {
  initial: MovementFilters;
  onApply: (filters: MovementFilters) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const inverted = isInvertedRange(draft);
  function toggle(type: MovementType) {
    setDraft((current) => {
      const chosen = current.types.includes(type)
        ? current.types.filter((item) => item !== type)
        : [...current.types, type];
      return { ...current, types: TYPE_ORDER.filter((item) => chosen.includes(item)) };
    });
  }
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!inverted) onApply(draft);
      }}
    >
      <div className="grid gap-4 dashboard:grid-cols-2 dashboard:gap-3">
        <TextField label="Desde" type="date" value={draft.from} max={draft.to || undefined}
          onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} />
        <TextField label="Hasta" type="date" value={draft.to} min={draft.from || undefined}
          error={inverted ? INVERTED_RANGE : undefined}
          onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} />
      </div>
      <fieldset className="grid">
        <legend className="pb-1 text-label text-fg">Tipo</legend>
        {TYPE_ORDER.map((type) => (
          <label key={type} className="flex min-h-11 items-center gap-3 text-body text-fg">
            <input type="checkbox" className="size-5 accent-action" checked={draft.types.includes(type)} onChange={() => toggle(type)} />
            {MOVEMENT_TYPE[type].label}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3">
        <Button type="submit">Aplicar</Button>
        <Button variant="ghost" onClick={onClear}>Limpiar</Button>
      </div>
    </form>
  );
}
```
`web/components/accounts/MovementsScreen.tsx` — keep the query, `invalidCursor` effect, `hasFilters`, `NO_FILTERS` and states; move `INVERTED_RANGE`/`isInvertedRange`/`toggleType`/`TYPE_ORDER` to `MovementFilters.tsx` (import `isInvertedRange`); add `const [filtersOpen, setFiltersOpen] = useState(false);`, `const { select } = useAccountSelection();` and `useEffect(() => select(accountId), [accountId, select]);` (Home keeps the account chosen here, WEB-28/WEB-29). Return, as fragments for AppShell's grid (story `MovementsHistory`/`MovementsToolbar`/`MovementsFilters`):
```tsx
    <>
      <div className="grid gap-2 dashboard:flex dashboard:items-center dashboard:justify-between">
        {overview.data ? (
          <div role="group" aria-label="Cuenta" className="grid grid-cols-2 gap-2 dashboard:w-80">
            {overview.data.accounts.map((account) => (
              <button key={account.id} type="button" aria-pressed={account.id === accountId}
                className={buttonClasses(account.id === accountId ? 'primary' : 'secondary')}
                onClick={() => router.push(`/accounts/${account.id}/movements`)}>
                {account.name}
              </button>
            ))}
          </div>
        ) : null}
        <Button variant="ghost" icon="filter" aria-haspopup="dialog" className="justify-self-end" onClick={() => setFiltersOpen(true)}>
          Filtros
        </Button>
      </div>
      {/* estados: los de hoy (carga, error, vacío con "Limpiar filtros" o "Nueva transferencia") */}
      {/* lista: */}
      <section aria-label="Movimientos" className="grid gap-5">
        <ListSection>
          <MovementList movements={items} headingLevel={2} />
        </ListSection>
        {/* error de la página siguiente: el de hoy */}
        {movements.hasNextPage && !movements.isFetchNextPageError ? (
          <Button variant="secondary" className="dashboard:justify-self-center"
            loading={movements.isFetchingNextPage} loadingLabel="Cargando…"
            onClick={() => void movements.fetchNextPage()}>
            Cargar más
          </Button>
        ) : null}
      </section>
      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtrar movimientos">
        <MovementFiltersForm
          initial={filters}
          onApply={(next) => { setFilters(next); setFiltersOpen(false); }}
          onClear={() => { setFilters(NO_FILTERS); setFiltersOpen(false); }}
        />
      </BottomSheet>
    </>
```
The empty state keeps today's copy and actions and gets `icon="movements"` (story `MovementsEmpty`). The query's `enabled: !isInvertedRange(filters)` guard stays.

- [ ] **Step 4: Run** — Step 2 command → PASS; `npm test` → green (axe case of the screen passes with day headings at h2 under the shell h1).
- [ ] **Step 5: R7 gates.**
- [ ] **Step 6: Commit** — `feat(web): group the movement history by day and move its filters into a sheet`; `Task: redesign#6.4`; `Refs: WEB-29, WEB-14, WEB-20, WEB-23, DSG-17`.

## Task 6.5: Web stepped transfer flow with the recipient step and the desktop summary

Track W. Mirrors the transfer stories of `web/.design-sync/previews/AppShell.tsx`: `TransferRecipient`, `TransferAmount`, `TransferReview`, `TransferUncertain`, `TransferRejected`, `TransferOtp`, `TransferCompleted`, `TransferFailed` (helpers `FlowPage`, `RecipientOption`, `StepActions`, `Summary`, `SummaryRow`, `AmountBlock`, `ReviewSummary`). Canned → real: `DRAFT`/`OTP_DRAFT`/… → the `useTransferFlow` state, `luis`/`mama`/`ahorro` → `useBeneficiaries()`/`useAccountsOverview()`, `sentTransfer`/`failedTransfer` → the `Transfer` returned by `createTransfer`/`confirmTransfer`, `closeHref="#"` → `/`, `noop` → the flow actions. Every WEB-16…WEB-19 test keeps its assertions on calls, payloads, keys, messages and focus; only roles/names/copy that WEB-30/WEB-25 change are updated (listed below). Folds the final-review items for 6.5: R30 hint copy, the StepActions pattern moved into the kit, the Receipt " · " as real text, the Stepper double announcement. Ruling R36 applies (total 5 → 4 once the amount is known).

**Files:**
- Create: `web/components/ui/StepActions.tsx`, `web/lib/client/transfer-steps.ts`, `web/lib/client/transfer-steps.test.ts`, `web/components/transfers/RecipientStep.tsx`, `web/components/transfers/RecipientStep.test.tsx`, `web/components/transfers/TransferSummary.tsx`
- Modify: `web/lib/client/transfer-flow.ts`, `web/lib/client/transfer-flow.test.tsx`, `web/components/transfers/{TransferFlow,TransferForm,ConfirmStep,OtpStep,ReceiptStep,TransferDetailScreen}.tsx`, `web/components/transfers/{TransferFlow.flow,TransferFlow.confirm,TransferForm,OtpStep,receipt}.test.tsx`, `web/test/support/transfer-flow.ts`, `web/test/accessibility.test.tsx`, `web/app/(app)/transfers/new/page.tsx`, `web/components/ui/{FlowHeader,Stepper,Receipt}.tsx`, `web/components/ui/{overlays,data}.test.tsx`

**Interfaces:**
- Consumes: `FlowHeader`, `Stepper`, `ListSection`, `Avatar`/`initials`, `Icon`, `AmountField` (`variant="hero"`), `Select`, `TextField`, `OtpField`, `InlineAlert` (`tone`, `title`, `focusOnMount`), `Button`, `buttonClasses`, `Receipt`, `LoadingState`, `ErrorState`, `StepHeading` (detail page only), `createTransfer`/`confirmTransfer`/`resendTransferOtp`, `transferResolver`, `maskClabe`, `normalizeAmountInput`, `amountInput`/`toCents`/`formatMXN` (contract), `loginPath`, `isUncertainFailure`/`ActionProblemError`.
- Produces:
  - `StepActions({ children, stacked?: boolean, fixed?: boolean })` (kit).
  - `FlowHeader` additive props `titleId?: string`, `focusTitle?: boolean`; `Stepper` without the group label; `Receipt` with a real " · ".
  - `type TransferRecipient = { destinationType: 'OWN_ACCOUNT'; toAccountId: string } | { destinationType: 'BENEFICIARY'; beneficiaryId: string }`; `TransferFlowState` gains `{ step: 'recipient'; draft: TransferDraft | null }`, `form` gains `recipient: TransferRecipient`, `ended` gains `transfer: Transfer | null`; `useTransferFlow(generate?, start?: TransferRecipient | null)` gains `choose(recipient)`; `recipientOf(values)`.
  - `requiresOtp(amount)`, `flowHeading(state): { title; step; total; label }`, `transferSummary(state, ctx): { rows: SummaryRows; note: string }`, `OTP_NOTICE` (`lib/client/transfer-steps.ts`).
  - `RecipientStep({ accounts, beneficiaries, onChoose })` (all own accounts, R38); `TransferForm` props `recipient` (new, required), `onValuesChange?`; `OtpStep`/`ReceiptStep`/`EndedStep` prop `actions?: 'fixed' | 'inline'`; `EndedStep` props `transfer`, `accounts`; `TransferSummary({ rows, note })`, `SummaryRow`, `AmountBlock` (`components/transfers/TransferSummary.tsx`).

- [ ] **Step 1: Write the failing tests**

`web/lib/client/transfer-steps.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BENEFICIARY, OVERVIEW, PRINCIPAL, pendingOtpTransfer, problem, transfer } from '@/test/fixtures';
import type { TransferDraft, TransferFlowState } from './transfer-flow';
import { OTP_NOTICE, flowHeading, requiresOtp, transferSummary } from './transfer-steps';

function draft(amount: string): TransferDraft {
  return {
    values: { fromAccountId: PRINCIPAL.id, destinationType: 'BENEFICIARY', toAccountId: '', beneficiaryId: BENEFICIARY.id, amount, concept: 'Renta', reference: '1' },
    request: { fromAccountId: PRINCIPAL.id, destination: { type: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id }, amount, concept: 'Renta', reference: '1' },
  };
}
const confirm = (amount: string, status: 'idle' | 'uncertain' | 'rejected' = 'idle'): TransferFlowState => ({ step: 'confirm', draft: draft(amount), status });
const CTX = { accounts: OVERVIEW.accounts, beneficiaries: [BENEFICIARY], live: null, originId: PRINCIPAL.id, remaining: '38000.00' };

describe('pasos del flujo', () => {
  it('WEB-30 un monto mayor a $10,000.00 pide código; exactamente $10,000.00 no', () => {
    expect(requiresOtp('10000.00')).toBe(false);
    expect(requiresOtp('10000.01')).toBe(true);
  });

  it('WEB-30 destinatario y monto son los pasos 1 y 2 de 5', () => {
    expect(flowHeading({ step: 'recipient', draft: null })).toEqual({ title: '¿A quién le envías?', step: 1, total: 5, label: 'Destinatario' });
    expect(flowHeading({ step: 'form', draft: null, recipient: { destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id } })).toEqual({ title: '¿Cuánto envías?', step: 2, total: 5, label: 'Monto' });
  });

  it('WEB-30 la revisión es el paso 3 de 5 con código y 3 de 4 sin él (R36)', () => {
    expect(flowHeading(confirm('15000'))).toEqual({ title: 'Revisa tu transferencia', step: 3, total: 5, label: 'Revisión' });
    expect(flowHeading(confirm('5000'))).toMatchObject({ step: 3, total: 4 });
    expect(flowHeading(confirm('5000', 'uncertain')).title).toBe('Estado sin confirmar');
    expect(flowHeading(confirm('30000', 'rejected'))).toMatchObject({ title: 'Transferencia rechazada', total: 5 });
  });

  it('WEB-30 el código es el paso 4 de 5 y el comprobante es el último paso', () => {
    expect(flowHeading({ step: 'otp', transfer: pendingOtpTransfer(), replayed: false })).toEqual({ title: 'Confirma con tu código', step: 4, total: 5, label: 'Código' });
    expect(flowHeading({ step: 'receipt', transfer: transfer(), replayed: false })).toEqual({ title: 'Transferencia enviada', step: 4, total: 4, label: 'Comprobante' });
    expect(flowHeading({ step: 'ended', problem: problem('OTP_ATTEMPTS_EXHAUSTED'), transfer: null })).toEqual({ title: 'La transferencia no se realizó', step: 5, total: 5, label: 'Comprobante' });
    expect(flowHeading({ step: 'ended', problem: problem('TRANSFER_EXPIRED'), transfer: null }).title).toBe('El código venció');
  });

  it('WEB-30 el resumen dice lo capturado y, si pedirá código, lo avisa', () => {
    expect(transferSummary({ step: 'recipient', draft: null }, CTX)).toEqual({
      rows: { desde: 'Principal · •••• 9719' },
      note: 'Te quedan $38,000.00 de tu límite diario de hoy.',
    });
    expect(transferSummary(confirm('15000'), CTX)).toEqual({
      rows: { desde: 'Principal · •••• 9719', para: 'Luis · •••• 9735', monto: '$15,000.00', concepto: 'Renta', referencia: '1' },
      note: OTP_NOTICE,
    });
  });
});
```

`web/lib/client/transfer-flow.test.tsx` — superseded by WEB-30 (the flow starts at the recipient step): in `'WEB-17 al pasar a la confirmación genera la llave del intento'` expect `result.current.state.step` to be `'recipient'`; in `'WEB-18 al agotarse el código o vencer…'` the state after `restart()` is `{ step: 'recipient', draft: null }`. Append:
```tsx
  it('WEB-30 elegir el destino pasa al monto; editar desde la revisión vuelve al monto con el mismo destino', () => {
    const recipient = { destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id } as const;
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), { initialProps: { generate: keys() } });
    act(() => result.current.choose(recipient));
    expect(result.current.state).toEqual({ step: 'form', draft: null, recipient });
    act(() => result.current.review(DRAFT));
    act(() => result.current.edit());
    expect(result.current.state).toMatchObject({ step: 'form', draft: DRAFT, recipient });
  });

  it('WEB-30 con un beneficiario del acceso directo empieza en el monto y reiniciar vuelve al destinatario', () => {
    const start = { destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id } as const;
    const { result } = renderHook(({ generate }) => useTransferFlow(generate, start), { initialProps: { generate: keys() } });
    expect(result.current.state).toEqual({ step: 'form', draft: null, recipient: start });
    act(() => result.current.restart());
    expect(result.current.state).toEqual({ step: 'recipient', draft: null });
  });

  it('WEB-18 al terminar el intento conserva la transferencia para su comprobante', () => {
    const { result } = renderHook(({ generate }) => useTransferFlow(generate), { initialProps: { generate: keys() } });
    act(() => result.current.review(DRAFT));
    act(() => result.current.sent(pendingOtpTransfer(), false));
    act(() => result.current.ended(problem('OTP_ATTEMPTS_EXHAUSTED')));
    expect(result.current.state).toMatchObject({ step: 'ended', transfer: pendingOtpTransfer() });
  });
```

`web/components/transfers/RecipientStep.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AHORRO, BENEFICIARY, PRINCIPAL } from '@/test/fixtures';
import { RecipientStep } from './RecipientStep';

function renderStep(props: Partial<Parameters<typeof RecipientStep>[0]> = {}) {
  const onChoose = vi.fn();
  const view = render(
    <RecipientStep accounts={[PRINCIPAL, AHORRO]} beneficiaries={[BENEFICIARY]} onChoose={onChoose} {...props} />,
  );
  return { ...view, onChoose, user: userEvent.setup() };
}

describe('RecipientStep', () => {
  it('WEB-30 ofrece todas las cuentas propias y los beneficiarios (R38)', () => {
    renderStep();
    expect(screen.getByRole('heading', { name: 'Tus cuentas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Principal/ })).toHaveAccessibleName(/CLABE •••• 9719 · \$25,000\.00/);
    expect(screen.getByRole('button', { name: /^Ahorro/ })).toHaveAccessibleName(/CLABE •••• 9722 · \$10,000\.00/);
    expect(screen.getByRole('heading', { name: 'Beneficiarios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Luis/ })).toHaveAccessibleName(/Luis Pérez Ramírez · CLABE •••• 9735/);
  });

  it('WEB-30 elegir una cuenta propia continúa como traspaso entre cuentas propias', async () => {
    const { user, onChoose } = renderStep();
    await user.click(screen.getByRole('button', { name: /^Ahorro/ }));
    expect(onChoose).toHaveBeenCalledWith({ destinationType: 'OWN_ACCOUNT', toAccountId: AHORRO.id });
  });

  it('WEB-30 elegir un beneficiario continúa con él', async () => {
    const { user, onChoose } = renderStep();
    await user.click(screen.getByRole('button', { name: /^Luis/ }));
    expect(onChoose).toHaveBeenCalledWith({ destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id });
  });

  it('WEB-15 sin beneficiarios sugiere agregar uno', () => {
    renderStep({ beneficiaries: [] });
    expect(screen.getByRole('link', { name: 'Agregar beneficiario' })).toHaveAttribute('href', '/beneficiaries/new');
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    const { container } = renderStep();
    expect(await axe(container)).toHaveNoViolations();
  });
});
```
(The case `WEB-15 sin beneficiarios sugiere agregar uno` moves here from `TransferForm.test.tsx`.)

`web/test/support/transfer-flow.ts` — `fillTransfer` goes through the two first steps (superseded by WEB-30); callers are unchanged:
```ts
/** Elige a Luis, llena el monto (Principal es el origen por omisión) y pasa a la revisión. */
export async function fillTransfer(user: User, amount = '5,000') {
  await user.click(await screen.findByRole('button', { name: /^Luis/ }));
  await user.type(await screen.findByLabelText('Monto'), amount);
  await user.selectOptions(screen.getByLabelText('Cuenta de origen'), PRINCIPAL.id);
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia'), '1');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}
```

`web/components/transfers/TransferForm.test.tsx` — the form is now the amount step and receives the chosen `recipient` (superseded by WEB-30). `renderForm` passes `recipient={TO_LUIS}` (`const TO_LUIS = { destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id } as const`) and `fillBeneficiaryTransfer` drops the origin/radio/beneficiary selections. Cases:
  - remove `WEB-16 como destino propio solo ofrece cuentas distintas de la de origen` and `WEB-16 si el origen pasa a ser la cuenta de destino elegida, se limpia el destino` (superseded by WEB-30: the destination is chosen first; replaced by the next case and by `RecipientStep` cases), and `WEB-15 sin beneficiarios…` (moved to `RecipientStep.test.tsx`);
  - add `WEB-16 la cuenta de origen no ofrece la cuenta propia de destino`: `renderForm({ recipient: { destinationType: 'OWN_ACCOUNT', toAccountId: AHORRO.id } })` → the option texts of `getByLabelText('Cuenta de origen')` contain one starting with `Principal` and none starting with `Ahorro`;
  - add `WEB-16 si el acceso directo apunta a la cuenta de destino, el origen pasa a la otra cuenta (R38)`: `renderForm({ recipient: { destinationType: 'OWN_ACCOUNT', toAccountId: PRINCIPAL.id }, defaultFromAccountId: PRINCIPAL.id })` → `getByLabelText('Cuenta de origen')` has value `AHORRO.id` and no option starts with `Principal`;
  - add `WEB-30 muestra a quién se envía sobre el monto, que es el protagonista`: `getByText('Para')`, `getByText('Luis · CLABE •••• 9735')`, `getByTestId('hero-amount-mirror')`;
  - add `WEB-25 las ayudas del concepto y de la referencia usan la redacción de la app móvil`: `getByLabelText('Concepto')` has accessible description `'De 1 a 40 caracteres.'`, `getByLabelText('Referencia')` `'De 1 a 7 dígitos.'` (R30);
  - keep both WEB-21 cases and `DSG-12`, `WEB-23` as they are;
  - `WEB-16 arma el destino de cuenta propia`: `renderForm({ recipient: { destinationType: 'OWN_ACCOUNT', toAccountId: PRINCIPAL.id }, defaultFromAccountId: AHORRO.id })`, type `200`/`Apartado`/`42`, Continuar → same `toMatchObject` as today;
  - `WEB-07 valida concepto, referencia y destino con el contrato` → rename to `WEB-07 valida concepto y referencia con el contrato` and drop the `Beneficiario` expectation (superseded by WEB-30);
  - `WEB-16 muestra el saldo disponible de la cuenta de origen`: no `selectOptions` (Principal is preselected) → same description;
  - `WEB-17 al editar recupera lo que se había escrito`: replace the `Beneficiario` expectation with `expect(screen.getByLabelText('Cuenta de origen')).toHaveValue(PRINCIPAL.id)`;
  - `WEB-16 toma la cuenta y el beneficiario de los accesos directos` → `WEB-16 toma la cuenta de origen del acceso directo`: `renderForm({ defaultFromAccountId: AHORRO.id })` → origin value `AHORRO.id` (the beneficiary shortcut is covered by the flow test below).

`web/components/transfers/TransferFlow.confirm.test.tsx` / `TransferFlow.flow.test.tsx` — updates (superseded by WEB-30 for titles/regions and by WEB-25 for copy shared with the mobile app; every call/key/payload assertion stays):
  - `findByRole('region', { name: 'Confirma la transferencia' })` → `{ name: 'Revisa tu transferencia' }`; `'Principal •••• 9719'` → `'Principal · •••• 9719'`; `'Luis •••• 9735'` → `'Luis · •••• 9735'`.
  - uncertain (R37, superseded by WEB-30): `expect(await screen.findByRole('alert')).toHaveTextContent('No sabemos si la transferencia se envió')` → `expect(await screen.findByText('No pudimos confirmar el estado de tu transferencia')).toBeVisible()` (the state is a warning `status`, as in mobile `attempt-actions.tsx`).
  - `getByRole('heading', { name: 'Ingresa el código' })` → `{ name: 'Confirma con tu código' }` (still `toHaveFocus()` in the full-flow case).
  - OTP copy: `expect(screen.getByText(/an\*\*\*@example\.com/)).toHaveTextContent('Vence a las 10:52')` → `expect(screen.getByText('Te enviamos un código de 6 dígitos a an***@example.com.')).toBeVisible(); expect(screen.getByText('Vence a las 10:52.')).toBeVisible();`.
  - rename `WEB-17 con doble clic en "Enviar" envía una sola transferencia y el botón indica que se envía` → `WEB-30 WEB-17 con doble clic en "Enviar" en la revisión crea una sola transferencia y el botón indica que se envía` (body unchanged — Review Focus #1).
  - (R37, superseded by WEB-30) `WEB-18 al agotar los intentos ofrece iniciar una transferencia nueva desde cero` → `WEB-30 WEB-18 al agotar los intentos muestra el comprobante fallido y ofrece intentar de nuevo`: after the alert assertion, `expect(within(screen.getByRole('region', { name: 'Comprobante' })).getByText('Fallida')).toBeVisible()`; click `'Intentar de nuevo'` (was `'Iniciar una nueva transferencia'`); then `expect(await screen.findByRole('heading', { level: 1, name: '¿A quién le envías?' })).toBeVisible()` (the restart goes back to the first step; the old `Monto` empty check moves after choosing Luis again: `await user.click(screen.getByRole('button', { name: /^Luis/ })); expect(screen.getByLabelText('Monto')).toHaveValue('');`).
Append to `TransferFlow.flow.test.tsx` (imports: add `waitFor`, `within`, `router` from `@/test/support/next-navigation`, `AHORRO`, `PRINCIPAL`):
```tsx
  it('WEB-30 el indicador muestra el paso 3 de 5 en la revisión de una transferencia con código y lo anuncia', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    expect(await screen.findByText('Paso 1 de 5 · Destinatario')).toHaveAttribute('aria-live', 'polite');
    await fillTransfer(user, '15,000');
    expect(await screen.findByText('Paso 3 de 5 · Revisión')).toHaveAttribute('aria-live', 'polite');
  });

  it('WEB-30 sin código la revisión es el paso 3 de 4 y el comprobante el 4 de 4', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);
    expect(await screen.findByText('Paso 3 de 4 · Revisión')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Paso 4 de 4 · Comprobante')).toBeVisible();
  });

  it('WEB-30 elegir la cuenta de Ahorro continúa como traspaso entre cuentas propias sin pedir beneficiario', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await user.click(await screen.findByRole('button', { name: /^Ahorro/ }));
    expect(screen.queryByLabelText('Beneficiario')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Monto'), '200');
    await user.type(screen.getByLabelText('Concepto'), 'Apartado');
    await user.type(screen.getByLabelText('Referencia'), '42');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      fromAccountId: PRINCIPAL.id,
      destination: { type: 'OWN_ACCOUNT', accountId: AHORRO.id },
      amount: '200',
    });
  });

  it('WEB-30 WEB-16 desde la pestaña Transferir, elegir Principal deja Ahorro como origen (R38)', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await user.click(await screen.findByRole('button', { name: /^Principal/ }));
    const origin = screen.getByLabelText('Cuenta de origen');
    expect(origin).toHaveValue(AHORRO.id);
    expect(within(origin).getAllByRole('option').some((option) => option.textContent?.startsWith('Principal'))).toBe(false);
    await user.type(screen.getByLabelText('Monto'), '300');
    await user.type(screen.getByLabelText('Concepto'), 'Regreso');
    await user.type(screen.getByLabelText('Referencia'), '7');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      fromAccountId: AHORRO.id,
      destination: { type: 'OWN_ACCOUNT', accountId: PRINCIPAL.id },
      amount: '300',
    });
  });

  it('WEB-30 con el beneficiario del acceso directo empieza en el monto', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow defaultBeneficiaryId={BENEFICIARY.id} />);
    expect(await screen.findByRole('heading', { level: 1, name: '¿Cuánto envías?' })).toBeVisible();
    expect(screen.getByText('Luis · CLABE •••• 9735')).toBeVisible();
    await user.type(screen.getByLabelText('Monto'), '10');
  });

  it('WEB-22 si la sesión terminó al enviar, lleva al inicio de sesión con el regreso al flujo', async () => {
    createMock.mockResolvedValue({ ok: false, problem: problem('UNAUTHENTICATED', { status: 401 }) });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/login?next=%2Ftransfers%2Fnew&reason=expired'),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('WEB-30 en el dashboard el resumen acompaña cada paso con lo capturado', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    const summary = await screen.findByRole('region', { name: 'Resumen' });
    expect(summary).toHaveTextContent('Principal · •••• 9719');
    expect(summary).toHaveTextContent('Por definir');
    expect(summary).toHaveTextContent('Te quedan $38,000.00 de tu límite diario de hoy.');
    await user.click(screen.getByRole('button', { name: /^Luis/ }));
    await user.type(await screen.findByLabelText('Monto'), '15,000');
    const updated = screen.getByRole('region', { name: 'Resumen' });
    expect(updated).toHaveTextContent('Luis · •••• 9735');
    expect(updated).toHaveTextContent('$15,000.00');
    expect(updated).toHaveTextContent('Como el monto es mayor a $10,000.00');
  });
```
(`BENEFICIARY`, `problem`, `transfer` are already imported by these files or come from `@/test/fixtures`.)

`web/components/transfers/OtpStep.test.tsx` — superseded by WEB-30 (R37: copy of the approved `TransferOtp`/`TransferFailed`; the per-code messages are unchanged): `WEB-16 indica el destino enmascarado…` asserts `getByText('Te enviamos un código de 6 dígitos a an***@example.com.')` and `getByText('Vence a las 10:52.')`; in `EndedStep` cases pass `transfer={null} accounts={[]}`, the exhausted case is renamed `WEB-30 WEB-18 con los intentos agotados indica que no se realizó y ofrece intentar de nuevo`, asserts the alert has `problemMessage('OTP_ATTEMPTS_EXHAUSTED')` (no "La transferencia no se realizó" title: that is now the FlowHeader title) and clicks `'Intentar de nuevo'`. Append:
```tsx
  it('WEB-30 el monto es el protagonista del paso de código, con los intentos que quedan', async () => {
    confirmMock.mockResolvedValue({ ok: false, problem: problem('OTP_INVALID', { attemptsRemaining: 2 }) });
    const { user } = renderStep();
    expect(screen.getByText('$15,000.00')).toBeVisible();
    expect(screen.getByText('Para Luis · CLABE •••• 9735')).toBeVisible();
    expect(screen.getByText('Te quedan 3 intentos.')).toBeVisible();
    await submitCode(user, '000000');
    expect(await screen.findByText('Te quedan 2 intentos.')).toBeVisible();
  });

  it('WEB-18 WEB-25 al agotar los intentos muestra el comprobante con el estado "Fallida"', () => {
    render(<EndedStep problem={problem('OTP_ATTEMPTS_EXHAUSTED')} transfer={pendingOtpTransfer()} accounts={OVERVIEW.accounts} onRestart={vi.fn()} />);
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Fallida')).toBeVisible();
    expect(receipt).toHaveTextContent('Principal · •••• 9719');
    expect(screen.getByRole('link', { name: 'Ver mis cuentas' })).toHaveAttribute('href', '/');
  });
```
(Add `within` and `OVERVIEW` to the imports.)

`web/components/transfers/receipt.test.tsx` — `'Principal •••• 9719'` → `'Principal · •••• 9719'`, `'Luis •••• 9735'` → `'Luis · •••• 9735'` (WEB-25, the separator is now text).

`web/test/accessibility.test.tsx` — in the `it.each` table replace the `transferencia` row (superseded by WEB-30: the form is the amount step, first field "Monto") by
`['transferencia', <TransferForm key="transfer" accounts={OVERVIEW.accounts} beneficiaries={[BENEFICIARY]} recipient={{ destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id }} onSubmit={() => undefined} />, 'Continuar', 'Monto']`; in `WEB-23 al cambiar de paso el foco va al título del paso` the heading is `'Revisa tu transferencia'`.

`web/components/ui/overlays.test.tsx` — **replace** the existing `WEB-30 anuncia el paso actual` case (it asserts `getByRole('group', …)`; superseded: the group label read the step twice, final-review 6.5 item) with:
```tsx
  it('WEB-30 anuncia el paso actual una sola vez', () => {
    render(<Stepper current={3} total={5} label="Revisión" />);
    expect(screen.getByText('Paso 3 de 5 · Revisión')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
```
Append `FlowHeader` and `StepActions` cases:
```tsx
  it('WEB-23 al cambiar de paso el título recibe el foco; al abrir la página, no', () => {
    const { rerender } = render(<FlowHeader title="¿A quién le envías?" step={1} total={5} stepLabel="Destinatario" closeHref="/" titleId="t" focusTitle />);
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
    rerender(<FlowHeader title="¿Cuánto envías?" step={2} total={5} stepLabel="Monto" closeHref="/" titleId="t" focusTitle />);
    expect(screen.getByRole('heading', { level: 1, name: '¿Cuánto envías?' })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 't');
  });

  it('WEB-30 en teléfono las acciones del paso quedan fijas abajo y un espaciador reserva su alto', () => {
    const { container } = render(<StepActions stacked><button type="button">Enviar</button></StepActions>);
    expect(screen.getByRole('button', { name: 'Enviar' }).closest('.fixed')).toHaveClass('inset-x-0', 'bottom-0', 'dashboard:static');
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('h-36', 'dashboard:hidden');
  });

  it('WEB-30 en una página con pestañas las acciones van en línea', () => {
    render(<StepActions fixed={false}><button type="button">Ver mis cuentas</button></StepActions>);
    expect(screen.getByRole('button', { name: 'Ver mis cuentas' }).closest('.fixed')).toBeNull();
  });
```
`web/components/ui/data.test.tsx` — `Receipt`: `'Principal •••• 9719'` → `'Principal · •••• 9719'`, `'Luis •••• 9735'` → `'Luis · •••• 9735'`; the case `WEB-25 separa el nombre de la terminación con un " · " decorativo…` becomes `WEB-25 separa el nombre de la terminación con " · ", como en la revisión` asserting the two `toHaveTextContent` strings (the CSS `after:content` workaround is gone, final-review 6.5 item).

- [ ] **Step 2: Run** — `npx vitest run lib/client components/transfers components/ui/overlays.test.tsx components/ui/data.test.tsx test/accessibility.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`web/components/ui/StepActions.tsx` (the story's `StepActions`, now in the kit):
```tsx
import type { ReactNode } from 'react';

export interface StepActionsProps {
  children: ReactNode;
  /** Dos botones apilados en teléfono: el espaciador reserva más alto. */
  stacked?: boolean;
  /** `false`: en línea debajo del contenido (páginas con pestañas, como el detalle). */
  fixed?: boolean;
}

/**
 * Acciones de un paso del flujo (WEB-30). En teléfono quedan fijas abajo con un borde superior, como
 * el `footer` de Screen en la app móvil (WEB-25); el espaciador reserva su alto para que no tapen el
 * contenido. En el dashboard van en línea, debajo del paso.
 */
export function StepActions({ children, stacked = false, fixed = true }: StepActionsProps) {
  if (!fixed) return <div className="grid gap-3 dashboard:flex">{children}</div>;
  return (
    <>
      <div aria-hidden="true" className={`${stacked ? 'h-36' : 'h-21'} dashboard:hidden`} />
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface-canvas px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dashboard:static dashboard:border-0 dashboard:bg-transparent dashboard:p-0">
        <div className="mx-auto grid max-w-app gap-3 dashboard:mx-0 dashboard:flex dashboard:max-w-none">
          {children}
        </div>
      </div>
    </>
  );
}
```

`web/components/ui/FlowHeader.tsx` — becomes `'use client'`; add the two optional props; the `h1` gets `ref`, `id={titleId}`, `tabIndex={focusTitle ? -1 : undefined}` and `focus-visible:outline-none`; focus on step change only (StrictMode-safe):
```tsx
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(`${step}·${title}`);
  useEffect(() => {
    const key = `${step}·${title}`;
    if (shown.current === key) return;
    shown.current = key;
    // Con teclado o lector de pantalla, el cambio de paso se nota y la navegación sigue desde aquí (WEB-23).
    if (focusTitle) heading.current?.focus();
  }, [step, title, focusTitle]);
```
`web/components/ui/Stepper.tsx` — drop `role="group"` and `aria-label` from the wrapper (now `<div className="grid gap-2">`); bars and the live `<p>` unchanged. `web/components/ui/Receipt.tsx` — delete `SEPARATOR`; origin `<>{fromAccount.name} · {maskClabe(fromAccount.clabe)}</>`, destination `` `${transfer.destination.displayName} · •••• ${transfer.destination.clabeLast4}` ``.

`web/lib/client/transfer-flow.ts` — add the recipient step:
```ts
/** Destino elegido en el primer paso (WEB-30). */
export type TransferRecipient =
  | { destinationType: 'OWN_ACCOUNT'; toAccountId: string }
  | { destinationType: 'BENEFICIARY'; beneficiaryId: string };

export function recipientOf(values: TransferFormValues): TransferRecipient {
  return values.destinationType === 'OWN_ACCOUNT'
    ? { destinationType: 'OWN_ACCOUNT', toAccountId: values.toAccountId }
    : { destinationType: 'BENEFICIARY', beneficiaryId: values.beneficiaryId };
}
```
`TransferFlowState`: add `| { step: 'recipient'; draft: TransferDraft | null }`, change form to `{ step: 'form'; draft: TransferDraft | null; recipient: TransferRecipient }`, ended to `{ step: 'ended'; problem: ActionProblem; transfer: Transfer | null }`. `FlowEvent`: add `{ type: 'CHOOSE'; recipient: TransferRecipient }`. `INITIAL = { step: 'recipient', draft: null }`. Reducer: `case 'CHOOSE': return state.step === 'recipient' ? { step: 'form', draft: state.draft, recipient: event.recipient } : state;`; `case 'EDIT': return state.step === 'confirm' ? { step: 'form', draft: state.draft, recipient: recipientOf(state.draft.values) } : state;`; `case 'ENDED': return { step: 'ended', problem: event.problem, transfer: state.step === 'otp' ? state.transfer : null };`. `useTransferFlow(generate?: () => string, start: TransferRecipient | null = null)` initializes lazily: `useReducer(transferFlowReducer, start, (first): TransferFlowState => first ? { step: 'form', draft: null, recipient: first } : INITIAL)` and adds `choose(recipient: TransferRecipient) { dispatch({ type: 'CHOOSE', recipient }); }` (no key change: the key is still issued in `review`). Update the doc comment of the reducer: "destinatario → monto → confirmación → (código) → comprobante".

`web/lib/client/transfer-steps.ts`:
```ts
import { amountInput, formatMXN, toCents, type Account, type Beneficiary, type Transfer } from '@devchrisvaz/wallet-contract';
import { maskClabe, normalizeAmountInput } from '@/lib/money';
import type { TransferFlowState, TransferFormValues, TransferRecipient } from './transfer-flow';

const OTP_THRESHOLD_CENTS = toCents('10000.00');

/** Montos mayores a $10,000.00 piden un código por correo (HU6). */
export function requiresOtp(amount: string): boolean {
  return toCents(amount) > OTP_THRESHOLD_CENTS;
}

export const OTP_NOTICE =
  'Como el monto es mayor a $10,000.00, te enviaremos un código de confirmación a tu correo.';

export interface FlowHeading {
  title: string;
  step: number;
  total: number;
  label: string;
}

/** Título e indicador de cada paso (WEB-30); el total pasa a 4 cuando el monto no pide código (R36). */
export function flowHeading(state: TransferFlowState): FlowHeading {
  switch (state.step) {
    case 'recipient':
      return { title: '¿A quién le envías?', step: 1, total: 5, label: 'Destinatario' };
    case 'form':
      return { title: '¿Cuánto envías?', step: 2, total: 5, label: 'Monto' };
    case 'confirm':
      return {
        title: state.status === 'uncertain' ? 'Estado sin confirmar' : state.status === 'rejected' ? 'Transferencia rechazada' : 'Revisa tu transferencia',
        step: 3,
        total: requiresOtp(state.draft.request.amount) ? 5 : 4,
        label: 'Revisión',
      };
    case 'otp':
      return { title: 'Confirma con tu código', step: 4, total: 5, label: 'Código' };
    case 'receipt': {
      const total = state.transfer.requiresOtp ? 5 : 4;
      const title = state.transfer.status === 'COMPLETED' ? 'Transferencia enviada' : 'Estado de la transferencia';
      return { title, step: total, total, label: 'Comprobante' };
    }
    case 'ended':
      return {
        title: state.problem.code === 'TRANSFER_EXPIRED' ? 'El código venció' : 'La transferencia no se realizó',
        step: 5,
        total: 5,
        label: 'Comprobante',
      };
  }
}

export interface SummaryRows { desde?: string; para?: string; monto?: string; concepto?: string; referencia?: string }

export interface SummaryContext {
  accounts: Account[];
  beneficiaries: Beneficiary[];
  /** Lo que se va escribiendo en el paso de monto. */
  live: TransferFormValues | null;
  originId: string | undefined;
  /** `dailyLimit.remaining` tal como lo devuelve la API (WEB-13: sin calcularlo). */
  remaining: string;
}

const accountText = (account: Account | undefined) => (account ? `${account.name} · ${maskClabe(account.clabe)}` : undefined);
const beneficiaryText = (beneficiary: Beneficiary | undefined) => (beneficiary ? `${beneficiary.alias} · ${maskClabe(beneficiary.clabe)}` : undefined);
const transferText = (transfer: Transfer) => `${transfer.destination.displayName} · •••• ${transfer.destination.clabeLast4}`;

/** El monto escrito si ya es válido para el contrato (sin separadores); si no, nada. */
function typedAmount(text: string): string | undefined {
  const normalized = normalizeAmountInput(text);
  return amountInput.safeParse(normalized).success ? normalized : undefined;
}

function omitEmpty(rows: SummaryRows): SummaryRows {
  return Object.fromEntries(Object.entries(rows).filter(([, value]) => value)) as SummaryRows;
}

/** Resumen lateral del dashboard (WEB-30): lo capturado y, si pedirá código, el aviso. */
export function transferSummary(state: TransferFlowState, ctx: SummaryContext): { rows: SummaryRows; note: string } {
  const account = (id: string | undefined) => ctx.accounts.find((item) => item.id === id);
  const destination = (recipient: TransferRecipient) =>
    recipient.destinationType === 'OWN_ACCOUNT'
      ? accountText(account(recipient.toAccountId))
      : beneficiaryText(ctx.beneficiaries.find((item) => item.id === recipient.beneficiaryId));
  const note = (amount: string | undefined, final: boolean) =>
    amount && !final && requiresOtp(amount) ? OTP_NOTICE : `Te quedan ${formatMXN(ctx.remaining)} de tu límite diario de hoy.`;
  switch (state.step) {
    case 'recipient':
      return { rows: omitEmpty({ desde: accountText(account(ctx.originId)) }), note: note(undefined, false) };
    case 'form': {
      const values = ctx.live;
      const amount = values ? typedAmount(values.amount) : undefined;
      return {
        rows: omitEmpty({
          desde: accountText(account(values?.fromAccountId || ctx.originId)),
          para: destination(state.recipient),
          monto: amount ? formatMXN(amount) : undefined,
          concepto: values?.concept || undefined,
          referencia: values?.reference || undefined,
        }),
        note: note(amount, false),
      };
    }
    case 'confirm': {
      const { request, values } = state.draft;
      return {
        rows: { desde: accountText(account(request.fromAccountId)), para: destination(recipientOf(values)), monto: formatMXN(request.amount), concepto: request.concept, referencia: request.reference },
        note: note(request.amount, false),
      };
    }
    case 'otp':
    case 'receipt':
    case 'ended': {
      const transfer = state.transfer;
      if (!transfer) return { rows: {}, note: note(undefined, true) };
      return {
        rows: { desde: accountText(account(transfer.fromAccountId)), para: transferText(transfer), monto: formatMXN(transfer.amount), concepto: transfer.concept, referencia: transfer.reference },
        note: note(transfer.amount, state.step !== 'otp'),
      };
    }
  }
}
```
(Import `recipientOf` from `./transfer-flow`; `omitEmpty` keeps `toEqual` exact in the tests above. After a completed send the note shows the `remaining` the accounts refetch returns, so it drops by the amount without any arithmetic in the browser — the story's $30,250.00.)

`web/components/transfers/TransferSummary.tsx` — story `SummaryRow`, `AmountBlock` and `Summary` (renamed `TransferSummary`), verbatim classes:
```tsx
import { ListSection } from '@/components/ui/ListSection';
import type { SummaryRows } from '@/lib/client/transfer-steps';

/** Fila etiqueta / valor del resumen (revisión y panel lateral). */
export function SummaryRow({ term, value }: { term: string; value: string | undefined }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-3">
      <dt className="text-body-sm text-fg-secondary">{term}</dt>
      <dd className={`text-right text-label tabular-nums ${value ? 'text-fg' : 'text-fg-muted'}`}>{value ?? 'Por definir'}</dd>
    </div>
  );
}

/** El monto protagonista de la revisión y del código. */
export function AmountBlock({ amount, caption }: { amount: string; caption?: string }) {
  return (
    <div className="grid justify-items-center gap-1 py-2 text-center">
      <p className="text-label text-fg-secondary">Monto</p>
      <p className="text-display text-fg tabular-nums">{amount}</p>
      {caption ? <p className="text-body-sm text-fg-secondary">{caption}</p> : null}
    </div>
  );
}

/** Resumen lateral del dashboard (WEB-30): lo que lleva capturado la transferencia. */
export function TransferSummary({ rows, note }: { rows: SummaryRows; note: string }) {
  return (
    <ListSection title="Resumen" className="hidden self-start dashboard:block">
      <dl className="divide-y divide-border">
        <SummaryRow term="Desde" value={rows.desde} />
        <SummaryRow term="Para" value={rows.para} />
        <SummaryRow term="Monto" value={rows.monto} />
        <SummaryRow term="Concepto" value={rows.concepto} />
        <SummaryRow term="Referencia" value={rows.referencia} />
      </dl>
      <p className="border-t border-border pt-3 text-caption text-fg-muted">{note}</p>
    </ListSection>
  );
}
```

`web/components/transfers/RecipientStep.tsx` — story `TransferRecipient` + `RecipientOption` (`<button type="button" className="flex min-h-16 w-full items-center gap-3 py-3 text-left">` with the avatar, label/description spans and `<Icon name="forward" className="text-fg-muted" />`), each option with `onClick`. Own accounts: **every** account of `accounts` (R38: the origin is chosen in the next step, which then excludes the recipient) in `ListSection title="Tus cuentas"`, avatar `<Avatar icon="ownTransfer" />`, description `` `CLABE ${maskClabe(account.clabe)} · ${formatMXN(account.balance)}` ``, choose `{ destinationType: 'OWN_ACCOUNT', toAccountId }`. Beneficiaries in `ListSection title="Beneficiarios"`, avatar `<Avatar initials={initials(beneficiary.name)} />`, label alias, description `` `${beneficiary.name} · CLABE ${maskClabe(beneficiary.clabe)}` ``; without beneficiaries the section shows `<p className="py-3 text-body-sm text-fg-secondary">Aún no tienes beneficiarios.{' '}<Link href="/beneficiaries/new" className="text-action underline underline-offset-2">Agregar beneficiario</Link></p>`. Returns a fragment (the step section is the grid).

`web/components/transfers/TransferForm.tsx` — the amount step (story `TransferAmount`). Props: add `recipient: TransferRecipient` and `onValuesChange?: ((values: TransferFormValues) => void) | undefined`; `defaults(props)`: `initialValues` if given; otherwise `origins = accounts.filter((a) => !(recipient.destinationType === 'OWN_ACCOUNT' && a.id === recipient.toAccountId))`, `fromAccountId = origins.find((a) => a.id === defaultFromAccountId)?.id ?? origins[0]?.id ?? ''`, destination fields from `recipient`, the rest `''`. Delete the destination fieldset/selects and the `fromField` onChange (the origin list never contains the chosen own destination). Render, in this order: a `ListSection` "Para" row (story markup: `Avatar` — `icon="ownTransfer"` for an own account, `initials(beneficiary.name)` for a beneficiary — then `<p className="text-caption text-fg-secondary">Para</p>` and `<p className="truncate text-label text-fg">{label} · CLABE {maskClabe(clabe)}</p>` where `label` is `beneficiary.alias` for a beneficiary and `account.name` for an own account, as in the story and the tests (`Luis · CLABE •••• 9735`)); `<AmountField variant="hero" label="Monto" hint="Hasta 2 decimales, por ejemplo 1,250.50." error={errors.amount?.message} {...register('amount')} />`; the `Select` "Cuenta de origen" over `origins` (options `{name} · {formatMXN(balance)}`, hint `Saldo disponible: …`); `TextField` Concepto `hint="De 1 a 40 caracteres."`; `TextField` Referencia `inputMode="numeric" hint="De 1 a 7 dígitos."` (R30); `<StepActions><Button type="submit">Continuar</Button></StepActions>`. The form keeps `noValidate`, `handleSubmit(onSubmit)` and `transferResolver`; className `grid content-start gap-5`. Live values for the summary (`useWatch`, not `watch()`: `react-hooks/incompatible-library` warns on `watch` and the web lint runs with `--max-warnings=0`; `control` is already destructured and `useWatch` returns the default values on the first render):
```tsx
  const live = useWatch({ control });
  useEffect(() => {
    onValuesChange?.(live as TransferFormValues);
  }, [live, onValuesChange]);
```

`web/components/transfers/ConfirmStep.tsx` — story `ReviewSummary` + actions. Keep the props, the origin/destination lookups, `rejectionTitle` and both alerts' `focusOnMount`. Render `<AmountBlock amount={formatMXN(request.amount)} />`, a `ListSection` with `<dl className="divide-y divide-border">` rows Desde (`Principal · •••• 9719` format), Para, Concepto, Referencia (`SummaryRow`), `{requiresOtp(request.amount) ? <InlineAlert tone="info">{OTP_NOTICE}</InlineAlert> : null}`; uncertain → `<InlineAlert tone="warning" title="No pudimos confirmar el estado de tu transferencia" focusOnMount>Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces.</InlineAlert>` (story `TransferUncertain`, mobile copy); rejected → today's danger alert unchanged (title "Saldo insuficiente"/"Superaste tu límite diario", `describeProblem`, and for `INSUFFICIENT_FUNDS` "Saldo disponible en {origin.name}: {formatMXN(origin.balance)}" — WEB-16 requires the balance next to the rejection, so it stays even though the story shows only the message; 8.1 classifies it "por diseño"). Actions in `StepActions`: rejected → `<Button variant="secondary" onClick={onEdit}>Corregir</Button>`; uncertain → `<Button onClick={onSend}>Reintentar</Button>`; otherwise `stacked` with `<Button loading={sending} loadingLabel="Enviando…" onClick={onSend}>Enviar</Button>` and `<Button variant="ghost" disabled={sending} onClick={onEdit}>Editar</Button>`. Remove `StepHeading` and the outer `<section>` (the flow wraps every step). Return a fragment.

`web/components/transfers/OtpStep.tsx` — `OtpStep` gets `actions?: 'fixed' | 'inline'` (default `'fixed'`). Keep all logic (`ENDING_CODES`, `inFlight`, resend, `sessionEnded`, alerts). Also keep the remaining attempts in the challenge after a wrong code:
```ts
      if (result.problem.code === 'OTP_INVALID') {
        const left = (result.problem as { attemptsRemaining?: unknown }).attemptsRemaining;
        if (typeof left === 'number') setChallenge((current) => (current ? { ...current, attemptsRemaining: left } : current));
      }
      setError(describeProblem(result.problem));
```
Render (story `TransferOtp`): `<AmountBlock amount={formatMXN(transfer.amount)} caption={`Para ${transfer.destination.displayName} · CLABE •••• ${transfer.destination.clabeLast4}`} />`; the delivery-failed warning, notice and error alerts as today; `<form noValidate onSubmit={…} className="grid gap-4">` with, when `challenge`, `<p className="text-body text-fg">Te enviamos un código de 6 dígitos a {challenge.maskedDestination}.</p>` and `<div className="grid gap-1 text-body-sm text-fg-secondary tabular-nums"><p>Vence a las {formatTime(challenge.expiresAt)}.</p><p>{challenge.attemptsRemaining === 1 ? 'Te queda 1 intento.' : `Te quedan ${challenge.attemptsRemaining} intentos.`}</p></div>`, then the `OtpField` and `<StepActions stacked={canResend} fixed={actions === 'fixed'}>` with "Confirmar" and, if `canResend`, the ghost "Reenviar código". Remove `StepHeading`. `EndedStep({ problem, transfer, accounts, onRestart, actions = 'fixed' })`: `endedTitle` returns `'Superaste tu límite diario'` for `DAILY_LIMIT_EXCEEDED`, `'Saldo insuficiente'` for `INSUFFICIENT_FUNDS` and `undefined` otherwise (the generic title is now the FlowHeader's); render `<InlineAlert tone="danger" title={endedTitle(problem)} focusOnMount>{describeProblem(problem)}</InlineAlert>`, then a receipt when the transfer is known and the code says how it ended:
```tsx
const ENDED_STATUS: Partial<Record<string, Transfer['status']>> = {
  OTP_ATTEMPTS_EXHAUSTED: 'FAILED',
  DAILY_LIMIT_EXCEEDED: 'FAILED',
  INSUFFICIENT_FUNDS: 'FAILED',
  TRANSFER_EXPIRED: 'EXPIRED',
};
// …
const status = ENDED_STATUS[problem.code];
{transfer && status ? (
  <Receipt transfer={{ ...transfer, status }} fromAccount={accounts.find((a) => a.id === transfer.fromAccountId)} />
) : null}
```
(The status comes from the API's answer — 422 `OTP_ATTEMPTS_EXHAUSTED` means the transfer is `FAILED` — so the receipt shows the real result, as mobile `outcome-view.tsx` does with its badge.) Actions `<StepActions stacked fixed={actions === 'fixed'}><Button onClick={onRestart}>Intentar de nuevo</Button><Link href="/" className={buttonClasses('secondary')}>Ver mis cuentas</Link></StepActions>` (story `TransferFailed`).

`web/components/transfers/ReceiptStep.tsx` — keep the invalidation effect; add `actions?: 'fixed' | 'inline'`; render `<Receipt …/>` and `<StepActions stacked={Boolean(onRestart)} fixed={actions === 'fixed'}>` with the "Ver mis cuentas" secondary `Link` and, with `onRestart`, the ghost "Hacer otra transferencia"; remove `StepHeading` and the outer `section`.

`web/components/transfers/TransferDetailScreen.tsx` — the detail page has tabs, so its steps use inline actions: `<ReceiptStep transfer={transfer} accounts={overview.data.accounts} actions="inline" />`; pending: `<><StepHeading>Confirma con tu código</StepHeading><OtpStep … actions="inline" /></>`; ended: `<EndedStep problem={ended} transfer={query.data} accounts={overview.data.accounts} actions="inline" onRestart={() => router.push('/transfers/new')} />`. (6.6 adds the detail layout.)

`web/components/transfers/TransferFlow.tsx` — data gate + steps + frame:
```tsx
export const FLOW_TITLE_ID = 'transfer-flow-title';
const RECIPIENT = flowHeading({ step: 'recipient', draft: null });

/** Encabezado del paso, el paso (región nombrada por su título) y el resumen del dashboard (WEB-30). */
function FlowFrame({ heading, summary, children }: { heading: FlowHeading; summary?: ReactNode; children: ReactNode }) {
  return (
    <>
      {/* FlowHeader antes del paso: los efectos corren en orden de hermanos, así el foco de una alerta
          (focusOnMount, WEB-23) gana al del título. No cambiar este orden. */}
      <FlowHeader titleId={FLOW_TITLE_ID} focusTitle title={heading.title} step={heading.step} total={heading.total} stepLabel={heading.label} closeHref="/" />
      <div className="grid gap-8 dashboard:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby={FLOW_TITLE_ID} className="grid content-start gap-5">{children}</section>
        {summary}
      </div>
    </>
  );
}

export function TransferFlow({ defaultFromAccountId, defaultBeneficiaryId, generateKey }: TransferFlowProps) {
  const overview = useAccountsOverview();
  const beneficiaries = useBeneficiaries();
  // Una relectura que falla con datos en caché no desmonta el intento en curso.
  if (!overview.data || !beneficiaries.data) {
    return (
      <FlowFrame heading={RECIPIENT}>
        {overview.isError || beneficiaries.isError ? (
          <ErrorState title="No pudimos cargar tus cuentas y beneficiarios" error={overview.error ?? beneficiaries.error}
            onRetry={() => { void overview.refetch(); void beneficiaries.refetch(); }} />
        ) : (
          <LoadingState label="Cargando tus cuentas y beneficiarios" />
        )}
      </FlowFrame>
    );
  }
  const items = beneficiaries.data.items;
  const start: TransferRecipient | null = items.some((item) => item.id === defaultBeneficiaryId)
    ? { destinationType: 'BENEFICIARY', beneficiaryId: defaultBeneficiaryId as string }
    : null;
  return (
    <TransferSteps accounts={overview.data.accounts} remaining={overview.data.dailyLimit.remaining} beneficiaries={items}
      defaultFromAccountId={defaultFromAccountId} start={start} generateKey={generateKey} />
  );
}
```
`TransferSteps` (same file) holds `useTransferFlow(generateKey, start)`, the `inFlight` ref and `send()` **verbatim** from today's `TransferFlow` (including `loginPath('/transfers/new', 'expired')` on 401, `isUncertainFailure`, the accounts invalidation on rejection), `const [live, setLive] = useState<TransferFormValues | null>(null)`, `const originId = accounts.find((a) => a.id === defaultFromAccountId)?.id ?? accounts[0]?.id;`, and renders `<FlowFrame heading={flowHeading(state)} summary={<TransferSummary {...transferSummary(state, { accounts, beneficiaries, live, originId, remaining })} />}>{body}</FlowFrame>` where `body` per `state.step` is: `recipient` → `<RecipientStep accounts={accounts} beneficiaries={beneficiaries} onChoose={flow.choose} />` (`originId` only feeds the summary's "Desde"); `form` → `<TransferForm accounts={accounts} beneficiaries={beneficiaries} recipient={state.recipient} initialValues={state.draft?.values} defaultFromAccountId={defaultFromAccountId} onSubmit={flow.review} onValuesChange={setLive} />`; `confirm` → `<ConfirmStep … />` as today; `otp`/`receipt` → today's `REPLAYED_MESSAGE` info alert + `OtpStep`/`ReceiptStep` (`onRestart={flow.restart}`); `ended` → `<EndedStep problem={state.problem} transfer={state.transfer} accounts={accounts} onRestart={flow.restart} />`.

`web/app/(app)/transfers/new/page.tsx` — remove the wrapper `div` and the `h1`: return `<TransferFlow defaultFromAccountId={…} defaultBeneficiaryId={…} />` (FlowHeader owns the h1; AppFrame renders the flow mode).

- [ ] **Step 4: Run** — Step 2 command → PASS; `npm test` → all green.
- [ ] **Step 5: R7 gates.**
- [ ] **Step 6: Commit** (two commits): `feat(web): add step actions to the kit and focus the flow title on each step` (kit: `StepActions`, `FlowHeader`, `Stepper`, `Receipt` + `overlays`/`data` tests; `Refs: WEB-30, WEB-25, WEB-23, DSG-17`) and `feat(web): split the transfer into recipient, amount, review, code and receipt steps` (the rest; `Refs: WEB-30, WEB-16, WEB-17, WEB-18, WEB-19, WEB-22, WEB-25`), both `Task: redesign#6.5`.

## Task 6.6: Web Beneficiaries, New beneficiary and Transfer detail with the app patterns

Track W. Mirrors stories `Beneficiaries`, `BeneficiariesEmpty`, `NewBeneficiary` and `TransferDetail` of `web/.design-sync/previews/AppShell.tsx` (`BeneficiariesShell` and the `AppShell` wrappers are the real AppFrame from 6.1, which already sets the titles "Beneficiarios", "Agregar beneficiario", "Transferencia", the primary actions and `current={null}` on the detail). Canned → real: `[luis, mama]` → `useBeneficiaries().data.items`, `href="#"` → real routes, `sentTransfer` → `useTransfer(transferId)`. The WEB-15/WEB-20 tests keep their assertions.

**Files:**
- Modify: `web/components/beneficiaries/BeneficiariesScreen.tsx`, `web/components/beneficiaries/NewBeneficiaryForm.tsx`, `web/components/beneficiaries/beneficiaries.test.tsx`, `web/app/(app)/beneficiaries/new/page.tsx`, `web/app/(app)/transfers/[transferId]/page.tsx`, `web/components/transfers/TransferDetailScreen.tsx`, `web/components/transfers/receipt.test.tsx`

**Interfaces:**
- Consumes: `ListSection`, `Avatar`/`initials`, `buttonClasses`, `EmptyState` (`icon`), `LoadingState`, `ErrorState`, `maskClabe`, `useBeneficiaries`, `useTransfer`, `ReceiptStep`/`OtpStep`/`EndedStep` with `actions="inline"` (6.5), `StepHeading`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests** — append to `web/components/beneficiaries/beneficiaries.test.tsx`:
```tsx
  it('WEB-25 cada fila lleva el avatar con las iniciales y "Transferir a <alias>" abre el flujo con ese beneficiario', async () => {
    bffGetMock.mockResolvedValue({ items: [BENEFICIARY] });
    renderWithClient(<BeneficiariesScreen />);
    const row = within(await screen.findByRole('list', { name: 'Beneficiarios' })).getByRole('listitem');
    expect(within(row).getByText('LP')).toHaveAttribute('aria-hidden', 'true');
    expect(within(row).getByText('CLABE •••• 9735')).toBeVisible();
    expect(within(row).getByRole('link', { name: 'Transferir a Luis' })).toHaveAttribute(
      'href',
      `/transfers/new?beneficiary=${BENEFICIARY.id}`,
    );
  });

  it('WEB-27 en teléfono "Agregar beneficiario" va arriba de la lista', async () => {
    bffGetMock.mockResolvedValue({ items: [BENEFICIARY] });
    renderWithClient(<BeneficiariesScreen />);
    await screen.findByRole('list', { name: 'Beneficiarios' });
    const add = screen.getByRole('link', { name: 'Agregar beneficiario' });
    expect(add).toHaveAttribute('href', '/beneficiaries/new');
    expect(add).toHaveClass('dashboard:hidden');
  });
```
and inside `describe('NewBeneficiaryForm', …)`:
```tsx
  it('WEB-25 WEB-26 "Cancelar" vuelve a la lista y el envío ocupa todo el ancho en teléfono', () => {
    renderWithClient(<NewBeneficiaryForm />);
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/beneficiaries');
    expect(screen.getByRole('button', { name: 'Agregar beneficiario' }).parentElement).toHaveClass('grid', 'gap-3');
  });
```
Append to `describe('TransferDetailScreen', …)` in `web/components/transfers/receipt.test.tsx`:
```tsx
  it('WEB-25 WEB-27 el detalle muestra el comprobante y "Ver mis cuentas" en línea, sin tapar las pestañas', async () => {
    reads(transfer());
    renderWithClient(<TransferDetailScreen transferId={transfer().id} />);
    await screen.findByRole('region', { name: 'Comprobante' });
    const back = screen.getByRole('link', { name: 'Ver mis cuentas' });
    expect(back).toHaveAttribute('href', '/');
    expect(back.closest('.fixed')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hacer otra transferencia' })).not.toBeInTheDocument();
  });
```
- [ ] **Step 2: Run** — `npx vitest run components/beneficiaries components/transfers/receipt.test.tsx` → FAIL (no avatar, no top link class, no Cancelar).
- [ ] **Step 3: Implement**
  - `BeneficiariesScreen.tsx` — story `Beneficiaries`/`BeneficiariesEmpty`; return fragments for AppShell's grid. Loading `<LoadingState label="Cargando tus beneficiarios" />` and error `<ErrorState title="No pudimos cargar tus beneficiarios" …/>` unchanged. Empty: `<EmptyState icon="beneficiaries" title="Aún no tienes beneficiarios" description="Agrega con su CLABE a las personas a las que les envías dinero." action={<Link href="/beneficiaries/new" className={buttonClasses('secondary')}>Agregar beneficiario</Link>} />`. List: `<Link href="/beneficiaries/new" className={buttonClasses('primary', 'dashboard:hidden')}>Agregar beneficiario</Link>` then `<ListSection><ul aria-label="Beneficiarios" className="divide-y divide-border">` with, per beneficiary, `<li className="flex items-center gap-3 py-3"><Avatar initials={initials(beneficiary.name)} /><div className="grid min-w-0 flex-1 gap-1"><p className="text-label text-fg">{alias}</p><p className="text-body-sm text-fg-secondary">{name}</p><p className="text-caption text-fg-muted tabular-nums">CLABE {maskClabe(clabe)}</p></div><Link href={`/transfers/new?beneficiary=${id}`} aria-label={`Transferir a ${alias}`} className={buttonClasses('secondary', 'shrink-0')}>Transferir</Link></li>`. The desktop "Agregar beneficiario" is the TopBar action (6.1).
  - `NewBeneficiaryForm.tsx` — story `NewBeneficiary`: form className `grid gap-5 dashboard:max-w-xl dashboard:rounded-lg dashboard:bg-surface dashboard:p-8 dashboard:shadow-card`; fields and hints unchanged; actions `<div className="grid gap-3 pt-1"><Button type="submit" loading={isSubmitting} loadingLabel="Agregando…">Agregar beneficiario</Button><Link href="/beneficiaries" className={buttonClasses('ghost')}>Cancelar</Link></div>`.
  - `app/(app)/beneficiaries/new/page.tsx` — return `<NewBeneficiaryForm />` (the wrapper `div` and "Volver a beneficiarios" go; "Cancelar" replaces the back link, the shell shows the title).
  - `app/(app)/transfers/[transferId]/page.tsx` — return `<TransferDetailScreen transferId={transferId} />`.
  - `TransferDetailScreen.tsx` — wrap every branch's content in `<div className="grid gap-5 dashboard:max-w-2xl">` (story `TransferDetail`); keep the inline-action wiring from 6.5.
- [ ] **Step 4: Run** — Step 2 command → PASS; `npm test` → green.
- [ ] **Step 5: R7 gates.**
- [ ] **Step 6: Commit** — `feat(web): give beneficiaries and the transfer detail the app patterns`; `Task: redesign#6.6`; `Refs: WEB-25, WEB-26, WEB-27, WEB-15, WEB-20`.

## Task 6.7: Web accessibility and responsiveness in a real browser

Track W. Adds the real-browser checks jsdom cannot make (layout, `display: none`, contrast): a Playwright suite that starts a fake API with the canonical story data and `next dev`, and a jsdom axe pass of every screen inside the real frame. The fake API and the support helpers are reused by Task 8.1. Final-review 6.7 item: "único h1" is checked in the browser.

**Files:**
- Create: `web/playwright.config.ts`, `web/e2e/fake-api.mjs`, `web/e2e/support.ts`, `web/e2e/layout.spec.ts`, `web/e2e/keyboard.spec.ts`, `web/e2e/overlays.spec.ts`, `web/e2e/a11y.spec.ts`, `web/test/screens.a11y.test.tsx`, `web/.gitignore`
- Modify: `web/package.json` (devDependency `"@playwright/test": "1.61.1"`, script `"test:e2e": "playwright test"`), `web/package-lock.json`

**Interfaces:**
- Consumes: every screen and shell from 6.1–6.6; `axe-core/axe.min.js` (already installed through `vitest-axe`).
- Produces: `npm run test:e2e`; fake API on `127.0.0.1:4999` (`POST /__scenario` to switch data); helpers `login`, `scenario`, `visibleH1Count`, `hasHorizontalScroll`, ids `PRINCIPAL_ID`, `SENT_TRANSFER_ID`, `NOW` (`e2e/support.ts`).

- [ ] **Step 1: Install the runner** — `npm install --save-dev --save-exact @playwright/test@1.61.1` (chromium-1228 is already in `~/.cache/ms-playwright`; if Playwright reports it missing, `npx playwright install chromium`). Create `web/.gitignore`:
```
/test-results/
/playwright-report/
/blob-report/
```

- [ ] **Step 2: Write the fake API** — `web/e2e/fake-api.mjs` (plain Node, no dependencies; data identical to "Canonical story data" of `plan-phase-a.md`, so real screens can be compared with the approved stories in 8.1):
```js
#!/usr/bin/env node
// API simulada para las pruebas de navegador y la paridad de las pantallas reales (WEB-23, WEB-24,
// WEB-25): responde lo que la web pide al servidor con los datos canónicos de las historias. Nunca
// toca la base de datos. `POST /__scenario` cambia los datos (cuentas vacías, beneficiarios vacíos,
// una lectura que no responde) y reinicia el estado.
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number.parseInt(process.argv[process.argv.indexOf('--port') + 1] || '4999', 10);

const user = { id: '6f1c2a8e-1d2b-4c3d-9e4f-5a6b7c8d9e0f', email: 'ana@example.com', fullName: 'Ana Gómez Castillo', phoneMasked: '+52******5678', curpMasked: 'GOCA**************', rfcMasked: 'GOCA*********', emailVerifiedAt: '2026-10-01T15:00:00Z', createdAt: '2026-10-01T14:55:00Z' };
const principal = { id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51', name: 'Principal', clabe: '646180157000009719', currency: 'MXN', createdAt: '2026-09-30T15:00:00Z' };
const ahorro = { id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a52', name: 'Ahorro', clabe: '646180157000001234', balance: '10000.00', currency: 'MXN', createdAt: '2026-09-30T15:00:00Z' };
const luis = { id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61', name: 'Luis Pérez Ramírez', alias: 'Luis', clabe: '646180157000005678', createdAt: '2026-10-01T15:00:00Z' };
const mama = { id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c62', name: 'María Gómez', alias: 'Mamá', clabe: '646180157000004321', createdAt: '2026-10-01T15:00:00Z' };
const movements = [
  { id: 'mv-1', type: 'TRANSFER_OUT', amount: '-1250.00', balanceAfter: '25000.00', concept: 'Renta', reference: '1', counterparty: { name: 'Luis', clabeLast4: '5678' }, transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a', occurredAt: '2026-10-13T16:42:00Z' },
  { id: 'mv-2', type: 'TRANSFER_IN', amount: '450.00', balanceAfter: '26250.00', concept: 'Pago de la comida', reference: '9', counterparty: { name: 'Andrea Ruiz', clabeLast4: '8842' }, transferId: '3b5d7f9a-1c2e-4b4d-8f6a-0c2e4a6b8d91', occurredAt: '2026-10-12T23:10:00Z' },
  { id: 'mv-3', type: 'TRANSFER_OUT', amount: '-150.00', balanceAfter: '25800.00', concept: 'Despensa', reference: '1', counterparty: { name: 'Mamá', clabeLast4: '4321' }, transferId: '9b3e4c0a-7c2d-4e6a-8c7b-0a2f3e4d5c6b', occurredAt: '2026-10-12T15:05:00Z' },
  { id: 'mv-4', type: 'OWN_TRANSFER_OUT', amount: '-3000.00', balanceAfter: '25950.00', concept: 'Ahorro quincenal', reference: '15', counterparty: { name: 'Ahorro', clabeLast4: '1234' }, transferId: '8a2d3b9f-6b1c-4d5f-9b6a-9f1e2d3c4b5a', occurredAt: '2026-10-09T18:20:00Z' },
  { id: 'mv-5', type: 'DEPOSIT', amount: '28950.00', balanceAfter: '28950.00', concept: 'Depósito inicial', reference: '1', counterparty: null, transferId: '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b', occurredAt: '2026-09-30T15:05:00Z' },
];
const sent = { id: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a', status: 'COMPLETED', kind: 'THIRD_PARTY', fromAccountId: principal.id, destination: { type: 'BENEFICIARY', accountId: null, beneficiaryId: luis.id, displayName: 'Luis', clabeLast4: '5678' }, amount: '1250.00', concept: 'Renta', reference: '1', requiresOtp: false, otp: null, rejectionReason: null, failureReason: null, createdAt: '2026-10-13T16:41:00Z', completedAt: '2026-10-13T16:42:00Z' };
const challenge = { channel: 'EMAIL', deliveryStatus: 'SENT', maskedDestination: 'an***@example.com', expiresAt: '2026-10-13T18:05:00Z', attemptsRemaining: 3, resendsRemaining: 3 };
const pending = { ...sent, id: '4c8e2f6a-1b3d-4e5f-9a7b-6c8d0e2f4a6b', status: 'PENDING_OTP', amount: '15000.00', requiresOtp: true, otp: challenge, createdAt: '2026-10-13T17:41:00Z', completedAt: null };

const DEFAULTS = { accounts: 'ok', beneficiaries: 'ok' };
let scenario = { ...DEFAULTS };
let debited = false; // tras enviar los $1,250.00: Principal en $23,750.00 y el límite en $30,250.00

const later = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();
const tokens = () => ({ tokenType: 'Bearer', accessToken: `access-${randomUUID()}`, accessTokenExpiresAt: later(60), refreshToken: `refresh-${randomUUID()}`.padEnd(43, 'r'), refreshTokenExpiresAt: later(7 * 24 * 60) });

function overview() {
  if (scenario.accounts === 'empty') {
    return { accounts: [], dailyLimit: { limit: '50000.00', used: '0.00', remaining: '50000.00', resetsAt: '2026-10-14T06:00:00Z', timeZone: 'America/Mexico_City' } };
  }
  return {
    accounts: [{ ...principal, balance: debited ? '23750.00' : '25000.00' }, ahorro],
    dailyLimit: { limit: '50000.00', used: debited ? '19750.00' : '18500.00', remaining: debited ? '30250.00' : '31500.00', resetsAt: '2026-10-14T06:00:00Z', timeZone: 'America/Mexico_City' },
  };
}

function send(res, status, body, problem = false) {
  const headers = { 'X-Request-Id': randomUUID(), 'Cache-Control': 'no-store' };
  if (body === undefined) { res.writeHead(status, headers).end(); return; }
  res.writeHead(status, { ...headers, 'Content-Type': problem ? 'application/problem+json' : 'application/json' }).end(JSON.stringify(body));
}
const fail = (res, status, code, extra = {}) => send(res, status, { type: `/problems/${code.toLowerCase().replace(/_/g, '-')}`, title: code, status, code, requestId: randomUUID(), ...extra }, true);
const readBody = async (req) => { let text = ''; for await (const chunk of req) text += chunk; return text ? JSON.parse(text) : {}; };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const route = `${req.method} ${path}`;
  if (route === 'GET /health') return send(res, 200, { status: 'ok' });
  if (route === 'POST /__scenario') { scenario = { ...DEFAULTS, ...(await readBody(req)) }; debited = false; return send(res, 204); }
  if (route === 'POST /auth/login' || route === 'POST /auth/verify-email') return send(res, 200, { user, tokens: tokens() });
  if (route === 'POST /auth/refresh') return send(res, 200, tokens());
  if (route === 'POST /auth/logout') return send(res, 204);
  if (route === 'POST /auth/register' || route === 'POST /auth/verify-email/resend') return send(res, 202, { message: 'Si los datos son correctos, recibirás un correo con las instrucciones.' });
  if (route === 'GET /me') return send(res, 200, user);
  if (route === 'GET /accounts') { if (scenario.accounts === 'hang') return undefined; return send(res, 200, overview()); }
  const movementsPath = /^\/accounts\/([^/]+)\/movements$/.exec(path);
  if (req.method === 'GET' && movementsPath) {
    if (movementsPath[1] === ahorro.id) return send(res, 200, { items: [], nextCursor: null });
    if (movementsPath[1] !== principal.id) return fail(res, 404, 'NOT_FOUND');
    const filtered = ['from', 'to', 'type', 'cursor'].some((key) => url.searchParams.has(key));
    if (filtered) return send(res, 200, { items: [], nextCursor: null });
    const limit = url.searchParams.get('limit');
    return send(res, 200, { items: limit ? movements.slice(0, Number.parseInt(limit, 10)) : movements, nextCursor: limit ? null : 'cursor-2' });
  }
  if (route === 'GET /beneficiaries') return send(res, 200, { items: scenario.beneficiaries === 'empty' ? [] : [luis, mama] });
  if (route === `GET /transfers/${sent.id}`) return send(res, 200, sent);
  if (route === `GET /transfers/${pending.id}`) return send(res, 200, pending);
  if (route === 'POST /transfers') {
    const { amount } = await readBody(req);
    const whole = String(amount).replace(/\.00$/, '');
    if (whole === '30000') return fail(res, 422, 'INSUFFICIENT_FUNDS', { transferId: randomUUID() });
    if (whole === '15000') return send(res, 201, pending);
    debited = whole === '1250';
    return send(res, 201, whole === '1250' ? sent : { ...sent, id: randomUUID(), amount: String(amount) });
  }
  if (route === `POST /transfers/${pending.id}/confirm`) {
    const { otp } = await readBody(req);
    if (otp === '000000') return fail(res, 422, 'OTP_ATTEMPTS_EXHAUSTED');
    return send(res, 200, { ...pending, status: 'COMPLETED', otp: null, completedAt: '2026-10-13T17:43:00Z' });
  }
  if (route === `POST /transfers/${pending.id}/otp/resend`) return send(res, 200, challenge);
  return fail(res, 404, 'NOT_FOUND');
}).listen(port, '127.0.0.1', () => console.log(`API simulada en http://127.0.0.1:${port}`));
```

- [ ] **Step 3: Config and helpers**

`web/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

/*
 * Pruebas en navegador real (WEB-23, WEB-24): lo que jsdom no puede medir (layout, display: none,
 * contraste). Levanta la API simulada con los datos de las historias y `next dev` contra ella.
 */
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3101',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/fake-api.mjs --port 4999',
      url: 'http://127.0.0.1:4999/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npx next dev --port 3101 --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3101/login',
      reuseExistingServer: true,
      timeout: 180_000,
      env: { API_BASE_URL: 'http://127.0.0.1:4999', SESSION_COOKIE_SECURE: 'false' },
    },
  ],
});
```
`web/e2e/support.ts`:
```ts
import { expect, type Page } from '@playwright/test';

export const API = 'http://127.0.0.1:4999';
/** 12:00 en Ciudad de México, el "ahora" de las historias. */
export const NOW = new Date('2026-10-13T18:00:00Z');
export const PRINCIPAL_ID = '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51';
export const SENT_TRANSFER_ID = '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a';

/** Cambia los datos de la API simulada (y reinicia su estado). */
export async function scenario(page: Page, value: Record<string, string>) {
  const response = await page.request.post(`${API}/__scenario`, { data: value });
  expect(response.ok()).toBe(true);
}

/** Inicia sesión por el formulario real con el reloj del navegador fijo en NOW. */
export async function login(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto('/login');
  await page.getByLabel('Correo').fill('ana@example.com');
  await page.getByLabel('Contraseña').fill('Ana-demo-2026!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL((url) => url.pathname === '/');
}

export function visibleH1Count(page: Page): Promise<number> {
  return page.evaluate(() => [...document.querySelectorAll('h1')].filter((h) => h.checkVisibility()).length);
}

export function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}
```

- [ ] **Step 4: Write the specs**

`web/e2e/layout.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { PRINCIPAL_ID, SENT_TRANSFER_ID, hasHorizontalScroll, login, scenario, visibleH1Count } from './support';

const WIDTHS = [320, 390, 768, 1024, 1440, 1920] as const;
const PUBLIC = ['/login', '/register', '/verify-email?email=ana%40example.com&registered=1'];
const PRIVATE = ['/', `/accounts/${PRINCIPAL_ID}/movements`, '/beneficiaries', '/beneficiaries/new', '/transfers/new', `/transfers/${SENT_TRANSFER_ID}`];

test.beforeEach(async ({ page }) => {
  await scenario(page, {});
});

for (const width of WIDTHS) {
  test(`WEB-24 WEB-23 a ${width} px ninguna pantalla se desplaza a lo ancho, cada una tiene un solo h1 visible y un solo "Saltar al contenido"`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const check = async (path: string) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await hasHorizontalScroll(page), `${path} a ${width} px`).toBe(false);
      expect(await visibleH1Count(page), `${path} a ${width} px`).toBe(1);
      await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toHaveCount(1);
    };
    for (const path of PUBLIC) await check(path);
    await login(page);
    for (const path of PRIVATE) await check(path);
  });
}

test('WEB-24 WEB-27 a 390 px se ve la forma de app con pestañas abajo y a 1280 px el dashboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const nav = page.getByRole('navigation', { name: 'Principal' });
  await expect(nav).toHaveCount(1);
  const box = await nav.boundingBox();
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
  await expect(nav.getByRole('link')).toHaveCount(4);
  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('complementary')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
});

test('WEB-27 en el flujo de transferencia a 390 px no hay pestañas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/transfers/new');
  await expect(page.getByRole('heading', { level: 1, name: '¿A quién le envías?' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
});

test('WEB-28 con el texto al 200 % el saldo del hero no se corta', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const amount = page.getByTestId('hero-amount');
  await expect(amount).toBeVisible();
  expect(await amount.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await hasHorizontalScroll(page)).toBe(false);
});
```
`web/e2e/keyboard.spec.ts`:
```ts
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, scenario } from './support';

/** Tab hasta `target`; en botones y enlaces el foco debe verse (WEB-23). */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) {
      const { tag, outline } = await target.evaluate((el) => ({ tag: el.tagName, outline: getComputedStyle(el).outlineStyle }));
      if (tag === 'A' || tag === 'BUTTON') expect(outline).not.toBe('none');
      return;
    }
  }
  throw new Error('El foco no llegó al control con Tab');
}

for (const width of [390, 1280] as const) {
  test(`WEB-23 WEB-30 a ${width} px la transferencia llega al comprobante solo con el teclado`, async ({ page }) => {
    await scenario(page, {});
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await login(page);
    await page.goto('/transfers/new');
    await tabTo(page, page.getByRole('button', { name: /^Luis/ }));
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByLabel('Monto'));
    await page.keyboard.type('1250');
    await tabTo(page, page.getByLabel('Concepto'));
    await page.keyboard.type('Renta');
    await tabTo(page, page.getByLabel('Referencia'));
    await page.keyboard.type('1');
    await tabTo(page, page.getByRole('button', { name: 'Continuar' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Revisa tu transferencia' })).toBeFocused();
    await tabTo(page, page.getByRole('button', { name: 'Enviar' }));
    await page.keyboard.press('Space');
    await expect(page.getByRole('region', { name: 'Comprobante' })).toBeVisible();
  });
}
```
`web/e2e/overlays.spec.ts` (Review Focus #3, real browser):
```ts
import { expect, test } from '@playwright/test';
import { PRINCIPAL_ID, login, scenario } from './support';

test.beforeEach(async ({ page }) => {
  await scenario(page, {});
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
});

test('DSG-17 WEB-29 la hoja de filtros atrapa el foco, Escape en una fecha no la cierra y al cerrar vuelve el foco a "Filtros"', async ({ page }) => {
  await page.goto(`/accounts/${PRINCIPAL_ID}/movements`);
  const opener = page.getByRole('button', { name: 'Filtros' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Filtrar movimientos' });
  await expect(sheet).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  for (let i = 0; i < 15; i += 1) {
    await page.keyboard.press('Tab');
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await sheet.getByLabel('Desde').focus();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Aplicar' }).focus();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('DSG-17 WEB-27 el menú de la cuenta se cierra con Escape y devuelve el foco al avatar', async ({ page }) => {
  const avatar = page.getByRole('button', { name: 'Menú de la cuenta' });
  await avatar.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Tu cuenta' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Tu cuenta' })).toBeHidden();
  await expect(avatar).toBeFocused();
});
```
`web/e2e/a11y.spec.ts` (axe with real CSS, including color contrast — DSG-04/DSG-14):
```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PRINCIPAL_ID, SENT_TRANSFER_ID, login, scenario } from './support';

const AXE = readFileSync(join(process.cwd(), 'node_modules/axe-core/axe.min.js'), 'utf8');

/** Violaciones de axe en la página, sin el indicador de desarrollo de Next (`nextjs-portal`). */
async function axe(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const runner = (window as unknown as { axe: { run: (context: unknown) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe;
    const result = await runner.run({ exclude: [['nextjs-portal']] });
    return result.violations.map((violation) => `${violation.id} (${violation.nodes.length})`);
  });
}

for (const width of [390, 1280] as const) {
  test(`WEB-23 DSG-14 a ${width} px axe no reporta problemas en ninguna pantalla`, async ({ page }) => {
    await scenario(page, {});
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/login', '/register']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await axe(page), path).toEqual([]);
    }
    await login(page);
    for (const path of ['/', `/accounts/${PRINCIPAL_ID}/movements`, '/beneficiaries', '/beneficiaries/new', '/transfers/new', `/transfers/${SENT_TRANSFER_ID}`]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await axe(page), path).toEqual([]);
    }
  });
}
```
`web/test/screens.a11y.test.tsx` (jsdom, every screen inside the real frame):
```tsx
import { screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AccountsOverviewScreen } from '@/components/accounts/AccountsOverviewScreen';
import { MovementsScreen } from '@/components/accounts/MovementsScreen';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';
import { BeneficiariesScreen } from '@/components/beneficiaries/BeneficiariesScreen';
import { NewBeneficiaryForm } from '@/components/beneficiaries/NewBeneficiaryForm';
import { AppFrame } from '@/components/layout/AppFrame';
import { BrandShell } from '@/components/layout/BrandShell';
import { TransferDetailScreen } from '@/components/transfers/TransferDetailScreen';
import { TransferFlow } from '@/components/transfers/TransferFlow';
import { bffGet } from '@/lib/client/bff';
import { BENEFICIARY, OVERVIEW, PRINCIPAL, movement, transfer } from '@/test/fixtures';
import { setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';

vi.mock('@/app/actions/auth', () => ({ logout: vi.fn(), login: vi.fn(), register: vi.fn(), verifyEmail: vi.fn(), resendVerification: vi.fn() }));
vi.mock('@/app/actions/beneficiaries', () => ({ createBeneficiary: vi.fn() }));
vi.mock('@/app/actions/transfers', () => ({ createTransfer: vi.fn(), confirmTransfer: vi.fn(), resendTransferOtp: vi.fn() }));
vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };
/**
 * jsdom no aplica `display: none`: la navegación lateral y las pestañas, y los dos encabezados (el
 * de la app y la barra superior), están a la vez en el DOM. En el navegador lo cubre e2e/a11y.spec.ts.
 */
const IN_JSDOM = { rules: { 'landmark-unique': { enabled: false }, 'landmark-no-duplicate-banner': { enabled: false } } };

beforeEach(() => {
  vi.mocked(bffGet).mockReset();
  vi.mocked(bffGet).mockImplementation(async (path: string) => {
    if (path === 'accounts') return OVERVIEW;
    if (path === 'beneficiaries') return { items: [BENEFICIARY] };
    if (path.endsWith('/movements')) return { items: [movement()], nextCursor: null };
    if (path.startsWith('transfers/')) return transfer();
    throw new Error(`Lectura inesperada: ${path}`);
  });
});

const SIGNED_IN: [string, string, ReactElement, string][] = [
  ['Inicio', '/', <AccountsOverviewScreen key="home" />, 'Últimos movimientos'],
  ['Movimientos', `/accounts/${PRINCIPAL.id}/movements`, <MovementsScreen key="movements" accountId={PRINCIPAL.id} />, 'Filtros'],
  ['Beneficiarios', '/beneficiaries', <BeneficiariesScreen key="beneficiaries" />, 'Luis Pérez Ramírez'],
  ['Agregar beneficiario', '/beneficiaries/new', <NewBeneficiaryForm key="new" />, 'Nombre del titular'],
  ['Transferir', '/transfers/new', <TransferFlow key="flow" />, 'Tus cuentas'],
  ['Transferencia', `/transfers/${transfer().id}`, <TransferDetailScreen key="detail" transferId={transfer().id} />, 'Completada'],
];

describe('accesibilidad de cada pantalla en su estructura', () => {
  it.each(SIGNED_IN)('WEB-23 %s dentro de la estructura de la app no tiene problemas de accesibilidad', async (_name, path, ui, ready) => {
    setLocation(path);
    const { container } = renderWithClient(<AppFrame user={USER}>{ui}</AppFrame>);
    await screen.findAllByText(ready);
    expect(await axe(container, IN_JSDOM)).toHaveNoViolations();
  });

  it.each([
    ['inicio de sesión', 'Inicia sesión', <LoginForm key="login" />],
    ['registro', 'Crea tu cuenta', <RegisterForm key="register" />],
    ['verificación', 'Verifica tu correo', <VerifyEmailForm key="verify" email="ana@example.com" registered />],
  ] as const)('WEB-23 WEB-31 el %s sobre la superficie de marca no tiene problemas de accesibilidad', async (_name, title, form) => {
    const { container } = renderWithClient(<BrandShell title={title}>{form}</BrandShell>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 5: Run** — `npx vitest run test/screens.a11y.test.tsx` → PASS (if a violation appears, fix the screen, not the rule list; if axe's contrast finding is a token pair, stop and escalate — design-tokens is read-only for the track, never change the token or the rule). Then `npm run test:e2e` (first run compiles every route in `next dev`; allow ~2–3 min) → all specs PASS. Expected failures to fix in the owning component if they appear: horizontal scroll at 320 px (look for fixed-width rows, `whitespace-nowrap` amounts, the 4-tab bar labels), a second visible `h1`, contrast of `text-fg-muted` on `bg-surface-canvas`. If chromium fails to launch, run `npx playwright install chromium` once and rerun. If an axe or contrast failure traces to a token value, stop and escalate (see above).
- [ ] **Step 6: R7 gates** — `npm run format:check && npm run lint && npm run typecheck && npm test` (the e2e suite is not part of `npm test`; CI is unchanged).
- [ ] **Step 7: Commit** — `test(web): check layout, keyboard, sheets and contrast of every screen in a real browser`; `Task: redesign#6.7`; `Refs: WEB-23, WEB-24, WEB-27, WEB-28, WEB-29, WEB-30, DSG-14, DSG-17`. Paths: `web/playwright.config.ts`, `web/e2e/*`, `web/test/screens.a11y.test.tsx`, `web/.gitignore`, `web/package.json`, `web/package-lock.json` (plus any screen fixed in Step 5).

## Task 7.1: Mobile tabs (Inicio, Movimientos, Transferir) with the flow outside them and the avatar menu

Track M. Moves the signed-in tree to `(app)/(tabs)` with expo-router's `Tabs` and the kit `TabBar` as a custom tab bar; "Transferir" pushes the flow, which stays a stack screen of `(app)` above the tabs (full screen, no tab bar, MOB-18). Adds the shared account selection, the current user (`GET /me`) for the header and logout from the avatar menu. Folds the final-review items for 7.1: `hitSlop={4}` literal, pressed feedback on tabs, and the `Screen tabBar` no-op prop (now: the tab bar owns the bottom safe area). Home and Movements keep their content here (7.3/7.4 redesign them); they only get the header and the selection. Biometric unlock (bonus, R46): `src/app/_layout.tsx` is **not** touched — it keeps `<UnlockGate>` around `<RootNavigator />` (MOB-25: no `/auth/refresh` before unlocking); `<UnlockOffer />` stays on Home (7.3 restyles it); `<UnlockSwitch />` moves from the bottom of Home into the account-menu BottomSheet, next to "Cerrar sesión", through an additive `AppHeader` prop.

**Files:**
- Create: `mobile/src/app/(app)/(tabs)/_layout.tsx`, `mobile/src/app/(app)/(tabs)/movements.tsx`, `mobile/src/navigation/app-tab-bar.tsx`, `mobile/src/navigation/__tests__/tabs.test.tsx`, `mobile/src/features/accounts/selection.tsx`, `mobile/src/features/accounts/__tests__/selection.test.tsx`, `mobile/src/features/accounts/account-header.ts`
- Move: `git mv "mobile/src/app/(app)/index.tsx" "mobile/src/app/(app)/(tabs)/index.tsx"`
- Delete: `mobile/src/app/(app)/accounts/[accountId].tsx` (Movements is a tab; superseded by MOB-20)
- Modify: `mobile/src/app-services.tsx`, `mobile/src/components/screen.tsx`, `mobile/src/components/__tests__/screen.test.tsx`, `mobile/src/components/ui/tab-bar.tsx`, `mobile/src/components/ui/icon.tsx`, `mobile/src/components/ui/app-header.tsx` (additive `menuExtra`), `mobile/src/components/ui/__tests__/navigation.test.tsx`, `mobile/src/features/unlock/__tests__/unlock-switch.test.tsx` (open the menu first), `mobile/src/features/accounts/queries.ts`, `mobile/src/features/accounts/home-screen.tsx`, `mobile/src/features/accounts/movements-screen.tsx`, `mobile/src/features/accounts/__tests__/home-screen.test.tsx`, `mobile/src/features/accounts/__tests__/movements-screen.test.tsx`, `mobile/src/test-utils/fixtures.ts`

**Interfaces:**
- Consumes: `TabBar({ items, current, onSelect })`, `AppHeader({ user, title?, onLogout? })`, `Screen({ children, refresh?, footer?, header?, tabBar? })` (`@/components/ui`, `@/components/screen`), `Tabs` and `type BottomTabBarProps` from `expo-router/js-tabs` (the `Tabs` export of `expo-router` is deprecated in v57), `useRouter` (`expo-router`), `logout(session, api)` (`@/session/logout`), `useServices` (`@/app-services`), `required`, `queryKeys` (`./queries`).
- Produces: `AppTabBar(props: BottomTabBarProps)`, `TAB_ITEMS`; `AccountSelectionProvider` (mounted inside `AppProviders`), `useAccountSelection(): { accountId: string | null; select(accountId: string): void }`, `selectedAccount(accounts, accountId)`; `useCurrentUser()`, `queryKeys.me`; `useAccountHeader(): { user: { name: string; email: string }; onLogout(): void; menuExtra: ReactNode }` (`menuExtra` = `<UnlockSwitch />`); `AppHeader` additive prop `menuExtra?: ReactNode` (rendered in the account sheet before "Cerrar sesión"); `useRecentMovements(accountId: string | undefined)` (disabled while `undefined`); fixture `me: User`.

- [ ] **Step 1: Write the failing tests**

`mobile/src/test-utils/fixtures.ts` — append:
```ts
import type { User } from '@devchrisvaz/wallet-contract';

/** Respuesta de `GET /me` (el saludo y el menú de la cuenta). */
export const me: User = {
  id: '6f1c2a8e-1d2b-4c3d-9e4f-5a6b7c8d9e0f',
  email: 'ana@example.com',
  fullName: 'Ana Gómez Castillo',
  phoneMasked: '+52******5678',
  curpMasked: 'GOCA**************',
  rfcMasked: 'GOCA*********',
  emailVerifiedAt: '2026-10-01T15:00:00Z',
  createdAt: '2026-10-01T14:55:00Z',
};
```
(Merge the type import into the file's existing `import type { … } from '@devchrisvaz/wallet-contract'`.)

`mobile/src/navigation/__tests__/tabs.test.tsx`:
```tsx
import { screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import TabsLayout from '@/app/(app)/(tabs)/_layout';
import { createFakeApi } from '@/test-utils/fake-api';
import { renderApp } from '@/test-utils/render-app';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': () => <Text>Pantalla de inicio</Text>,
  '(tabs)/movements': () => <Text>Pantalla de movimientos</Text>,
  'transfer/index': () => <Text>Elegir destinatario</Text>,
};

describe('pestañas de la app', () => {
  test('MOB-18 la barra muestra Inicio, Movimientos y Transferir y marca la pestaña actual', async () => {
    await renderApp({ fake: createFakeApi(), routes });
    expect(await screen.findByText('Pantalla de inicio')).toBeOnTheScreen();
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Inicio',
      'Movimientos',
      'Transferir',
    ]);
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  test('MOB-18 tocar Movimientos abre la pestaña y la marca como seleccionada para los lectores de pantalla', async () => {
    const { router } = await renderApp({ fake: createFakeApi(), routes });
    await userEvent.press(await screen.findByRole('tab', { name: 'Movimientos' }));
    expect(await screen.findByText('Pantalla de movimientos')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toBeSelected();
    expect(router.getPathname()).toBe('/movements');
  });

  test('MOB-18 tocar Transferir abre el flujo como pantalla de la pila, fuera de las pestañas', async () => {
    const { router } = await renderApp({ fake: createFakeApi(), routes });
    await userEvent.press(await screen.findByRole('tab', { name: 'Transferir' }));
    expect(await screen.findByText('Elegir destinatario')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/transfer');
    expect(router.getSegments()).toEqual(['transfer']);
  });
});
```

`mobile/src/features/accounts/__tests__/selection.test.tsx`:
```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ahorro, principal } from '@/test-utils/fixtures';

import { AccountSelectionProvider, selectedAccount, useAccountSelection } from '../selection';

function Chooser({ label }: { label: string }) {
  const { accountId, select } = useAccountSelection();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => select(ahorro.id)}>
      <Text>{`${label}: ${accountId ?? 'ninguna'}`}</Text>
    </Pressable>
  );
}

describe('selección de cuenta', () => {
  test('MOB-19 MOB-20 Inicio y Movimientos comparten la cuenta elegida', async () => {
    await render(
      <AccountSelectionProvider>
        <Chooser label="Inicio" />
        <Chooser label="Movimientos" />
      </AccountSelectionProvider>,
    );
    await userEvent.press(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getByText(`Movimientos: ${ahorro.id}`)).toBeOnTheScreen();
  });

  test('MOB-19 si la cuenta elegida ya no existe se usa la primera', () => {
    expect(selectedAccount([principal, ahorro], ahorro.id)).toBe(ahorro);
    expect(selectedAccount([principal, ahorro], 'otra')).toBe(principal);
    expect(selectedAccount([principal, ahorro], null)).toBe(principal);
    expect(selectedAccount([], null)).toBeUndefined();
  });
});
```

`mobile/src/components/__tests__/screen.test.tsx` — the existing MOB-18 case stays; append (RNTL 14 removed the `UNSAFE_*` queries and only renders host elements, so `Screen` gives its `SafeAreaView` `testID="screen-safe-area"`; the host `RNCSafeAreaView` of `react-native-safe-area-context` 5.7 receives an edge record `{ top, right, bottom, left }` with `'additive' | 'off'`):
```tsx
test('MOB-18 con barra de pestañas la pantalla no agrega el área segura de abajo: la pone la barra', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Screen tabBar>
        <Text>Contenido</Text>
      </Screen>
    </SafeAreaProvider>,
  );
  const edges = screen.getByTestId('screen-safe-area').props.edges as Record<string, string>;
  expect(Object.keys(edges).filter((edge) => edges[edge] !== 'off')).toEqual(['top']);
});

test('MOB-18 sin barra de pestañas conserva las áreas seguras de arriba y de abajo', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Screen>
        <Text>Contenido</Text>
      </Screen>
    </SafeAreaProvider>,
  );
  const edges = screen.getByTestId('screen-safe-area').props.edges as Record<string, string>;
  expect(Object.keys(edges).filter((edge) => edges[edge] !== 'off')).toEqual(['top', 'bottom']);
});
```

`mobile/src/components/ui/__tests__/navigation.test.tsx` — append inside `describe('TabBar', …)`:
```tsx
  test('MOB-18 la pestaña actual lleva la etiqueta en verde de acción y las demás en gris', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TabBar items={['home', 'movements', 'transfer']} current="movements" onSelect={() => {}} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Movimientos')).toHaveStyle({ color: theme.colors.action.primary });
    expect(screen.getByText('Inicio')).toHaveStyle({ color: theme.colors.text.muted });
  });

  test('MOB-18 MOB-24 el menú de la cuenta muestra lo que se le pase junto a "Cerrar sesión"', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppHeader user={USER} onLogout={() => {}} menuExtra={<Text>Ajuste extra</Text>} />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByTestId('bottom-sheet');
    expect(within(sheet).getByText('Ajuste extra')).toBeOnTheScreen();
    expect(within(sheet).getByRole('button', { name: 'Cerrar sesión' })).toBeOnTheScreen();
  });
```
(Pressable's pressed state cannot be driven through RNTL 14's host-only renderer: the pressed feedback is checked on the canvas in 8.1 and on the phone, Expo Go checklist. Import `Text` from `react-native` if the file does not yet.)

`mobile/src/features/accounts/__tests__/home-screen.test.tsx` — routes become `{ index: HomeScreen, movements: () => <Text>Movimientos de la cuenta</Text>, 'transfer/index': () => <Text>Elegir beneficiario</Text> }`; every fake also answers `.on('GET', '/me', json(200, me))`. Superseded by MOB-18 (logout moved from the footer to the avatar menu): in `MOB-04 cerrar sesión borra la sesión y los datos en memoria`, press `screen.getByRole('button', { name: 'Menú de la cuenta' })` first, then `within(screen.getByTestId('bottom-sheet')).getByRole('button', { name: 'Cerrar sesión' })` (same assertions). Superseded by MOB-20 (Movements is a tab that shows the chosen account): `MOB-06 tocar una cuenta abre sus movimientos` expects `router.getPathname()` to be `'/movements'` (7.3 then replaces this case by "Ver todos"). Append (R46):
```tsx
  test('MOB-18 MOB-24 el menú de la cuenta muestra el interruptor del desbloqueo junto a "Cerrar sesión"', async () => {
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview()));
    await renderApp({ fake, routes });
    await screen.findByText('$25,000.00');
    expect(screen.queryByRole('switch', { name: 'Desbloqueo con huella' })).toBeNull();
    await userEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByTestId('bottom-sheet');
    expect(await within(sheet).findByRole('switch', { name: 'Desbloqueo con huella' })).toBeOnTheScreen();
    expect(within(sheet).getByRole('button', { name: 'Cerrar sesión' })).toBeOnTheScreen();
  });
```
(Add `within` and `me` to the file's imports. The global `expo-local-authentication` mock reports a fingerprint by default, as in `unlock-switch.test.tsx`; if the file's tests run with fake timers, settle pending reads the way that file does.)

`mobile/src/features/unlock/__tests__/unlock-switch.test.tsx` — superseded by MOB-18/R46 (the switch moved into the account menu): in `openHome`, after `expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();` add `await fireEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));` (import `fireEvent` if needed); every assertion stays. All other unlock tests (`unlock-gate`, `lock-screen`, `unlock-offer`, `background-lock`, `root-layout`, `biometrics`) must pass unchanged.

`mobile/src/features/accounts/__tests__/movements-screen.test.tsx` — superseded by MOB-20 (no `accountId` in the route): `openMovements` renders `routes: { movements: MovementsScreen }` with `initialUrl: '/movements'` and registers `GET /me`; the account defaults to the first one (`principal`), so `MOVEMENTS_PATH` and every assertion stay.

- [ ] **Step 2: Run** — `npx jest src/navigation src/features/accounts src/components` → FAIL (no `(tabs)` layout, no selection, `Screen` edges unchanged, routes missing).

- [ ] **Step 3: Implement**

`mobile/src/features/accounts/selection.tsx`:
```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AccountSelection {
  accountId: string | null;
  select: (accountId: string) => void;
}

const SelectionContext = createContext<AccountSelection | null>(null);

/** Cuenta elegida, compartida por Inicio y Movimientos durante la sesión (MOB-19, MOB-20). */
export function AccountSelectionProvider({ children }: { children: ReactNode }) {
  const [accountId, select] = useState<string | null>(null);
  const value = useMemo(() => ({ accountId, select }), [accountId]);
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

/** Sin proveedor (pruebas de un componente suelto), la selección es local. */
export function useAccountSelection(): AccountSelection {
  const shared = useContext(SelectionContext);
  const [accountId, select] = useState<string | null>(null);
  return shared ?? { accountId, select };
}

/** La cuenta elegida si sigue existiendo; si no, la primera. */
export function selectedAccount<T extends { id: string }>(
  accounts: readonly T[],
  accountId: string | null,
): T | undefined {
  return accounts.find((account) => account.id === accountId) ?? accounts[0];
}
```
`mobile/src/app-services.tsx` — in `AppProviders`, wrap `children` with `<AccountSelectionProvider>` inside `QueryClientProvider` (import from `@/features/accounts/selection`; that module imports nothing from `app-services`, so there is no cycle). `renderApp` uses `AppProviders`, so every screen test shares the selection like the app.

`mobile/src/features/accounts/queries.ts` — add `me: ['me'] as const` to `queryKeys`; make `useRecentMovements(accountId: string | undefined)` use `queryKey: queryKeys.movements(accountId ?? '')`, `path: { accountId: accountId ?? '' }` and `enabled: accountId !== undefined`; add:
```ts
/** Usuario de la sesión para el saludo y el menú de la cuenta (MOB-18, MOB-19). */
export function useCurrentUser() {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => required((await api.GET('/me', { signal })).data),
    staleTime: Infinity,
  });
}
```
`mobile/src/features/accounts/account-header.ts`:
```ts
import { createElement, type ReactNode } from 'react';

import { useServices } from '@/app-services';
import { UnlockSwitch } from '@/features/unlock/unlock-switch';
import { logout } from '@/session/logout';

import { useCurrentUser } from './queries';

/**
 * Encabezado de las pestañas: el usuario de `GET /me`, el cierre de sesión del menú (MOB-04, MOB-18)
 * y, en el mismo menú, el interruptor del desbloqueo biométrico (MOB-24, R46).
 */
export function useAccountHeader(): { user: { name: string; email: string }; onLogout: () => void; menuExtra: ReactNode } {
  const { session, api } = useServices();
  const me = useCurrentUser();
  return {
    user: { name: me.data?.fullName ?? '', email: me.data?.email ?? '' },
    onLogout: () => void logout(session, api),
    menuExtra: createElement(UnlockSwitch),
  };
}
```
`mobile/src/components/ui/app-header.tsx` — additive `menuExtra?: ReactNode` in `AppHeaderProps`, rendered inside the `BottomSheet` between the account row and the "Cerrar sesión" button (`{menuExtra}`); nothing else changes.
`mobile/src/navigation/app-tab-bar.tsx`:
```tsx
import type { NavDestination } from '@devchrisvaz/wallet-design-tokens';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { TabBar } from '@/components/ui';

/** Pestañas de la app (MOB-18); la web agrega Beneficiarios (WEB-27). */
export const TAB_ITEMS = ['home', 'movements', 'transfer'] as const satisfies readonly NavDestination[];

/**
 * Barra de pestañas de expo-router con el TabBar del kit. Inicio y Movimientos son pestañas;
 * Transferir abre el flujo, que es una pantalla de la pila fuera de las pestañas y por eso se ve a
 * pantalla completa, sin la barra.
 */
export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const current: NavDestination = state.routes[state.index]?.name === 'movements' ? 'movements' : 'home';
  return (
    <TabBar
      items={TAB_ITEMS}
      current={current}
      onSelect={(key) => {
        if (key === 'transfer') router.push('/transfer');
        else if (key === 'movements') navigation.navigate('movements');
        else navigation.navigate('index');
      }}
    />
  );
}
```
`mobile/src/app/(app)/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from 'expo-router/js-tabs';

import { AppTabBar } from '@/navigation/app-tab-bar';

/** Pestañas con sesión (MOB-18): Inicio y Movimientos. El flujo de transferencia vive en `(app)/transfer`. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="movements" />
    </Tabs>
  );
}
```
`mobile/src/app/(app)/(tabs)/movements.tsx`:
```tsx
import { MovementsScreen } from '@/features/accounts/movements-screen';

export default function MovementsRoute() {
  return <MovementsScreen />;
}
```
`(app)/_layout.tsx` stays a `Stack`: it now holds `(tabs)` and `transfer/*`.

`mobile/src/components/screen.tsx` — `Screen({ children, refresh, footer, header, tabBar = false })`; `<SafeAreaView testID="screen-safe-area" … edges={tabBar ? ['top'] : ['top', 'bottom']}>`; doc of `tabBar`: "Pantalla de una pestaña: la barra va debajo (no encima) y pone el área segura inferior, así que la pantalla solo reserva la de arriba."

`mobile/src/components/ui/tab-bar.tsx` — `style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}` with `itemPressed: { backgroundColor: theme.colors.surface.subtle }` (`surface.subtle` has the same value as `surface.canvas`, sand50 — an existing token, not a new color). `mobile/src/components/ui/icon.tsx` — `hitSlop={theme.spacing[1]}` instead of `hitSlop={4}` (R3).

`mobile/src/features/accounts/home-screen.tsx` — keep the content; use `const header = useAccountHeader();` and `const { select } = useAccountSelection();`; `<Screen tabBar refresh={refresh} header={<AppHeader user={header.user} onLogout={header.onLogout} menuExtra={header.menuExtra} />}>` with no `footer` (Transferir is a tab, logout is in the menu); delete the old "Tus cuentas" header block (the AppHeader greeting is the screen header, R17); keep `<UnlockOffer />` at the top of the content and delete `<UnlockSwitch />` from the bottom (it now lives in the menu, R46); each card `onPress={() => { select(account.id); router.navigate('/movements'); }}`.

`mobile/src/features/accounts/movements-screen.tsx` — replace `useLocalSearchParams` with `const { accountId } = useAccountSelection(); const overview = useAccountsOverview(); const account = overview.data ? selectedAccount(overview.data.accounts, accountId) : undefined; const movements = useRecentMovements(account?.id);`; `<Screen tabBar refresh={refresh} header={<AppHeader user={header.user} title="Movimientos" onLogout={header.onLogout} menuExtra={header.menuExtra} />}>`; keep the account-name heading (as a non-header `Text`) and the list until 7.4; remove the "Volver" footer.

- [ ] **Step 4: Run** — Step 2 command → PASS; `npm test` → green (root-navigator and login tests use their own route maps and are unaffected).
- [ ] **Step 5: R7 gates** — `npm run format:check && npm run lint && npm run typecheck && npm test`.
- [ ] **Step 6: Commit** — `feat(mobile): navigate with tabs and open the transfer flow outside them`; `Task: redesign#7.1`; `Refs: MOB-18, MOB-04, MOB-20`.

## Task 7.2: Mobile login on the brand surface

Track M. Mirrors stories `Login` and `LoginRateLimited` of `mobile/.design-sync/previews/Screen.tsx` (and `StartupLoading`/`StartupOffline`, which already match `root-navigator.tsx`). The container keeps every MOB-01/MOB-03 behavior; a pure `LoginView` renders. Also moves the two startup screens to a pure module so 8.1 can render the real ones, and adds the purity guard for every `*-view.tsx`.

**Files:**
- Create: `mobile/src/features/auth/login-view.tsx`, `mobile/src/navigation/startup-views.tsx`, `mobile/src/__tests__/views-are-pure.test.ts`
- Modify: `mobile/src/features/auth/login-screen.tsx`, `mobile/src/features/auth/__tests__/login-screen.test.tsx`, `mobile/src/navigation/root-navigator.tsx`, `mobile/src/features/unlock/lock-screen.tsx` (bonus, onto the brand surface — R42/R46)

**Interfaces:**
- Consumes: `BrandScreen({ title, children })`, `TextField`, `Button`, `InlineAlert`, `type AlertTone` (`@/components/ui`), `Wordmark`, `ActivityIndicator`.
- Produces: `LoginView(props: LoginViewProps)` with `interface LoginViewProps { email: string; password: string; fieldErrors: Record<string, string>; alert: { tone: AlertTone; message: string } | null; lockRemaining: number; submitting: boolean; onChangeEmail(value: string): void; onChangePassword(value: string): void; onSubmit(): void }`; `StartupLoading()`, `StartupOffline({ onRetry })` from `@/navigation/startup-views`.

- [ ] **Step 1: Write the failing tests** — append to `mobile/src/features/auth/__tests__/login-screen.test.tsx`:
```tsx
  test('MOB-22 se ve la superficie de marca con el Wordmark y el formulario en una hoja blanca con los campos de MOB-01', async () => {
    await renderLogin(createFakeApi());
    expect(screen.getByText('Tu billetera digital en pesos mexicanos.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Inicia sesión' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Correo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Contraseña')).toBeOnTheScreen();
    expect(
      screen.getByText(/El registro y la verificación del correo se hacen en la web de TreoWallet\./),
    ).toBeOnTheScreen();
  });
```
`mobile/src/__tests__/views-are-pure.test.ts`:
```ts
/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FEATURES = join(__dirname, '..', 'features');
/** Lo que una vista no puede importar (salvo `import type`): navegación, consultas, sesión, nativos. */
const IMPURE =
  /^import\s+(?!type\b)[^;]*?from\s+'(expo-[^']*|@tanstack\/react-query|@react-native-community\/netinfo|@\/app-services|@\/session\/[^']*|@\/features\/[^']*\/queries|\.\/queries|\.\/transfer-attempt|\.\/use-transfer-attempt|\.\/transport|\.\/connectivity)'/m;

export function viewFiles(dir: string = FEATURES): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : viewFiles(join(dir, entry.name));
    return entry.name.endsWith('-view.tsx') ? [join(dir, entry.name)] : [];
  });
}

/** Vistas del flujo de transferencia que aún usan el router o el intento; la tarea 7.5 las vuelve puras y vacía esta lista. */
const PENDING_7_5 = ['transfer/otp-view.tsx', 'transfer/outcome-view.tsx'];

describe('vistas de pantalla puras', () => {
  test('MOB-18 MOB-22 ninguna vista importa navegación, consultas, sesión ni módulos nativos', () => {
    const offenders = viewFiles()
      .filter((file) => !PENDING_7_5.some((pending) => file.endsWith(pending)))
      .filter((file) => IMPURE.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
```
(`expo-[^']*` also covers `expo-router`; views receive callbacks instead. This is what lets Task 8.1 render the real screens in the react-native-web canvas. Today `otp-view.tsx` imports `MAX_RETRIES` from `./transfer-attempt` and `outcome-view.tsx` imports `useRouter`: they are listed in `PENDING_7_5` until 7.5.)

- [ ] **Step 2: Run** — `npx jest src/features/auth src/__tests__/views-are-pure.test.ts` → the MOB-22 case FAILS (no BrandScreen); the guard passes (`form-view.tsx` and `review-view.tsx` are already pure; the two transfer views listed in `PENDING_7_5` are skipped until 7.5).

- [ ] **Step 3: Implement**

`mobile/src/features/auth/login-view.tsx` (story `Login`/`LoginRateLimited`):
```tsx
import { StyleSheet, Text, View } from 'react-native';

import { BrandScreen, Button, InlineAlert, TextField, type AlertTone } from '@/components/ui';
import { theme } from '@/theme';

export interface LoginViewProps {
  email: string;
  password: string;
  fieldErrors: Record<string, string>;
  alert: { tone: AlertTone; message: string } | null;
  /** Segundos de bloqueo tras un 429 (MOB-01). */
  lockRemaining: number;
  submitting: boolean;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
}

/** Inicio de sesión sobre la superficie de marca (MOB-22): el formulario en una hoja blanca. */
export function LoginView({ email, password, fieldErrors, alert, lockRemaining, submitting, onChangeEmail, onChangePassword, onSubmit }: LoginViewProps) {
  return (
    <BrandScreen title="Inicia sesión">
      {alert ? <InlineAlert tone={alert.tone} message={alert.message} /> : null}
      <View style={styles.form}>
        <TextField label="Correo" variant="email" value={email} onChangeText={onChangeEmail} error={fieldErrors.email} returnKeyType="next" />
        <TextField label="Contraseña" variant="password" value={password} onChangeText={onChangePassword} error={fieldErrors.password} returnKeyType="go" onSubmitEditing={onSubmit} />
        {lockRemaining > 0 ? (
          <Text style={styles.countdown} accessibilityLiveRegion="polite">{`Podrás intentar de nuevo en ${lockRemaining} s.`}</Text>
        ) : null}
        <Button label="Iniciar sesión" onPress={onSubmit} loading={submitting} disabled={lockRemaining > 0} />
      </View>
      <Text style={styles.note}>
        ¿Aún no tienes cuenta? El registro y la verificación del correo se hacen en la web de TreoWallet.
      </Text>
    </BrandScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[4] },
  countdown: { ...theme.typography.bodySm, ...theme.amount, color: theme.colors.text.secondary },
  note: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
});
```
`login-screen.tsx` — keep `submit` (including `unlockPreference.offerAfterLogin()` before `session.start` after a successful password login — MOB-24, R46; `unlockPreference` stays destructured from `useServices()`), `alertFor`, the revoked notice and `useCountdown`; return `<LoginView email={email} password={password} fieldErrors={fieldErrors} alert={shownAlert} lockRemaining={lock.remaining} submitting={submitting} onChangeEmail={setEmail} onChangePassword={setPassword} onSubmit={() => void submit()} />`; delete the old `Screen` markup and styles (the subtitle "Usa el correo y la contraseña…" goes away: the approved story drops it).

`mobile/src/navigation/startup-views.tsx` — move `StartupLoading`, `StartupOffline` and their `styles` verbatim from `root-navigator.tsx` and export them; `root-navigator.tsx` imports them **and keeps exporting `StartupLoading`** (`export { StartupLoading } from './startup-views';`) because `features/unlock/unlock-gate.tsx` imports it from `@/navigation/root-navigator` (R46).

`mobile/src/features/unlock/lock-screen.tsx` (bonus UI, restyled with the kit — R42): keep every hook, state and handler; replace the centered `View` with `<BrandScreen title="TreoWallet está bloqueada">` containing the notice `InlineAlert` and the two buttons (`styles.actions` keeps `gap: theme.spacing[3]`); drop the local `Wordmark` and `title` style (BrandScreen brings the Wordmark, which keeps `accessibilityRole="header"` and the label "TreoWallet", and the title header). `lock-screen.test.tsx` must pass unchanged (header "TreoWallet", header "TreoWallet está bloqueada", no `$`, no CLABE or `@` on screen — the brand tagline has neither). If any lock-screen assertion fails, revert this file to its current markup instead of changing the test.

- [ ] **Step 4: Run** — `npx jest src/features/auth src/navigation src/__tests__` → PASS; `npm test` → green.
- [ ] **Step 5: R7 gates.**
- [ ] **Step 6: Commit** — `feat(mobile): show the login and the lock screen on the brand surface`; `Task: redesign#7.2`; `Refs: MOB-22, MOB-01, MOB-03, MOB-24`. Before committing, `npx jest src/features/unlock src/features/auth` must be green (every unlock test, R46).

## Task 7.3: Mobile Home — greeting, hero, selectable cards and the latest 5 movements

Track M. Mirrors stories `Home`, `HomeEmpty`, `HomeLoading`, `HomeError` of `mobile/.design-sync/previews/Screen.tsx` (helpers `TabScreen`, `quickActions`, `SeeAll`). Canned → real: `user` → `useAccountHeader()`, `TOTAL` → `sumAmounts(accounts.map(balance))`, `principal`/`ahorro` → `useAccountsOverview()`, `movements` → `useLatestMovements(selected.id)` (D9: same endpoint, `limit=5`), `noop` → `select`/`router`. Folds the final-review items for 7.3: QuickActions test, M-5 mobile (hero font scaling), and the error title on the real screen. Bonus (R46): the biometric offer `<UnlockOffer />` stays on Home — the view takes it as an `offer` slot (the view stays pure) and the offer card is restyled with the kit `ListSection`; the account menu carries `<UnlockSwitch />` (7.1). `src/test-utils/render-root.tsx` keeps its own route map (`'(app)/index': HomeScreen`); do not change it.

**Files:**
- Create: `mobile/src/features/accounts/home-view.tsx`, `mobile/src/lib/loadable.ts`
- Modify: `mobile/src/features/accounts/home-screen.tsx`, `mobile/src/features/accounts/queries.ts`, `mobile/src/features/accounts/__tests__/home-screen.test.tsx`, `mobile/src/components/ui/balance-hero.tsx`, `mobile/src/components/ui/__tests__/home.test.tsx`, `mobile/src/features/unlock/unlock-offer.tsx` (card → `ListSection`)

**Interfaces:**
- Consumes: `AppHeader`, `BalanceHero({ total, available, actions })`, `QuickActions({ actions: { key; label; icon; onPress }[] })`, `AccountCard({ name, clabe, balance, selected, onPress })`, `DailyLimitMeter`, `ListSection({ title, action, children })`, `MovementList({ movements, now? })`, `EmptyState({ title, description, action?: { label; onPress }, icon })`, `InlineAlert({ tone, title?, message })`, `Button`, `Skeleton`, `Screen`, `sumAmounts` (`@/lib/display`), `errorMessage` (`@/lib/errors`), `useAccountHeader`, `useAccountSelection`/`selectedAccount` (7.1), `useRefreshByUser`.
- Produces: `type Loadable<T> = { status: 'pending' } | { status: 'error'; message: string } | { status: 'success'; data: T }` and `loadable(query)` (`@/lib/loadable`); `HomeView(props: HomeViewProps)`; `useLatestMovements(accountId)`, `LATEST_MOVEMENTS_LIMIT = 5`, `queryKeys.latestMovements(accountId)` = `['accounts', accountId, 'movements', 'latest']` (under `['accounts']`, so the MOB-13 invalidation refreshes it).

- [ ] **Step 1: Write the failing tests**

`mobile/src/features/accounts/__tests__/home-screen.test.tsx` — add helpers (keep `pullToRefresh`):
```tsx
import type { AccountsOverview, Movement } from '@devchrisvaz/wallet-contract';
import TabsLayout from '@/app/(app)/(tabs)/_layout';
import { ahorro, me, overview, principal } from '@/test-utils/fixtures';
import { MovementsScreen } from '../movements-screen';

function row(id: string, concept: string): Movement {
  return { id, type: 'TRANSFER_OUT', amount: '-100.00', balanceAfter: '24900.00', concept, reference: '1', counterparty: { name: 'Luis', clabeLast4: '5678' }, transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a', occurredAt: '2026-10-13T16:42:00Z' };
}

/** Lecturas de Inicio: usuario, cuentas y los últimos movimientos de cada cuenta. */
function homeApi(accounts: AccountsOverview = overview()) {
  return createFakeApi()
    .on('GET', '/me', json(200, me))
    .on('GET', '/accounts', json(200, accounts))
    .on('GET', `/accounts/${principal.id}/movements`, json(200, { items: [row('p1', 'Renta de octubre')], nextCursor: null }))
    .on('GET', `/accounts/${ahorro.id}/movements`, json(200, { items: [row('a1', 'Apartado quincenal')], nextCursor: null }));
}

const tabRoutes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/movements': MovementsScreen,
  'transfer/index': () => <Text>Elegir beneficiario</Text>,
};
```
Existing cases build their fakes from `homeApi()` (or `homeApi(overview([]))`; the failing/hanging ones keep their own `/accounts` replies on top of `homeApi()` — `on` puts the newest route first). Remove `MOB-06 tocar una cuenta abre sus movimientos` (superseded by MOB-19: tapping a card selects it; "Ver todos" opens Movements — next case). `MOB-15 un saldo grande se muestra a partir del string, sin floats` (superseded by MOB-19: the hero repeats the total, so with a single account RNTL finds the amount twice) becomes:
```tsx
  test('MOB-15 un saldo grande se muestra a partir del string, sin floats', async () => {
    const big = { ...principal, balance: '1234567.89' };
    await renderApp({ fake: homeApi(overview([big, ahorro])), routes });
    expect(await screen.findByText('$1,234,567.89')).toBeOnTheScreen();
    expect(screen.getByLabelText('Saldo total $1,244,567.89')).toBeOnTheScreen();
  });
```
Append:
```tsx
  test('MOB-19 saluda con el nombre del usuario', async () => {
    await renderApp({ fake: homeApi(), routes });
    expect(await screen.findByLabelText('Hola, Ana')).toBeOnTheScreen();
  });

  test('MOB-19 el hero muestra $35,000.00 sumado sin punto flotante y lo disponible hoy', async () => {
    await renderApp({ fake: homeApi(), routes });
    expect(await screen.findByLabelText('Saldo total $35,000.00')).toBeOnTheScreen();
    expect(screen.getByText('Disponible hoy $31,500.00')).toBeOnTheScreen();
  });

  test('MOB-19 la primera cuenta queda seleccionada y la lista trae sus últimos 5 movimientos', async () => {
    const fake = homeApi();
    await renderApp({ fake, routes });
    expect(await screen.findByRole('button', { name: /^Principal/ })).toBeSelected();
    expect(await screen.findByText(/Renta de octubre/)).toBeOnTheScreen();
    expect(fake.requestsTo('GET', `/accounts/${principal.id}/movements`)[0]?.path).toBe(
      `/accounts/${principal.id}/movements?limit=5`,
    );
  });

  test('MOB-19 al tocar Ahorro la tarjeta queda marcada y la lista muestra los de Ahorro', async () => {
    await renderApp({ fake: homeApi(), routes });
    await userEvent.press(await screen.findByRole('button', { name: /^Ahorro/ }));
    expect(screen.getByRole('button', { name: /^Ahorro/ })).toBeSelected();
    expect(screen.getByRole('button', { name: /^Principal/ })).not.toBeSelected();
    expect(await screen.findByText(/Apartado quincenal/)).toBeOnTheScreen();
  });

  test('MOB-19 "Ver todos" con Ahorro seleccionada abre Movimientos con Ahorro', async () => {
    const fake = homeApi();
    const { router } = await renderApp({ fake, routes: tabRoutes });
    await userEvent.press(await screen.findByRole('button', { name: /^Ahorro/ }));
    await userEvent.press(screen.getByRole('button', { name: 'Ver todos los movimientos' }));
    await waitFor(() => expect(router.getPathname()).toBe('/movements'));
    await waitFor(() =>
      expect(fake.requestsTo('GET', `/accounts/${ahorro.id}/movements`).map((r) => r.path)).toContain(
        `/accounts/${ahorro.id}/movements?limit=20`,
      ),
    );
  });

  test('MOB-19 "Transferir" del hero abre el flujo', async () => {
    const { router } = await renderApp({ fake: homeApi(), routes });
    await userEvent.press(await screen.findByRole('button', { name: 'Transferir' }));
    expect(await screen.findByText('Elegir beneficiario')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/transfer');
  });

  test('MOB-19 si la consulta falla, el error dice qué lectura falló', async () => {
    const fake = homeApi().on('GET', '/accounts', 'network-error');
    await renderApp({ fake, routes });
    expect(await screen.findByText('No pudimos cargar tus cuentas')).toBeOnTheScreen();
  });
```
`mobile/src/components/ui/__tests__/home.test.tsx` — append (M-5 and the missing QuickActions test):
```tsx
describe('QuickActions', () => {
  test('MOB-19 cada acción es un botón con su texto visible', async () => {
    const onTransfer = jest.fn();
    await render(<QuickActions actions={[{ key: 't', label: 'Transferir', icon: 'transfer', onPress: onTransfer }, { key: 'm', label: 'Movimientos', icon: 'movements', onPress: () => {} }]} />);
    expect(screen.getByText('Movimientos')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Transferir' }));
    expect(onTransfer).toHaveBeenCalledTimes(1);
  });
});

test('MOB-19 DSG-13 con el texto agrandado el saldo del hero se reduce para caber en una línea', async () => {
  await render(<BalanceHero total="35000.00" available="31500.00" />);
  const amount = screen.getByTestId('hero-amount');
  expect(amount).toHaveProp('numberOfLines', 1);
  expect(amount).toHaveProp('adjustsFontSizeToFit', true);
  expect(amount).toHaveProp('minimumFontScale', 0.5);
});
```
(Import `QuickActions`, `BalanceHero`, `fireEvent` as the file already does for its other cases.)

- [ ] **Step 2: Run** — `npx jest src/features/accounts src/components/ui/__tests__/home.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`mobile/src/lib/loadable.ts`:
```ts
import type { UseQueryResult } from '@tanstack/react-query';

import { errorMessage } from './errors';

/** Estado de una lectura para una vista: cargando, con error (mensaje por `code`) o con datos. */
export type Loadable<T> =
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

/**
 * Un error gana a los datos en caché: si la actualización falla no se muestran los saldos
 * anteriores como si fueran actuales (MOB-05).
 */
export function loadable<T>(query: Pick<UseQueryResult<T>, 'status' | 'data' | 'error'>): Loadable<T> {
  if (query.status === 'error') return { status: 'error', message: errorMessage(query.error) };
  if (query.status === 'pending' || query.data === undefined) return { status: 'pending' };
  return { status: 'success', data: query.data };
}
```
`queries.ts` — add `latestMovements: (accountId: string) => ['accounts', accountId, 'movements', 'latest'] as const` and:
```ts
/** Lo que muestra Inicio por cuenta (MOB-19; D9: el mismo endpoint con `limit=5`). */
export const LATEST_MOVEMENTS_LIMIT = 5;

export function useLatestMovements(accountId: string | undefined) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.latestMovements(accountId ?? ''),
    queryFn: async ({ signal }) => {
      const { data } = await api.GET('/accounts/{accountId}/movements', {
        params: { path: { accountId: accountId ?? '' }, query: { limit: LATEST_MOVEMENTS_LIMIT } },
        signal,
      });
      return required(data).items.slice(0, LATEST_MOVEMENTS_LIMIT);
    },
    enabled: accountId !== undefined,
  });
}
```
`balance-hero.tsx` — on the `hero-amount` `Text`: add `adjustsFontSizeToFit` and `minimumFontScale={0.5}` (keeps `numberOfLines={1}`; with large system text the amount shrinks instead of being cut, M-5).

`mobile/src/features/accounts/home-view.tsx` (pure; story `Home`, `HomeEmpty`, `HomeLoading`, `HomeError`):
```tsx
import type { AccountsOverview, Movement } from '@devchrisvaz/wallet-contract';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AccountCard, AppHeader, BalanceHero, Button, DailyLimitMeter, EmptyState, InlineAlert, ListSection, MovementList, QuickActions, Skeleton } from '@/components/ui';
import { sumAmounts } from '@/lib/display';
import type { Loadable } from '@/lib/loadable';
import { theme } from '@/theme';

export interface HomeViewProps {
  user: { name: string; email: string };
  onLogout: () => void;
  refresh?: { refreshing: boolean; onRefresh: () => void } | undefined;
  overview: Loadable<AccountsOverview>;
  selectedId: string | undefined;
  latest: Loadable<Movement[]>;
  /** Referencia de "Hoy" y "Ayer" (lienzos); por omisión, la hora actual. */
  now?: Date | undefined;
  onSelect: (accountId: string) => void;
  onRetryOverview: () => void;
  onRetryLatest: () => void;
  onTransfer: () => void;
  onSeeAll: () => void;
  /** Oferta del desbloqueo biométrico (bonus, MOB-24): la pone el contenedor. */
  offer?: ReactNode;
  /** Lo que va en el menú de la cuenta junto a "Cerrar sesión" (el interruptor del desbloqueo, R46). */
  menuExtra?: ReactNode;
}

/** Inicio (MOB-19): saludo, hero, cuentas seleccionables, límite diario y últimos 5 movimientos. */
export function HomeView(props: HomeViewProps) {
  const { user, onLogout, refresh, overview, onRetryOverview, offer, menuExtra } = props;
  return (
    <Screen tabBar refresh={refresh} header={<AppHeader user={user} onLogout={onLogout} menuExtra={menuExtra} />}>
      {overview.status === 'pending' || overview.status === 'error' ? offer : null}
      {overview.status === 'pending' ? (
        <>
          <Skeleton variant="card" />
          <View style={styles.stack}>
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </View>
          <ListSection>
            <View style={styles.stack}>
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </View>
          </ListSection>
        </>
      ) : overview.status === 'error' ? (
        <View style={styles.list}>
          <InlineAlert tone="danger" title="No pudimos cargar tus cuentas" message={overview.message} />
          <Button label="Reintentar" variant="secondary" onPress={onRetryOverview} />
        </View>
      ) : overview.data.accounts.length === 0 ? (
        <>
          <BalanceHero total="0.00" available={overview.data.dailyLimit.remaining} />
          {offer}
          <EmptyState icon="account" title="Aún no tienes cuentas" description="Cuando tu cuenta esté lista, aquí verás su saldo." action={{ label: 'Volver a cargar', onPress: onRetryOverview }} />
        </>
      ) : (
        <HomeContent {...props} data={overview.data} />
      )}
    </Screen>
  );
}

function HomeContent({ data, selectedId, latest, now, onSelect, onRetryLatest, onTransfer, onSeeAll, offer }: HomeViewProps & { data: AccountsOverview }) {
  return (
    <>
      <BalanceHero
        total={sumAmounts(data.accounts.map((account) => account.balance))}
        available={data.dailyLimit.remaining}
        actions={<QuickActions actions={[{ key: 'transfer', label: 'Transferir', icon: 'transfer', onPress: onTransfer }, { key: 'movements', label: 'Movimientos', icon: 'movements', onPress: onSeeAll }]} />}
      />
      {offer}
      <View style={styles.stack}>
        {data.accounts.map((account) => (
          <AccountCard key={account.id} name={account.name} clabe={account.clabe} balance={account.balance} selected={account.id === selectedId} onPress={() => onSelect(account.id)} />
        ))}
      </View>
      <ListSection>
        <DailyLimitMeter dailyLimit={data.dailyLimit} />
      </ListSection>
      <ListSection
        title="Últimos movimientos"
        action={
          <Pressable accessibilityRole="button" accessibilityLabel="Ver todos los movimientos" onPress={onSeeAll} style={styles.link}>
            <Text style={styles.linkText}>Ver todos</Text>
          </Pressable>
        }
      >
        {latest.status === 'pending' ? (
          <View style={styles.stack}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </View>
        ) : latest.status === 'error' ? (
          <View style={styles.list}>
            <InlineAlert tone="danger" title="No pudimos cargar los movimientos" message={latest.message} />
            <Button label="Reintentar" variant="secondary" onPress={onRetryLatest} />
          </View>
        ) : latest.data.length === 0 ? (
          <Text style={styles.empty}>Aún no hay movimientos en esta cuenta.</Text>
        ) : (
          <MovementList movements={latest.data} now={now} />
        )}
      </ListSection>
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing[3] },
  list: { gap: theme.spacing[4] },
  link: { minHeight: theme.touchTarget, justifyContent: 'center' },
  linkText: { ...theme.typography.label, color: theme.colors.action.primary },
  empty: { ...theme.typography.bodySm, color: theme.colors.text.secondary, paddingVertical: theme.spacing[3] },
});
```
(`DailyLimitMeter` takes the same props as in the `Home` story. `MovementList` passes the time-only prop to its rows itself.)

`home-screen.tsx` (container):
```tsx
export function HomeScreen() {
  const router = useRouter();
  const header = useAccountHeader();
  const overview = useAccountsOverview();
  const { accountId, select } = useAccountSelection();
  const selected = overview.data ? selectedAccount(overview.data.accounts, accountId) : undefined;
  const latest = useLatestMovements(selected?.id);
  const refresh = useRefreshByUser(() => Promise.all([overview.refetch(), latest.refetch()]));
  return (
    <HomeView
      user={header.user}
      onLogout={header.onLogout}
      menuExtra={header.menuExtra}
      offer={<UnlockOffer />}
      refresh={refresh}
      overview={loadable(overview)}
      selectedId={selected?.id}
      latest={loadable(latest)}
      onSelect={select}
      onRetryOverview={() => void overview.refetch()}
      onRetryLatest={() => void latest.refetch()}
      onTransfer={() => router.push('/transfer')}
      onSeeAll={() => {
        if (selected) select(selected.id);
        router.navigate('/movements');
      }}
    />
  );
}
```
(Keep the MOB-05 doc comment on `HomeScreen`, extended with MOB-19; import `UnlockOffer` from `@/features/unlock/unlock-offer`.)

`mobile/src/features/unlock/unlock-offer.tsx` (bonus UI restyled with the kit, R46): keep every hook and handler; replace the `View style={styles.card}` and its `title` Text with `<ListSection title={`Entrar con tu ${support.kind}`}>` (the kit's title is the `accessibilityRole="header"` text the unlock tests query) wrapping `<View style={styles.body}>` (`gap: theme.spacing[3]`) with the body text and the "Activar"/"Ahora no" buttons; delete the `card`/`title` styles. `unlock-offer.test.tsx` must pass unchanged.

- [ ] **Step 4: Run** — Step 2 command → PASS; `npm test` → green (the pure-view guard covers `home-view.tsx`).
- [ ] **Step 5: R7 gates.**
- [ ] **Step 6: Commit** — `feat(mobile): redesign Home with the greeting, balance hero and latest movements`; `Task: redesign#7.3`; `Refs: MOB-19, MOB-05, MOB-15, DSG-13`.

## Task 7.4: Mobile Movements as a tab with the account selector and day grouping

Track M. Mirrors stories `Movements` and `MovementsEmpty` of `mobile/.design-sync/previews/Screen.tsx` (`AccountSwitch`, `TabScreen`). Canned → real: the two `Button`s → one per account of `useAccountsOverview()`, `movements` → `useRecentMovements(selected.id)` (last 20, MOB-06). Pins Review Focus #4 (midnight and new year). The time-only `MovementRow` prop is passed by `MovementList` (fix wave).

**Files:**
- Create: `mobile/src/features/accounts/movements-view.tsx`
- Modify: `mobile/src/features/accounts/movements-screen.tsx`, `mobile/src/features/accounts/__tests__/movements-screen.test.tsx`, `mobile/src/components/ui/button.tsx`, `mobile/src/components/ui/__tests__/controls.test.tsx`

**Interfaces:**
- Consumes: `Screen`, `AppHeader`, `Button`, `ListSection`, `MovementList`, `EmptyState`, `InlineAlert`, `Skeleton`, `Loadable`/`loadable`, `useAccountHeader`, `useAccountSelection`/`selectedAccount`, `useAccountsOverview`, `useRecentMovements`, `useRefreshByUser`.
- Produces: `MovementsView(props: MovementsViewProps)` with `{ user; onLogout; menuExtra?: ReactNode; refresh?; overview: Loadable<AccountsOverview>; selectedId: string | undefined; movements: Loadable<Movement[]>; now?: Date; onSelect(accountId): void; onRetryAccounts(): void; onRetryMovements(): void }`; `Button` additive prop `selected?: boolean` (→ `accessibilityState.selected`).

- [ ] **Step 1: Write the failing tests** — in `movements-screen.test.tsx` (helpers from 7.1), append:
```tsx
  test('MOB-20 el selector marca la cuenta actual y al cambiar a Ahorro muestra sus últimos 20', async () => {
    const fake = createFakeApi()
      .on('GET', MOVEMENTS_PATH, json(200, page([movement(1)])))
      .on('GET', `/accounts/${ahorro.id}/movements`, json(200, page([movement(2, { concept: 'Apartado' })])));
    await openMovements(fake);
    expect(await screen.findByRole('button', { name: 'Principal' })).toBeSelected();
    await userEvent.press(screen.getByRole('button', { name: 'Ahorro' }));
    expect(screen.getByRole('button', { name: 'Ahorro' })).toBeSelected();
    expect(await screen.findByText('Luis · Apartado')).toBeOnTheScreen();
    expect(fake.requestsTo('GET', `/accounts/${ahorro.id}/movements`)[0]?.path).toBe(
      `/accounts/${ahorro.id}/movements?limit=20`,
    );
  });

  describe('agrupación por día de Ciudad de México', () => {
    // Solo `Date` es falso: TanStack Query y la API simulada siguen con temporizadores reales.
    const REAL = ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'hrtime', 'performance'] as const;
    afterEach(() => jest.useRealTimers());

    async function dayHeaders(now: string, times: [string, string]) {
      jest.useFakeTimers({ now: new Date(now), doNotFake: [...REAL] });
      const items = times.map((occurredAt, index) => movement(index + 1, { occurredAt }));
      await openMovements(createFakeApi().on('GET', MOVEMENTS_PATH, json(200, page(items))));
      await screen.findAllByTestId('movement-row');
      return screen.getAllByRole('header').map((node) => node.props.children);
    }

    test('MOB-20 un movimiento de las 05:30 UTC de hoy aparece bajo "Ayer"', async () => {
      expect(await dayHeaders('2026-10-13T18:00:00Z', ['2026-10-13T16:42:00Z', '2026-10-13T05:30:00Z'])).toEqual(['Movimientos', 'Hoy', 'Ayer']);
    });

    test('MOB-20 el 1 de enero, un movimiento de las 23:30 del 31 de diciembre aparece bajo "Ayer"', async () => {
      expect(await dayHeaders('2026-01-01T18:00:00Z', ['2026-01-01T16:00:00Z', '2026-01-01T05:30:00Z'])).toEqual(['Movimientos', 'Hoy', 'Ayer']);
    });
  });

  test('MOB-20 si la lectura falla, el error dice qué lectura falló y permite reintentar', async () => {
    const fake = createFakeApi().on('GET', MOVEMENTS_PATH, 'network-error');
    await openMovements(fake);
    expect(await screen.findByText('No pudimos cargar los movimientos')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });
```
(Import `ahorro`, `userEvent`. `movement(index, overrides)`, `page(items)`, `MOVEMENTS_PATH`, `openMovements` exist in the file; `openMovements` registers `/accounts` and `/me`. The day headers are the `accessibilityRole="header"` texts of `MovementList`, after the AppHeader title.)

In `controls.test.tsx` append:
```tsx
  test('MOB-20 un botón de selector anuncia si está elegido', async () => {
    await render(<Button label="Ahorro" variant="secondary" selected={false} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ahorro' })).not.toBeSelected();
  });
```
- [ ] **Step 2: Run** — `npx jest src/features/accounts/__tests__/movements-screen.test.tsx src/components/ui/__tests__/controls.test.tsx` → FAIL.
- [ ] **Step 3: Implement**
  - `button.tsx` — add `selected?: boolean` to `ButtonProps` and `accessibilityState={{ disabled: inactive, busy: loading, selected }}`.
  - `movements-view.tsx` (pure; story `Movements`/`MovementsEmpty`): `<Screen tabBar refresh={refresh} header={<AppHeader user={user} title="Movimientos" onLogout={onLogout} menuExtra={menuExtra} />}>`; `overview` `pending` → three `Skeleton` lines in `styles.loading` (`gap: theme.spacing[4]`); `overview` `error` → `InlineAlert tone="danger" title="No pudimos cargar tus cuentas"` + "Reintentar" (`onRetryAccounts`); success → the segmented switch over `overview.data.accounts` `<View style={styles.segmented}>` (`flexDirection: 'row', gap: theme.spacing[2]`) with, per account, `<View key style={styles.segment}><Button label={account.name} variant={account.id === selectedId ? 'primary' : 'secondary'} selected={account.id === selectedId} onPress={() => onSelect(account.id)} /></View>` (`segment: { flex: 1 }`); then movements `pending` → six `Skeleton` lines; `error` → `InlineAlert tone="danger" title="No pudimos cargar los movimientos" message={…}` + "Reintentar" (`onRetryMovements`); empty → `<EmptyState icon="movements" title="Aún no hay movimientos" description="Aquí verás los depósitos y las transferencias de esta cuenta." />`; otherwise `<ListSection><MovementList movements={movements.data} now={now} /></ListSection>`.
  - `movements-screen.tsx` (container): `useAccountHeader()`, `useAccountsOverview()`, `useAccountSelection()`, `selected = overview.data ? selectedAccount(overview.data.accounts, accountId) : undefined`, `useRecentMovements(selected?.id)`, `useRefreshByUser(() => Promise.all([overview.refetch(), movements.refetch()]))`; render `<MovementsView user={header.user} onLogout={header.onLogout} menuExtra={header.menuExtra} … overview={loadable(overview)} selectedId={selected?.id} movements={loadable(movements)} onSelect={select} … />` (keep the MOB-06 doc comment, extended with MOB-20).
- [ ] **Step 4: Run** — Step 2 command → PASS; `npm test` → green.
- [ ] **Step 5: R7 gates.**
- [ ] **Step 6: Commit** — `feat(mobile): show Movements as a tab with an account selector and day groups`; `Task: redesign#7.4`; `Refs: MOB-20, MOB-06, MOB-15`.

## Task 7.5: Mobile stepped transfer flow with the amount as hero

Track M. Mirrors the transfer stories of `mobile/.design-sync/previews/Screen.tsx`: `TransferRecipient`, `TransferRecipientEmpty`, `TransferAmount`, `TransferReview`, `TransferRetrying`, `TransferUncertain`, `TransferRejected`, `TransferOtp`, `TransferCompleted`, `TransferFailed` (helpers `FlowScreen`, `RecipientRow`, `SummaryRow`, `AmountBlock`, `ReviewSummary`). Canned → real: `luis`/`mama` → `useBeneficiaries()`, `principal`/`ahorro` → `useAccountsOverview()`, every story state → the `AttemptState` of `TransferAttempt` (unchanged), `noop` → the attempt's methods and the router. All MOB-07…MOB-14 tests keep their assertions on requests, keys, payloads, timers and messages; only the names the stories change are updated (listed). Folds the final-review items for 7.5: Receipt `fromAccountClabe` and the error titles on the real screens, the Stepper double announcement, and moves the review/OTP actions into the `Screen` footer (the mobile equivalent of the web `StepActions`). Ruling R36 applies.

**Files:**
- Create: `mobile/src/features/transfer/flow-steps.ts`, `mobile/src/features/transfer/__tests__/flow-steps.test.ts`, `mobile/src/features/transfer/retry-limits.ts`, `mobile/src/features/transfer/recipient-view.tsx`, `mobile/src/features/transfer/transfer-flow-view.tsx`, `mobile/src/features/transfer/__tests__/steps.test.tsx`
- Modify: `mobile/src/features/transfer/{beneficiary-picker-screen,transfer-flow-screen,form-view,review-view,otp-view,outcome-view,transfer-attempt}.ts(x)`, `mobile/src/features/transfer/__tests__/{beneficiary-picker,receipt,transfer-form}.test.tsx`, `mobile/src/components/ui/stepper.tsx`, `mobile/src/components/ui/__tests__/overlays.test.tsx`, `mobile/src/__tests__/views-are-pure.test.ts`
- Delete: `mobile/src/features/transfer/attempt-actions.tsx` (its alerts and buttons move into `transfer-flow-view.tsx`: alerts in the body, buttons in the footer, as in the stories)

**Interfaces:**
- Consumes: `Screen({ header, footer })`, `FlowHeader({ title, step, total, stepLabel, onClose })`, `ListSection`, `Avatar`/`initials`, `Icon`, `AmountField` (`variant="hero"`), `Select`, `TextField`, `OtpField`, `InlineAlert`, `Button`, `Receipt({ transfer, fromAccountName, fromAccountClabe })`, `EmptyState`, `Skeleton`, `maskClabe`, `errorMessage`, `problemMessage`, `useCountdown`, `TransferAttempt` methods `review`, `submit`, `edit`, `retry`, `confirmOtp`, `resendOtp`, `restart`, `type AttemptState`, `useRouter().dismissTo` (expo-router 57).
- Produces: `flowHeading(state): FlowHeading`, `RECIPIENT_HEADING`, `requiresOtp(amount)`, `UNCERTAIN_TITLE` (`flow-steps.ts`); `MAX_RETRIES` (`retry-limits.ts`, re-exported by `transfer-attempt.ts`); `RecipientView({ beneficiaries: Loadable<BeneficiaryList>; onPick(beneficiary); onRetry(); onClose() })`; `TransferFlowView({ state, data: Loadable<{ accounts: Account[]; beneficiary: Beneficiary | undefined }>, values, errors, code, actions: TransferFlowActions })` with `interface TransferFlowActions { onClose; onChange(values); onContinue; onSubmit; onEdit; onRetry; onCodeChange(code); onConfirm; onResend; onRestart; onHome; onAnother }`; `FormView` gains `beneficiary` and loses its "Continuar" button; `ReviewView({ draft, account, beneficiary })`; `OtpView({ state, code, onCodeChange })` + `otpControls(state)`; `OutcomeView({ state, account })`; `Stepper` announces from its accessible container.

- [ ] **Step 1: Write the failing tests**

`mobile/src/features/transfer/__tests__/flow-steps.test.ts`:
```ts
import { draft, transfer } from '@/test-utils/transfer-fixtures';

import { RECIPIENT_HEADING, flowHeading, requiresOtp } from '../flow-steps';
import type { AttemptState } from '../transfer-attempt';

const frozen = (amount: string) => ({ key: 'k', payload: '{}', draft: { ...draft, amount } });

describe('pasos del flujo', () => {
  test('MOB-21 destinatario y monto son los pasos 1 y 2 de 5', () => {
    expect(RECIPIENT_HEADING).toEqual({ title: '¿A quién le envías?', step: 1, total: 5, label: 'Destinatario' });
    expect(flowHeading({ status: 'editing' })).toEqual({ title: '¿Cuánto envías?', step: 2, total: 5, label: 'Monto' });
  });

  test('MOB-21 la revisión es el paso 3 de 5 con código y 3 de 4 sin él (R36)', () => {
    expect(flowHeading({ status: 'reviewing', ...frozen('15000') })).toEqual({ title: 'Revisa tu transferencia', step: 3, total: 5, label: 'Revisión' });
    expect(flowHeading({ status: 'waitingRetry', retry: 1, delayMs: 1000, ...frozen('1250') })).toEqual({ title: 'Enviando tu transferencia', step: 3, total: 4, label: 'Revisión' });
    expect(requiresOtp('10000.00')).toBe(false);
  });

  test('MOB-21 el código es el paso 4 de 5 y el comprobante el último', () => {
    const pending = transfer({ status: 'PENDING_OTP', requiresOtp: true });
    expect(flowHeading({ status: 'pendingOtp', transfer: pending })).toEqual({ title: 'Confirma con tu código', step: 4, total: 5, label: 'Código' });
    expect(flowHeading({ status: 'completed', transfer: transfer(), replayed: false } as AttemptState)).toMatchObject({ step: 4, total: 4, label: 'Comprobante' });
    expect(flowHeading({ status: 'completed', transfer: transfer({ requiresOtp: true }), replayed: false })).toMatchObject({ step: 5, total: 5 });
  });
});
```
`mobile/src/features/transfer/__tests__/steps.test.tsx`:
```tsx
import { act, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFakeApi, json, type FakeApi, type FakeReply } from '@/test-utils/fake-api';
import { luis, overview } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';
import { pendingOtp, transfer } from '@/test-utils/transfer-fixtures';

import { TransferFlowScreen } from '../transfer-flow-screen';

function apiWith(...createReplies: FakeReply[]): FakeApi {
  return createFakeApi()
    .on('GET', '/accounts', json(200, overview()))
    .on('GET', '/beneficiaries', json(200, { items: [luis] }))
    .on('POST', '/transfers', ...createReplies);
}

const routes = {
  index: () => <Text>Pantalla de inicio</Text>,
  'transfer/index': () => <Text>Elegir destinatario</Text>,
  'transfer/send': TransferFlowScreen,
};

async function open(fake: FakeApi, fakeTimers = false) {
  const rendered = await renderApp({ fake, routes, initialUrl: `/transfer/send?beneficiaryId=${luis.id}` });
  const user = userEvent.setup(fakeTimers ? { advanceTimers: jest.advanceTimersByTime } : {});
  return { ...rendered, user };
}

async function review(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.type(await screen.findByLabelText('Monto'), amount);
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia'), '1');
  await user.press(screen.getByRole('button', { name: 'Continuar' }));
}

describe('flujo por pasos', () => {
  afterEach(() => jest.useRealTimers());

  test('MOB-21 el monto es el protagonista del paso de monto, debajo de a quién se envía', async () => {
    await open(apiWith(json(201, transfer())));
    expect(await screen.findByLabelText('Paso 2 de 5: Monto')).toBeOnTheScreen();
    expect(screen.getByText('Para')).toBeOnTheScreen();
    expect(screen.getByText('Luis · CLABE •••• 5678')).toBeOnTheScreen();
    expect(screen.getByTestId('hero-amount-mirror', { includeHiddenElements: true })).toBeTruthy();
  });

  test('MOB-21 en el paso de código el indicador muestra el paso 4 de 5 y lo anuncia', async () => {
    const { user } = await open(apiWith(json(201, pendingOtp())));
    await review(user, '15000');
    expect(await screen.findByLabelText('Paso 3 de 5: Revisión')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Enviar' }));
    const stepper = await screen.findByLabelText('Paso 4 de 5: Código');
    expect(stepper).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  test('MOB-21 al perder la red al enviar reintenta con la misma llave y muestra el estado de reintento', async () => {
    jest.useFakeTimers();
    const fake = apiWith('network-error', json(201, transfer()));
    const { user } = await open(fake, true);
    await review(user, '1250');
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Perdimos la conexión. Reintentaremos la misma operación (1 de 5).')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Enviando tu transferencia' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
    expect(await screen.findByText('Completada')).toBeOnTheScreen();
    const keys = fake.requestsTo('POST', '/transfers').map((request) => request.headers['idempotency-key']);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  test('MOB-21 MOB-13 el comprobante lleva el origen con su terminación y ofrece hacer otra transferencia', async () => {
    const { user, router } = await open(apiWith(json(201, transfer())));
    await review(user, '1250');
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Principal · •••• 9719')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Hacer otra transferencia' }));
    expect(await screen.findByText('Elegir destinatario')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/transfer');
  });

  test('MOB-21 salir de la transferencia vuelve a Inicio', async () => {
    const { user, router } = await open(apiWith(json(201, transfer())));
    await user.press(await screen.findByRole('button', { name: 'Salir de la transferencia' }));
    expect(await screen.findByText('Pantalla de inicio')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
  });
});
```
(`pendingOtp()` and `transfer()` come from `@/test-utils/transfer-fixtures`; `principal` has CLABE …9719. The "Enviando" title check uses the `FlowHeader` title, an `accessibilityRole="header"` text.)

`mobile/src/features/transfer/__tests__/beneficiary-picker.test.tsx` — superseded by MOB-21 (the approved `RecipientRow` and the flow's close button): the accessible names become `'Luis, Luis Pérez, CLABE terminación 5678'` and `'Mamá, María Gómez, CLABE terminación 4321'` (the `/^Mamá/` press stays); the empty case expects the buttons `['Salir de la transferencia']` instead of `['Cancelar']`. Append:
```tsx
  test('MOB-21 el destinatario es el paso 1 de 5 y lo anuncia', async () => {
    const fake = createFakeApi().on('GET', '/beneficiaries', json(200, { items: [luis, mama] }));
    await renderApp({ fake, routes, initialUrl: '/transfer' });
    expect(await screen.findByLabelText('Paso 1 de 5: Destinatario')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '¿A quién le envías?' })).toBeOnTheScreen();
  });

  test('MOB-21 si la consulta falla, el error dice qué lectura falló', async () => {
    const fake = createFakeApi().on('GET', '/beneficiaries', 'network-error');
    await renderApp({ fake, routes, initialUrl: '/transfer' });
    expect(await screen.findByText('No pudimos cargar tus beneficiarios')).toBeOnTheScreen();
  });
```
`mobile/src/features/transfer/__tests__/receipt.test.tsx` — superseded by MOB-21 (story `TransferCompleted` copy): press `'Ver mis cuentas'` instead of `'Ir a mis cuentas'` (same assertions; `HomeScreen` is the `index` route); and, superseded by WEB-25/MOB-21 (final-review 6.5/7.5: the origin carries its CLABE ending), in `MOB-13 el comprobante muestra los datos que devolvió la API` replace `expect(screen.getByText('Principal')).toBeOnTheScreen()` with `expect(screen.getByText('Principal · •••• 9719')).toBeOnTheScreen()`.

`mobile/src/features/transfer/__tests__/transfer-form.test.tsx` — superseded by MOB-21 (story `TransferAmount`: "Para" and the recipient are two texts): in `openForm` replace `await screen.findByText('Para Luis · CLABE •••• 5678');` with `await screen.findByText('Luis · CLABE •••• 5678');` (every case keeps its assertions).

`mobile/src/components/ui/__tests__/overlays.test.tsx` — `Stepper` (final-review: no double announcement):
```tsx
  test('MOB-21 anuncia el paso desde el contenedor, una sola vez', async () => {
    await render(<Stepper current={4} total={5} label="Código" />);
    expect(screen.getByLabelText('Paso 4 de 5: Código')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByText('Paso 4 de 5 · Código')).not.toHaveProp('accessibilityLiveRegion');
  });
```
`mobile/src/__tests__/views-are-pure.test.ts` — empty `PENDING_7_5` (delete the constant and its filter: every view is pure now) and append inside the `describe`:
```ts
  test('MOB-21 cada pantalla tiene su vista pura', () => {
    expect(viewFiles().map((file) => file.split('/features/')[1]).sort()).toEqual([
      'accounts/home-view.tsx',
      'accounts/movements-view.tsx',
      'auth/login-view.tsx',
      'transfer/form-view.tsx',
      'transfer/otp-view.tsx',
      'transfer/outcome-view.tsx',
      'transfer/recipient-view.tsx',
      'transfer/review-view.tsx',
      'transfer/transfer-flow-view.tsx',
    ]);
  });
```

- [ ] **Step 2: Run** — `npx jest src/features/transfer src/components/ui/__tests__/overlays.test.tsx src/__tests__/views-are-pure.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`retry-limits.ts`: `/** Reintentos automáticos de un intento (MOB-10). */ export const MAX_RETRIES = 5;`. In `transfer-attempt.ts` replace `export const MAX_RETRIES = 5;` with `import { MAX_RETRIES } from './retry-limits';` (top) and `export { MAX_RETRIES };` (the retry tests import it from here).

`flow-steps.ts`:
```ts
import { toCents } from '@devchrisvaz/wallet-contract';

import type { AttemptState } from './transfer-attempt';

/** Montos mayores a 10,000.00 MXN piden un código por correo (HU6). */
const OTP_THRESHOLD_CENTS = toCents('10000.00');

export function requiresOtp(amount: string): boolean {
  return toCents(amount) > OTP_THRESHOLD_CENTS;
}

export const UNCERTAIN_TITLE = 'No pudimos confirmar el estado de tu transferencia';

export interface FlowHeading {
  title: string;
  step: number;
  total: number;
  label: string;
}

export const RECIPIENT_HEADING: FlowHeading = { title: '¿A quién le envías?', step: 1, total: 5, label: 'Destinatario' };

const TITLES: Record<AttemptState['status'], string> = {
  // los de transfer-flow-screen.tsx, sin cambios
};

/** Título e indicador del paso (MOB-21); el total pasa a 4 cuando el monto no pide código (R36). */
export function flowHeading(state: AttemptState): FlowHeading {
  const title = TITLES[state.status];
  switch (state.status) {
    case 'editing':
      return { title, step: 2, total: 5, label: 'Monto' };
    case 'pendingOtp':
    case 'confirmingOtp':
    case 'waitingOtpRetry':
    case 'otpUncertain':
      return { title, step: 4, total: 5, label: 'Código' };
    case 'completed': {
      const total = state.transfer.requiresOtp ? 5 : 4;
      return { title, step: total, total, label: 'Comprobante' };
    }
    case 'failed':
    case 'expired':
      return { title, step: 5, total: 5, label: 'Comprobante' };
    default:
      return { title, step: 3, total: requiresOtp(state.draft.amount) ? 5 : 4, label: 'Revisión' };
  }
}
```
(Move the `TITLES` record verbatim from `transfer-flow-screen.tsx`; `review-view.tsx` imports `requiresOtp` from here and no longer exports its own.)

`stepper.tsx` — move `accessibilityLiveRegion="polite"` from the `Text` to the `accessible` `View` (the container is the single accessible element: its label is read on focus and on change).

`recipient-view.tsx` (pure; story `TransferRecipient`/`TransferRecipientEmpty`): `<Screen header={<FlowHeader title={RECIPIENT_HEADING.title} step={1} total={5} stepLabel="Destinatario" onClose={onClose} />}>`; `pending` → three `Skeleton` lines; `error` → `<InlineAlert tone="danger" title="No pudimos cargar tus beneficiarios" message={…} />` + `<Button label="Reintentar" variant="secondary" onPress={onRetry} />`; empty → `<EmptyState icon="beneficiaries" title="Aún no tienes beneficiarios" description="Regístralos en la web de TreoWallet para poder enviarles dinero desde aquí." />`; otherwise `<ListSection title="Beneficiarios">` with one row per beneficiary copied from the story's `RecipientRow` (`Pressable accessibilityRole="button" accessibilityLabel={`${b.alias}, ${b.name}, CLABE terminación ${b.clabe.slice(-4)}`} onPress={() => onPick(b)} style={[styles.row, index === 0 ? null : styles.divider]}`, `Avatar initials={initials(b.name)}`, alias in `rowTitle`, `${b.name} · CLABE ${maskClabe(b.clabe)}` in `rowDetail` with `numberOfLines={1}`, `<Icon name="forward" color={theme.colors.text.muted} />`; styles `row`, `divider`, `rowText`, `rowTitle`, `rowDetail` verbatim from the story).

`beneficiary-picker-screen.tsx` (container): `const router = useRouter(); const beneficiaries = useBeneficiaries();` → `<RecipientView beneficiaries={loadable(beneficiaries)} onRetry={() => void beneficiaries.refetch()} onPick={(b) => router.push({ pathname: '/transfer/send', params: { beneficiaryId: b.id } })} onClose={() => router.dismissTo('/')} />`.

`form-view.tsx` (story `TransferAmount`): add `beneficiary: Beneficiary | undefined`; render first the "Para" `ListSection` (`styles.row` with `Avatar initials={initials(beneficiary.name)}`, `<Text style={styles.rowDetail}>Para</Text>`, `<Text style={styles.rowTitle}>{`${beneficiary.alias} · CLABE ${maskClabe(beneficiary.clabe)}`}</Text>`, only when `beneficiary`), then `AmountField variant="hero" label="Monto" help="Hasta 2 decimales, sin comas."`, the `Select` "Cuenta de origen" (unchanged), `TextField` Concepto/Referencia (unchanged); remove `onContinue` and its button (it moves to the footer). `form` gap stays `theme.spacing[4]`.

`review-view.tsx` (story `ReviewSummary`): `AmountBlock` (`<View style={styles.amountBlock}><Text style={styles.amountLabel}>Monto</Text><Text style={styles.amount}>{formatMXN(draft.amount)}</Text></View>`), `<ListSection>` with `SummaryRow`s Desde (`${account.name} · ${maskClabe(account.clabe)}`), Para (`${beneficiary.alias} · ${maskClabe(beneficiary.clabe)}`), Concepto, Referencia (story `SummaryRow` markup and styles verbatim), then the OTP info `InlineAlert` when `requiresOtp(draft.amount)`. Remove the `children` prop and the old `summary` box styles.

`otp-view.tsx` (story `TransferOtp`): props `{ state: OtpState; code: string; onCodeChange(code: string): void }` (`code` lifted to the container so the footer can submit it); body: `AmountBlock` with `formatMXN(transfer.amount)` and caption `` `Para ${transfer.destination.displayName} · CLABE ${maskClabe(transfer.destination.clabeLast4)}` ``, then `<View style={styles.list}>` with the "Te enviamos un código de 6 dígitos a …" text, the delivery-failed warning, `<View style={styles.tight}>` with the two meta lines (countdown and attempts, as today), the `otpError`/`resendError`/`waitingOtpRetry` alerts (as today, `MAX_RETRIES` from `./retry-limits`), the `otpUncertain` warning (`title={UNCERTAIN_TITLE}`, message "Puede que ya se haya confirmado. Reintenta para conocer el resultado.") and, unless `otpUncertain`, `<OtpField value={code} onChangeText={onCodeChange} disabled={busy} />`. Export:
```ts
/** Lo que necesitan las acciones del pie en el paso de código. */
export function otpControls(state: OtpState): { busy: boolean; canResend: boolean; resending: boolean } {
  const busy = state.status === 'confirmingOtp' || state.status === 'waitingOtpRetry';
  const pending = state.status === 'pendingOtp' ? state : undefined;
  const exhausted = pending?.resendError instanceof ProblemError && pending.resendError.code === 'RESEND_LIMIT_REACHED';
  const canResend = state.status === 'pendingOtp' && !exhausted && (state.transfer.otp?.resendsRemaining ?? 0) > 0;
  return { busy, canResend, resending: pending?.resending ?? false };
}
```
and `export type OtpState`.

`outcome-view.tsx` (story `TransferCompleted`/`TransferFailed`): props `{ state: OutcomeState; account: Account | undefined }`, no router, no buttons. Completed → the `replayed` info alert (as today) + `<Receipt transfer={state.transfer} fromAccountName={account?.name} fromAccountClabe={account?.clabe} />`. Failed/expired → `<InlineAlert tone="danger" message={errorMessage(state.error)} />` + `<Receipt transfer={{ ...state.transfer, status: state.status === 'expired' ? 'EXPIRED' : 'FAILED' }} fromAccountName={account?.name} fromAccountClabe={account?.clabe} />` (the 422/409 is the API's verdict on that transfer, so the receipt shows it; it replaces today's lone `StatusBadge`).

`transfer-flow-view.tsx` (pure; every flow story from step 2 on):
```tsx
export interface TransferFlowActions {
  onClose: () => void;
  onChange: (values: FormValues) => void;
  onContinue: () => void;
  onSubmit: () => void;
  onEdit: () => void;
  onRetry: () => void;
  onCodeChange: (code: string) => void;
  onConfirm: () => void;
  onResend: () => void;
  onRestart: () => void;
  onHome: () => void;
  onAnother: () => void;
}

export interface TransferFlowViewProps {
  state: AttemptState;
  data: Loadable<{ accounts: Account[]; beneficiary: Beneficiary | undefined }>;
  values: FormValues;
  errors: Record<string, string>;
  code: string;
  actions: TransferFlowActions;
}

/** Pantalla de un paso: encabezado con cerrar, título y pasos; contenido; acciones fijas abajo. */
function FlowScreen({ heading, onClose, footer, children }: { heading: FlowHeading; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  return (
    <Screen header={<FlowHeader title={heading.title} step={heading.step} total={heading.total} stepLabel={heading.label} onClose={onClose} />} footer={footer}>
      {children}
    </Screen>
  );
}

/** Flujo de transferencia a partir del monto (MOB-21): lo que muestran las historias, por estado del intento. */
export function TransferFlowView({ state, data, values, errors, code, actions }: TransferFlowViewProps) {
  const heading = flowHeading(state);
  if (data.status !== 'success') {
    return (
      <FlowScreen heading={heading} onClose={actions.onClose}>
        {data.status === 'pending' ? (
          <View style={styles.loading}><Skeleton variant="line" /><Skeleton variant="line" /></View>
        ) : (
          <InlineAlert tone="danger" title="No pudimos cargar tus cuentas y beneficiarios" message={data.message} />
        )}
      </FlowScreen>
    );
  }
  const { accounts, beneficiary } = data.data;
  switch (state.status) {
    case 'editing':
      return (
        <FlowScreen heading={heading} onClose={actions.onClose} footer={<Button label="Continuar" onPress={actions.onContinue} />}>
          <FormView accounts={accounts} beneficiary={beneficiary} values={values} errors={errors} onChange={actions.onChange} />
        </FlowScreen>
      );
    case 'rateLimited':
      return <RateLimitedStep heading={heading} state={state} accounts={accounts} beneficiary={beneficiary} actions={actions} />;
    case 'reviewing':
    case 'sending':
    case 'waitingRetry':
    case 'uncertain':
    case 'rejected':
    case 'error':
      return (
        <FlowScreen heading={heading} onClose={actions.onClose} footer={<ReviewFooter state={state} actions={actions} />}>
          <ReviewView draft={state.draft} account={accounts.find((a) => a.id === state.draft.fromAccountId)} beneficiary={beneficiary} />
          <ReviewAlert state={state} />
        </FlowScreen>
      );
    case 'pendingOtp':
    case 'confirmingOtp':
    case 'waitingOtpRetry':
    case 'otpUncertain':
      return (
        <FlowScreen heading={heading} onClose={actions.onClose} footer={<OtpFooter state={state} code={code} actions={actions} />}>
          <OtpView state={state} code={code} onCodeChange={actions.onCodeChange} />
        </FlowScreen>
      );
    case 'completed':
      return (
        <FlowScreen heading={heading} onClose={actions.onClose} footer={<><Button label="Ver mis cuentas" variant="secondary" onPress={actions.onHome} /><Button label="Hacer otra transferencia" variant="ghost" onPress={actions.onAnother} /></>}>
          <OutcomeView state={state} account={accounts.find((a) => a.id === state.transfer.fromAccountId)} />
        </FlowScreen>
      );
    case 'failed':
    case 'expired':
      return (
        <FlowScreen heading={heading} onClose={actions.onClose} footer={<><Button label="Intentar de nuevo" onPress={actions.onRestart} /><Button label="Ver mis cuentas" variant="secondary" onPress={actions.onHome} /></>}>
          <OutcomeView state={state} account={accounts.find((a) => a.id === state.transfer.fromAccountId)} />
        </FlowScreen>
      );
  }
}
```
with, in the same file (copy the copy from today's `attempt-actions.tsx`):
- `ReviewAlert({ state })`: `waitingRetry` → `<InlineAlert tone="warning" message={`Perdimos la conexión. Reintentaremos la misma operación (${state.retry} de ${MAX_RETRIES}).`} />`; `uncertain` → `<InlineAlert tone="warning" title={UNCERTAIN_TITLE} message="Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces." />`; `rejected`/`error` → `<InlineAlert tone="danger" message={errorMessage(state.error)} />`; otherwise `null`.
- `ReviewFooter({ state, actions })`: `reviewing` → "Enviar" (`onSubmit`) + ghost "Editar" (`onEdit`); `sending`/`waitingRetry` → `<Button label="Enviar" onPress={() => undefined} loading />`; `uncertain` → "Reintentar" (`onRetry`); `rejected`/`error` → secondary "Corregir" (`onEdit`).
- `RateLimitedStep` — the one state with a timer: `const countdown = useCountdown(state.retryAfterSeconds);` body `ReviewView` + `<InlineAlert tone="warning" message={problemMessage('RATE_LIMITED')} />` + the countdown text (as today); footer "Reintentar" disabled while `countdown.remaining > 0`.
- `OtpFooter({ state, code, actions })`: `otpUncertain` → "Reintentar" (`onRetry`); otherwise `const { busy, canResend, resending } = otpControls(state);` → `<Button label="Confirmar" loading={busy} disabled={code.length !== 6} onPress={actions.onConfirm} />` and, if `canResend`, `<Button label="Reenviar código" variant="ghost" loading={resending} onPress={actions.onResend} />`.

`transfer-flow-screen.tsx` (container; keep its doc comment):
```tsx
export function TransferFlowScreen() {
  const router = useRouter();
  const { beneficiaryId } = useLocalSearchParams<{ beneficiaryId: string }>();
  const accounts = useAccountsOverview();
  const beneficiaries = useBeneficiaries();
  const { attempt, state } = useTransferAttempt();
  const [values, setValues] = useState<FormValues>({ fromAccountId: undefined, amount: '', concept: '', reference: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState('');
  const accountList = accounts.data?.accounts ?? [];
  const fromAccountId = values.fromAccountId ?? accountList[0]?.id;
  const loadError = accounts.error ?? beneficiaries.error;
  const data: TransferFlowViewProps['data'] =
    accounts.isPending || beneficiaries.isPending
      ? { status: 'pending' }
      : loadError
        ? { status: 'error', message: errorMessage(loadError) }
        : { status: 'success', data: { accounts: accountList, beneficiary: beneficiaries.data?.items.find((item) => item.id === beneficiaryId) } };

  return (
    <TransferFlowView
      state={state}
      data={data}
      values={{ ...values, fromAccountId }}
      errors={errors}
      code={code}
      actions={{
        onClose: () => router.dismissTo('/'),
        onChange: setValues,
        onContinue: () => {
          const result = attempt.review({ fromAccountId: fromAccountId ?? '', beneficiaryId, amount: values.amount, concept: values.concept, reference: values.reference });
          setErrors(result.ok ? {} : result.errors);
        },
        onSubmit: () => void attempt.submit(),
        onEdit: () => attempt.edit(),
        onRetry: () => void attempt.retry(),
        onCodeChange: setCode,
        onConfirm: () => void attempt.confirmOtp(code),
        onResend: () => void attempt.resendOtp(),
        onRestart: () => {
          setCode('');
          attempt.restart();
        },
        onHome: () => router.dismissTo('/'),
        onAnother: () => router.dismissTo('/transfer'),
      }}
    />
  );
}
```
(`dismissTo` pops back to the given route, or replaces with it when it is not in the stack — so "Ver mis cuentas" lands on Inicio both from the real stack and from a test that opened `/transfer/send` directly.)

Delete `attempt-actions.tsx` (`git rm`); `grep -rn "attempt-actions" mobile/src` must print nothing.

- [ ] **Step 4: Run** — Step 2 command → PASS; `npm test` → green: in particular `review`, `transfer-form`, `sending-states`, `otp-screen`, `receipt`, `lost-response` keep their assertions (the buttons kept their names: "Continuar", "Enviar", "Editar", "Reintentar", "Corregir", "Confirmar", "Reenviar código", "Intentar de nuevo").
- [ ] **Step 5: R7 gates.**
- [ ] **Step 6: Commit** — `feat(mobile): split the transfer into steps with the amount as hero`; `Task: redesign#7.5`; `Refs: MOB-21, MOB-07, MOB-08, MOB-09, MOB-10, MOB-11, MOB-12, MOB-13, MOB-14`.

---

## Task 8.1: Final parity on the real screens

Close phase, in `$WT` (`design/redesign` after both merges). Captures every equivalent pair on the **real** screens and compares it with the approved stories and with its pair, at 390×844 (viewport and full page — final-review M-8) and, for the web, at 1280×800.

**How the real screens are captured (investigated in this environment):**
- **Web — the real app, fully running (primary, high fidelity).** `next dev` from the worktree on `127.0.0.1:3101` with `API_BASE_URL` pointing at `web/e2e/fake-api.mjs` (Task 6.7) on `127.0.0.1:4999`, which serves the canonical story data with the contract's shapes and answers the Server Actions' API calls (create → `COMPLETED` for $1,250.00, `PENDING_OTP` for $15,000.00, 422 `INSUFFICIENT_FUNDS` for $30,000.00; confirm `000000` → 422 `OTP_ATTEMPTS_EXHAUSTED`). Playwright logs in through the real form, fixes the browser clock at `2026-10-13T18:00:00Z` (so "Hoy"/"Ayer" match the stories) and drives each state as a person would; the uncertain state aborts the Server Action request in the browser. Nothing touches the seeded PostgreSQL. Port 3000 is taken (Grafana); 4000 runs the user's API from the main checkout and is not used.
- **Mobile — the real views in the react-native-web canvas (fallback, because the full stack cannot run here).** There is no device or simulator; the app has no `react-native-web`/`react-dom`/`@expo/metro-runtime` dependency (they exist only in `mobile/.ds-sync/`), and on web `expo-secure-store` has no implementation, so the real app cannot log in under Expo web (MOB-02 forbids an AsyncStorage fallback). Tasks 7.2–7.5 made every screen a pure `*-view.tsx` (guarded by `src/__tests__/views-are-pure.test.ts`); this task points the `Screen` stories at those real views with the canonical data, so the canvas renders the real presentational code with the same theme and react-native-web the app would use on web.
- **Verified:** the real web pages (routing, layouts, BFF reads, Server Actions, Tailwind output, Work Sans via `next/font`) at both widths against the approved stories; the real mobile view code at 390×844 against the approved stories; every web↔mobile pair on real code, viewport and full page. **Not verified here:** native rendering (Hermes text metrics, iOS/Android font rasterizing, safe-area insets on devices, Android back, `adjustsFontSizeToFit`), the mobile containers' wiring in pixels (covered by the RNTL tests of 7.1–7.5), the expo-router tab layout itself (the canvas uses the kit `TabBar` the layout renders), and the real API (unchanged in this change; it was exercised end to end in `web-app` 9.2). Those go to the Expo Go checklist (close-out section) for the user.

**Files:**
- Create: `web/.design-sync/review/parity-real.mjs`
- Modify: `mobile/.design-sync/previews/Screen.tsx`, `mobile/.design-sync/entry.ts`, `mobile/.design-sync/config.json`, `web/.design-sync/NOTES.md` (+ any real component fixed in Step 6, with its test)

**Interfaces:**
- Consumes: the review server on `127.0.0.1:4310` (never stopped), `web/e2e/fake-api.mjs`, the views `HomeView`, `MovementsView`, `LoginView`, `RecipientView`, `TransferFlowView`, `StartupLoading`, `StartupOffline` (7.2–7.5), `playwright`/`pngjs`/`pixelmatch` from `web/.ds-sync`.
- Produces: `.design-sync/.cache/parity-real/{approved,real,diff}/*.png` and `report.json` (`[{ story, A390, A390full, B1280, B1280full, C390, C390full, D390, D390full }]`, each `{ ratio, heights }` or `null`); the "Paridad (pantallas reales)" table in `web/.design-sync/NOTES.md`.

- [ ] **Step 1: Capture the approved baseline before rebuilding anything.** Write `web/.design-sync/review/parity-real.mjs`:
```js
#!/usr/bin/env node
// Paridad sobre las pantallas reales (WEB-25, tarea 8.1 del rediseño).
//   --phase approved  Antes de reconstruir los lienzos: captura las historias aprobadas (web `AppShell` a
//                     390×844 y 1280×800, móvil `Screen` a 390×844), en ventana y en página completa.
//   --phase real      Captura la web real (next dev contra la API simulada) recorriendo cada estado como una
//                     persona, y las vistas reales de la app móvil (las historias de `Screen` ya las usan), y
//                     compara: A web real↔aprobada a 390, B a 1280, C móvil real↔aprobada, D web real↔móvil real.
// `ratio` es una guía (Work Sans variable en la web y TTF estáticos en móvil): se revisa cada -diff.png con la
// regla de veredicto de NOTES.md ("Paridad").
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = createRequire(resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '.ds-sync', 'package.json'));
const { chromium } = tools('playwright');
const { PNG } = tools('pngjs');
const pixelmatch = tools('pixelmatch').default ?? tools('pixelmatch');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const phase = arg('phase', 'real');
const base = arg('base', 'http://127.0.0.1:4310');
const app = arg('app', 'http://127.0.0.1:3101');
const api = arg('api', 'http://127.0.0.1:4999');
const out = resolve(arg('out', '.design-sync/.cache/parity-real'));
const NOW = new Date('2026-10-13T18:00:00Z');
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const PRINCIPAL = '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51';
const SENT = '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a';
for (const dir of ['approved', 'real', 'diff']) mkdirSync(join(out, dir), { recursive: true });

const browser = await chromium.launch();
const headerOf = async (bundle) => JSON.parse(/@ds-bundle: (\{.*?\}) \*\//.exec(await (await fetch(`${base}/${bundle}/_ds_bundle.js`)).text())[1]);
const htmlOf = (header, name) => header.components.find((c) => c.name === name).sourcePath.replace(/\.jsx$/, '.html');
const webCanvas = `${base}/web/${htmlOf(await headerOf('web'), 'AppShell')}`;
const mobileCanvas = `${base}/mobile/${htmlOf(await headerOf('mobile'), 'Screen')}`;

/** Fuentes listas y dos cuadros pintados; luego ventana y página completa. */
async function shoot(page, dir, name) {
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
  const { width } = page.viewportSize();
  await page.screenshot({ path: join(out, dir, `${name}-${width}.png`) });
  await page.screenshot({ path: join(out, dir, `${name}-${width}-full.png`), fullPage: true });
}

async function storiesOf(url) {
  const page = await browser.newPage();
  await page.goto(`${url}?story=__probe__`);
  const list = await page.evaluate(() => window.__dsCells ?? []);
  await page.close();
  return list;
}

async function canvasShot(url, story, dir, name, size) {
  const page = await browser.newPage({ viewport: size });
  await page.goto(`${url}?story=${story}`);
  // Sin el margen de la celda ni el transform de `.ds-single`: lo fijo queda abajo de la ventana.
  await page.addStyleTag({ content: 'body{padding:0 !important}.ds-single{transform:none !important}' });
  await page.waitForFunction(() => document.getElementById('r0')?.childElementCount > 0);
  await shoot(page, dir, name);
  await page.close();
}

const scenario = (value) => fetch(`${api}/__scenario`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value ?? {}) });

async function newPage(size, signedIn) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  if (signedIn) {
    await page.goto(`${app}/login`);
    await page.getByLabel('Correo').fill('ana@example.com');
    await page.getByLabel('Contraseña').fill('Ana-demo-2026!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL((url) => url.pathname === '/');
  }
  return page;
}

const blur = (page) => page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
async function toAmount(page, amount) {
  await page.goto(`${app}/transfers/new`);
  await page.getByRole('button', { name: /^Luis/ }).click();
  await page.getByLabel('Monto').fill(amount);
  await page.getByLabel('Concepto').fill('Renta');
  await page.getByLabel('Referencia').fill('1');
}
async function toReview(page, amount) {
  await toAmount(page, amount);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('heading', { level: 1, name: 'Revisa tu transferencia' }).waitFor();
}
async function send(page) {
  await page.getByRole('button', { name: 'Enviar' }).click();
}
const text = (page, value) => page.getByText(value).first().waitFor({ timeout: 15_000 });

/** Cada historia web: cómo llegar a ese estado en la app real. */
const RECIPES = {
  Login: { public: true, go: (p) => p.goto(`${app}/login`) },
  Register: { public: true, go: (p) => p.goto(`${app}/register`) },
  VerifyEmail: { public: true, go: (p) => p.goto(`${app}/verify-email?email=ana%40example.com&registered=1`) },
  Home: { go: async (p) => { await p.goto(`${app}/`); await text(p, 'Pago de la comida'); } },
  HomeEmpty: { scenario: { accounts: 'empty' }, go: async (p) => { await p.goto(`${app}/`); await text(p, 'Aún no tienes cuentas'); } },
  HomeLoading: { scenario: { accounts: 'hang' }, go: async (p) => { await p.goto(`${app}/`, { waitUntil: 'domcontentloaded' }); await text(p, 'Cargando tus cuentas'); } },
  HomeError: { go: async (p) => { await p.route('**/bff/api/accounts', (route) => route.abort()); await p.goto(`${app}/`); await text(p, 'No pudimos cargar tus cuentas'); } },
  Movements: { go: async (p) => { await p.goto(`${app}/accounts/${PRINCIPAL}/movements`); await text(p, 'Cargar más'); } },
  MovementsEmpty: { go: async (p) => { await RECIPES.Movements.go(p); await p.getByRole('button', { name: 'Filtros' }).click(); await p.getByLabel('Desde').fill('2026-10-01'); await p.getByRole('button', { name: 'Aplicar' }).click(); await text(p, 'No hay movimientos en este periodo'); } },
  MovementsFilters: { go: async (p) => { await RECIPES.Movements.go(p); await p.getByRole('button', { name: 'Filtros' }).click(); await p.getByRole('dialog', { name: 'Filtrar movimientos' }).waitFor(); } },
  TransferRecipient: { go: async (p) => { await p.goto(`${app}/transfers/new`); await text(p, 'Tus cuentas'); } },
  TransferAmount: { go: async (p) => { await toAmount(p, '1250.00'); await blur(p); } },
  TransferReview: { go: async (p) => { await toReview(p, '1250.00'); await blur(p); } },
  TransferUncertain: { go: async (p) => { await toReview(p, '1250.00'); await p.route('**/transfers/new', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue())); await send(p); await text(p, 'No pudimos confirmar el estado de tu transferencia'); await blur(p); } },
  TransferRejected: { go: async (p) => { await toReview(p, '30000.00'); await send(p); await text(p, 'No tienes saldo suficiente para esta transferencia.'); await blur(p); } },
  TransferOtp: { go: async (p) => { await toReview(p, '15000.00'); await send(p); await p.getByLabel('Código de 6 dígitos').fill('482913'); await blur(p); } },
  TransferCompleted: { go: async (p) => { await toReview(p, '1250.00'); await send(p); await text(p, 'Completada'); await blur(p); } },
  TransferFailed: { go: async (p) => { await toReview(p, '15000.00'); await send(p); await p.getByLabel('Código de 6 dígitos').fill('000000'); await p.getByRole('button', { name: 'Confirmar' }).click(); await text(p, 'Fallida'); await blur(p); } },
  Beneficiaries: { go: async (p) => { await p.goto(`${app}/beneficiaries`); await text(p, 'María Gómez'); } },
  BeneficiariesEmpty: { scenario: { beneficiaries: 'empty' }, go: async (p) => { await p.goto(`${app}/beneficiaries`); await text(p, 'Aún no tienes beneficiarios'); } },
  NewBeneficiary: { go: async (p) => { await p.goto(`${app}/beneficiaries/new`); await text(p, 'Nombre del titular'); } },
  TransferDetail: { go: async (p) => { await p.goto(`${app}/transfers/${SENT}`); await text(p, 'Completada'); } },
};

function compare(a, b, diffName) {
  if (!existsSync(a) || !existsSync(b)) return null;
  const A = PNG.sync.read(readFileSync(a));
  const B = PNG.sync.read(readFileSync(b));
  const width = Math.min(A.width, B.width);
  const height = Math.min(A.height, B.height);
  const crop = (img) => { const c = new PNG({ width, height }); PNG.bitblt(img, c, 0, 0, width, height, 0, 0); return c; };
  const diff = new PNG({ width, height });
  const changed = pixelmatch(crop(A).data, crop(B).data, diff.data, width, height, { threshold: 0.15 });
  writeFileSync(join(out, 'diff', diffName), PNG.sync.write(diff));
  return { ratio: Number((changed / (width * height)).toFixed(4)), heights: `${A.height}/${B.height}` };
}

const webStories = await storiesOf(webCanvas);
const mobileStories = await storiesOf(mobileCanvas);

if (phase === 'approved') {
  for (const story of webStories) {
    await canvasShot(webCanvas, story, 'approved', `${story}-web`, PHONE);
    await canvasShot(webCanvas, story, 'approved', `${story}-web`, DESKTOP);
  }
  for (const story of mobileStories) await canvasShot(mobileCanvas, story, 'approved', `${story}-mobile`, PHONE);
} else {
  for (const story of webStories) {
    const recipe = RECIPES[story];
    if (!recipe) { console.warn(`Sin receta para ${story}`); continue; }
    for (const size of [PHONE, DESKTOP]) {
      await scenario(recipe.scenario);
      const page = await newPage(size, !recipe.public);
      await recipe.go(page);
      await page.addStyleTag({ content: 'nextjs-portal{display:none !important}' });
      await shoot(page, 'real', `${story}-web`);
      await page.context().close();
    }
  }
  await scenario({});
  for (const story of mobileStories) await canvasShot(mobileCanvas, story, 'real', `${story}-mobile`, PHONE);
  const file = (dir, name) => join(out, dir, name);
  const report = [...new Set([...webStories, ...mobileStories])].map((story) => ({
    story,
    A390: compare(file('real', `${story}-web-390.png`), file('approved', `${story}-web-390.png`), `${story}-A390.png`),
    A390full: compare(file('real', `${story}-web-390-full.png`), file('approved', `${story}-web-390-full.png`), `${story}-A390full.png`),
    B1280: compare(file('real', `${story}-web-1280.png`), file('approved', `${story}-web-1280.png`), `${story}-B1280.png`),
    B1280full: compare(file('real', `${story}-web-1280-full.png`), file('approved', `${story}-web-1280-full.png`), `${story}-B1280full.png`),
    C390: compare(file('real', `${story}-mobile-390.png`), file('approved', `${story}-mobile-390.png`), `${story}-C390.png`),
    C390full: compare(file('real', `${story}-mobile-390-full.png`), file('approved', `${story}-mobile-390-full.png`), `${story}-C390full.png`),
    D390: compare(file('real', `${story}-web-390.png`), file('real', `${story}-mobile-390.png`), `${story}-D390.png`),
    D390full: compare(file('real', `${story}-web-390-full.png`), file('real', `${story}-mobile-390-full.png`), `${story}-D390full.png`),
  }));
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.table(report.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v && typeof v === 'object' ? v.ratio : v]))));
}
await browser.close();
```
Run it now, before any rebuild (the server on 4310 still serves the approved bundles of `$WT/web/ds-bundle` and `$WT/mobile/ds-bundle`, as rebuilt in P0.4). If `curl -sf -o /dev/null http://127.0.0.1:4310/web/.canvas.html` fails, start the server in the background first (Phase A's command; never stop it): `(cd "$WT" && node web/.design-sync/review/serve.mjs --web web/ds-bundle --mobile mobile/ds-bundle --port 4310)`.
```bash
cd "$WT/web" && ls .ds-sync/node_modules/pixelmatch .ds-sync/node_modules/pngjs >/dev/null \
  && node .design-sync/review/parity-real.mjs --phase approved
```
Expected: `approved/` holds `<Story>-web-390.png`, `-web-390-full.png`, `-web-1280.png`, `-web-1280-full.png` for every web story and `<Story>-mobile-390(-full).png` for every mobile story. If `.ds-sync` is missing a package: `(cd .ds-sync && npm i pixelmatch@7 pngjs@7)`.

- [ ] **Step 2: Point the mobile stories at the real views.**
  - `mobile/.design-sync/entry.ts` — append: `export { HomeView } from '@/features/accounts/home-view'; export { MovementsView } from '@/features/accounts/movements-view'; export { LoginView } from '@/features/auth/login-view'; export { RecipientView } from '@/features/transfer/recipient-view'; export { TransferFlowView } from '@/features/transfer/transfer-flow-view'; export { StartupLoading, StartupOffline } from '@/navigation/startup-views'; export { ProblemError } from '@devchrisvaz/wallet-contract';` (comment: "Vistas reales de las pantallas (8.1): las historias de `Screen` las usan con los datos canónicos").
  - `mobile/.design-sync/config.json` — `componentSrcMap`: `"HomeView": null, "MovementsView": null, "LoginView": null, "RecipientView": null, "TransferFlowView": null, "StartupLoading": null, "StartupOffline": null, "ProblemError": null` (in the bundle, no cards — same mechanism as the RN primitives).
  - `mobile/.design-sync/previews/Screen.tsx` — keep the header comment (rewrite it: the stories now render the real views of `src/features/**` and `src/navigation/startup-views.tsx`), the canonical data block, `completedTransfer` and `failedTransfer` (the latter as the `PENDING_OTP` snapshot: `status: 'PENDING_OTP'`, the view shows it as "Fallida" from the 422), `TABS` and `styles.phone`/`styles.fill`; replace each story body with the real view, same export names:

| Story | Body |
|---|---|
| `StartupLoading` / `StartupOffline` | `<View style={styles.phone}><StartupLoading /></View>` / `<StartupOffline onRetry={noop} />` |
| `Login` | `<LoginView email="" password="" fieldErrors={{}} alert={null} lockRemaining={0} submitting={false} onChangeEmail={noop} onChangePassword={noop} onSubmit={noop} />` |
| `LoginRateLimited` | same with `email={user.email} password="contraseña-segura" alert={{ tone: 'warning', message: RATE_LIMITED }} lockRemaining={42}` |
| `Home` | `<TabFrame current="home"><HomeView user={user} onLogout={noop} overview={{ status: 'success', data: { accounts: [principal, ahorro], dailyLimit } }} selectedId={principal.id} latest={{ status: 'success', data: movements }} now={NOW} onSelect={noop} onRetryOverview={noop} onRetryLatest={noop} onTransfer={noop} onSeeAll={noop} /></TabFrame>` where `TabFrame` = `<View style={styles.phone}><View style={styles.fill}>{children}<TabBar items={TABS} current={current} onSelect={noop} /></View></View>` |
| `HomeEmpty` | `overview={{ status: 'success', data: { accounts: [], dailyLimit: { ...dailyLimit, used: '0.00', remaining: dailyLimit.limit } } }}`, `selectedId={undefined}`, `latest={{ status: 'pending' }}` |
| `HomeLoading` / `HomeError` | `overview={{ status: 'pending' }}` / `overview={{ status: 'error', message: NETWORK_ERROR_MESSAGE }}` (both `latest={{ status: 'pending' }}`; the greeting shows "Ana": the header knows the user — final-review 8.3 item "HomeLoading greeting") |
| `Movements` / `MovementsEmpty` | `<TabFrame current="movements"><MovementsView user={user} onLogout={noop} overview={{ status: 'success', data: { accounts: [principal, ahorro], dailyLimit } }} selectedId={principal.id} movements={{ status: 'success', data: movements }} (or `data: []`) now={NOW} onSelect={noop} onRetryAccounts={noop} onRetryMovements={noop} /></TabFrame>` |
| `TransferRecipient` / `TransferRecipientEmpty` | `<View style={styles.phone}><RecipientView beneficiaries={{ status: 'success', data: { items: [luis, mama] } }} (or `items: []`) onPick={noop} onRetry={noop} onClose={noop} /></View>` |
| `TransferAmount` | `<View style={styles.phone}><TransferFlowView state={{ status: 'editing' }} data={READY} values={{ fromAccountId: principal.id, amount: '1250.00', concept: 'Renta', reference: '1' }} errors={{}} code="" actions={ACTIONS} /></View>` with `const READY = { status: 'success', data: { accounts: [principal, ahorro], beneficiary: luis } } as const;` and `ACTIONS` = every `TransferFlowActions` key set to `noop` |
| `TransferReview` / `TransferRetrying` / `TransferUncertain` | `state={{ status: 'reviewing', ...FROZEN }}` / `{ status: 'waitingRetry', retry: 1, delayMs: 1000, ...FROZEN }` / `{ status: 'uncertain', ...FROZEN }` with `const FROZEN = { key: 'k', payload: '{}', draft: { fromAccountId: principal.id, beneficiaryId: luis.id, amount: '1250.00', concept: 'Renta', reference: '1' } };` |
| `TransferRejected` | `{ status: 'rejected', ...FROZEN, draft: { ...FROZEN.draft, amount: '30000.00' }, error: new ProblemError(422, { code: 'INSUFFICIENT_FUNDS', title: 'Saldo insuficiente', status: 422 }) }` |
| `TransferOtp` | `state={{ status: 'pendingOtp', transfer: { ...failedTransfer, otp: { ...failedTransfer.otp, attemptsRemaining: 3, expiresAt: new Date(Date.now() + 272_000).toISOString() } } }} code="482913"` (4:32 left when captured) |
| `TransferCompleted` | `state={{ status: 'completed', transfer: completedTransfer, replayed: false }}` |
| `TransferFailed` | `state={{ status: 'failed', transfer: failedTransfer, error: new ProblemError(422, { code: 'OTP_ATTEMPTS_EXHAUSTED', title: 'Intentos agotados', status: 422 }) }}` |

  (`RATE_LIMITED`, `NETWORK_ERROR_MESSAGE` stay as the file defines them. Remove the story-only helpers the views replace: `TabScreen`, `FlowScreen`, `SeeAll`, `AccountSwitch`, `RecipientRow`, `SummaryRow`, `AmountBlock`, `ReviewSummary`, `quickActions`, `reviewProps`.)

- [ ] **Step 3: Rebuild both canvases** (the web kit changed in 6.x; the mobile stories changed above):
```bash
cd "$WT/web" && node .design-sync/build-ui.mjs && node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle && node .ds-sync/package-validate.mjs ./ds-bundle && node .design-sync/review/install.mjs
cd "$WT/mobile" && node .design-sync/build-ui.mjs && node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle && node .ds-sync/package-validate.mjs ./ds-bundle && node .design-sync/review/install.mjs
```
Expected: both validations complete; `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4310/mobile/.canvas.html` → 200 (the running server reads the new files). If a real view fails to bundle (react-native-web), the purity guard was bypassed: fix the view's import (never the guard) and rebuild.

- [ ] **Step 4: Start the real web stack** (persistent processes: start them in the background — use the `agent-term` skill or `run_in_background` — and record their PIDs; never touch the processes on 3000, 4000, 4310 or 8081):
```bash
cd "$WT/web" && node e2e/fake-api.mjs --port 4999            # background
cd "$WT/web" && API_BASE_URL=http://127.0.0.1:4999 SESSION_COOKIE_SECURE=false npx next dev --port 3101 --hostname 127.0.0.1   # background
until curl -sf -o /dev/null http://127.0.0.1:3101/login; do sleep 2; done   # use a Monitor/until loop, not a foreground sleep
```
Check Work Sans loaded (next/font downloads it): `curl -s http://127.0.0.1:3101/login | grep -c "__Work_Sans\|font-work-sans"` ≥ 1; if `next dev` logged "Failed to download `Work Sans`", the network is down — record it and continue (the D/A ratios will flag text everywhere).

- [ ] **Step 5: Capture and compare** — `cd "$WT/web" && node .design-sync/review/parity-real.mjs --phase real`. Expected: a table with one row per story; files in `real/` and `diff/`.

- [ ] **Step 6: Classify and fix.** For every row read the `diff/*.png` of each column whose ratio ≥ 0.002 and apply the verdict rule of `web/.design-sync/NOTES.md` ("Paridad": por diseño → idéntico → suavizado; anything else is structural). Agreed "por diseño" cases for this pass, besides the Phase A ones (4th tab, "Filtros" row, own accounts in the recipient step, native select, each app's own copy, "Mostrar CLABE" R29, amount hint R30):
  - A/B `TransferRecipient` (web): the extra "Principal" row under "Tus cuentas" — the real step lists every own account, the story only Ahorro (por diseño, R38);
  - A/B `TransferRejected` (web): the alert title "Saldo insuficiente" and the line "Saldo disponible en Principal: $25,000.00" (WEB-16 requires them);
  - A/B `TransferCompleted` (web, 1280): none expected — the note shows "$30,250.00" because the fake API debits after the send, like the story;
  - A/B (web, 1280) every page: content up to 1200 px instead of 1120 px (final-review 6.1 fix of `max-w-content`; the story canvas was rebuilt with the same kit, so this only shows if Step 1 baseline predates it — then classify "por diseño: 6.1");
  - C `TransferOtp` (mobile): the countdown second ("4:31" vs "4:32");
  - B (web, desktop) side-nav user line: none expected (the fake API's user is "Ana Gómez Castillo");
  - A/B `TransferDetail` (web): the real page puts "Ver mis cuentas" in the inline `StepActions` wrapper of `ReceiptStep` (`grid gap-3 dashboard:flex`) where the story has a single link with `dashboard:justify-self-start` (pre-flight #20);
  - spec text vs. approved stories (R44; the stories win): WEB-26 "Agregar beneficiario" as the Beneficiarios top-bar action, WEB-25 Register without a fixed footer, WEB-29/D9 the desktop filters as the centered BottomSheet panel (not a side panel).
  Differences already present between the approved canvases (Step 1) and `PHASE_B_BASE`'s kit are not structural (the baseline was rebuilt in P0.4 after the fix wave; anything older than that is not a Phase B regression).
  Structural differences are fixed in the real code (web `components/**`, mobile `src/features/**` views or the kit), each with a test where the difference is testable (e.g. a missing element, wrong copy, wrong order), committed with the task that owns that code (`Task: redesign#6.x`/`7.x`), then Steps 3 and 5 rerun. Iterate until no structural difference remains.

- [ ] **Step 7: Record** — in `web/.design-sync/NOTES.md`, after "Paridad", add "## Paridad (pantallas reales)" with: how it was captured (the two bullets "How the real screens are captured" above, in Spanish), the commands of Steps 1–5, the final table `| Historia | A 390 | A 390 completa | B 1280 | C móvil | D pareja | Veredicto | Nota |` (ratios from `report.json`), the "Verificado / no verificado" list, and the R44 cases (the three spec-vs-story deltas above) as "por diseño". Stop the two background processes started in Step 4 (by PID).
- [ ] **Step 8: Gates and commit** — `cd "$WT/web" && npm run format:check && npm run lint` and `cd "$WT/mobile" && npm run format:check && npm run lint && npm test` (the `.design-sync` folders are Prettier/ESLint-ignored, R9, but the gates must stay green); two commits, one per project: `test(web): compare the real screens with the approved stories and their pairs` (`web/.design-sync/review/parity-real.mjs`, `web/.design-sync/NOTES.md`; `Refs: WEB-25`) and `test(mobile): render the real screen views in the canvas stories` (`mobile/.design-sync/previews/Screen.tsx`, `mobile/.design-sync/entry.ts`, `mobile/.design-sync/config.json`; `Refs: MOB-18, MOB-19, MOB-20, MOB-21, MOB-22`), both `Task: redesign#8.1`.

## Task 8.2: Documentation — READMEs, design-tokens rows and the AI log

Close phase, in `$WT`.

**Files:**
- Modify: `web/README.md`, `mobile/README.md`, `design-tokens/README.md`, `docs/ai-log.md`, `openspec/changes/redesign/tasks.md`

- [ ] **Step 1: `web/README.md`** — spec bullet: add `openspec/changes/redesign/` (WEB-24 a WEB-31). "Cómo funciona" → "Interfaz": two shapes (app under 1024 px with tabs and the avatar menu, dashboard from 1024 px with side nav and top bar) through `components/layout/AppFrame.tsx` + `AppShell`, public pages on `BrandShell`, kit internal links through `next/link` (`components/ui/RouterLink.tsx`), the account chosen in Inicio shared with Movimientos, the stepped transfer (Destinatario → Monto → Revisión → Código → Comprobante) with the desktop summary; folders table: `components/layout/` row. "Pruebas": add "Pruebas en navegador" — `npm run test:e2e` (Playwright 1.61.1; starts `e2e/fake-api.mjs` on 4999 with the canonical data and `next dev` on 3101; first run `npx playwright install chromium` if the browser is missing): overflow at 320–1920 px, one visible `h1`, keyboard-only transfer, sheets, axe with real CSS. "Verificaciones manuales" → "Transferencia solo con teclado": state it is automated in `e2e/keyboard.spec.ts` and keep the manual script.
- [ ] **Step 2: `mobile/README.md`** (keep main's biometric-unlock sections from the bonus) — "Cómo está hecha": tabs `src/app/(app)/(tabs)` (Inicio, Movimientos) with the kit TabBar; the transfer as stack screens `src/app/(app)/transfer/*` outside the tabs; containers (`*-screen.tsx`) and pure views (`*-view.tsx`, guarded by `src/__tests__/views-are-pure.test.ts`, rendered by the design-sync canvas); `GET /me` for the greeting. "Verificación manual en Expo Go": update steps 2–6 to the new navigation (Inicio with the hero and "Ver todos", Movimientos tab with the account selector, Transferir tab → recipient → amount → review → code → receipt) and add the redesign checklist (the close-out section below, in Spanish). Keep every string `src/__tests__/readme.test.ts` asserts (`EXPO_PUBLIC_API_URL`, `http://10.0.2.2:4000`, "IP de la red local", `.env.example`, `Mailpit`, `http://localhost:8025`, `install-links=true`, `npm test`, "Qué haría con más tiempo", "biométric", "Verificación manual en Expo Go", plus every string the bonus added to that test — read the file); mention that "Desbloqueo con <huella|rostro>" now lives in the account menu (R46); run `npx jest src/__tests__/readme.test.ts`.
- [ ] **Step 3: `design-tokens/README.md`** (final-review 8.2 item: the "Forma" row) — extend the web table with exactly what `generated/tailwind.css` exposes (`grep -n -- '--color-\|--shadow-\|--container-\|--breakpoint-\|--text-display-xl' generated/tailwind.css`): Superficies `bg-surface-canvas`, `bg-surface-hero`; Texto `text-fg-on-hero-muted`; a new row "Acento sobre oscuro" `bg-accent-on-dark`, `text-accent-on-dark`, `outline-accent-on-dark` (solo sobre `surface-hero`, DSG-14); Tipografía `text-display-xl`; Forma `shadow-raised`, `shadow-sheet`; a new row "Layout" `max-w-app`, `max-w-content`, `w-sidebar`, `h-(--dt-layout-tab-bar-height)` and the variants `app:` (≥ 480 px) and `dashboard:` (≥ 1024 px). Mobile section: `theme.layout`, `theme.iconSize`, `theme.avatarSize`, `theme.elevation.raised|sheet`, `theme.typography.displayXl`, `theme.colors.surface.canvas|hero`, `theme.colors.text.onHeroMuted`, `theme.colors.accent.onDark`. "Datos y textos compartidos": `iconConcepts`/`iconNames`, `movementIcon`, `toneIcon`, `navDestinations`, `dayKey`/`dayLabel`/`groupByDay` (CDMX, UTC−6 fallback), `heroAmountSize`/`splitCents`. "Componentes": add the v2 inventory (TabBar, SideNav y TopBar solo web, AppHeader, BalanceHero, QuickActions, ListSection, MovementList, Avatar, Icon/IconButton, BottomSheet, Stepper, FlowHeader, StepActions solo web, BrandShell/BrandScreen, AppShell solo web). Version line: 1.2.0 (set in P0.2, R42: the redesign's v2 tokens and main's SCHEDULED/CANCELLED states, both additive — DSG-16); describe both additions in the version note.
- [ ] **Step 4: `docs/ai-log.md`** — `main`'s "## Sesión 4 — 2026-10-14 · Bonus: …" is already in the file (merged in P0, R42) and stays as is; append, below it, "## Sesión 5 — 2026-10-14 · Rediseño (`redesign`)" in the file's style (Spanish, first person, short paragraphs and lists): prompts clave (the scope prompt of the redesign and the approval message verbatim: "I approve the design so when you're done with phase a, proceed with phase b and apply the new styles to the projects…"); process (prototype on a branch reviewed on the design-sync canvases, parity canvas, two parallel tracks per phase); AI proposals accepted/modified with their rulings (e.g. R2 a button with block content inside a heading, R17 one `h1` per page, R18→R26 the hero amount mirror, R29 "Mostrar CLABE", R31 overlapping hit areas, R32 Wordmark size, R36 stepper total); AI errors found and fixed (R5 regex that rejected Lucide's `X`, R7 formatting left unchecked, R9 previews breaking Prettier in CI, R14 `absoluteFillObject` missing in RN 0.86, I-1/I-3 of the final review, plus what Phase B's reviews found — read `progress.md`); verification (Vitest/Jest counts, `npm run test:e2e`, the 8.1 parity tables); what stays pending (Claude Design upload, Expo Go checklist).
- [ ] **Step 5: `openspec/changes/redesign/tasks.md`** — mark `[x]` 1.1–5.4 if not already, and 6.1–8.2. Leave 8.3 unchecked until its step "subir a Claude Design" happens (8.3 records it as pending) and 8.4 for its own task. Run `openspec validate redesign --strict` (expected: valid).
- [ ] **Step 6: Commit** — `docs: document the redesign in the READMEs and the AI log`; `Task: redesign#8.2`; `Refs: DSG-13, DSG-16, WEB-24, MOB-18`.

## Task 8.3: Re-sync design-sync of both apps locally (upload pending /design-login)

Close phase, in `$WT`. Folds final-review M-6 and the 8.3 triage items. The Claude Design upload is **not** done tonight: `/design-login` has never been run in this environment; the task records it as pending and does not attempt it.

**Files:**
- Modify: `web/.design-sync/{tailwind.css,conventions.md,NOTES.md,config.json,entry.ts}`, `web/.design-sync/docs/StepActions.md` (create), `web/.design-sync/previews/StepActions.tsx` (create), `web/.design-sync/previews/AppShell.tsx` (use the kit `StepActions`), the pre-redesign web previews `web/.design-sync/previews/{Button,DailyLimitMeter,ErrorState,InlineAlert,LoadingState,MovementRow,OtpField,Receipt,Select,Skeleton,StatusBadge,StepHeading,TextField}.tsx`; `mobile/.design-sync/{conventions.md,NOTES.md,config.json}`, the pre-redesign mobile previews `mobile/.design-sync/previews/{AccountCard,DailyLimitMeter,InlineAlert,MovementRow,OtpField,PrivacyOverlay,Receipt,Select,Skeleton,StatusBadge,TextField,Wordmark}.tsx`; `mobile/src/components/ui/account-card.tsx` (comment only), `design-tokens/src/scale.ts` (comment only)

- [ ] **Step 1: Web drift (M-6)** — `tailwind.css`: add to the safelist every v2 family the screens use (`bg-surface-canvas`, `bg-surface-hero`, `text-fg-on-hero-muted`, `bg-accent-on-dark`, `text-accent-on-dark`, `focus-visible:outline-accent-on-dark`, `text-display-xl`, `shadow-raised`, `shadow-sheet`, `max-w-app`, `max-w-content`, `w-sidebar`, `h-21`, `h-36`, and the `app:`/`dashboard:` variants of the utilities the stories use — grep `previews/*.tsx` and `components/**` for `dashboard:` and `app:` classes and list them); `conventions.md`: replace the PageShell "Montaje"/"Las pantallas de la app" sections with AppShell (props, `mode="flow"`, `primaryAction`), BrandShell, `StepActions`, `RouterLink` (plain `<a>` in the canvas) and the screen map by shared story name (from `plan-phase-a.md` "Shared story names"); update the class table rows and the "inicio con sesión" example to AppShell; `NOTES.md`: screen map section → `previews/AppShell.tsx`, note that `formatMXN`, `toCents`, `centsToDecimalString`, `sumAmounts` are exported by `entry.ts`; `config.json` `dtsPropsFor.AccountCard`: "Anillo de selección (ring-action)" → "Borde de selección de 2 px en el verde de acción"; `entry.ts`: export `StepActions` (+ `type StepActionsProps`), docs stub `docs/StepActions.md` (category of FlowHeader), preview `previews/StepActions.tsx` with `Fixed` and `Inline` stories; in `previews/AppShell.tsx` replace the local `StepActions` function by the kit's (same markup, so the canvases do not change).
- [ ] **Step 2: Mobile drift (M-6)** — `config.json` `dtsPropsFor.Receipt`: add `\n  /** CLABE de la cuenta de origen: el origen lleva su terminación. */\n  fromAccountClabe?: string;`; `conventions.md` and `NOTES.md`: the screen map now renders the real views (8.1), list them and the purity guard; `src/components/ui/account-card.tsx` doc comment "saldo en `display`" → "saldo en `h2`" (comment only, then mobile gates); `design-tokens/src/scale.ts` `avatarSize` comment: `sm` 32 for rows and the side-nav user, `md` 40 for the account-menu avatar (comment only; then `npm run generate && git diff --exit-code generated/` in design-tokens: expected no diff; if the only diff is that comment copied into a generated file, commit the regenerated file in the same commit).
- [ ] **Step 3: Old component previews** (final-review 8.3 item) — each preview listed under Files predates the redesign: render it with the props that exist after Phase B (e.g. `MovementRow` with and without the time-only prop, `DailyLimitMeter` with and without its opt-in header, mobile `Receipt` with `fromAccountClabe`, `StepHeading` only where it is still used — the detail's pending OTP) and in the v2 context (canvas background `bg-surface-canvas` / `theme.colors.surface.canvas`, cards via `ListSection` where the real screens put them). No component code changes in this step.
- [ ] **Step 4: Rebuild, validate, capture and grade both canvases** (commands of 8.1 Step 3, then `node .ds-sync/package-capture.mjs --out ./ds-bundle` in each app); grade every changed cell (`.design-sync/.cache/review/<Name>.grade.json`, rubric of `plan-phase-a.md` Task 5.1 Step 4). Rerun `node .design-sync/review/parity-check.mjs --base http://127.0.0.1:4310` from `web/` and confirm the Phase A pair table still holds (only antialiasing or the agreed cases).
- [ ] **Step 5: Upload stays pending** — add to both `NOTES.md`: "Pendiente: subir a Claude Design. Requiere autenticarse con `/design-login` (no se ha hecho en este entorno); después, `resync` desde cada app según 'Preparar'." Do not run any upload command.
- [ ] **Step 6: Gates and commit** — web and mobile `npm run format:check && npm run lint && npm run typecheck && npm test`; design-tokens `npm run format:check && npm run lint && npm run typecheck && npm test`. Commits, one per project: `chore(web): re-sync the design-sync setup with the applied redesign` (web paths), `chore(mobile): re-sync the design-sync setup with the applied redesign` (mobile paths) and `docs(design-tokens): describe the avatar sizes by use` (`design-tokens/src/scale.ts` and any regenerated file), all `Task: redesign#8.3`, `Refs: DSG-17`.

## Task 8.4: Merge `design/redesign` into `main` locally (never pushed)

Close phase. Rulings R34/R43, R41 and R42: merge `main` into `design/redesign` again (it keeps moving tonight), re-gate, restyle any bonus UI that came in, then merge into `main` with `--no-ff` in the main checkout **only if** every gate passed, the checkout is clean and on `main`, `main` still equals the SHA recorded before the gates, and nothing conflicts; afterwards `npm install` there. Never push; never stop, restart or kill the user's or other sessions' processes, and never touch other sessions' worktrees. Final-review 8.4 item: freeze the full 1.0.0 token set in the DSG-16 additivity test first.

**Files:**
- Create: `design-tokens/test/fixtures/tokens-1.0.0.css`
- Modify: `design-tokens/test/tokens.test.ts`, `openspec/changes/redesign/tasks.md`, the lockfiles the merge of `main` requires, and any bonus screen restyled in Step 3

- [ ] **Step 1: Freeze 1.0.0** — the 1.0.0 baseline is the redesign's branch point `2713c6e` (P0 merged `main` into the branch, so `git merge-base main design/redesign` no longer points there). From `$WT`: `git show 2713c6e:design-tokens/package.json | grep '"version": "1.0.0"'` (expected match) and `mkdir -p design-tokens/test/fixtures && git show 2713c6e:design-tokens/generated/tokens.css > design-tokens/test/fixtures/tokens-1.0.0.css` (73 `--dt-*` declarations). Append to `design-tokens/test/tokens.test.ts` (merge the `node:fs` import with the file's top imports):
```ts
import { readFileSync } from 'node:fs';

function declarations(css: string): Map<string, string> {
  return new Map([...css.matchAll(/(--dt-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name as string, (value as string).trim()]));
}

describe('tokens 1.0.0 congelados', () => {
  it('DSG-16 cada token de la versión 1.0.0 conserva su valor en la salida CSS', () => {
    const before = declarations(readFileSync(new URL('./fixtures/tokens-1.0.0.css', import.meta.url), 'utf8'));
    const now = declarations(readFileSync(new URL('../generated/tokens.css', import.meta.url), 'utf8'));
    expect(before.size).toBe(73);
    for (const [name, value] of before) expect(now.get(name), name).toBe(value);
  });
});
```
Run `cd design-tokens && npx vitest run test/tokens.test.ts` → PASS (if a value differs, that token changed meaning: stop — DSG-16 requires 2.0.0 and a `design.md` entry; escalate, do not edit the fixture). If `format:check` flags the CSS fixture, add `test/fixtures/` to `design-tokens/.prettierignore`. Commit `test(design-tokens): freeze the 1.0.0 tokens before merging the redesign` (`Task: redesign#8.4`, `Refs: DSG-16`).

- [ ] **Step 2: Merge `main` again (R42)** — in `$WT`, record the target and merge:
```bash
cd "$WT" && test -z "$(git status --porcelain)"
MAIN_SHA=$(git rev-parse main)            # write it to progress.md: Step 5 merges only if main still equals it
git merge --no-ff main -m "merge: main (latest bonus work) into design/redesign"
```
  - Nothing new on `main` since P0: the merge says "Already up to date"; continue.
  - Conflicts outside the redesigned files (docs, specs, lockfiles): resolve by keeping both sides (for `docs/ai-log.md`, main's sessions first and the redesign's "Sesión 5" last); lockfiles are regenerated by the installs below, never hand-merged.
  - Conflicts in a redesigned screen (`web/app/**`, `web/components/{accounts,auth,beneficiaries,transfers,layout}/**`, `mobile/src/app/**`, `mobile/src/features/**`, `mobile/src/navigation/**`, either kit): dispatch an **opus integrator** that ports the bonus UI into the redesigned screen with the kit, keeping both the redesign's and the bonus's tests green. If it cannot get both suites green, stop: `git merge --abort` in `$WT` (never in the main checkout), leave `design/redesign` as it was (ready, gates green) and report what conflicted.
  - After the merge: if `main` brought a new tokens version, keep design-tokens at the higher semver with both lines additive (`1.2.0` unless main went past it — then the next minor) and update the README version line; `npm run generate` in design-tokens; `npm install` (not `ci`) in `contract`, `design-tokens`, `web`, `mobile`; commit the lockfiles and version files (`chore: reinstall the shared packages after merging main`, `Task: redesign#8.4`, `Refs: DSG-16`).

- [ ] **Step 3: Restyle any bonus UI that came in (R42)** — compare `git diff "$PHASE_B_BASE" HEAD --stat -- web mobile` with the files the redesign owns. Each bonus screen element that renders in a redesigned screen (e.g. a statement download on web Movements, a scheduled-date field in the web transfer form, a new mobile Home control) is restyled with the kit (`ListSection`, `Button`, `TextField`, `Select`, `InlineAlert`, the step's `StepActions`/`Screen` footer) in the place the redesigned screen has for it, without changing its behavior; its own tests and the redesign's tests stay green; one commit per app (`feat(<app>): restyle <bonus element> with the redesign kit`, `Task: redesign#8.4`, `Refs: WEB-25` or `MOB-19`/`MOB-21` as applies). Web statements (`StatementDownload` in `MovementsScreen`) and the scheduled-transfers web UI are **not** on `main` at plan time; this step covers them only if they landed by now. If a bonus element has no sensible place in the approved layout, keep it where the bonus put it, restyled, and list it in the report.

- [ ] **Step 4: Gates of every project** on the merged branch (from `$WT`; all must exit 0):
```bash
git diff --quiet main design/redesign -- api contract && echo "api y contrato iguales a main"
(cd contract && npm ci && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build)
(cd design-tokens && npm run format:check && npm run lint && npm run typecheck && npm test && npm run generate && git diff --exit-code generated/)
(cd api && npm ci && npm run format:check && npm run lint && npm run typecheck && npm run test:unit)
(cd web && npm ci && npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build)
(cd mobile && npm ci && npm run format:check && npm run lint && npm run typecheck && npm test && npx expo export --platform android --output-dir "$SCRATCH/expo-export")
```
(`$SCRATCH` is the session scratchpad directory, not `/tmp`. `api`'s integration project needs PostgreSQL and `.env`; its unit project runs without services and is the bar here — the redesign does not touch `api`. `npm run build` of the web needs network for `next/font`. `expo export` runs Metro and Hermes without a device and proves the new routes and dependencies bundle.) Then mark 8.4 `[x]` in `openspec/changes/redesign/tasks.md` (8.3 stays open: upload pending), run `openspec validate redesign --strict`, and commit `docs(openspec): close the redesign tasks applied tonight` (`openspec/changes/redesign/tasks.md`; `Task: redesign#8.4`, `Refs: DSG-13, WEB-24, MOB-18`). `git status --short` in `$WT` must then be empty.

- [ ] **Step 5: Merge into `main`** — only if Steps 1–4 passed (if this runs in a new shell, set `MAIN_SHA` again from `progress.md`). One guarded command in the main checkout: it merges only if the checkout is clean, on `main`, and `main` still equals `MAIN_SHA`; otherwise it changes nothing and reports:
```bash
cd "/home/morgan-desktop/Projects/Coding Assignments/Treo" \
  && test -z "$(git status --porcelain)" \
  && test "$(git rev-parse --abbrev-ref HEAD)" = main \
  && test "$(git rev-parse main)" = "$MAIN_SHA" \
  && PRE_MERGE=$(git rev-parse HEAD) \
  && echo "PRE_MERGE=$PRE_MERGE" \
  && git merge --no-ff design/redesign -F - <<'EOF' \
  || { echo "no se integró: checkout sucio, otra rama, main se movió o la integración falló"; git status --short; }
merge: design/redesign (TreoWallet redesign, phases A and B) into main

Task: redesign#8.4
Refs: DSG-13, DSG-14, DSG-15, DSG-16, DSG-17, WEB-24, WEB-25, WEB-26, WEB-27, WEB-28, WEB-29, WEB-30, WEB-31, MOB-18, MOB-19, MOB-20, MOB-21, MOB-22
Co-Authored-By: Claude <Model> 5.5 <noreply@anthropic.com>
EOF
git diff --quiet HEAD design/redesign && echo "main = design/redesign"
```
  Write `PRE_MERGE` to `progress.md`. If the guard fails or `git merge` reports a conflict: stop. Never run `git merge --abort`, `git reset` or `git checkout` in the main checkout without the user (a half-done merge there is reported as is); `design/redesign` stays ready and the report says so. **Never push.**

- [ ] **Step 6: Install in the main checkout (R41)** — only after a successful Step 5, so the user's running Metro (8081) and dev servers resolve the new dependencies. `npm install`, never `npm ci` (it would delete `node_modules` under the running processes); `design-tokens` first (its `prepare` runs `tsup`, so `dist/` exists before the apps copy it through `install-links=true`):
```bash
cd "/home/morgan-desktop/Projects/Coding Assignments/Treo"
(cd design-tokens && npm install)
(cd web && npm install)
(cd mobile && npm install)
git status --short    # lockfiles must be unchanged; if npm rewrote one, do not commit it — list it in the report
```
Never stop, restart or kill any process (Expo on 8081, the API on 4000, the review server on 4310, Grafana on 3000, other sessions' servers or anything else). The final report tells the user: restart Expo with `npx expo start --clear` (from `mobile/` of the main checkout) before opening Expo Go; to undo the merge, `git reset --hard <PRE_MERGE>` with the SHA recorded in Step 5 (R43) — never `2713c6e`, which would delete the bonus commits.

---

## Close-out: pending for the user (no device here)

**Expo Go checklist** (runs on a phone against the local API; add it to `mobile/README.md` in 8.2, Spanish):
1. **Dates and `dayLabel` on Hermes** — Movimientos and Inicio group by "Hoy", "Ayer" and short dates ("9 oct", "28 dic 2025") exactly as in the canvases; check a movement made just after 00:00 CDMX appears under "Hoy" and one from 23:30 the day before under "Ayer". (I-3 made `dates.ts` independent of Hermes' ICU with a UTC−6 fallback and a fixed month table; this confirms it on the engine. The final review left the Hermes run unverifiable here.)
2. **Hero font scaling** — with the system text size at its maximum, the balance on Inicio shrinks to fit on one line and is never cut (`adjustsFontSizeToFit`, M-5); tab labels and the account cards stay readable.
3. **Sheet focus return** — with TalkBack/VoiceOver on, opening "Menú de la cuenta" moves focus into the sheet, and closing it (button or back gesture) returns focus to the avatar.
4. **Android back** — closes an open sheet first; on the amount step goes back to the recipient step; on the recipient step leaves the flow; on a tab does not leave the app session.
5. **Tabs and safe area** — the tab bar sits above the home indicator/gesture bar without a double gap; the transfer flow shows no tab bar; Transferir opens the recipient step.
6. **Stepper announcement** — moving to each step announces "Paso n de m" once (TalkBack live region on the container).

**Also pending:** the Claude Design upload of both design-sync projects (`/design-login`, then resync — Task 8.3 Step 5); restarting Expo with `npx expo start --clear` after the merge and the `npm install` of Task 8.4 Step 6 (the user's processes are never restarted by the plan, R41); undoing the merge, if wanted, with `git reset --hard <PRE_MERGE>` (R43).

---

## Self-review

### Spec coverage

| Requirement | Implemented / pinned in |
|---|---|
| DSG-13 Lenguaje visual elevado | Tokens/kit in Phase A; real screens 6.3 (hero `[overflow-wrap:anywhere]` test), 7.3 (hero font scaling test); docs 8.2; parity 8.1 |
| DSG-14 Lima solo sobre oscuro | Phase A tokens tests; real-browser contrast `e2e/a11y.spec.ts` (6.7); README rows 8.2 |
| DSG-15 Iconografía compartida | Phase A `Icon` + concept map; real tabs/side nav use `navDestinations` icons (6.1, 7.1); same icon per platform checked by 8.1 D-column |
| DSG-16 Tokens v2 aditivos | 8.4 Step 1 freezes all 73 tokens of 1.0.0 (`DSG-16 cada token de la versión 1.0.0 conserva su valor…`); 8.3 Step 2 `generate` without diff |
| DSG-17 Inventario v2 | BottomSheet scroll lock + Escape-in-date (6.4), StepActions/FlowHeader/Stepper (6.5), TabBar pressed/active styles (7.1), Stepper single announcement (6.5 web, 7.5 mobile), design-sync re-sync 8.3 |
| WEB-24 Layout responsivo | `AppFrame`/`appSection` (6.1, tests `WEB-26 WEB-27 %s tiene su destino…`), content width fix (6.1 shells test), `e2e/layout.spec.ts` overflow 320–1920 and shapes (6.7) |
| WEB-25 Paridad | Each screen task mirrors its story; 8.1 compares real web ↔ approved and ↔ real mobile (viewport + full page) |
| WEB-26 Navegación del dashboard | 6.1 `AppFrame.test.tsx` (aria-current, logout from side nav, primary action), `e2e/layout.spec.ts` |
| WEB-27 Navegación en teléfono | 6.1 (`aria-current`, avatar menu logout, no tabs in flow), 6.6 (inline actions), 6.7 (`WEB-27 en el flujo… no hay pestañas`) |
| WEB-28 Inicio rediseñado | 6.3 (sum $35,000.00, selection, latest 5 with `limit: '5'`, "Ver todos" href, quick actions) |
| WEB-29 Movimientos por día | 6.4 (CDMX grouping incl. 05:30Z, filters sheet, account switch), 6.1 (`/movements` → selected account) |
| WEB-30 Flujo por pasos | 6.5 (steps 1–5, 3 de 5 / 3 de 4, own-account transfers both ways incl. Ahorro→Principal from the tab (R38), beneficiary shortcut, summary, double click), 6.7 keyboard e2e |
| WEB-31 Pantallas públicas de marca | 6.2 (`public-pages.test.ts`, form layout tests), 6.7 jsdom axe on BrandShell |
| MOB-18 Pestañas | 7.1 (`tabs.test.tsx`, avatar logout, `Screen tabBar` edges, tab styles) |
| MOB-19 Inicio | 7.3 (greeting, $35,000.00, selection, `limit=5`, "Ver todos" → Movimientos with Ahorro, error title, QuickActions, hero scaling) |
| MOB-20 Movimientos como pestaña | 7.4 (selector, last 20 of Ahorro, 05:30Z "Ayer", 1 January "Ayer", error title) |
| MOB-21 Flujo por pasos | 7.5 (`flow-steps.test.ts`, `steps.test.tsx`: 4 de 5 announced, network loss retry with the same key, amount hero, receipt with CLABE ending, exit) |
| MOB-22 Login de marca | 7.2 (`MOB-22 se ve la superficie de marca…`) |
| Surviving WEB-03/05/11–23, MOB-01–17 | Existing suites kept; each changed assertion is listed with its superseding ID in 6.1–6.6 and 7.1–7.5 |

### Final-review items → task
6.1: next/link for TabBar/SideNav/QuickActions/IconButton/FlowHeader (RouterLink), `/movements`, content max width, screens' own `h1`s. 6.3: AccountCard focus ring, M-2, M-5 web. 6.4: M-4, M-7, Escape in date fields, R16 class assertions (MovementRow date → I-1 prop via MovementList). 6.5/7.5: Receipt separator as text, `fromAccountClabe` and error titles on mobile, Stepper double announcement, StepActions into the kit (web) / Screen footer (mobile). 6.7: visible-`h1` check in a browser. 7.1: `hitSlop`, tab pressed feedback, `Screen tabBar`. 7.3: QuickActions test, M-5 mobile. 7.4: new-year test. 8.1: full-page pass (M-8). 8.2: tokens README rows. 8.3: M-6, HomeLoading greeting, old previews. 8.4: 1.0.0 freeze. Expo Go checklist: close-out. Ruling R36: stated in Global Constraints, 6.5 and 7.5. Rulings R37–R41: Global Constraints; R37 in the 6.5 test updates, R38 in 6.5 (RecipientStep, TransferForm, flow test) and 8.1, R39 in 6.7, R40 in 7.2–7.5, R41 in 8.4 Steps 5–6 and the close-out. Rulings R42–R46: Global Constraints; R42 in P0.2–P0.4, 8.2 Step 4 ("Sesión 5") and 8.4 Steps 2–5; R43 in 8.4 Step 6 and the close-out; R44 in 8.1 Steps 6–7; R45 = the pre-flight fixes below; R46 in 7.1 (UnlockSwitch in the account menu, `_layout.tsx` untouched), 7.2 (`StartupLoading` re-export, `offerAfterLogin`, lock screen), 7.3 (UnlockOffer slot and restyle), 7.4 (`menuExtra`).

### Placeholder scan
No "TBD"/"similar to task N". Two deliberate indirections, both because a parallel fixer owns the code right now: the name of MovementRow's time-only prop and of DailyLimitMeter's opt-in header prop ("read it from the kit"); every task that touches them says which file to read. `<Model>` in the trailer is filled by each implementer (R8).

### Type and name consistency (checked against the kits on `design/redesign` at 1828a02)
Web: `AppShell` props `current/title/primaryAction/user/onLogout/mode/items/children`; `NavItem { key; href }`; `TabBar({ items, current, position?, className? })`; `SideNav({ items, current, user, onLogout?, className? })`; `IconButton({ icon, label, onClick?, href?, tone?, className? })`; `QuickAction { key; label; icon; href?; onClick? }`; `BalanceHero({ total, available, actions? })` with `data-testid="hero-amount"`; `AccountCard({ account, selected?, onSelect?, children? })`; `ListSection({ title?, action?, children, className? })`; `MovementList({ movements, now? })` (+ `headingLevel` in 6.4); `BottomSheet({ open, onClose, title, children })`; `Stepper({ current, total, label })`; `FlowHeader({ title, step, total, stepLabel, closeHref })` (+ `titleId`, `focusTitle` in 6.5); `Receipt({ transfer, fromAccount? })`; `AmountField` `variant="hero"` with `data-testid="hero-amount-mirror"`; `EmptyState({ title, description?, action?, icon? })`; `InlineAlert({ tone, title?, children?, focusOnMount? })` (`role="alert"` only for `danger`); `Avatar({ tone?, size?, initials?, icon? })`, `initials()`; `buttonClasses(variant, className)`. Mobile: `TabBar({ items: NavDestination[], current, onSelect })` (`testID="tab-bar"`, role `tab`); `AppHeader({ user, title?, onLogout? })` (greeting label "Hola, <nombre>"); `BalanceHero` label "Saldo total <monto>"; `QuickAction { key; label; icon; onPress }`; `AccountCard({ name, clabe, balance, selected?, onPress? })`; `EmptyState({ title, description, action?: { label; onPress }, icon? })`; `InlineAlert({ tone, message, title? })`; `Button({ label, onPress, variant?, disabled?, loading?, icon? })` (+ `selected` in 7.4); `FlowHeader({ title, step, total, stepLabel, onClose })`; `Receipt({ transfer, fromAccountName?, fromAccountClabe? })`; `Screen({ children, refresh?, footer?, header?, tabBar? })`; `BottomSheet` (`testID="bottom-sheet"`). Tokens: `navDestinations` labels Inicio/Movimientos/Transferir/Beneficiarios; `groupByDay(items, dateOf, now?)`. Contract: `GET /me` → `User { fullName, email, … }`; movements query `limit`. expo-router 57: `Tabs`/`BottomTabBarProps` from `expo-router/js-tabs`, `router.dismissTo`.
