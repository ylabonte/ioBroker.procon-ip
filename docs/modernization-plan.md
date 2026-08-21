# ioBroker.procon-ip — Modernization Design

- **Date:** 2026-08-22
- **Status:** Approved (roadmap & sequencing); implementation plans per release to follow
- **Author:** Yannic Labonte (with agent-assisted analysis)

This document is the design reference for modernizing the adapter after the 1.7.x
housekeeping (repo-checker fixes, Trusted Publishing, grouped Dependabot). It is
based on a three-lane read-only analysis (capabilities/implementation, ioBroker
Adapter-API usage, test coverage/testability) synthesized into a phased plan.

## 1. Goals

Lasting value, not warning-silencing:

1. **Testability** — turn a 697-line, untested god-object into a thin, injected
   shell plus a dependency-free, mock-free unit-testable logic module, and get a
   real unit suite with a coverage gate.
2. **Correctness & robustness** — fix latent bugs and make startup self-healing
   (the adapter must never stay dead because the controller was offline at boot).
3. **Future-proofing** — self-healing object definitions (`extendObject`), modern
   Adapter-API usage, and a Node baseline policy that separates dev tooling from
   the supported-runtime contract.

## 2. Decisions (agreed)

- **Sequencing:** ship **1.8.0** minimal now → **1.8.1** correctness/hygiene
  quick-wins → **1.9.0** refactor + API modernization. No 2.0.0 (public contract
  is preserved).
- **`@types/node`:** pin to `^22` — the type surface is a compile-time fence and
  must match the *minimum* supported runtime, not the dev machine. Lands in 1.8.1.
- **Refactor scope:** full — this design doc, then implementation plans, then
  execution including the unit suite and CI coverage gate.

## 3. Node baseline policy

Rationale: dev tooling runs on the newest Node, but everything the compiler is
allowed to believe about the runtime (target, lib, `@types/node`) must be pinned
to the oldest Node we promise to support. The 22.x CI lane is the backstop.

| Knob | Value | Why |
|---|---|---|
| `engines.node` | `>=22` (keep) | Support contract = minimum runtime |
| CI test matrix | `[22.x, 24.x, 26.x]` | Every supported LTS **plus** the dev baseline (26) |
| `check-and-lint` / `deploy` node | `26.x` | Run tooling on the dev baseline |
| tsconfig base | `@tsconfig/node22` (keep) | Compile target/lib must match the minimum runtime |
| `@types/node` | `^22` (from `^24`) | Types are the compile-time fence; pin to the minimum |

`engine-strict`/`ls-engines` in CI is an optional add-on to catch dependencies
that quietly raise their own Node floor above 22.

## 4. Target architecture (vision)

A **thin adapter shell** (`main.ts`, target ~150 lines) that only wires ioBroker
lifecycle events to **injected** collaborators:

- The five `procon-ip` services are injected (constructor/factory, default = real
  services) instead of hard-`new`'d in `onReady`, so they can be stubbed in tests.
- A **dependency-free logic module** (`src/mapping.ts` + friends) holds all pure
  decisions: service-config building, relay-id math, object/state `common`
  builders, change-detection, command routing. Unit-tested with zero mocks.
- Object provisioning / state publishing / command handling are split into small
  collaborators, each taking only the adapter surface it needs.
- Object definitions are **self-healing** via `extendObject` from single
  declarative builders, so every release can improve roles/units on existing
  installs instead of freezing them.
- Startup is **resilient**: the adapter comes up, creates what it can, and polls
  until the controller appears; it never dies because the controller was off.

## 5. Roadmap

### 1.8.0 — now (S, low-risk beyond procon-ip 2.x, user-visible)

Ship exactly what is staged and green (PR #232): dependency currency, adoption of
`procon-ip` **2.x**, and the `setStateAsync`→`setState` migration. Nothing else is
added, so any field report isolates to the procon-ip 2.x runtime change. Release
to the latest repo and **soak 1–2 weeks against the real controller** before any
stable promotion.

### 1.8.1 — correctness & hygiene quick-wins (S, low-risk, partly user-visible)

| Item | Resolves | Nature |
|---|---|---|
| Wrap the initial `getStateService.update()` in try/catch; start polling regardless; bootstrap objects on the first successful poll; log "controller unreachable, retrying" | **H2** startup death | behavior-changing → controller-off validation |
| Fix `_forceUpdate` splice guard to `idx > -1` | **L3** latent bug | mechanical |
| Align `admin/jsonConfig.json` defaults with `io-package.json` native (10000 / 10) | config drift | mechanical |
| Remove the vestigial `baseUrl` service-config property (procon-ip 2.x ignores it) | dead code | mechanical (verify against lib) |
| `this.setTimeout`/`this.clearTimeout`; `await` the bootstrap loop; drop the `setTimeout(…,300)` sequencing hack | **M1** + fire-and-forget race | mechanical + small behavior cleanup |
| Fix `test/mocharc.custom.json` spec glob + `.mts` extension so `npm test` runs the real unit test; wire `c8`/`nyc` into `test:ts` | test-infra headline | dev-only |
| Node baseline: `@types/node ^22`, CI matrix `+26.x`, tooling node `26.x` | §3 | dev-only |
| Typo "ProCnn.IP"; gate silly-log string building | **L4** (partial) | mechanical |

"The adapter never needs a manual restart again" release. Small, reviewable.

### 1.9.0 — refactor + API modernization (M–L, medium internal risk)

Done in two internal parts, **A before B** (tests are written against current
behavior first, then behavior changes land guarded).

**Part A — testability refactor (behavior-preserving):**

1. `export class ProconIp`; test via public seams where possible.
2. Extract **`src/mapping.ts`** (pure): `isValidURL`, `buildServiceConfig` (kills
   the prototype-based config object), relay-id offset math (name & document the
   `+8/+0`, `+9/+1` magic), object-`common` builders (collapse the near-duplicate
   timer/dosage blocks), change-detection predicate, command-routing classifier.
   Unit-test mock-free.
3. Inject the five services; pick a **single source of truth** for controller
   state (`_stateData` vs `_getStateService.data`) and document the
   `UsrcfgCgiService` re-`evaluate` invariant.
4. Split the god-object into ~3 collaborators (ObjectProvisioner / StatePublisher
   / CommandHandler); add a state-id helper (kills ~30 hand-built prefixes) and
   one error-log helper (kills the 7× `instanceof Error` block).
5. Handler tests with `@iobroker/testing` `MockAdapter` + `sinon` fake timers;
   keep integration as a boot/shutdown smoke test.
6. CI **coverage gate** (`c8 --check-coverage`) at (achieved − buffer), ratcheting
   upward per PR; exclude the thin bootstrap entrypoint.

**Part B — API modernization (behavior-changing, on top of A's tests):**

| Item | Resolves | Nature |
|---|---|---|
| `extendObject` everywhere; `updateObjectCommonName` → one call; declarative builders as the single definition source → **self-healing definitions** | **H1** | behavior-changing on existing installs — see §7 |
| `setStateChanged` for `setDataState`, `setRelayDataState`, `info.connection` | **M2** | observable only as fewer redundant updates |
| Scope subscriptions to `*.onOff`, `*.auto`, `*.timer`, `*.dosageTimer` | **M3** | safe |
| Ack commands immediately after a successful controller write | **M4** | correctness win |
| Relative state ids via the id helper | **L1** | mechanical after A |
| `role: indicator` for boolean sysinfo flags; explicit `common.type` | **L4** | ships via H1 self-healing |

### Later (post-1.9.0 soak)

- **DMX512 lighting** (`DmxService`/`GetDmxService`) as **1.10.0** — additive new
  capability, cheap once the provisioning/publishing architecture exists.
- Drop Node 22 (`engines >=24`, `@tsconfig/node24`, `@types/node ^24`) around its
  EOL (~April 2027) as a then-minor bump.

## 6. Testing & validation strategy

- **Unit (bulk of value):** pure functions in `mapping.ts` (no mocks) — id math,
  `common` builders, change-detection, routing, `isValidURL`, `buildServiceConfig`.
  Handler tests with `MockAdapter` + stubbed services + `sinon.useFakeTimers()` for
  the poll `setTimeout`. Polling-callback tests (change-detection, forced update +
  splice, connection transitions, error path). Unload (stop, `info.connection`,
  `clearTimeout`, `callback()` always).
- **Integration:** keep `tests.integration()` as a thin boot/shutdown smoke test;
  optionally assert that expected objects (`info.system.*`, `relays.*`) are created.
- **Coverage:** enable `c8`/`nyc` (config already exists), gate in CI, ratchet up.
- **Real-device checklist (before stable promotion of 1.8.0 and 1.8.1):** poll
  loop; relay on/off/auto for **internal and external** relays; dosage timer;
  relay timer; error-tolerance/reconnect; and the H2 scenario (start with the
  controller powered off, then power it on).

## 7. Risks & guardrails

1. **`extendObject` migration on existing installs (H1) — biggest.** `extendObject`
   deep-merges `common`, so emitted fields overwrite user customizations (renamed
   objects, tweaked Alexa `smartName`). Guardrails: extend only adapter-owned
   fields (`type`, `role`, `read`, `write`, `unit`); sync `name` only on real
   controller-label change; treat `smartName` deliberately (own it and document,
   or skip when already set). Stamp `native.objectSchemaVersion` and re-extend once
   per schema version, not every boot. Test against a copied production `objects`
   DB; document normalized fields in the 1.9.0 changelog.
2. **procon-ip 2.x runtime behavior.** CI green proves compilation, not the wire
   protocol → the real-device checklist (§6) + latest-repo soak before stable.
3. **H2 changes startup semantics.** Log clearly so the new quiet self-healing
   isn't misread as a hang.
4. **Coverage-gate friction.** Gate at achieved-minus-buffer and ratchet; don't
   impose a high fixed threshold on a legacy codebase.
5. **Refactor regression (Part A).** Mitigation is the ordering: characterization
   tests against current behavior first, mechanical extraction second, behavior
   changes only in Part B; the integration smoke test stays green throughout.

## 8. Out of scope

- No public-contract break / no 2.0.0.
- No new user features in 1.8.x/1.9.0 (DMX is a later, separate release).
- No dependency major bumps beyond procon-ip 2.x in this initiative (TypeScript 7
  is blocked by `@typescript-eslint` peering `typescript <6.1.0`; revisit when the
  linter supports it).

## Appendix — finding index

- **H1** definitions frozen by `setObjectNotExists` → `extendObject`.
- **H2** startup dies if controller unreachable (no try/catch on initial update).
- **M1** raw `setTimeout` → `this.setTimeout`. **M2** redundant writes →
  `setStateChanged`. **M3** over-subscription. **M4** commands never immediately acked.
- **L1** full-namespace ids. **L2** jsonConfig/io-package default drift.
  **L3** `_forceUpdate` splice bug at index 0/value 0. **L4** roles/types/typo/log.
- **Testability:** broken mocha spec glob (unit test never runs), unexported class,
  no DI, `nyc` configured but never invoked (0% measured), ~100% of logic untested.
