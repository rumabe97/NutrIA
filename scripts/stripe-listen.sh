#!/bin/sh
# Forwards Stripe's test-mode events to the local API while `pnpm dev` runs.
#
# Without it a local checkout succeeds at Stripe and the account never turns
# premium: the webhook is the only thing that changes a tier (0056), and Stripe
# cannot reach localhost on its own. Skips, without failing `pnpm dev`, when the
# Stripe CLI is not installed or apps/api/.env has no Stripe key — billing is
# optional locally. The signing secret it prints (whsec_…) is the local
# STRIPE_WEBHOOK_SECRET; it stays the same between runs on one machine.
#
# The events are the ones BillingService.webhook acts on; anything else it
# ignores, so forwarding more would only be noise.
set -e

cd "$(dirname "$0")/.."

STRIPE=$(command -v stripe || true)
[ -z "$STRIPE" ] && [ -x "$HOME/.local/bin/stripe" ] && STRIPE="$HOME/.local/bin/stripe"

if [ -z "$STRIPE" ]; then
  echo "[stripe] CLI not installed — webhooks will not reach the local API (docs/reference/payments.md § 3d)"
  exit 0
fi

ENV_FILE=apps/api/.env

if ! grep -q '^STRIPE_SECRET_KEY=..*' "$ENV_FILE" 2>/dev/null; then
  echo "[stripe] no STRIPE_SECRET_KEY in $ENV_FILE — billing is off locally, nothing to forward"
  exit 0
fi

PORT=$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -n 1)
PREFIX=$(sed -n 's/^API_PREFIX=//p' "$ENV_FILE" | tail -n 1)

# The CLI exits when its websocket to Stripe drops (seen: "i/o timeout" on a
# ping), and nothing brings it back — so a flaky connection left `pnpm dev`
# running with no forwarder and every payment stuck on free. It is restarted
# after a pause; stopping `pnpm dev` (INT/TERM) ends the loop, not just one run.
# Each child runs in the background and is waited on, because a shell only
# acts on a signal between commands: a foreground `sleep` or `stripe` would
# hold the stop back, and the child would outlive the loop.
set +e
child=
trap '[ -n "$child" ] && kill "$child" 2>/dev/null; exit 0' INT TERM

while true; do
  "$STRIPE" listen \
    --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted \
    --forward-to "localhost:${PORT:-3001}/${PREFIX:-api/v1}/billing/webhook" &
  child=$!
  wait "$child"
  echo "[stripe] listen stopped (exit $?) — restarting in 5 s; events sent meanwhile are lost, re-send them from the dashboard"
  sleep 5 &
  child=$!
  wait "$child"
done
