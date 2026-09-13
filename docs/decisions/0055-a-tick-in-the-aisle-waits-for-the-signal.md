# 0055 — A tick in the aisle waits for the signal

**Status**: accepted · **Date**: 2026-09-13 · **Deciders**: owner, agent

## Context

`0053` made the shopping list readable offline, but a tick made offline undid itself a
moment later. The screen said so, and `0053` named ticking offline as the next thing people
would ask for, since the supermarket is where the list is ticked and where the signal
drops. The owner took it as the next step ("Va, continúa").

## Decision

- **Every tick is queued on the device first, then sent at once.** The queue lives in
  `localStorage` (`nutria-pending-ticks-v1`, `apps/web/src/lib/pendingTicks.ts`). It holds
  one entry per item, and the last tick wins: ticking and unticking offline leaves one
  answer to send, not a history of changes.
- **It is sent again when a connection may be back**: on opening any signed-in screen, on
  reconnecting, and on returning to the app. Ticks go one at a time, one flush at a time,
  and the first that finds no connection stops the flush. Once any tick is sent, the
  stored offline copies are refreshed.
- **What the server answers decides what stays.**
  - A refusal (a 4xx: the item is on a list that was rebuilt, or is not theirs) drops the
    tick and puts the item back.
  - No connection, or a server failure (5xx), keeps the tick for later.
- **The screen shows what the device knows.** A waiting or confirmed tick overrides what the
  page arrived with, including a stored copy, and the "X de Y en el carro" count counts
  them too.
- **Two devices: the last tick to reach the server wins.** A shopping list is one person's
  and is rarely ticked on two devices at once. The worst case is an item shown ticked on one
  device that the other had unticked.
- **Cleared with the offline copies** at sign-in, sign-up, sign-out and account deletion:
  ticks made in one session are not another session's to send.
- **Only the shopping list.** Marking a meal eaten, swapping one or doing the check-in still
  needs a connection, and the offline notice now says which is which.

## Alternatives considered

- **Background Sync, so the worker sends ticks with the app closed.** Safari does not have
  it, so the iPhone would still need this queue, and a second path that works everywhere
  but the iPhone is one to keep in step for nothing.
- **Queueing in the worker (IndexedDB).** On iOS the worker does not run without the page,
  and the page is what has to show the ticks. The queue belongs where it is read.
- **A merge rule by timestamp** (apply a tick only if it is newer than the server's). Client
  clocks drift, and for a shopping list the conflict it resolves hardly ever happens.

## Consequences

- A tick made offline stays on the device until the app is next opened with a connection.
- Signing out with ticks still waiting drops them. Signing out needs a connection anyway,
  and the menu does not offer it offline (`0053`).
- A browser that clears its storage loses waiting ticks, like any other unsaved change.
