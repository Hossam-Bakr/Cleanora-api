# Next Phase Prompt — R1-P07 Worker, Team & Crew Management

**Consumed:** 2026-08-22 by the owner's exact instruction
`ACTIVATE R1-P07 AND RUN SPECKIT SPECIFY ONLY`. The pre-activation evidence and
boundaries below are retained for traceability; current status is authoritative
in `docs/product/current.md` and the R1-P07 activation artifact.

## Objective

After separate human-owner authorization, activate R1-P07 and run
`speckit-specify` only to prepare a business-focused specification for Worker,
Team, crew-composition, access, and `workersReady` behavior. This handoff does
not itself activate the phase.

## Dependency evidence

- R1-P06 is Complete by explicit human-owner approval, with T001–T137 and its
  review and completion evidence recorded in its canonical feature directory.
- R1-P06 was merged into `origin/main` through PR #6 at commit
  `5d466f09ba1b61ad2a840ee4c5fe54e4663e2764`.
- At handoff-preparation time, `docs/product/current.md` recorded no active
  phase and R1-P07 had not yet been activated. That evidence is historical after
  the consumed-status note above.
- No R1-P07 branch, feature directory, `spec.md`, `plan.md`, or `tasks.md`
  exists or is authorized by this handoff.

## Required product context

- Treat DEC-038 as the authoritative approved pre-activation product baseline
  for Worker identity and engagements, email invitations, access and Worker
  lifecycles, privacy, authority, Worker types and skills, Teams,
  `workersReady`, concurrency, history, reasons, and notification intent.
- Load only the R1-P07 section of `docs/product/roadmap.md` plus directly relevant
  Worker and Team behavior in `docs/product/vision.md`.
- Preserve Provider-domain truth from completed phases: exact-Provider `OWNER`
  and explicit `ADMIN` memberships are distinct from Worker profile data, and
  no Worker boolean grants Provider Admin authority.
- Preserve Authentication ownership of identities, passwords, roles, sessions,
  and recent re-authentication. Preserve Media ownership of private avatar bytes
  and processing.
- Ask any genuinely new material decision using
  `docs/ai/decision-question-format.md`.

## Open questions requiring approval

No material product questions are known from the 27-question package approved
in DEC-038. `speckit-specify` may identify a genuinely new ambiguity that
materially changes scope, privacy, security, UX, or acceptance behavior; it must
ask that question sequentially under the repository decision-question contract
rather than inventing an answer.

## Preparation deliverables

Only after the owner gives the separate activation instruction:

1. Record R1-P07 activation while preserving the one-active-phase rule.
2. Create the single R1-P07 feature directory and `spec.md` through
   `speckit-specify`.
3. Create and validate the specification requirements checklist.
4. Persist the active feature pointer and run the mandatory after-specify hook.
5. Stop and report specification readiness; do not continue automatically.

The preferred authorization is:

```text
ACTIVATE R1-P07 AND RUN SPECKIT SPECIFY ONLY
```

## Explicit exclusions

- No R1-P07 activation occurs while preparing or reading this handoff.
- Do not create `plan.md`, `tasks.md`, implementation prompts, product code, or
  product tests.
- Do not define HTTP endpoints, request/response schemas, or public module
  contracts as approved facts before the later specify and planning workflows.
- Do not modify Prisma, create or edit migrations, or perform database
  operations.
- Do not create or switch a Git branch, stage, commit, push, merge, deploy, or
  perform production configuration or migration.
- Do not modify `.specify/feature.json` or create `specs/R1-P07-*` before the
  separate activation instruction.

Prepare phase artifacts only unless implementation is separately requested.
