# Module Template

Create this compact layout only when the active phase approves the module:

```text
src/modules/<module-name>/
├── <module-name>.routes.ts
├── <module-name>.controller.ts
├── <module-name>.service.ts
├── <module-name>.repository.ts
├── <module-name>.schemas.ts
├── <module-name>.types.ts
├── <module-name>.errors.ts
├── <module-name>.contracts.ts
├── index.ts
└── __tests__/
    ├── <module-name>.service.test.ts
    └── <module-name>.integration.test.ts
```

Add events, jobs, policies, mappers, constants, or a README only when behavior requires them. Do not create empty optional files or an ORM `model.ts`.

If complexity later justifies deeper layers, evolve internally to `api/`, `application/`, `domain/`, and `infrastructure/` while preserving the public `index.ts`.
