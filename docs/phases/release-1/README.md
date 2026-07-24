# Release 1 — Phase Registry

This registry makes every approved Release 1 phase visible in one folder. The
canonical scope and Done When clauses remain in
`docs/product/roadmap.md`. Only `docs/product/current.md` activates a phase.


| Phase  | Name                                                 | Depends on                      | Documentation                                       |
| ------ | ---------------------------------------------------- | ------------------------------- | --------------------------------------------------- |
| R1-P00 | Product & Database Architecture                      | —                               | Current phase                                       |
| R1-P01 | Project Foundation & Country Configuration           | R1-P00                          | Roadmap                                             |
| R1-P02 | Complete Authentication & Identity                   | R1-P01                          | [Preparation pack](R1-P02-authentication/README.md) |
| R1-P03 | Roles, Permissions & Privileged Audit                | R1-P02                          | Roadmap                                             |
| R1-P04 | Customer Profiles, Preferences & Text Addresses      | R1-P03                          | Roadmap                                             |
| R1-P05 | Provider Onboarding, Profile & Lifecycle             | R1-P03                          | Roadmap                                             |
| R1-P06 | Provider Verification & External Payout Destinations | R1-P05                          | Roadmap                                             |
| R1-P07 | Worker, Team & Crew Management                       | R1-P05, R1-P03                  | Roadmap                                             |
| R1-P08 | Catalog, Localization & Service Requirements         | R1-P01, R1-P03                  | Roadmap                                             |
| R1-P09 | Provider Services, Pricing & Historical Snapshots    | R1-P05, R1-P08                  | Roadmap                                             |
| R1-P10 | Availability, Capacity & Textual Coverage            | R1-P07, R1-P09                  | Roadmap                                             |
| R1-P11 | Eligibility Engine V1                                | R1-P10                          | Roadmap                                             |
| R1-P12 | Browse Marketplace & Provider Details                | R1-P11                          | Roadmap                                             |
| R1-P13 | Booking Draft, Pricing Snapshot & Status Machine     | R1-P04, R1-P11                  | Roadmap                                             |
| R1-P14 | Financial Ledger & Payment Architecture              | R1-P13                          | Roadmap                                             |
| R1-P15 | Deposit Payments, Methods & Webhooks                 | R1-P14                          | Roadmap                                             |
| R1-P16 | Provider Booking Response & Cancellation Events      | R1-P15                          | Roadmap                                             |
| R1-P17 | Worker & Team Assignment                             | R1-P16, R1-P07                  | Roadmap                                             |
| R1-P18 | Order Execution & Client Completion Code             | R1-P17                          | Roadmap                                             |
| R1-P19 | Panic & Emergency Core                               | R1-P18                          | Roadmap                                             |
| R1-P20 | Remaining Payment & COD Confirmation                 | R1-P18, R1-P14                  | Roadmap                                             |
| R1-P21 | Provider Dues, Settlements & Reconciliation          | R1-P20                          | Roadmap                                             |
| R1-P22 | Basic Ratings & Reviews                              | R1-P18                          | Roadmap                                             |
| R1-P23 | Notifications & Admin-Editable Templates             | Cross-cutting Release 1 domains | Roadmap                                             |
| R1-P24 | Support & Complaints                                 | R1-P19, R1-P20                  | Roadmap                                             |
| R1-P25 | Admin, Operations & Finance Control                  | R1-P03–R1-P24                   | Roadmap                                             |
| R1-P26 | Reporting, Security, QA & Production Launch          | All prior Release 1 phases      | Roadmap                                             |




## Sequencing notes requiring resolution

The detailed roadmap is sequential, but several capabilities are needed before
their owning phase currently appears:

- Authentication OTP in R1-P02 needs SMS/email delivery before R1-P23.
- Worker login in R1-P02 depends on provider-created workers from R1-P07.
- Actor-aware authentication needs a minimal role/account-kind contract before
R1-P03 owns the complete authorization model.
- Panic in R1-P19 can only receive a support-ticket foreign key after R1-P24.
- R1 media phases require protected object storage even though Docker/cloud
deployment is deferred.

These are planning dependencies, not permission to implement future modules.