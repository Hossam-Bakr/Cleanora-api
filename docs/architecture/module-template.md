# Module Template

Create a module only when its active phase needs it:

```text
src/modules/<name>/
├── <name>.routes.ts
├── <name>.controller.ts
├── <name>.service.ts
├── <name>.repository.ts
└── <name>.schema.ts
```

These are examples, not mandatory files. Do not create empty files, one-line
barrels, a separate type file for one consumer, or an interface for one
implementation. Add a policy, transaction repository, provider adapter, or
deeper folder only when current complexity justifies it.
