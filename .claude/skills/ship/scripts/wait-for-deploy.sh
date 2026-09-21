#!/bin/sh
# Waits until production is serving a commit, then checks it answers.
#
# Vercel reports each production deployment to GitHub against the commit it built, one
# per project. That is the signal used here: polling a URL for a 200 proves a new route
# exists and nothing at all about a changed one, and the API lands about a minute after
# the web app, so "the page is up" has been wrong before.
#
# Usage: sh .claude/skills/ship/scripts/wait-for-deploy.sh [sha] [web-path ...]
#   sha        the merged commit; defaults to origin/main
#   web-path   PUBLIC pages that must answer 200 afterwards, e.g. /condiciones /en/condiciones
#
# A signed-in screen (/perfil, /plan…) cannot be asked from here: with no session the web
# app redirects it to sign-in, in production exactly as it should. That is reported as
# "needs a session — not checked", not as a failure, and the run says how to prove such a
# change is live instead. Any other answer than 200 is a failure.
#
# Origins come from docs/reference/deployment.md; override with WEB_URL / API_URL.

WEB_URL="${WEB_URL:-https://nutr-ia-web-phi.vercel.app}"
API_URL="${API_URL:-https://api-liard-kappa.vercel.app/api/v1}"
ATTEMPTS="${ATTEMPTS:-60}"
PAUSE="${PAUSE:-10}"

sha="${1:-$(git rev-parse origin/main)}"
[ "$#" -gt 0 ] && shift

repo=$(gh repo view --json nameWithOwner -q .nameWithOwner) || exit 1
echo "[deploy] waiting for ${sha%"${sha#???????}"} on $repo"

attempt=0
while [ "$attempt" -lt "$ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  pending=0
  seen=0

  for id in $(gh api "repos/$repo/deployments?sha=$sha" --jq '.[] | select(.environment | startswith("Production")) | .id'); do
    seen=$((seen + 1))
    state=$(gh api "repos/$repo/deployments/$id/statuses" --jq '.[0].state')

    case "$state" in
      success) ;;
      failure | error)
        echo "[deploy] a production deployment FAILED (deployment $id: $state) — read its build log on Vercel"
        exit 1
        ;;
      *) pending=$((pending + 1)) ;;
    esac
  done

  # Two projects deploy from this repository. Fewer than two seen means the second has
  # not been announced yet, which is not the same as there being nothing to wait for.
  if [ "$seen" -ge 2 ] && [ "$pending" -eq 0 ]; then
    echo "[deploy] $seen production deployments succeeded"
    break
  fi

  [ "$attempt" -eq "$ATTEMPTS" ] && { echo "[deploy] gave up after $ATTEMPTS attempts ($seen seen, $pending pending)"; exit 1; }
  sleep "$PAUSE"
done

failed=0
unchecked=0

check() {
  code=$(curl -s -o /dev/null -w '%{http_code}' "$1")
  echo "[deploy] $code  $1"
  [ "$code" = "200" ] || failed=1
}

# A page, which may turn out to be a signed-in one. The proxy sends a visitor with no
# session to /acceder (or /en/acceder) with `?siguiente=` naming where they were going;
# that redirect is production working, so it is told apart from every other non-200.
check_page() {
  answer=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$1")
  code=${answer%% *}
  target=${answer#* }

  case "$code:$target" in
    200:*)
      echo "[deploy] 200  $1"
      ;;
    30?:*/acceder\?siguiente=* | 30?:*/acceder)
      echo "[deploy] $code  $1  — needs a session, not checked"
      unchecked=$((unchecked + 1))
      ;;
    *)
      echo "[deploy] $code  $1${target:+  → $target}"
      failed=1
      ;;
  esac
}

check "$API_URL/health"
check "$WEB_URL/"
for path in "$@"; do check_page "$WEB_URL$path"; done

[ "$failed" -eq 0 ] || { echo '[deploy] something does not answer 200'; exit 1; }

if [ "$unchecked" -gt 0 ]; then
  echo "[deploy] $unchecked signed-in page(s) could not be asked from here. The deployments above"
  echo '         succeeded, so the commit is live; to show the change itself, look for it in what'
  echo '         production serves — a new rule in a stylesheet linked from a public page, a new'
  echo '         endpoint answering — or open the screen signed in.'
fi

echo '[deploy] production is serving it'
