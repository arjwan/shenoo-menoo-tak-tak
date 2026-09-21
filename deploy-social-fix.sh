#!/usr/bin/env bash
set -euo pipefail

echo "== Deploy Shno Mano social UI fixes =="
bundle_dir="$(cd "$(dirname "$0")" && pwd)"
project="${SHNO_PROJECT_DIR:-/home/opc/shenoo-menoo-tak-tak}"
web_root="${SHNO_WEB_ROOT:-/usr/share/nginx/html/shno-mano}"
public_base="${SHNO_PUBLIC_BASE:-https://shino-mino-tak-tak.duckdns.org}"
service_name="${SHNO_SERVICE:-shno-mano-tech.service}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

test -d "$project/server/src" || { echo "Project not found: $project" >&2; exit 1; }
test -d "$web_root" || { echo "Web root not found: $web_root" >&2; exit 1; }
grep -q 'data-action="share"' "$bundle_dir/taktak-feed.js"
grep -q 'viewer-reel-action' "$bundle_dir/taktak-viewers.js"
grep -q 'شنو منو مراسلات' "$bundle_dir/taal-nsolf.html"

backup="$project/.deploy-backups/$stamp-social-ui"
mkdir -p "$backup/static" "$backup/server/src/models" "$backup/server/src/routes"

static_files=(
  auth-guard.js communication-dock.js communication-dock.css
  social-actions-fix.css stories-deck.js stories.html
  reels.html reels-v2.js reels-v2.css reels-media-extra.css
  taktak.html taktak-feed.js taktak-feed.css taktak-viewers.js taktak-viewers.css
  taal-nsolf.html
)
for file in "${static_files[@]}"; do
  test -f "$bundle_dir/$file" || { echo "Missing bundle file: $file" >&2; exit 1; }
  if sudo test -f "$web_root/$file"; then sudo cp -a "$web_root/$file" "$backup/static/$file"; fi
  sudo install -m 0644 "$bundle_dir/$file" "$web_root/$file"
done

server_files=(
  server/src/models/Post.js
  server/src/routes/posts.routes.js
  server/src/routes/post-feed.routes.js
  server/src/routes/media-direct.routes.js
)
for file in "${server_files[@]}"; do
  test -f "$bundle_dir/$file" || { echo "Missing bundle file: $file" >&2; exit 1; }
  cp -a "$project/$file" "$backup/$file"
  install -m 0644 "$bundle_dir/$file" "$project/$file"
done

sudo restorecon -RF "$web_root" "$project/server/src" 2>/dev/null || true
sudo systemctl restart "$service_name"
sudo systemctl is-active --quiet "$service_name"
sudo nginx -t
sudo systemctl reload nginx

curl --fail --silent --show-error http://127.0.0.1:3000/api/health | grep -q '"ok":true'
nonce="$(date +%s)"
curl --fail --silent --show-error "$public_base/taktak.html?v=$nonce" | grep -q '20260913-social-actions-2'
curl --fail --silent --show-error "$public_base/taktak-feed.js?v=$nonce" | grep -q 'data-action="share"'
curl --fail --silent --show-error "$public_base/taktak-viewers.js?v=$nonce" | grep -q 'viewer-reel-action'
curl --fail --silent --show-error "$public_base/social-actions-fix.css?v=$nonce" | grep -q 'viewer-reel-actions'
curl --fail --silent --show-error "$public_base/stories-deck.js?v=$nonce" | grep -q 'pointerdown'
curl --fail --silent --show-error "$public_base/taal-nsolf.html?v=$nonce" | grep -q 'شنو منو مراسلات'
if curl --fail --silent --show-error "$public_base/taal-nsolf.html?v=$nonce" | grep -q 'دعوة أصدقاء'; then
  echo "Old Taal Nsolf service grid is still public." >&2
  exit 1
fi

echo "Deployment and public verification completed."
echo "Backup: $backup"
