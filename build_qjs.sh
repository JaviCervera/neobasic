#!/usr/bin/env bash
# =================================================================
# build_qjs.sh  --  Build all QuickJS-related artefacts:
#
#   dist/neobasic-qjs.js   NeoBasic compiler CLI (runs under qjs)
#   dist/nbqjs[.exe]       Custom QuickJS binary with native Raylib
#
# Prerequisites (both targets):
#   Node.js + npm          (for neobasic-qjs.js)
#   Python 3               (for gen_qjs_module.py)
#   gcc                    (for nbqjs)
#
# Additional prerequisites for nbqjs:
#   Linux  : libX11-dev, libXrandr-dev, libXinerama-dev,
#             libXcursor-dev, libXi-dev, libGL-dev (or mesa-dev)
#   macOS  : Xcode command-line tools
#
# Sources expected at:
#   lib/quickjs-2025-09-13/
#   lib/raylib-5.0/
# =================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Helpers ──────────────────────────────────────────────────────
need() {
    command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' not found. $2"; exit 1; }
}

# ── Step 1: build neobasic-qjs.js ────────────────────────────────
echo "=== [1/2] Building neobasic-qjs.js ==="
need node  "Install Node.js (https://nodejs.org/)"
need npm   "Install Node.js (https://nodejs.org/)"
need npx   "Install Node.js (https://nodejs.org/)"

cd "$SCRIPT_DIR"

# Install deps if node_modules is missing
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "--> Installing npm dependencies..."
    npm install
fi

# Compile TypeScript → dist/
echo "--> Running tsc..."
npm run build

# Bundle for QuickJS → dist/neobasic-qjs.js
echo "--> Bundling for QuickJS..."
npm run bundle:qjs

echo ""
echo "    dist/neobasic-qjs.js  OK"

# ── Step 2: build nbqjs ──────────────────────────────────────────
echo ""
echo "=== [2/2] Building nbqjs ==="
need gcc     "Install gcc (Linux: build-essential; macOS: xcode-select --install)"
need python3 "Install Python 3 (https://python.org/)"

BUILD_NBQJS="$SCRIPT_DIR/neo_mods/raylib/build/build_nbqjs.sh"
if [ ! -f "$BUILD_NBQJS" ]; then
    echo "ERROR: $BUILD_NBQJS not found."
    exit 1
fi

bash "$BUILD_NBQJS"

# ── Done ─────────────────────────────────────────────────────────
EXE_EXT=""
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) EXE_EXT=".exe" ;; esac

echo ""
echo "=== Build complete ==="
echo "    dist/neobasic-qjs.js"
echo "    dist/nbqjs$EXE_EXT"
