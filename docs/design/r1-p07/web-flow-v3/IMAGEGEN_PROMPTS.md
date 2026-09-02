# Accepted ImageGen prompt set

These are the final prompt patterns used for the accepted `web-flow-v3` assets. The output was generated with the built-in ImageGen tool; no external image-generation fallback was used.

## Numbered page edit template

The template was called once for each source page from `01` through `15`, replacing `{N}` with the page number and passing the corresponding `web-ux-v2` PNG as the single edit target.

```text
Use case: precise-object-edit
Asset type: Cleanora R1-P07 desktop website UX screen
Input image: Image 1 is the exact edit target.

Primary request:
Add one prominent, consistent navigation sequence marker showing that this is screen {N} in the website flow.

Composition and placement:
- Put a 72 px circular badge in unused whitespace at the upper-left of the main page content, directly below the global top header.
- The badge must not cover the Cleanora logo, navigation, Arabic page title, cards, tables, forms, buttons, sidebar, modal content, or the API footer.
- Circle fill: Cleanora primary blue #0A63FF.
- Inside it, render exactly one centered white bold number: {N}.
- Add a thin white inner ring and a very subtle soft shadow.
- Do not add any label, arrow, annotation, or other new text.

Preservation constraints:
Change only by adding this single numbered circle. Preserve the existing image pixel-for-pixel as much as possible: the full desktop website layout, 1536x1024 aspect ratio, all Arabic and English text, all API paths in the bottom footer, Cleanora branding, navigation/sidebar when present, cards, colors, typography, spacing, borders, and existing content. No crop, no mobile frame, no additional mockup, no watermark. The new numbered circle must contain exactly "{N}".
```

## Master order board prompt

The Cleanora web design-system image was provided as a style reference. The final accepted prompt required an exact 5 × 3 grid so the numbering could be visually verified.

```text
Use case: infographic-diagram
Asset type: exact master desktop website screen-order map for frontend developers
Reference image: Image 1 is a style reference only. Create a new original diagram.

Canvas and style:
1536x1024 landscape. Cleanora enterprise desktop web style: white and very-light-gray background, navy typography, #0A63FF primary blue, green outcomes, orange warnings, red destructive impact, purple archive. Rounded white cards, fine gray borders, subtle shadows, no photographs, no 3D, no mobile devices, no phone frames.
Top title exactly: Cleanora R1-P07 Website Screen Order

Strict grid:
Make exactly fifteen equal screen cards arranged in exactly 5 columns by 3 rows.
Row 1 contains numbers 1, 2, 3, 4, 5 from left to right.
Row 2 contains numbers 6, 7, 8, 9, 10 from left to right.
Row 3 contains numbers 11, 12, 13, 14, 15 from left to right.
Every card has one identical filled blue circle at top containing its white number. Every integer 1 through 15 must appear exactly once in the card circles. Do not skip, repeat, reorder, or use any other numbered circles.

Exact card labels and role chips:
1 — Overview — ADMIN
2 — Workers List — ADMIN
3 — Create / Edit Worker — ADMIN
4 — Worker Details — ADMIN
5 — Access & Admin — ADMIN
6 — Accept Invitation — INVITED USER
7 — Worker Lifecycle — ADMIN
8 — Teams List / Create — ADMIN
9 — Team Details — ADMIN
10 — Final Cleaner Impact — ADMIN
11 — Supervisor Team — SUPERVISOR
12 — Worker Self-Service — WORKER
13 — Team Lifecycle — ADMIN
14 — Workforce Readiness — OUTCOME
15 — Workforce History — ADMIN

Connections:
Use solid blue arrows for the admin path: 1 → 2 → 3 → 4 → 5 → 7 → 8 → 9 → 10 → 13 → 14 → 15.
Use dashed blue branch arrows: 5 → 6 → 12 and 9 → 11.
Use dashed green outcome arrows: 11 → 14 and 12 → 14 and 12 → 15.
Use a small red warning symbol only inside card 10.
Add an unnumbered legend: solid blue Admin path; dashed blue role branch; dashed green outcome.

Bottom API footer:
A full-width white footer titled exactly "Key APIs used across the screens", with these exact readable endpoint strings:
GET/POST /api/v1/providers/{providerId}/workers
POST /api/v1/providers/{providerId}/workers/{workerId}/login-access-commands
GET/POST /api/v1/providers/{providerId}/teams
POST /api/v1/providers/{providerId}/teams/{teamId}/membership-commands
GET /api/v1/providers/{providerId}/workforce-readiness
GET /api/v1/workers/me

Quality and text constraints:
Prioritize exact numbers and exact short labels over decoration. No extra cards, no duplicate screen number, no omitted screen, no paragraph text, no tiny illegible labels, no sidebar, no watermark.
```

## Master board connector cleanup

The numbered grid was then passed back as the exact edit target. This accepted cleanup removed model-generated connectors so the catalog could not imply an inaccurate universal actor route. Actor-specific routes remain in the dedicated flow boards and `README.md`.

```text
Use case: precise-object-edit
Asset type: Cleanora R1-P07 desktop website screen-order catalog
Input image: Image 1 is the exact edit target.

Primary change:
Remove every connector line and arrow between the fifteen screen cards, including all solid blue arrows, dashed blue arrows, dashed green arrows, and the arrow legend. This board must communicate catalog order only, not actor navigation.

Replace the removed arrow-legend area with one simple centered unnumbered label:
Screen catalog order — actor-specific flows are shown separately

Strict preservation:
- Preserve the title exactly: Cleanora R1-P07 Website Screen Order.
- Preserve exactly fifteen cards in the same 5 by 3 grid.
- Preserve every card number 1 through 15 exactly once, in the same card and same position.
- Preserve every card label and role chip exactly.
- Preserve the red warning symbol inside card 10.
- Preserve the entire bottom API footer and all six endpoint strings exactly.
- Preserve the 1536x1024 size, Cleanora colors, typography, spacing, cards, white background, and border system.
- Do not add any other content, numbers, arrows, icons, sidebar, mobile frame, or watermark.
- The only visual deletion is the connectors and arrow legend; do not redraw the screen cards.
```
