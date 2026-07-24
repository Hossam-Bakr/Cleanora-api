# Route Composition

This folder owns application-level route registration only.

Business routes remain inside their owning module. The global registrar checks
duplicate module names and mounts approved registrars. It must not become a
global controller or a place for business workflows.
