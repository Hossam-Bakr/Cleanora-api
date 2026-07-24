# Background Jobs

This folder is the process-level composition area for approved BullMQ workers.

- Business job definitions remain inside their owning module.
- Queue ports remain under `src/core/queues`.
- Concrete queue adapters remain under `src/integrations`.
- Do not create a worker until an active phase defines ownership, payload
  version, idempotency, retry, retention, and operator recovery.

R1-P00 intentionally registers no background job.
