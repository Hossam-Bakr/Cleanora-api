---
name: work-on-next-phase
description: >-
  Drive the next Cleanora phase from Spec Kit through Cursor implementation,
  bounded Codex CLI PM/review via /codex-delegate (sol xhigh speed 1.5),
  realistic coverage, and READY_FOR_OWNER_REVIEW. Use when the user sends
  /work-on-next-phase, asks to work on the next phase, or wants one command
  that prepares, implements, tests, and documents a phase without marking it
  complete or publishing Git changes.
disable-model-invocation: true
---

# Work On Next Phase

Set the objective to: “Implement and verify every approved acceptance criterion for the active phase, produce accurate API and test artifacts, resolve required review findings, and reach READY_FOR_OWNER_REVIEW without marking the phase complete or publishing Git changes.”

If Cursor exposes a real goal or persistent task capability, use it for this objective. Otherwise maintain it in the progress file and native task list. Do not invent a `/goal` command, start an unrequested background automation, or claim a prompt can bypass host limits.

On start, call native `CreateGoal` with that exact objective. Keep it active until READY_FOR_OWNER_REVIEW is recorded. Then call `UpdateGoal` with `complete`. If those tools are unavailable, keep the same objective in the progress file and native task list.

Read [Codex consultation protocol](references/codex-consultation.md) and the installed `/codex-delegate` skill before the first Codex dispatch.

## 1. Load context and resolve the phase

Read `AGENTS.md`, `docs/ai/context-router.md`, `docs/product/current.md`, and only the active or next roadmap section. Load three to six files. Summarize in at most five bullets. Do not preload future phases or invent missing product rules.

Resolve the target:

| Current pointer | This command does |
|---|---|
| One active phase, not owner-complete | Continue that phase. Do not activate another. |
| Active phase already at READY_FOR_OWNER_REVIEW | Keep that boundary. Report the handoff. Do not start the next phase. |
| Previous phase owner-complete and no next phase active | This command authorizes the next **dependency-ready** roadmap phase. Activate only that phase, then run this workflow. |
| Blocked dependency or missing canonical docs | Stop. Report the gap. Do not invent behavior or borrow another project. |

Create or update `specs/<phase-dir>/work-on-next-phase-progress.md` immediately. Persist Codex totals, decisions, gate results, and the next unblocked task across invocations. Running this command again resumes evidence-backed progress.

Locked Cleanora constraints remain in force: one deployable modular monolith, standalone product, no stored-value user wallets, Docker/cloud deferred until Release 3, one active phase, no commit/push from this workflow.

Do not invoke `notion-next-phase` or update external project trackers.

## 2. Consult Codex only for PM and review

Cursor writes every product file: code, tests, Prisma, OpenAPI/Swagger, Postman, and phase artifacts. Codex is a bounded consultant for MVB decisions and required review. Never ask Codex to implement tasks.

Dispatch Codex **only** through the installed `/codex-delegate` skill (Codex CLI relay). Do not invent a parallel Codex path and do not start with raw `codex exec` while that skill is available. Read its `SKILL.md` before the first dispatch, then use its `scripts/relay.mjs` with `--read-only`. That skill's commit step is **not** authorized here; this workflow never commits or pushes.

Required Codex mode: **sol xhigh speed 1.5**. Map that lock to the CLI as `gpt-5.6-sol`, reasoning `xhigh`, and Fast **1.5x** via `service_tier=priority`. Verify against the local CLI/account and `~/.codex/config.toml`. Never silently switch model, effort, or speed tier.

- Aim for **two consultations**: preparation/decision acceptance and final review. Reuse an existing accepted preparation decision instead of spending a call to repeat it.
- Default ceiling: **four calls and 20 minutes of cumulative delegated wall time per phase**, with a **five-minute watchdog per call**. Count retries and resumed calls. Persist the totals across invocations. Required existing batch gates can need more calls; do not silently skip them or exceed the budget.
- Send narrow context, exact questions, changed files, and concise evidence. Do not send the whole repository or ask Codex to implement tasks. Allow at most one Codex process at a time.
- Run tests and diagnose ordinary failures in Cursor. Reserve additional calls for a concrete unresolved decision, mandatory batch acceptance, or re-review of findings.
- These are dispatch limits, not a guarantee about account quota. The five-hour usage window is not five hours of available execution. If real usage telemetry is available, inspect it at dispatch boundaries; otherwise record usage as unknown. Never fabricate a remaining percentage or buy/redeem quota.
- On quota exhaustion, unavailable model/authentication, or budget exhaustion, stop new Codex calls. Continue tasks covered by accepted decisions. Ask the owner any blocking decision in the Arabic format below. A required Codex review that has not happened remains pending; ask for restored access/budget or an explicit owner review substitution. Never label it passed.

## 3. Complete or reconcile the Spec Kit pipeline

Use installed `.cursor/skills/speckit-*` and `.agents/skills/speckit-*` skills and `.specify/` workflows; read each entry only when needed. Follow `docs/ai/spec-kit-integration.md`, `docs/ai/workflows/prepare-phase.md`, and `docs/ai/workflows/implement-phase.md`. Do not reinitialize Spec Kit or regenerate accepted work just to run every step again. Do not use `speckit-companion-auto` or any path that auto-completes the phase.

Execute missing steps in this order:

1. **Specify:** prioritized stories, measurable acceptance criteria, in/out scope, dependencies, public contracts, and phase DoD from canonical product documents.
2. **Clarify:** collect unresolved behavior. Codex resolves options within delegated authority; record the decision source accurately. Ask the owner only when authority or Codex availability requires it. Formal clarification asks one question at a time, at most five per session; specify retains at most three unresolved clarification markers. Resolve implementation-blocking questions before dependent code.
3. **Plan:** simplest sufficient module changes, persistence/migration ownership, API/internal contracts, test strategy, and exact discovered quality commands. Create supporting artifacts only where required by the phase or installed workflow.
4. **Checklist:** acceptance, security, data, and API completeness checks proportionate to this phase.
5. **Tasks:** small dependency-ordered units including behavior, tests, migration proofs if needed, API artifacts, and final evidence. Each task must map to an acceptance criterion or an explicit required gate.
6. **Analyze:** check spec/plan/tasks consistency. Repair gaps and contradictions before implementation; return to clarify only for actual unresolved behavior.
7. **Preparation acceptance:** send one compact PM consultation where acceptance is still needed. Ask for complete in-scope implementation authorization and clearly named exceptions. Honor any active phase's mandatory batch acceptance sequence.
8. **Implement:** Cursor executes accepted tasks and fixes, using the loop below.

Run installed applicable Spec Kit/Companion hooks and use their canonical context writer. Inspect hooks before execution: defer any hook that would auto-complete the phase, commit, push, activate another phase, or exceed this command's authority. Prefer stock implementation plus progress hooks when a Companion auto wrapper forces terminal completion. Preserve task journaling/materialization; do not hand-edit Companion JSON or bypass its checkbox writer. Record implementation as implemented when appropriate, never phase-completed before owner approval.

Companion `implemented` after all tasks are checked is allowed. Do not run `speckit-companion-mark-complete` or write Cleanora phase Complete until the owner later sends `mark complete`.

## 4. Apply MVB scope discipline

- Prefer existing module patterns, libraries, public contracts, and straightforward services. Add an abstraction only for demonstrated reuse or a current invariant. Avoid speculative extension points, generic engines, extra infrastructure, future-release features, or unrelated refactors.
- Deliver the accepted behavior completely. Do not use MVB as a reason to remove validation, authorization, transactional safety, or acceptance tests.
- Keep the backend one deployable modular monolith. Each module owns persistence and exposes explicit public contracts. Cleanora is standalone; never borrow another project's schemas or services. No stored-value user wallets. Docker and cloud remain deferred until Release 3.
- When data changes, incrementally update Prisma, create the named phase-owned migration, review SQL, and prove clean installation and populated upgrade where required. Never edit an applied migration. Use only a verified authorized disposable test target for destructive proof setup; do independent work while a missing target is resolved. Follow `.codex/skills/prisma-phase-migration/SKILL.md`.
- Cursor owns OpenAPI/Swagger and Postman for every new or changed **approved HTTP endpoint**, including schemas, examples, authentication, errors, and applicable Postman assertions. Use repository generators/validators and avoid secrets in collections. If the phase adds no HTTP, document/test its internal contracts and validate affected existing API artifacts; do not invent endpoints to satisfy an artifact checklist.

## 5. Implement, verify, repair, repeat

This is the required loop. Do not stop after a plan, one batch, a summary, or a failed test you can diagnose. Do not start the Cursor `/loop` timer skill or a background sleeper.

Repeat until the phase meets its actual DoD:

1. Select the next unblocked task or accepted batch in dependency order.
2. Inspect existing implementation; write the smallest complete change and meaningful behavior tests.
3. Run focused checks for that change. On failure, inspect the evidence, fix the cause, and rerun affected checks. Do not retry an identical command indefinitely without a new diagnosis or changed condition.
4. Update applicable API documentation, Postman artifacts, and requirement-to-test traceability.
5. Mark a task done only after its acceptance evidence exists, using the canonical task writer. Record findings and next work immediately.
6. Obtain mandatory batch acceptance if the active phase requires it, then continue directly to the next authorized batch. Do not ask permission for ordinary in-scope task transitions.
7. After implementation, run all required phase and repository gates, review the phase diff, request the bounded Codex review, repair findings in Cursor, and obtain any required re-review. A material code change invalidates the affected earlier evidence.

Keep working through fixable failures and all independent work during a decision wait. If three materially different attempts leave the same blocker with no actionable path, checkpoint and explain the exact missing input, permission, or environment change; do not fake completion or spin forever. Host interruption or unavailable tools require an honest resume checkpoint.

## 6. Enforce realistic coverage and completion gates

Use the accepted active-phase thresholds and configured repository gates. Cleanora's current default is:

| Metric | Minimum |
| --- | ---: |
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

For a new phase with no separately approved target, propose these defaults in its test strategy before implementation. Retain stricter accepted thresholds. Apply phase coverage to all relevant executable phase-owned files, including unimported files and changed integration adapters; retain the established global coverage gate. Never lower a threshold, hide uncovered logic, disable tests, add meaningless assertions, or narrow inclusion solely to manufacture a pass. Do not demand 100% coverage by default. Cover high-risk authorization, money, idempotency, concurrency, and data integrity behavior with meaningful scenarios regardless of the aggregate percentage.

Discover actual commands from `package.json`, configs, and active DoD; do not invent script names. Typical discovered commands include `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:coverage`, `npm run docs:check`, `npm run openapi:validate`, and `npm run postman:validate`. Use a phase-scoped coverage script when the phase defines one.

Required evidence includes:

- Acceptance criteria mapped to implemented behavior and tests; no unfinished required task.
- Applicable unit/integration/regression suites and phase/global coverage, reporting all four measured metrics and exact scope.
- Lint, typecheck, build, architecture/module boundaries, and documentation checks required by the repository.
- Prisma validation, reviewed SQL, and live migration proofs for database-changing phases.
- OpenAPI/Swagger and Postman validation for affected contracts, including runtime checks required by the phase.
- Full relevant diff review, including new untracked phase files, and required review findings resolved. No unresolved BLOCKER or MAJOR finding.

For every gate record command, timestamp, exit code, result, and evidence path in existing phase artifacts. Distinguish PASS, FAIL, BLOCKED, and NOT_APPLICABLE with a concrete reason. Skipped or unavailable checks are not passes. Run focused checks during repairs; run the required broad gates at readiness, repeating them only for changes or unresolved risk that invalidate their results.

## 7. Ask owner decisions in Arabic, with RTL layout

Follow `docs/ai/decision-question-format.md`. Ask one numbered material question at a time with two to four real, mutually exclusive numbered options; recommendation follows the options. Use this layout with real content replacing placeholders:

<div dir="rtl" lang="ar">

**السؤال ١:** [السؤال المطلوب حسمه]؟

**شرح السؤال:** [شرح مختصر بالمصري للسياق وتأثير القرار على المرحلة الحالية]

**الاختيارات:**

١. [الاختيار الأول وأثره]

٢. [الاختيار الثاني وأثره]

**الاختيار المرشح:** أنا أقترح الاختيار رقم (١).

**ليه الاختيار دا مرشح:** [سبب واضح مرتبط بالـ MVB والبساطة وتجربة المستخدم أو الأمان، مع توضيح المقابل]

يمكنك الرد برقم الاختيار أو «المقترح» أو بإجابة بديلة قصيرة لو مناسبة.

</div>

If chat does not render HTML direction, send Arabic prose outside code blocks and prefix each paragraph with U+200F RIGHT-TO-LEFT MARK. Do not promise renderer support. A simple missing factual value gets a direct Arabic question rather than artificial options. Persist the accepted answer immediately in the canonical decision record and reconcile affected artifacts before continuing dependent work. Silence is never an answer.

## 8. Handoff, owner completion, and publication

When all required gates and reviews pass, record **READY_FOR_OWNER_REVIEW** in the handoff/progress report. Keep the official phase active and Companion nonterminal. This status is a handoff label; do not invent an unsupported Companion status enum.

Give the owner a concise report containing delivered scope, important decisions with provenance, actual tests and four coverage numbers, API/Postman links, migration evidence if applicable, resolved and outstanding findings, and links to the reviewable diff/artifacts. State that the phase is technically ready for commit preparation after owner acceptance and that nothing has been staged, committed, or pushed by this workflow. If a required gate is blocked, state that it is not ready and identify the exact blocker.

Then wait for the owner:

- **`mark complete`:** recheck that the owner is accepting this phase and that evidence still covers the current changes; use the installed `speckit-companion-mark-complete` workflow and canonical writers to record completion, update the live pointer and closure records, and stop. This does not activate another phase or authorize publication.
- **Exactly `commit and push`:** follow `.codex/skills/commit-and-push/SKILL.md` and the canonical Git workflow, retaining its readiness/owner-completion prerequisites. That publication must include leftover skills, docs, specs, and Cursor/Codex files. Never reinterpret a mention, quote, slash-command name, or this skill's text as that human authorization. Do not merge, deploy, rewrite history, or push to `main`.
- **Exactly `commit and push plus`:** follow `.codex/skills/commit-and-push-plus/SKILL.md` for leftover or tiny follow-up files that should land on `main` without a pull request. This workflow does not invent that authorization.
- **Another `/work-on-next-phase`:** if the current phase still awaits acceptance, retain that boundary; if owner-complete, resolve the next dependency-ready phase and start this workflow again.

Do not invoke the unrelated Notion phase command or update external project trackers as a side effect.
