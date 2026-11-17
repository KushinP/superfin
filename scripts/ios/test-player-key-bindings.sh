#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/streamyfin-player-keys.XXXXXX")
trap 'rm -rf "$test_dir"' EXIT
swiftc -module-cache-path "$test_dir/modules" \
  modules/mpv-player/ios/NativePlayer/PlayerKeyBindings.swift \
  modules/mpv-player/ios/NativePlayer/PlayerKeyboardPolicy.swift \
  tests/native/PlayerKeyBindingsTests.swift \
  -o "$test_dir/test"
"$test_dir/test"
