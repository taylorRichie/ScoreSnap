# ScoreSnap · shadcn/ui Integration & Migration Plan

_Reference implementation based on [shadcn/ui Next.js docs](https://ui.shadcn.com/docs/installation/next) and the ScoreSnap UI audit (Phase 0)._

## 1. Purpose & Goals

- Adopt **shadcn/ui** as the single source of truth for all reusable UI primitives.
- Replace every bespoke Tailwind composition (cards, alerts, tables, form controls, headers) with the canonical shadcn counterparts located under `@/components/ui`.
- Enforce neutral, dark-friendly styling via shadcn tokens (`bg-background`, `bg-card`, `text-muted-foreground`, etc.) so that no cards, badges, or actions rely on custom hex colors.
- Improve accessibility, keyboard support, and developer velocity by composing Radix-powered shadcn components instead of ad-hoc DOM trees.

## 2. Scope

**In scope**

- Ensuring `components.json`, `tailwind.config.ts`, and `src/app/globals.css` mirror shadcn defaults.
- Installing all required shadcn primitives (buttons, inputs, card, badge, table, dialog, dropdown-menu, alert, separator, skeleton, sheet, breadcrumb, tabs, toast/sonner, etc.).
- Migrating every UI surface listed in `docs/ui-inventory.md`.
- Documenting the usage rules and enforcing linting to prevent regressions.

**Out of scope**

- Changes to routing, data fetching, Supabase logic, or domain services.
- Visual redesign beyond what is necessary to align to the neutral shadcn token system.

## 3. Core Principles

1. **No custom primitives**: All buttons, inputs, cards, tables, badges, dropdowns, dialogs, and alerts must be imported from `@/components/ui/*`.
2. **Single component library**: Deprecate any Material UI, Chakra, or other third-party primitives. Only Radix + shadcn components are allowed.
3. **Tokens-first styling**: Use Tailwind classes that reference shadcn variables. Remove hard-coded `bg-blue-600`, `text-gray-500`, etc.
4. **Accessibility**: Preserve ARIA attributes, keyboard navigation, and focus management by relying on shadcn wrappers (dialogs, dropdowns, sheets, breadcrumb).
5. **Incremental delivery**: Convert feature areas page-by-page while ensuring the final state contains no legacy UI artifacts.

## 4. Technical Requirements

- `components.json` already targets the **new-york** style with `baseColor: "slate"`. Keep this as the authority for future shadcn CLI calls.
- Tailwind:
  - Keep `darkMode: ['class']`.
  - Ensure tokens under `theme.extend.colors` match the variables declared in `globals.css`.
  - Content globs already include `src/components` and `src/app`; add additional directories if we introduce shared UI stories/tests.
- Global CSS:
  - Preserve neutral oklch palette set in `:root`/`.dark`.
  - Default theme is forced to `class="dark"` at the root so the neutral dark palette is always active.
  - Remove any legacy utility classes (e.g., `.btn`, `.input`) once migration completes.
- Utilities:
  - `@/lib/utils` exports `cn`. Continue to leverage it for variant composition.
  - Introduce helper factories (e.g., `statusBadgeVariants`, `cardGridVariants`) inside shadcn component files when we need custom variants instead of sprinkling extra classes at call sites.

## 5. Phases & Deliverables

### Phase 0 · UI Audit ✅
- Deliverable: `docs/ui-inventory.md` (completed).
- Outcome: Every legacy component/pattern is mapped to a shadcn replacement.

### Phase 1 · Initialization & Configuration ✅
- Verify shadcn CLI setup (already present via `components.json`).
- Ensure the following primitives are installed via CLI (status as of this update):
  - ✅ button, input, card, badge, table, dialog, dropdown-menu, avatar, slider.
  - ✅ alert, separator, skeleton, sheet, breadcrumb (added 2025-11-17).
  - ⏳ tabs, toggle-group, checkbox, radio-group, select/combobox, sonner (to add when needed).
- Acceptance criteria:
  - Running `npm run dev` renders shadcn sample components with neutral styling.
  - `tailwind.config.ts` + `globals.css` contain only shadcn token references.

### Phase 2 · Core Primitives (Buttons, Inputs, Forms)

- Tasks:
  - Replace any remaining `.btn` or `.input` utility usage inside `app/auth/*`, `app/page.tsx`, `Header`, etc., with `<Button>`, `<Input>`, `<Label>`, `<Textarea>`, `<Select>`.
  - Add `checkbox`, `radio-group`, `switch`, and `form` primitives via CLI before encountering those controls.
  - Standardize form layouts (auth, bowler claim flows) to use shadcn spacing (`space-y-4`, `grid gap-4`) and error presentation via `<Alert variant="destructive">`.
- Definition of done:
  - No page contains `className` references to `.btn`, `bg-blue-*`, or `border-gray-*` for buttons/inputs.
  - Forms import exclusively from `@/components/ui`.

### Phase 3 · Complex Components (Cards, Tables, Dialogs, Navigation)

- Cards & Sections:
  - Rebuild dashboard stats, quick actions, upload dropzone, debug panels, and claim cards using `<Card>`+subcomponents. Remove emoji tiles with colored backgrounds; rely on `muted` surfaces and icons from `lucide-react`.
  - Convert info banners on upload/sessions pages to `<Alert>` with neutral styling.
- Tables:
  - Wrap all scoreboard/session tables in the shadcn `Table` primitives.
  - Move column headers, row cells, and empty states into dedicated components for reuse.
- Dialogs & Sheets:
  - `NameResolutionModal` already uses `<Dialog>`; normalize its internals to use tokens instead of custom colors.
  - Update mobile navigation to leverage `<Sheet>` for slide-over menus.
- Navigation:
  - Replace manual breadcrumb markup with `<Breadcrumb>` from shadcn.
  - Use `buttonVariants` (or `NavigationMenu` if added later) for nav links so active states share the same token system.
- Status chips/badges:
  - Replace all custom pill spans with `<Badge variant="secondary" | "outline" | "destructive">`.
- Loading:
  - Introduce `<Skeleton>` placeholders for dashboard stats, tables, and upload lists while async data loads.

### Phase 4 · Remove Legacy Components & Guardrails

- Delete obsolete CSS classes, helper components, and any remaining UI wrappers that predate shadcn.
- Add lint rules (custom ESLint rule or simple banned import rule) forbidding imports from `components/old-ui` or direct `lucide-react` usage without going through `@/components/ui`.
- Optional: add a codemod/CI check that warns when non-shadcn primitives appear outside `components/ui`.

### Phase 5 · QA, Documentation, Sign-off

- Run visual QA across dashboard, upload, sessions, bowlers, debug, and auth flows in both light & dark themes.
- Validate keyboard traps for dialogs/sheets, focus outlines, reduced-motion considerations, and responsive breakpoints.
- Update `docs/ui/shadcn-usage.md` with any newly added components or variants plus concrete “do/don’t” screenshots.
- Capture before/after screenshots for stakeholder review.

## 6. Outstanding Tasks & Owners

| Area | Tasks | Owner | Status |
| --- | --- | --- | --- |
| Header & global nav | Replace custom nav links with `buttonVariants`, add `Sheet` mobile menu, neutralize logo colors | UI | ✅ |
| Dashboard | Rebuild cards w/ `<Card>`, `<Badge>`, `<Skeleton>`, remove emoji color tiles | UI | ✅ |
| Upload page | Wrap dropzone + results in shadcn cards, use `<Alert>` for tips, `<Skeleton>` for progress | UI | ✅ |
| Sessions & bowlers | Replace cards/tables/breadcrumbs/badges with shadcn primitives | UI | ✅ |
| Auth forms | Adopt `<Card>` layout, `<Input>`, `<Label>`, `<Alert>` for errors | UI | ✅ |
| Toasts | Swap `react-hot-toast` for `sonner` component + provider | UI | ⏳ |
| Tooling | Add ESLint rule + optional codemod to block new custom primitives | DX | ⏳ |

## 7. Definition of Done

The migration is complete when:

1. All reusable UI primitives live under `@/components/ui` and originate from the shadcn registry (with CVA variants instead of bespoke CSS).
2. No `className` in the app references Tailwind color utilities (blue/green/orange/etc.) outside of shadcn component definitions; everything is derived from semantic tokens.
3. Navigation, dialogs, tables, and cards rely entirely on shadcn wrappers (`sheet`, `dialog`, `table`, `card`, `breadcrumb`, etc.).
4. ESLint/CI prevents regressions by rejecting direct DOM-based primitive implementations.
5. `docs/ui/shadcn-usage.md` explains how to add, extend, and consume shadcn components; onboarding engineers can follow it to ship new UI without guessing.

---

Questions or updates? Reach out in `#ui-system` and link back to this document so we keep the migration aligned with shadcn best practices.

