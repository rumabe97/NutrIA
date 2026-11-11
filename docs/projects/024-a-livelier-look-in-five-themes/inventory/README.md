# Inventory — what a person can reach today

The contract for PRD criterion 1: every control, link, field, state and message of every route,
read from the code on 2026-11-11, before any screen changed. One file per family:

| File | Covers | Rows |
| --- | --- | --- |
| [`app.md`](./app.md) | the 20 signed-in routes, and what wraps them | about 440 |
| [`admin.md`](./admin.md) | the console's 22 routes, its gate, its 404 and its menu | about 550 |
| [`public.md`](./public.md) | landing, privacy and terms, in both trees | about 100 |
| [`auth.md`](./auth.md) | the sign-in family's 8 routes and their English twins | about 130 |
| [`shell.md`](./shell.md) | what every signed-in screen shares: root shell, navigation, offline, tour, errors | about 60 |

Words are given by their dictionary key, which covers both languages. Each file ends with
"Not sure": what could not be settled from the code. Before a screen ships in the new design, its
table is ticked line by line in `../LOG.md`.

The mechanical check beside it is [`../baseline/`](../baseline/README.md).
