# Pipeline stages and drift taxonomy

Reference for the **design-system-governance** skill. Each pipeline stage has a primary job and drift types that must be considered before moving on.

## Stage index

| Stage | Name | Primary output |
|-------|------|----------------|
| 0 | Intake | Trigger path, refs, contributor type |
| 1 | Config load | Valid profile + registry + waivers |
| 2 | Detect components | List of component IDs + check packs |
| 3 | Resolve SoT | Per-component `figma` / `code` / `dual_compare` |
| 4 | Fetch canonicals | Snapshots + version metadata |
| 5 | Run checks | `GovernanceFinding[]` |
| 6 | Waivers + severity | Verdict `pass` / `warn` / `fail` |
| 7 | Flag | GitHub, Slack, Figma |
| 8 | Handoff | Human-readable summary |

---

## Drift types (what “drift” means here)

| Drift type | Definition | Typical check / category |
|------------|------------|---------------------------|
| **Token drift** | Hardcoded or non-canonical values instead of design tokens | `token_consistency` |
| **Design–code drift** | Figma variables/bindings ≠ code token manifest or implementation | `figma_code_mismatch` |
| **Variant drift** | States, sizes, or variants differ between Figma component set and code API | `figma_code_mismatch` |
| **Duplicate drift** | Second implementation overlapping an existing registry component | `duplicate_candidate` |
| **Consumer drift** | Product apps override DS styles or fork components | `consumer_drift` |
| **API drift** | Public props/events change without semver/migration | `api_breaking` |
| **Documentation drift** | Docs, Storybook, or Code Connect ≠ shipped API or Figma | `docs_gap` |
| **Version drift** | Apps or branches on different DS package or library versions | `version_drift` |
| **Platform drift** | Pre-existing Figma/code mismatch not introduced by current contribution | tag in summary, not always a finding |
| **Regression drift** | Contribution makes an existing gap worse | elevate severity or add `block` |

---

## Stage 5 — per-check drift matrix

Use this matrix **for each component** in the run:

### `tokens` pack

| Question | If yes → drift |
|----------|----------------|
| Raw `#`, `rgb()`, or literal px for governed properties? | Token drift → `token_consistency` |
| Token name not in manifest? | Token drift → `token_consistency` |
| Deprecated token from manifest deprecation list? | Token drift → `deprecated_token` (warn) |

### `duplicates` pack

| Question | If yes → drift |
|----------|----------------|
| New file/export name overlaps registry component? | Duplicate drift → `duplicate_candidate` |
| High API + style similarity to existing component? | Duplicate drift (note confidence in `evidence`) |

### `figma_code` pack

| Question | If yes → drift |
|----------|----------------|
| Key in both snapshots with different values? | Design–code drift → `figma_code_mismatch` |
| Variant/state present in Figma only or code only? | Variant drift → `figma_code_mismatch` |
| Missing snapshot file while `dual_compare`? | Canonical gap → `DS-SOT-MISSING` (info) |

### `api_stub` / future packs

| Question | If yes → drift |
|----------|----------------|
| Removed/renamed prop vs base ref? | API drift → `api_breaking` |
| Story prop table ≠ TypeScript exports? | Documentation drift → `docs_gap` |

---

## Introduced vs pre-existing drift

When `dual_compare` is enabled:

1. Load **canonical** snapshots (or `main` code) as baseline platform state.
2. Load **contribution** (PR head or Figma branch delta when available).
3. Classify:
   - **Pre-existing platform drift** — already in canonical snapshots before contribution.
   - **Regression drift** — contribution changes widen mismatch or add raw tokens.
   - **Introduced duplicate drift** — new file in contribution only.

Report all three sections in stage 8 handoff.

---

## Finding record (minimum)

Align with `schemas/finding.schema.json`:

```yaml
id: DS-FIG-Button-radius
component: Button
severity: warn
category: figma_code_mismatch
title: Figma/code mismatch radius
message: Design uses radius.md but code canonical has radius.lg.
canonical:
  source: dual
  expected: radius.lg
  actual: radius.md
figma:
  file_key: "..."
  node_id: "123:456"
  post_comment: true
```

---

## CLI mapping

| Stage | CLI / automation |
|-------|------------------|
| 5–6 | `npm run ds-gov -- run` or `designer` |
| 7 | `--github-output`, `--pr-comment`, `--slack`, `--figma-comments` |
| 4 | `.ds-governance/snapshots/{Component}.figma.json` + `.code.json` |

Implementation: `src/pipeline/run.ts`, `src/checks/*`, `src/reporters/*`.
