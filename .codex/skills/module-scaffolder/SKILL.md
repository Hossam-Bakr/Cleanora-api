---
name: module-scaffolder
description: Scaffold exactly one approved Cleanora domain module for the active phase. Use only when a phase plan explicitly authorizes a new module and its ownership, public contract, and repository conventions are known.
---

# Module Scaffolder

1. Read the active plan plus modular-monolith and boundary rules.
2. Confirm the module is required now and has an approved domain-oriented name.
3. Follow the repository's established module template; if none exists, stop and request an architecture convention rather than inventing a competing structure.
4. Create only the minimum folders and files needed by the active tasks.
5. Expose cross-module behavior through an explicit named service or
   composition file. Do not create a one-line `index.ts` barrel, empty test
   folder, or module README.
6. Keep controllers thin, workflows in services/use cases, persistence in owned repositories, and API validation in Zod schemas.
7. Avoid placeholder business code, duplicate ORM models, shared dumping, and future-phase modules.
8. Run applicable structure, type, and test checks and report created boundaries.
