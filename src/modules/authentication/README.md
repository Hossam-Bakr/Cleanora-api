# Authentication module

Start review at `index.ts`, the only public module contract.

```text
authentication/
├── index.ts                         public composition and exports
├── application/
│   ├── authentication.service.ts    authentication use cases
│   └── google-authentication.ts     Google transaction orchestration
├── domain/
│   ├── authentication.types.ts      identity and session shapes
│   ├── authentication.ports.ts      internal adapter contracts
│   ├── authentication.errors.ts     stable authentication errors
│   └── *.policy.ts                  pure business rules
├── http/                            routes, controller, schemas, middleware
└── infrastructure/                  Prisma repositories and policy adapter
```

Dependency direction is `HTTP → application → domain`. Infrastructure
implements domain ports. Other modules import only `#modules/authentication`.
