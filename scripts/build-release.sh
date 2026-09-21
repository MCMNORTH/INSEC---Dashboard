#!/usr/bin/env bash
set -euo pipefail

version="${1:-}"
if [[ ! "$version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9.-]+)?$ ]]; then
  echo "Version invalide. Format attendu : v1.2.3" >&2
  exit 1
fi

[[ -f vendor/autoload.php ]] || { echo "Exécutez composer install avant le packaging." >&2; exit 1; }
[[ -f public/build/manifest.json ]] || { echo "Exécutez npm run build avant le packaging." >&2; exit 1; }

root="$(git rev-parse --show-toplevel)"
dist="$root/dist"
workspace="$(mktemp -d)"
target="$workspace/insec-dashboard"
archive="$dist/insec-dashboard-${version}.tar.gz"
trap 'rm -rf "$workspace"' EXIT

mkdir -p "$target" "$dist"
git -C "$root" archive HEAD | tar -x -C "$target"
cp -a "$root/vendor" "$target/vendor"

rm -rf "$target/.github" "$target/tests" "$target/scripts"
rm -f "$target/phpunit.xml" "$target/package.json" "$target/package-lock.json" "$target/vite.config.js" "$target/postcss.config.js" "$target/tailwind.config.js"
mkdir -p "$target/storage/app/backups" "$target/storage/app/dossiers" "$target/storage/framework/cache" "$target/storage/framework/sessions" "$target/storage/framework/views" "$target/storage/logs" "$target/bootstrap/cache"
find "$target/storage" -type f -delete

cat > "$target/RELEASE.txt" <<EOF
INSEC Dashboard ${version}
Commit: $(git -C "$root" rev-parse HEAD)
Construit le: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

rm -f "$archive" "$archive.sha256"
tar -czf "$archive" -C "$workspace" insec-dashboard

if tar -tzf "$archive" | grep -Eq '(^|/)\.env$|database\.sqlite|storage/app/(backups|dossiers)/[^/]'; then
  echo "Le paquet contient une donnée interdite." >&2
  exit 1
fi

sha256sum "$archive" > "$archive.sha256"
echo "$archive"
echo "$archive.sha256"
