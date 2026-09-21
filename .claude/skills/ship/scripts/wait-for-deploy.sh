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

# The pull request was green, and that says nothing about this commit: `main` runs the gate
# again on the merge, on another runner, and a test that passes by a margin can fail there.
# It did, the day coverage became what CI runs — and nothing was watching, so nobody was
# told. A red run on `main` does not stop the host deploying; it is still a broken `main`.
#
# One commit can have several runs: a merge that fires two push events starts two, and the
# workflow's concurrency rule cancels one of them. A cancelled run that another one replaced
# says nothing about the commit, so it is set aside; of what is left, a run still going is
# waited for, a failure outranks a success, and only then does a success count.
RUN_THAT_COUNTS='
  [.[] | select(.conclusion != "cancelled")] as $live
  | (if ($live | length) > 0 then $live else . end) as $runs
  | (($runs | map(select(.status != "completed")) | .[0])
      // ($runs | map(select(.conclusion != "success")) | .[0])
      // $runs[0])
  | if . == null then empty else "\(.status) \(.conclusion // "-") \(.databaseId)" end
'
ci=''
for look in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  ci=$(gh run list --workflow CI --branch main --commit "$sha" --json status,conclusion,databaseId --jq "$RUN_THAT_COUNTS" 2>/dev/null)
  case "$ci" in
    completed*) break ;;
  esac
  sleep "$PAUSE"
done

case "$ci" in
  'completed success'*) echo '[deploy] CI on main for this commit: green' ;;
  completed*)
    echo "[deploy] CI on main for this commit: ${ci#completed } — main is RED. Read why: gh run view ${ci##* } --log-failed"
    failed=1
    ;;
  *) echo "[deploy] CI on main for this commit never finished (${ci:-no run found}) — look at it by hand" ; failed=1 ;;
esac

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

[ "$failed" -eq 0 ] || { echo '[deploy] not right yet — see the lines above'; exit 1; }

if [ "$unchecked" -gt 0 ]; then
  echo "[deploy] $unchecked signed-in page(s) could not be asked from here. The deployments above"
  echo '         succeeded, so the commit is live; to show the change itself, look for it in what'
  echo '         production serves — a new rule in a stylesheet linked from a public page, a new'
  echo '         endpoint answering — or open the screen signed in.'
fi

echo '[deploy] production is serving it'
