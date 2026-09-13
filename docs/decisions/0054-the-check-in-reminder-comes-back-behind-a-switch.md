# 0054 — The check-in reminder comes back, behind a switch, and reaches the phone too

**Status**: accepted · **Date**: 2026-09-13 · **Deciders**: owner, agent

## Context

`0027` built the check-in reminder: one mail a fortnight, on the day the check-in comes
due, and a switch on the profile that stops it. On 2026-09-09 its schedule was removed,
because the owner wanted every cron off while the project runs on free tiers. Since then
nobody has been told when their fortnight closes. The card on the dashboard is the only
nudge, and for someone who does not open the app the plan runs out and the next one is
built from the same answers as the last.

The installable app (`0053`) left one piece of roadmap step 8.1 undone: web push for the
check-in. The owner's words were: "Haz el paso 1, pero pon una feature flag en admin para
activar y desactivar".

## Decision

- **The schedule returns.** `/cron/reminders` runs daily at 08:00 UTC, which is 10:00 in
  Madrid in summer and 09:00 in winter. It is one invocation a day and uses nothing from
  the AI provider.
- **A switch on `/admin` decides whether anything goes out** (`checkInReminders` in
  `core/domain/Flag`).
  - Only the owner can see it.
  - With no row it falls back to off. The day the settings table is empty must not be the
    day everybody who is due gets contacted.
  - When it is off, the sweep does not even query.
  - The owner can stop reminders in one click without a deploy, which is what removing
    the cron was standing in for.
- **Push is a second channel, chosen per device.**
  - A browser subscribes from the profile ("Avisarme también en este dispositivo").
  - Subscriptions are stored in `push_subscriptions` (migration `0030`), one row per
    endpoint, so a phone that changes hands belongs to whoever subscribed on it last.
  - The sweep mails people who want the mail and pushes to each browser they subscribed.
    Each channel is tried on its own, so a refused mail does not cost the phone its
    reminder.
  - One row in `notifications` records whichever channel carried the reminder. "Already
    sent" now means any channel, so it is still one reminder a fortnight.
  - Someone who turned the mail off but subscribed a phone still gets the reminder, on
    the phone.
- **Nothing about health on a lock screen.** The whole message is "Tu quincena ha
  terminado — Dos minutos de check-in y el siguiente plan parte de ahí." Tapping it opens
  `/check-in`. The worker only ever opens a page of this site, whatever a message says.
- **VAPID keys are all three or none** (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`). With none, reminders go by mail only and the profile draws no push
  switch.
- **Endpoints are accepted only on push services that browsers use**: Google, Apple,
  Mozilla and Microsoft. The server later POSTs to whatever is stored, so accepting any
  URL would let a caller aim it at an address of their choosing.
- **A subscription ends** when:
  - the person signs out — the browser unsubscribes and tells the API while the session
    still exists;
  - the account is deleted — the cascade removes the row;
  - a push service answers 404 or 410.
- **iPhone.** Apple delivers web push only to an app added to the home screen (iOS 16.4
  and later). In Safari, the profile says how to do that instead of drawing a switch that
  cannot work.

## Alternatives considered

- **Separate switches on `/admin` for mail and push.** That would be two switches to keep
  in step for one decision, "do we contact people at all". Which channels to use is
  already each person's own choice.
- **A push provider's SDK** (OneSignal, Firebase). It adds a dependency and a third party
  on every device, for what Web Push does natively in one small service.
- **Keeping the cron off and running the sweep by hand.** The switch gives the same
  control without anyone having to remember to run it.

## Consequences

- After this deploys, nothing changes until the owner throws the switch on `/admin`.
  Then mail goes out if SMTP is set, and the profile offers the phone switch if VAPID is
  set.
- The cron costs one function invocation a day, even with the switch off.
- A phone signed out without the app (a session that expired) keeps its subscription
  until someone else subscribes on it or its push service reports it gone. The message
  carries nothing personal, so what reaches the wrong lock screen is "your fortnight is
  done".
