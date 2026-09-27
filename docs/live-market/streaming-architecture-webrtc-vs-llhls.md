# LIVE MARKET — Streaming Architecture: WebRTC vs. LL-HLS

| | |
|---|---|
| **Document type** | Architecture comparison and recommendation |
| **Baseline** | LIVE MARKET approved baseline, 27 September 2026 |
| **Date** | 2026-09-27 |
| **Prepared by** | Senior Product Consultant & Solution Architect |
| **Status** | Recommendation — pending a 2-week measured PoC (§10) and the beachhead decision |
| **Closes** | MVP streaming architecture shape · latency targets · low-connectivity ladder · session-end transport semantics |
| **Does not close** | Vendor selection (depends on beachhead PoPs and on PoC numbers) · part-duration tuning · enterprise ingest protocols |
| **Amends** | [MVP Scope Decision Matrix](./mvp-scope-decision-matrix.md) §13 — see §12 below |

> **Tag legend** — **[Approved]** baseline · **[Open]** baseline-declared open question · **[Deferred]** outside the
> baseline's design surface · **[My Recommendation]** consultant judgement, rejectable without touching the baseline.
>
> **Standing caveat.** All vendor pricing in this document is a planning assumption from public list prices, which
> vary by an order of magnitude between on-demand and committed-volume contracts and change without notice. Every
> figure requires validation against real quotes before it is used to price a package.

---

## 1. The question, framed correctly

"WebRTC or LL-HLS" is the wrong question, because they are not competitors across the whole path. The path has three
legs and each has a different winner:

| Leg | What it carries | Genuine candidates |
|---|---|---|
| **First mile — ingest** | Seller's phone → platform | WebRTC/WHIP · RTMP · SRT |
| **Fanout — distribution** | Platform → N viewers | **WebRTC (SFU) vs. LL-HLS** ← the real decision |
| **Last mile — playback** | Edge → viewer's device | Determined by the fanout choice |
| **Interaction** | Chat, Contact Requests | **WebSocket — independent of both** |

The fourth row is the most commonly missed, and it changes the answer. **Chat does not ride the video path.** Text
chat over a WebSocket is sub-second regardless of whether video is 400 ms or 4 s behind. This matters enormously
below, so it is stated up front.

---

## 2. What latency LIVE MARKET actually requires

Latency targets should be derived from the interactions the baseline actually permits, not from a general preference
for "low latency". The baseline permits: **text chat** (E1), **Contact Requests during the live session** (E2,
Principle 9), and no gifts, no tipping, no likes. Audience voice/video guesting is Phase 3 (E3/B6).

The conversational loop that must not break is therefore:

```
viewer sees product (video latency L)
  → viewer types a question           (WebSocket, ~100 ms)
  → seller reads and answers verbally (human, 2–6 s)
  → viewer hears answer               (video latency L again)
```

Total loop ≈ **2L + human time**. With L = 3 s the loop is ~8–12 s, which reads as a normal live Q&A. With L = 20 s
(classic HLS) the loop is ~25–30 s and the seller is answering a question about a product they have already put down
— that genuinely breaks "the broadcast IS the ad".

| Tier | Target (glass-to-glass) | Who needs it | Verdict |
|---|---|---|---|
| Sub-second | < 500 ms | Two-way audio/video conversation | **Not required at MVP** — no audience guesting until Phase 3 |
| **Broadcast** | **2–4 s typical, ≤ 6 s p95** | Every MVP viewer | **This is the MVP target** |
| Degraded | ≤ 10 s | Audio-only / severely congested networks | Acceptable fallback |
| Unacceptable | > 12 s | — | Breaks the live-commerce premise |

**Finding 1.** Because MVP interaction is text-only, **sub-second video buys nothing at MVP.** This single
observation removes an entire architectural tier from the MVP.

---

## 3. Protocol comparison

| Dimension | WebRTC (SFU fanout) | LL-HLS | Classic HLS/DASH |
|---|---|---|---|
| Glass-to-glass latency | **150–450 ms** | 1–4 s | 8–30 s |
| Transport | UDP (SRTP), TCP fallback | HTTP/2–3 over TCP | HTTP |
| Scale ceiling per stream | Hundreds–low thousands per SFU; scales by cascading SFUs | **Effectively unlimited** (CDN) | Unlimited |
| CDN cacheability | **None** — every viewer is a unique peer session | **Yes** — segments and parts cache; high hit ratio | Yes |
| Egress priced at | Cloud/SFU origin rates | **CDN rates (typically 2–4× cheaper)** | CDN rates |
| Cost shape | **Linear per participant-minute** | Low fixed per stream + cheap per viewer | Same as LL-HLS |
| ABR | Simulcast/SVC, client-selected — **no server transcode needed** | Server-side ladder — **transcode cost per rung** | Server-side ladder |
| Behaviour on packet loss | Freezes, drops frames, may disconnect | **Degrades by raising buffer / dropping rung** | Very resilient |
| Behaviour on bad networks | Poor — brittle under jitter | **Good** — this is its core strength | Excellent |
| Firewall/NAT traversal | Needs STUN + **TURN relay for ~8–20% of sessions** | Plain HTTPS — traverses everything | Plain HTTPS |
| Mobile battery / CPU | Higher | Lower | Lowest |
| Player maturity on web | Good, but bespoke | Mature (hls.js, native on iOS/Safari) | Very mature |
| Recording/DVR | Awkward | Easy | Easy — **irrelevant here**, Principle 7 forbids storage |
| Ops complexity | High (UDP ports, TURN, SFU scaling, cascading) | Moderate (transcode + packaging + CDN config) | Low |

Two rows deserve emphasis for this project specifically:

- **Egress pricing.** WebRTC fanout cannot use a CDN, so its bytes leave at cloud or SFU-origin rates. This is
  structurally more expensive per GB than committed CDN egress, and it is the reason the cost curves cross so early
  (§4).
- **Bad-network behaviour.** LIVE MARKET is a global market that explicitly plans for 360p and audio-only support
  ([Open], now closed in §6). WebRTC's failure mode on a congested mobile network is a freeze or a disconnect;
  LL-HLS's is a slightly larger buffer. For a buyer watching a seller demonstrate a product, a 1-second buffer
  increase is invisible and a freeze is fatal.

---

## 4. Cost crossover — the deciding analysis

This is the part that actually decides the architecture, and it is arithmetic rather than preference.

**Cost per stream-hour as a function of concurrent viewers V:**

```
LL-HLS :  C_h(V) = F_h + (v_h × V)      F_h = transcode ladder + packaging + origin
WebRTC :  C_w(V) = F_w + (v_w × V)      F_w ≈ publisher participant cost only (no transcode: simulcast)
```

**Assumed inputs** (all require quote validation):

| Term | Assumption | Derivation |
|---|---|---|
| `F_h` — LL-HLS fixed per stream-hour | **$0.12 – $0.38** | 3 transcode rungs @ $0.03–0.10/rung-hour + $0.03–0.08 packaging/origin |
| `v_h` — LL-HLS per viewer-hour | **$0.010 – $0.040** | 0.5 GB/viewer-hour × $0.02–0.08/GB CDN |
| `F_w` — WebRTC fixed per stream-hour | **≈ $0.03** | Publisher counted as one participant |
| `v_w` — WebRTC per viewer-hour | **$0.018 – $0.120** | $0.30–0.60 per 1,000 participant-minutes at the low end; several managed platforms price materially higher, some add egress on top |

**Crossover** — the viewer count above which LL-HLS is cheaper:

```
V* = (F_h − F_w) / (v_w − v_h)
```

**Sensitivity table** (using `v_h` = $0.015, i.e. CDN at $0.03/GB):

| `v_w` (WebRTC $/viewer-hr) | `F_h` = $0.12 | `F_h` = $0.20 | `F_h` = $0.38 |
|---|---|---|---|
| **$0.018** (best case for WebRTC) | V* ≈ **30** | V* ≈ **57** | V* ≈ **117** |
| **$0.027** | V* ≈ **8** | V* ≈ **14** | V* ≈ **29** |
| **$0.060** | V* ≈ **2** | V* ≈ **4** | V* ≈ **8** |
| **$0.120** | V* ≈ **1** | V* ≈ **2** | V* ≈ **3** |

**Finding 2.** Across the entire plausible parameter space, the crossover sits between **~2 and ~120 concurrent
viewers per broadcast** — and in most of it, below 30. Compare with the liquidity target in the scope matrix §5:
**≥ 20 viewers per concurrent broadcast.** The median LIVE MARKET broadcast is therefore *at or above* the crossover
from the first week of a successful launch.

**Finding 3.** WebRTC fanout is cheapest exactly where the business is failing (a handful of viewers per stream) and
most expensive exactly where it is succeeding. That is the wrong direction for a cost curve to point. LL-HLS's shape
— a small fixed cost per broadcast, then cheap CDN bytes — is aligned with growth.

There is also a second-order effect that favours LL-HLS further and is easy to miss: as concurrency per stream rises,
**CDN cache-hit ratio rises**, so the effective `v_h` *falls* with scale. WebRTC's `v_w` never falls; every viewer is
a fresh unicast session.

---

## 5. Recommended architecture for MVP

**WebRTC (WHIP) ingest → SFU → ABR transcode → LL-HLS packaging → CDN → every viewer.**
No WebRTC viewer tier at MVP. [My Recommendation]

```
Seller phone ──WHIP/WebRTC──► SFU ──► Transcode (360/480/720) ──► LL-HLS packager
                                │                                      │
                                │                                      ▼
                          Ingest health                          CDN (PoPs) ──► all viewers
                                │                                      
                                ▼                              ┌────────────────────────┐
                    Moderation workers                         │ Chat + Contact Request │
                  (keyframe sampling, ASR)                     │ WebSocket, sub-second  │
                                                               └────────────────────────┘
```

| Component | Choice | Why |
|---|---|---|
| Ingest | **WebRTC via WHIP** | Best mobile capture path; adaptive uplink; WHIP is a standard, so the ingest endpoint is replaceable without an app rewrite — this is the main lock-in defence |
| SFU | Managed at MVP | Ingest termination, simulcast reception, health signals; §11 sets the trigger to reconsider |
| Transcode | 3 rungs (§6) | LL-HLS needs a server-side ladder; this is `F_h` and it is the price of CDN economics |
| Fanout | **LL-HLS, standard output** | §4; and graceful degradation on bad networks (§3) |
| CDN | Commercial, committed volume once volume exists | Egress is 80–90% of the bill (scope matrix §6) |
| Chat / Contact Request | **Separate WebSocket service** | Decoupled from video latency; also the stateful component that cannot live on serverless |
| Storage | **None** | Principle 7 [Approved] — no VOD bucket exists; transcode-and-discard |

**What this deletes from the MVP** — and this is the point:

1. No WebRTC viewer tier → no SFU fanout scaling, no cascading, no TURN capacity planning for viewers (TURN remains only for ingest).
2. No runtime protocol switch → **an entire class of failure mode disappears** (mid-session promotion causing a rebuffer, split-brain metrics, two players to maintain, two QoE pipelines to measure).
3. One player path on every platform instead of two.

**When the WebRTC viewer tier comes back:** Phase 3, together with audience voice/video guesting (E3/B6). That is the
first feature that genuinely requires sub-second, and it should pay for the tier's complexity itself. [My Recommendation]

---

## 6. Latency budget and the low-connectivity ladder

### 6.1 Glass-to-glass budget (LL-HLS path)

| Stage | Best | Typical high | Notes |
|---|---|---|---|
| Capture + encode (phone) | 30 ms | 120 ms | Hardware encoder; keyframe interval matters |
| Uplink (WHIP) | 20 ms | 150 ms | Mobile network dependent |
| SFU handling | 10 ms | 30 ms | |
| ABR transcode | 150 ms | 400 ms | The largest fixed cost in the budget |
| LL-HLS part production | 200 ms | 500 ms | **= part duration; the primary tuning knob** |
| CDN propagation | 50 ms | 200 ms | Blocking playlist reload |
| Player buffer | 400 ms | 1,500 ms | 2–3 parts; **the second tuning knob** |
| Decode + render | 30 ms | 80 ms | |
| **Total** | **≈ 0.9 s** | **≈ 3.0 s** | Meets the 2–4 s target with headroom |

**What breaks the target:** a 1-second part duration with a 3-part player buffer adds ~2.5 s and pushes p95 past
6 s. Part duration and buffer depth are therefore **product-level settings, not defaults to inherit from a vendor**.
[My Recommendation]: start at 300 ms parts, 2-part buffer, and tune against measured rebuffer ratio — the trade is
latency against rebuffering, and on poor networks rebuffering is the worse loss.

For reference, the deferred WebRTC path measures ~150–450 ms end to end. The gap between 0.4 s and 3 s is real; §2
establishes that at MVP nothing in the product can use it.

### 6.2 ABR ladder

| Rung | Resolution | Total bitrate | GB / viewer-hour | Target condition |
|---|---|---|---|---|
| 360p | 640×360 | ~0.85 Mbps | **0.38** | 3G, congested cells, data-conscious viewers |
| **480p (default)** | 854×480 | ~1.25 Mbps | **0.56** | Default rung — scope matrix I6 |
| 720p | 1280×720 | ~2.6 Mbps | **1.17** | Good Wi-Fi, **viewer opt-in only** |
| Audio-only | — | 48–64 kbps | **~0.03** | < 200 kbps sustained — Phase 2 (B4) |

Switching policy [My Recommendation]:

| Condition | Action |
|---|---|
| Join | Start at 360p, ramp to 480p within ~5 s once throughput is proven |
| Sustained < 400 kbps | Lock to 360p |
| Sustained < 200 kbps for > 10 s | Audio-only (Phase 2); until then, 360p with a deeper buffer and an explicit "weak connection" indicator |
| Viewer requests HD | 720p, remembered per device, never the default |

**Audio-only is also a cost lever, not only an accessibility one:** at ~0.03 GB/viewer-hour it is roughly **1/19th**
of 480p. In a market where a seller is *describing* a product, audio-only is a genuinely usable degraded experience —
which is not true of most live video products.

---

## 7. Ingest resilience, and defining "no grace period" in transport terms

Principle 1 is unambiguous as product behaviour: **leaving the stream ends the ad immediately, with no grace period**
[Approved]. But a 4G-to-Wi-Fi handover produces a 3–8 second ingest gap, and a seller walking behind a concrete wall
produces a 10-second one. Implemented naively, "no grace period" means normal mobile networking terminates paid
sessions at random, consumes the seller's entitlement, and generates a support queue the platform cannot win.

The resolution is to notice that **two different things are being ended**, and the baseline only speaks to one:

| Ends | Timing | Basis |
|---|---|---|
| **The advertisement** — visibility in the market grid, discoverability, ability to create a Contact Request | **Immediately** — target < 2 s from ingest loss, viewers see "the broadcast has ended" | Principle 1 [Approved], preserved exactly |
| **The session record** — session id, statistics continuity, entitlement consumption | After `T_reconnect` of continuous ingest absence | Transport reality [My Recommendation] |

Recommended semantics:

| Interval | Grid / discovery | Contact Requests | Session |
|---|---|---|---|
| `t < 2 s` | Being removed | Disabled | Alive |
| `2 s ≤ t ≤ T_reconnect` | **Removed — not visible, not discoverable, not ranked** | Disabled | Slot held; ingest return resumes the same session |
| `t > T_reconnect` | Removed | Disabled | **Terminated.** Going live again is a new session under package rules |

[My Recommendation] `T_reconnect` = **15 s**. Also: **bill broadcast minutes on ingest-present time only**, never
wall-clock, so a reconnect window is never charged to the seller.

This is not a grace period for the advertisement — during the whole window the broadcast is invisible and
undiscoverable, so no viewer ever sees an ad whose seller is absent. It is a grace period for the *transport session*,
which the baseline does not address. **Clarification requested in §13.1** — if the owner reads Principle 1 as
requiring `T_reconnect = 0`, that is implementable, and the consequence to accept is documented there.

Additional ingest measures [My Recommendation]: uplink test in the Go-Live pre-flight (matrix B1) · adaptive uplink
bitrate before frame dropping · explicit on-screen seller warning at sustained low uplink · ingest-success-rate SLO
(§9).

**Enterprise ingest** — RTMP and/or SRT from hardware encoders and OBS: **Phase 2**, bundled with broadcaster seats
(A5/A6). Individual sellers on phones need WHIP; Company and International accounts with production setups will ask
for RTMP, and it is cheap to add once the SFU is in place. [Open]→sequenced.

---

## 8. Build vs. buy, and the trigger to revisit

| Option | Unit cost | Ops burden | Time to MVP | Verdict |
|---|---|---|---|---|
| **Full-stack managed live** (ingest + transcode + LL-HLS + CDN, one vendor) | Highest | Lowest | Weeks | **MVP choice** [My Recommendation] |
| **WebRTC-first platform** + its HLS egress | Medium–high | Low | Weeks | Viable; strongest option if the Phase-3 interactive tier is considered near-term |
| **Assembled** (own SFU + own transcode + commercial CDN contract) | Lowest at scale | Highest | Months | Phase 3+, on the trigger below |

**Trigger to re-evaluate** [My Recommendation] — begin the assembled-stack evaluation when **either**:

- the managed media bill exceeds **$15k–25k / month**, or
- monthly egress exceeds **150–300 TB**.

Below that, self-hosting loses on total cost once engineering time, global PoPs, and 24/7 on-call are counted. Above
it, the margin recovered is material and compounding.

**Lock-in defences to require of any vendor, from day one:** WHIP-standard ingest · standard LL-HLS output (no
proprietary player required) · raw QoE and egress metrics exported to our own telemetry (matrix I3) · no dependency
on a vendor-specific recording or catalogue feature (we have none — Principle 7 helps here).

---

## 9. SLOs to measure from day one

| Metric | Target | Why it is on this list |
|---|---|---|
| Glass-to-glass latency | p75 ≤ 4 s · p95 ≤ 6 s | The §2 premise |
| Join-to-first-frame | p75 ≤ 2 s | Discovery in a live-only market is browse-heavy; slow joins destroy grid browsing |
| Rebuffer ratio | p75 < 1% of watch time | Directly drives Retention/Watch Time, which is a ranking signal (Principle 6) |
| Playback failure rate | < 2% of attempts | |
| Ingest success rate | > 98% of Go-Live attempts | |
| Ingest interruption rate | Track per market | Calibrates `T_reconnect` empirically |
| TURN relay ratio (ingest) | Measure; expect 8–20% | A hidden cost line, and a network-policy signal |
| **Cost per viewer-hour** | Within 25% of the model | Matrix §6/§15 gate; needs the I3 telemetry fields from day one |

---

## 10. The two-week PoC that should precede the vendor commitment

Do not sign a volume commitment on the strength of §4's assumptions. Measure them. [My Recommendation]

| Day | Activity |
|---|---|
| 1–3 | Stand up WHIP ingest → LL-HLS on one managed vendor; 300 ms parts, 2-part buffer |
| 4–6 | 3 real broadcasts from real phones on deliberately poor networks (3G, congested Wi-Fi, moving vehicle), in the candidate beachhead region |
| 7–8 | Load-simulate 50 / 200 / 1,000 concurrent viewers; record cost and QoE at each level |
| 9–10 | Repeat the same three broadcasts on a WebRTC-fanout vendor for a like-for-like comparison |
| 11–12 | Reconcile actual invoices against §4; recompute `V*` with real numbers |
| 13–14 | Decision memo: vendor, part duration, buffer depth, ladder, `T_reconnect` |

**Pass criteria:** §9 targets met on the poor-network runs (not only on office Wi-Fi) · measured `V*` consistent with
§4 · cost per viewer-hour within 25% of the matrix §6.2 model · TURN ratio quantified.

**If the PoC contradicts §4** — specifically, if a vendor prices WebRTC fanout at or below $0.018/viewer-hour *with
egress included* while transcode is expensive, `V*` moves toward 100+ and a WebRTC-first MVP becomes arguable. That is
the one result that would reverse this recommendation, which is precisely why it is measured rather than assumed.

---

## 11. Cost consequences for package design

Handing these forward to the packaging deliverable:

1. **Cost per broadcast-hour is `F_h + v_h × V`** — a tier's cost is driven by *concurrency*, not by broadcast hours alone. Hours and concurrency ceiling must both be tier variables (already flagged in matrix §6.3).
2. **Default 480p at 0.56 GB/viewer-hour** is the number to price against — not 720p. Pricing against HD and defaulting to HD is how the margin disappears.
3. **Audio-only at ~0.03 GB/viewer-hour** makes low-bandwidth markets nearly free to serve. Relevant to beachhead selection, and it is a reason not to fear emerging-market demand.
4. `F_h` is per *broadcast*, not per viewer — so **many tiny broadcasts are disproportionately expensive**. A package that permits unlimited very short sessions is a cost leak; minimum session duration or session-count limits close it.
5. Price floor stays `≥ 3 × DeliveryCost` (matrix §6.3), now computable per tier once the PoC returns real `F_h` and `v_h`.

---

## 12. Amendment to the MVP Scope Decision Matrix §13

§13 of the matrix carried a directional assumption written before this analysis. It also sat in mild tension with the
matrix's own capability row B3. This deliverable resolves it in favour of B3, which was already correct.

| §13 row | As written | Amended |
|---|---|---|
| Shape | Hybrid: WebRTC for ingest **and for an interactive low-latency tier**; LL-HLS for scale-out | **WebRTC/WHIP ingest only; LL-HLS fanout for every viewer at MVP.** Interactive WebRTC viewer tier → Phase 3 with E3/B6 |
| Switch point | Promote to LL-HLS above "a few hundred" viewers | **No runtime switch at MVP.** The economic crossover is ~2–120 viewers (§4) — below the liquidity target — so LL-HLS is the default path, not the escalation path |
| Latency target | Sub-second interactive; 2–5 s LL-HLS | **2–4 s typical, ≤ 6 s p95**, budget in §6.1. Sub-second is out of scope until Phase 3 |
| ABR ladder | 360/480/720, default 480p | Unchanged [confirmed] |
| Non-goal | No recording, no VOD, no storage | Unchanged [Approved] |

**Net effect on scope: a reduction.** One protocol path, one player, no viewer-side TURN capacity, no mid-session
promotion logic. Matrix B3 stands as written and its build cost score (BC=3) is, if anything, now slightly
pessimistic.

---

## 13. Clarifications and open items

### 13.1 Clarification requested — "no grace period" in transport terms

**No principle change sought.** Confirm that Principle 1's no-grace-period rule governs **advertisement visibility**
(immediate removal from the market, immediate disabling of Contact Requests) and not the **ingest transport session**,
allowing a `T_reconnect` window of ~15 s during which the broadcast is invisible and undiscoverable but the session
record survives a network blip.

**If the owner requires `T_reconnect` = 0**, it is implementable. The consequences to accept: normal mobile-network
events terminate paid sessions; entitlement is consumed by the terminated session unless billing is ingest-time-based
anyway; sellers in exactly the emerging markets the baseline wants to serve are hit hardest, because network
interruption rates are highest there; and support volume rises in a way that is not attributable to any bug.

### 13.2 Still open

| # | Item | Blocked on | Owner |
|---|---|---|---|
| 1 | Vendor selection | Beachhead decision (PoP proximity) + PoC numbers | Owner + architecture |
| 2 | Part duration and buffer depth | PoC rebuffer measurements | Architecture |
| 3 | `T_reconnect` final value | §13.1 clarification + measured interruption rates | Owner |
| 4 | RTMP / SRT enterprise ingest | Phase 2, with broadcaster seats (A5/A6) | Product |
| 5 | Live captions / accessibility | Regulatory register R12 in the matrix — unscoped at MVP | Counsel + product |
| 6 | Moderation sampling rate vs. cost | Matrix G2; keyframe sampling frequency is a cost/precision trade | Trust & Safety |

### 13.3 Assumptions requiring validation

| # | Assumption | Validate with |
|---|---|---|
| A1 | All unit prices in §4 | Vendor quotes at projected volume |
| A2 | 0.5 GB/viewer-hour blended ladder average | PoC telemetry |
| A3 | 8–20% TURN relay ratio on ingest | PoC in the beachhead market |
| A4 | CDN cache-hit economics improve with concurrency | CDN vendor, contractually |
| A5 | 2–4 s is commercially sufficient for live selling | Observed Contact Request conversion in the pilot |
| A6 | Managed-to-assembled crossover at $15–25k/month | Rebuild with real quotes before acting on it |

---

## 14. Decision summary

| Question | Answer | Confidence |
|---|---|---|
| WebRTC or LL-HLS for fanout at MVP? | **LL-HLS, for all viewers** | High — §4 holds across the whole plausible parameter space |
| WebRTC anywhere at MVP? | **Yes — ingest only (WHIP)** | High |
| Sub-second viewer tier? | **No. Phase 3, with audience guesting** | High — nothing at MVP can use it (§2) |
| Latency target | **2–4 s typical, ≤ 6 s p95** | High |
| Low connectivity | **360p rung at MVP; audio-only Phase 2** | High |
| Managed or self-hosted? | **Managed, with named triggers to revisit (§8)** | Medium — depends on quotes |
| Which vendor? | **Undecided — PoC first (§10)** | — |
