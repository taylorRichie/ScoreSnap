# UI Component Inventory · ScoreSnap

_Last updated: Phase 0 audit for the shadcn/ui migration._

## Overview

ScoreSnap currently mixes shadcn primitives (button, card, dialog, etc.) with bespoke Tailwind utility compositions. This document enumerates every reusable or page-level UI surface that still relies on custom styling so that we can replace them with canonical shadcn implementations during Phases 2–4 of the migration.

## Custom / Legacy Components

| Component / Pattern | File(s) | Type | Approx. Usages | Notes | Target shadcn equivalent |
| --- | --- | --- | --- | --- | --- |
| `Header` | `src/components/Header.tsx` | Navigation (desktop + mobile) | Global layout | ✅ Migrated to shadcn `buttonVariants`, `DropdownMenu`, `Sheet` (Nov 17) | `sheet`, `button`, `dropdown-menu`, `breadcrumb` |
| `ClientLayout` header gate | `src/components/ClientLayout.tsx` | Layout wrapper | Global | Injects `react-hot-toast` + conditional header; does not enforce shadcn container spacing | Compose with shadcn `Toaster`/`sonner` later |
| `NameResolutionModal` | `src/components/NameResolutionModal.tsx` | Dialog workflow | Upload flow | Uses `Card` + `Button` but still applies custom `bg-blue-50`, `border-green-200` utility colors | Re-style with shadcn tokens only (`muted`, `primary`) |
| Session cards | `src/app/dashboard/page.tsx`, `src/app/sessions/page.tsx`, `src/app/sessions/[id]/page.tsx` | Cards / lists | 20+ | ✅ Rebuilt with `Card`, `Badge`, `Skeleton`, `Breadcrumb` | `card`, `badge`, `table`, `alert`, `skeleton` |
| Upload dropzone + alerts | `src/app/upload/page.tsx` | File input zone | 1 | ✅ Dropzone + tips now use shadcn `Card` + `Alert` | `card`, `alert`, `button`, `skeleton` |
| Debug tools cards | `src/app/debug/upload/page.tsx` | Cards / tabs | 4 | Custom monospace panels, colored badges | `card`, `tabs`, `badge`, `code` blocks |
| Auth forms | `src/app/auth/login/page.tsx`, `src/app/auth/signup/page.tsx` | Forms | 2 | ✅ Wrapped in `Card`, `Input`, `Button` with neutral tokens | `form`, `input`, `label`, `alert`, `button` |
| Tables | `src/app/sessions/[id]/page.tsx`, `src/app/bowlers/[id]/page.tsx` | Data tables | 3 | Native `<table>` with `divide-gray-200` utilities | `table` primitives + `badge` for status |
| Breadcrumbs | `src/app/sessions/page.tsx`, `src/app/bowlers/[id]/page.tsx`, etc. | Navigation aid | 4+ | Hand-built ordered lists w/ SVG chevrons | `breadcrumb` |
| Status badges | Spread across dashboard/sessions/bowlers | Badge | 10+ | Manual `span` with `px-2.5 py-0.5 rounded-full` + color classes (`bg-green-100`) | `badge` variants or `badge` + `variant="secondary"` |
| Loading states | Most async sections | Feedback | Global | `animate-spin` border divs, no skeletons | `skeleton`, icon + `animate-spin`, `spinner` helper |
| Toasts | Every page via `react-hot-toast` | Notifications | Global | Non-shadcn library | Consider replacing with `sonner` CLI component later |

## External UI Libraries in Use

- `react-hot-toast` – temporary notifications (to be swapped with `sonner` shadcn registry item in Phase 3).
- `react-dropzone` – upload interactions (keep logic, wrap UI in shadcn cards/buttons).
- `lucide-react` – icons (already recommended by shadcn).

## Page-Level Surfaces Still Using Custom Styling

- `app/debug/upload/page.tsx`: still relies on bespoke panels/badges for the admin tooling.
- `app/page.tsx` (marketing landing): Tailwind-only hero layout needs shadcn cards/buttons.
- Any future feature pages must continue auditing for stray `bg-gray-*`/`text-*` utilities.

Each of the above must be rewritten to compose only `@/components/ui/*` primitives plus neutral Tailwind tokens (`bg-background`, `text-muted-foreground`, `border-border`, etc.).

## Migration Notes

1. **Tailwind tokens**: Replace every `text-gray-*`, `bg-blue-*`, `bg-green-*`, `border-*-200` class with the semantic counterparts exposed by shadcn (`text-muted-foreground`, `bg-card`, `border-border`, `bg-muted`, etc.).
2. **Cards**: Rebuild every “card” as `<Card>` + `<CardHeader>`/`<CardContent>` combinations. No standalone `div` with `rounded-lg shadow`.
3. **Badges**: Swap hand-rolled pill spans with `<Badge variant="secondary" | "outline">`.
4. **Alerts**: Use the newly added `<Alert>` component for success/error/info banners (upload tips, session errors, etc.).
5. **Navigation**: Adopt `<Breadcrumb>` + `<Sheet>`/`<DropdownMenu>` for nav. Remove manual SVG chevrons.
6. **Tables**: Use `@/components/ui/table` wrappers everywhere a table appears; keep business logic separate.
7. **Loading**: Prefer `<Skeleton>` for placeholders and `Loader2` icon for inline spinners instead of custom `animate-spin` divs.

## Acceptance Tracking

- ✅ Inventory captured for every custom UI artifact and mapped to a shadcn replacement.
- ✅ Additional primitives required for migration (`alert`, `separator`, `skeleton`, `sheet`, `breadcrumb`) installed via shadcn CLI.
- ⏳ Migration work remains for each page listed above (tracked per Phase 2/3 tasks).

---

Generated for Phase 0 deliverable of the ScoreSnap shadcn/ui migration.
