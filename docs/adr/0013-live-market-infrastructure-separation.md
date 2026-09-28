# ADR-0013 — LIVE MARKET: separate control plane and media plane, isolated from LAHTHA & CLICK

| | |
|---|---|
| **Status** | Proposed |
| **Date** | 2026-09-28 |
| **Decision owners** | Owner (pending) |
| **Relates to** | [ADR-0001](./0001-frontend-stack.md) · [DEPLOYMENT.md](../../DEPLOYMENT.md) · [docs/live-market/](../live-market/) |
| **Supersedes** | Nothing |

> Cost figures are not restated here. The authoritative parameter register is
> [docs/live-market/financial-model.md](../live-market/financial-model.md) §1, and this ADR references it.

## Context

The LIVE MARKET workstream ([docs/live-market/](../live-market/)) specifies a global 24/7 marketplace built entirely on
live streaming. The question arose as a direct product question — *do we need new servers for this?* — and the honest
answer is more specific than yes: **LIVE MARKET does not need a new server, it needs a class of infrastructure this
repository does not currently contain.**

The existing deployment (`DEPLOYMENT.md`) is a request/response stack: Next.js on Vercel, a Node API on Railway or
Render, MongoDB Atlas. It is well chosen for what it serves — LAHTHA's inventory, checkout, invoicing and CLICK's
auctions — and it is structurally unable to carry live media.

| Existing component | Limit for LIVE MARKET |
|---|---|
| **Vercel** (serverless) | No long-lived high-volume connections, no UDP, execution-duration limits — cannot terminate WebRTC or carry a broadcast-scale WebSocket |
| **Railway / Render** (PaaS) | HTTP and WebSocket are fine, but WebRTC needs a dynamic UDP port range plus TURN relay, which most PaaS do not expose; and there is no CPU/GPU headroom for an ABR transcode ladder, nor egress control |
| **MongoDB Atlas** | Correct for transactional data; wrong for real-time counters (concurrent viewers, presence, momentum, retention) — those need Redis |

The streaming decision ([streaming-architecture](../live-market/streaming-architecture-webrtc-vs-llhls.md)) settled the
shape: WHIP/WebRTC ingest → SFU → ABR transcode → LL-HLS → CDN, with no WebRTC viewer tier at MVP. That shape implies
components with entirely different operational characteristics from anything currently deployed.

Two further facts bear on isolation. LIVE MARKET carries **user-generated live content**, which brings moderation and
online-safety duties ([moderation-operating-model](../live-market/moderation-operating-model.md)) that have no
counterpart in an Apple-device marketplace. And its dominant cost line is **egress**, which the
[financial model](../live-market/financial-model.md) shows drives the entire price floor — a number that becomes
uncomputable if egress is billed into a shared account.

## Decision

### 1. Two planes, explicitly separated

| Plane | Responsibility | Hosting shape |
|---|---|---|
| **Control plane** | Accounts, legal status, KYC records, packages, entitlement metering, Policy Engine, ranking, statistics, admin | The same *pattern* as today: container-hosted API + managed transactional database. Reusing the pattern is fine; reusing the deployment is not |
| **Media plane** | WHIP ingest, SFU, ABR transcode, LL-HLS packaging, CDN delivery, TURN | New, and **managed** at MVP |
| **Real-time state** | Presence, concurrent viewers, ranking counters, rate limits, chat fan-out | **Managed Redis — a component this repository does not have today** |
| **Chat / WebSocket service** | Live chat, moderation controls, in-session events | A separate **stateful** container. This is the closest thing to "a new server" in the ordinary sense |
| **Moderation workers** | Keyframe sampling, ASR, classification, kill-switch | Queue plus workers, models consumed as managed services |

### 2. Managed media at MVP, with named triggers to revisit

Buy the media plane. Do not build it. The reasoning is in the streaming document §8, and the trigger to re-evaluate
an assembled stack is stated there in terms of monthly bill and monthly egress — both referenced, not restated.

Lock-in defences required of any vendor: **WHIP-standard ingest**, **standard LL-HLS output** with no proprietary
player requirement, and **raw QoE and egress metrics exported to our own telemetry**.

### 3. Full isolation from LAHTHA & CLICK

Separate repository, separate database, separate cloud project or account. Nothing shared at MVP.

| Reason | Detail |
|---|---|
| **Risk profile** | Live UGC brings moderation, age-gating and illegal-content duties with no counterpart in the existing domains |
| **Load shape** | Spiky real-time versus transactional. A broadcast peak must not be able to degrade a checkout |
| **Egress attribution** | If egress is billed into a shared account, the price floor in the financial model becomes uncomputable — and the package prices derived from it become unfalsifiable |
| **Audit scope** | ZATCA e-invoicing and the existing tax surface should not be dragged into the audit scope of a global live-streaming platform, nor the reverse |
| **Blast radius** | Neither system failing should take the other down |

**Not shared at MVP, explicitly:** identity/IAM, database, object storage, PSP account, cloud project, deployment
pipeline. **Candidates for later sharing:** brand tokens and design system (`docs/brand/`), and nothing else until
there is a reason.

### 4. No video storage anywhere in the design

Principle 7 forbids stored video. The architectural consequence is that **no VOD bucket, no origin recording and no
replay packaging exists at all** — not disabled, absent. The moderation evidence buffer (CR-01, pending) is the single
exception and is ephemeral, encrypted and purge-audited.

This is also a genuine cost advantage over conventional live commerce, and it should be defended as a design property
rather than quietly eroded by a future "just keep the last one" request.

## Consequences

**Positive**

- The price floor stays computable, because egress is attributable to the product that generates it.
- Moderation, age-gating and safety tooling live in one codebase with one audit trail.
- A media-vendor change is a media-plane change; nothing in the control plane moves.
- The existing LAHTHA & CLICK roadmap is unaffected — no migration, no shared-schema negotiation.
- Storage cost and VOD complexity are absent rather than managed.

**Negative, and accepted**

- Two deployments, two on-call rotas, two sets of secrets. Real operational overhead for a small team.
- A seller who exists in both products has two accounts. Accepted at MVP; revisit only if that overlap turns out to be material, which is unlikely given different geographies and categories.
- Redis and a stateful chat service are new operational competencies for this repository.
- Managed media costs more per unit than an assembled stack would at scale. That is the deliberate trade, with the trigger to revisit already written down.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Extend the existing deployment** | Technically impossible for the media plane (Vercel/Railway limits above), and it would make egress unattributable |
| **Share IAM between the products** | Couples the two risk profiles at the most sensitive point, and forces a single KYC model onto two very different regulatory situations |
| **Self-host SFU, transcode and CDN from day one** | Loses on total cost once engineering time, global PoPs and 24/7 on-call are counted, and puts a media-infrastructure project on the critical path of a product that has not yet proven demand |
| **One cloud account, separate projects** | Better than nothing, but egress and support quotas still commingle. Separate accounts cost nothing extra and settle the question |
| **Serverless media via a single vendor SDK with a proprietary player** | Fastest to demo, worst lock-in, and it forfeits the WHIP/LL-HLS portability this ADR requires |

## Implementation notes

1. Log **bytes egressed and transcode-seconds per session from day one** — one field each. The cost dashboard is Phase 2, but it needs history to be worth building.
2. The **impression-provenance field** ([boost-mechanics](../live-market/boost-mechanics.md) §3.2) belongs in the control plane's view records from the first commit; it cannot be retrofitted without invalidating historical ranking.
3. Chat runs on the stateful service, **never on serverless** — and note that chat latency is independent of video latency, which is why the MVP needs no sub-second video tier at all.
4. The moderation keyframe and the discovery grid's poster frame are **the same extraction** ([discovery-ux-spec](../live-market/discovery-ux-spec.md) §3.2). Build it once.
5. A transactional database is recommended for the control plane given entitlement metering and billing; whether that is PostgreSQL or MongoDB is a separate decision this ADR does not force.

## Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | Media vendor selection | Blocked on the beachhead decision (PoP proximity) and the streaming PoC |
| 2 | PostgreSQL or MongoDB for the control plane | Schema work |
| 3 | Single cloud provider or multi-provider | Procurement |
| 4 | Who carries the media-plane on-call | Staffing |

## Status of the evidence

Every cost and capacity statement referenced here is a planning assumption pending vendor quotes and the streaming
PoC. Regulatory statements about UGC duties and audit scope are assumptions requiring per-country legal validation.
Neither this ADR nor the documents it references constitute legal or financial advice.
