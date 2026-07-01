#!/usr/bin/env bash
set -euo pipefail

transliterate_ru() {
  # stdin -> stdout
  # 1) ru->lat
  # 2) replace spaces with underscores
  # 3) remove/normalize unsafe characters
  # 4) collapse repeats
  sed -E \
    -e 'y/АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя/ABVGDEEJZIYKLMNOPRSTUFHCCSSSYYEUAabvgdeejziyklmnoprstufhccsssyyeua/' \
    -e 's/Ё/Yo/g; s/ё/yo/g' \
    -e 's/Ж/Zh/g; s/ж/zh/g' \
    -e 's/Х/Kh/g; s/х/kh/g' \
    -e 's/Ц/Ts/g; s/ц/ts/g' \
    -e 's/Ч/Ch/g; s/ч/ch/g' \
    -e 's/Ш/Sh/g; s/ш/sh/g' \
    -e 's/Щ/Shch/g; s/щ/shch/g' \
    -e 's/Ю/Yu/g; s/ю/yu/g' \
    -e 's/Я/Ya/g; s/я/ya/g' \
    -e 's/Ъ//g; s/ъ//g' \
    -e 's/Ь//g; s/ь//g' \
    -e 's/Ы/Y/g; s/ы/y/g' \
    -e 's/Э/E/g; s/э/e/g' \
    -e 's/[[:space:]]+/_/g' \
    -e 's/[^A-Za-z0-9._()+-]+/_/g' \
    -e 's/_+/_/g' \
    -e 's/^_+//; s/_+$//'
}


# Release the aliased github tool
if alias gh >/dev/null 2>&1; then
  unalias gh
fi

# Check deps
command -v gh >/dev/null || { echo "'gh' (GitHub CLI) is required"; exit 1; }
command -v node >/dev/null || { echo "'node' is required to read package.json version"; exit 1; }
gh auth status >/dev/null || { echo "Run: gh auth login"; exit 1; }

RELEASE_DIR="./build/release"

die() { echo "Error: $*" >&2; exit 1; }

# Extract the release tag (semver like v1.2.3) from the package.json
get_release_tag() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '.version' package.json
  else
    node -p "require('./package.json').version"
  fi
}

VERSION="$(get_release_tag)"
[[ -n "$VERSION" ]] || die "No version in package.json"

REPO="$(gh repo view --json nameWithOwner -q '.nameWithOwner')"
TAG="v${VERSION}"

echo "Repo: $REPO"
echo "Tag:  $TAG"

[[ -d "$RELEASE_DIR" ]] || die "Release dir not found: $RELEASE_DIR — run the production build first."
mapfile -t ASSET_PATHS < <(
  node -e "import('./conf/oktozine.build.conf.mjs').then(m => process.stdout.write(JSON.stringify(m.default)))" \
  | jq -r --arg version "v${VERSION}" --arg dir "${RELEASE_DIR}" '
      .releaseDocumentIds as $ids |
      .documents[] |
      select((.id as $id | $ids | index($id)) != null) |
      select(.documentFileName) |
      "\($dir)/\(.documentFileName | gsub("\\{\\{version\\}\\}"; $version))"
    '
)
[[ ${#ASSET_PATHS[@]} -gt 0 ]] || die "No release assets found for releaseDocumentIds in conf — run the production build first."

echo "Assets to upload:"
for a in "${ASSET_PATHS[@]}"; do
  echo "  - $a"
  [[ -f "$a" ]] || die "Asset not found: $a"
done

# Ensure tag exists locally; if not, create at HEAD
if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Creating local tag $TAG at HEAD"
  git tag "$TAG"
fi

# Push tag to origin if missing remotely
if ! git ls-remote --tags origin | grep -q "refs/tags/${TAG}$"; then
  echo "Pushing tag $TAG to origin"
  git push origin "$TAG"
fi

# --- determine previous tag and commits range/list ---

PREV_TAG="$(git for-each-ref --sort=-creatordate --format '%(refname:short)' refs/tags | grep -v "^${TAG}$" | head -n1 || true)"

if [[ -z "$PREV_TAG" ]]; then
  INITIAL_COMMIT="$(git rev-list --max-parents=0 HEAD)"
  RANGE="${INITIAL_COMMIT}..${TAG}"
  PREV_DISPLAY="(initial commit ${INITIAL_COMMIT})"
else
  RANGE="${PREV_TAG}..${TAG}"
  PREV_DISPLAY="${PREV_TAG}"
fi

COMMITS_LIST="$(git --no-pager log --pretty=format:'- %h %s (%an)' --no-merges --max-count=100 "${RANGE}" || true)"

if [[ -z "${COMMITS_LIST}" ]]; then
  COMMIT_HASH="$(git rev-parse --short "${TAG}")"
  COMMIT_SUBJECT="$(git log -1 --pretty=format:'%s' "${TAG}")"
  COMMIT_AUTHOR="$(git log -1 --pretty=format:'%an' "${TAG}")"
  COMMITS_LIST="- ${COMMIT_HASH} ${COMMIT_SUBJECT} (${COMMIT_AUTHOR})"
fi

echo "Commit range included in release: ${RANGE}"
echo "Included commits (trimmed to 100):"
echo "${COMMITS_LIST}"

# --- End section ---

# Prepare release notes (multiline)
NOTES="Release ${TAG}

Commits included: ${RANGE} (previous tag: ${PREV_DISPLAY})

Changes:
${COMMITS_LIST}
"

# Check whether release exists
set +e
gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1
EXISTS=$?
set -e

if [[ $EXISTS -ne 0 ]]; then
  echo "Creating release $TAG (without assets first)…"
  # Create release first (no assets), so we get a stable release object
  gh release create "$TAG" \
    --repo "$REPO" \
    --title "$TAG" \
    --notes "$NOTES"
else
  echo "Release $TAG exists; updating notes…"
  gh release edit "$TAG" --repo "$REPO" --notes "$NOTES"
fi

# Upload assets one-by-one
echo "Uploading assets one-by-one…"
tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

for asset in "${ASSET_PATHS[@]}"; do
  orig="$(basename "$asset")"
  base_no_ext="${orig%.pdf}"
  safe_base="$(printf '%s' "$base_no_ext" | transliterate_ru)"
  safe_name="${safe_base}.pdf"

  tmp_path="$tmp_dir/$safe_name"

  echo "Uploading: $asset"
  echo "  original: $orig"
  echo "  safe:     $safe_name"

  # Create a temp file with the desired upload name.
  # Prefer hardlink to avoid copying large PDFs; fall back to copy if cross-device.
  if ln -f "$asset" "$tmp_path" 2>/dev/null; then
    :
  else
    cp -f "$asset" "$tmp_path"
  fi

  # Upload the temp file. This guarantees the release asset name is $safe_name.
  # No --clobber. If it already exists, the command will fail (by design).
  gh release upload "$TAG" "$tmp_path" --repo "$REPO"
done


echo "Done. Release URL:"
gh release view "$TAG" --repo "$REPO" --json url -q .url
