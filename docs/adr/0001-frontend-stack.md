# ADR-0001 — Frontend Stack: Next.js 14 + Tailwind + shadcn/ui

| | |
|---|---|
| **Status** | Proposed |
| **Date** | 2026-05-26 |
| **Decision owners** | Engineering + Product |
| **Supersedes** | — |

## Context

We need to build three distinct UIs against the single LAHZA & CLICK backend (`lahtha-click/`):

1. **Admin** — desktop-first, queue-heavy.
2. **Vendor** — desktop and mobile parity.
3. **Customer storefront** — mobile-first, must be SEO-friendly for device listings.

Requirements:
- **Arabic-first with RTL** correctly handled out of the box.
- **TypeScript** end-to-end (matches backend).
- **Server-rendered** for the customer storefront (SEO + first-load performance for product pages).
- **Strong component primitives** (forms, dialogs, tables, dropdowns) — accessible by default, RTL-friendly.
- **Bold Minimalism** design system applied via tokens (see [`../brand/design-tokens.md`](../brand/design-tokens.md)).
- **One frontend repo / workspace** rather than three, to share components and tokens.

## Decision

**Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui**, deployed as a new workspace `lahtha-click-web/` sibling to the backend.

- **Next.js 14 (App Router)** for the framework. React Server Components by default for the storefront; client components where interactivity demands it.
- **TypeScript strict** matching backend conventions.
- **Tailwind CSS** as the styling system; design tokens from `design-tokens.md` mapped into `tailwind.config.ts`.
- **shadcn/ui** for component primitives (built on Radix + Tailwind). Open source, copy-into-repo model — no runtime dependency, full customization.
- **Three route groups** in a single Next.js app:
  - `app/(customer)/...` — storefront (RSC, SEO-optimized)
  - `app/(vendor)/...` — vendor portal (client-rendered after auth)
  - `app/(admin)/...` — admin console (client-rendered after auth)
- **Backend communication** via REST (Express → fetch). Typed contracts as Phase 2 via OpenAPI codegen or tRPC.

## Alternatives considered

| Option | Why not |
|---|---|
| **Three separate frontends** (admin / vendor / customer) | More repos, duplicated tokens and components, harder to keep brand consistent |
| **SvelteKit** | Smaller ecosystem for KSA RTL component libs; team momentum behind React |
| **Remix** | Solid choice, but smaller component ecosystem than Next.js; loses the RSC distinction |
| **Pure server-rendered EJS in existing Express** | Doesn't scale to vendor and admin interactivity; can't share patterns |
| **Vue / Nuxt** | Excellent options, but team and contractor familiarity is React |
| **Mobile-native (React Native / Flutter)** | Out of scope for Phase 1; web first, native after PMF |
| **Material UI / Chakra UI** for primitives | Heavier runtime; harder to lean into bold minimalism without overriding everything |

## Consequences

### Positive
- One repo, one tooling pipeline, one design system.
- Storefront ranks naturally on search engines (SSR + RSC).
- Tailwind + tokens lets the design system live in code, not in a Figma file that drifts.
- shadcn/ui's "copy in, own it" model means no upstream surprises.

### Negative
- Two Node ecosystems in one repo (backend + frontend). Manageable with workspace tooling.
- Next.js opinions (App Router, RSC) require ongoing team learning.
- Three-route-group structure means more disciplined codeowner rules (one team shouldn't accidentally edit another's surface).

### Neutral
- We commit to Vercel-style deployment patterns. Self-hosting Next.js 14 is straightforward; this isn't lock-in.

## Implementation plan

1. **Workstream 1b** — scaffold `lahtha-click-web/`: Next.js 14, Tailwind, shadcn/ui base, tokens applied, brand assets (logos) imported.
2. **Workstream 2** — admin auth + first queue (vendor KYC).
3. **Workstream 3** — vendor signup + KYC submission.
4. **Workstream 4** — customer storefront skeleton + device detail.
5. **Workstream 5+** — checkout, payment integration (per ADR-0002), order tracking, etc.

## Open questions

- Hosting target — Vercel vs. self-hosted on the same KSA infrastructure as the backend (for data residency). Decided in a follow-up ADR.
- Typed API contracts — OpenAPI codegen vs. tRPC. Decided when backend HTTP surface stabilizes.
- I18n library — `next-intl` is the leading candidate; confirmed when Arabic content lands.
