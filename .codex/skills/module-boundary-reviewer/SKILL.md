---
name: module-boundary-reviewer
description: Review Cleanora code for modular-monolith ownership and dependency violations. Use when inspecting a Git diff, module design, or phase implementation for forbidden imports, leaking internals, persistence access, shared-folder abuse, circular dependencies, thin-layer violations, or unclear transaction ownership.
---

# Module Boundary Reviewer

1. Read the active artifacts, `.cursor/rules/20-modular-monolith.mdc`, `.cursor/rules/30-module-boundaries.mdc`, and the complete relevant diff.
2. Map changed files to their owning modules and public contracts.
3. Check cross-module imports, direct repository access, Prisma access outside owning infrastructure, circular dependencies, and shared-folder dumping.
4. Check for business logic in routes/controllers, workflow orchestration in repositories, and internal models leaked through contracts.
5. Verify cross-module transaction ownership and event consistency.
6. Report only evidence-based findings with severity, exact file/line, rule, impact, and focused remediation.
7. Use the review-report template and list checks not run.

Do not perform broad rewrites by default.
