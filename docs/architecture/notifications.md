# Notifications

Business modules request notifications through `NotificationPort` using a template key, locale, variables, channel, recipient, and idempotency key.

Templates and channel eligibility remain server-controlled. Provider SDKs stay in core adapters and never leak into business modules. Delivery attempts, retries, and terminal failures must be observable.

Firebase Cloud Messaging is the approved push provider in ADR-0007. SMS
provider selection remains pending and blocks production OTP delivery.
