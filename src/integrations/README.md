# Integrations

Concrete infrastructure adapters live here.

Examples include PostgreSQL/Prisma lifecycle, Pino, Nodemailer, Redis, BullMQ,
Paymob, Firebase, SMS, and protected object storage.

Business modules depend on ports and public contracts. Provider SDK types,
credentials, raw payloads, and connection details must not leak into modules.
