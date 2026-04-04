#!/usr/bin/env bash
# =================================================================
# build_qjs.sh  --  Build all QuickJS-related artefacts:
#
#   dist/neobasic.js       NeoBasic compiler CLI (runs under qjs)
#   dist/neobasic.qjs      Precompiled bytecode of neobasic.js
#   dist/neobasic[.exe]    Custom QuickJS binary with native Raylib
#
# Prerequisites (both targets):
#   Node.js + npm          (for neobasic.js)
#   Python 3               (for gen_qjs_module.py)
#   gcc                    (for neobasic)
#
# Additional prerequisites for neobasic:
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

# ── Step 1: build neobasic.js ────────────────────────────────────
echo "=== [1/2] Building neobasic.js ==="
need node  "Install Node.js (https://nodejs.org/)"
need npm   "Install Node.js (https://nodejs.org/)"
need npx   "Install Node.js (https://nodejs.org/)"

cd "$SCRIPT_DIR"

# Install deps if node_modules is missing
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "--> Installing npm dependencies..."
    npm install
fi

# Bundle CLI for QuickJS -> dist/neobasic.js
# (esbuild transpiles TypeScript directly; no prior tsc needed)
echo "--> Bundling for QuickJS..."
npm run bundle:qjs

echo ""
echo "    dist/neobasic.js  OK"

# ── Step 2: build neobasic ───────────────────────────────────────
echo ""
echo "=== [2/3] Building neobasic ==="
need gcc     "Install gcc (Linux: build-essential; macOS: xcode-select --install)"
need python3 "Install Python 3 (https://python.org/)"

BUILD_NBQJS="$SCRIPT_DIR/interpreter/build.sh"
if [ ! -f "$BUILD_NBQJS" ]; then
    echo "ERROR: $BUILD_NBQJS not found."
    exit 1
fi

bash "$BUILD_NBQJS"

# ── Step 3: precompile neobasic.js → neobasic.qjs ───────────────
EXE_EXT=""
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) EXE_EXT=".exe" ;; esac

echo ""
echo "=== [3/3] Precompiling neobasic.js to neobasic.qjs ==="
"$SCRIPT_DIR/dist/neobasic$EXE_EXT" -p "$SCRIPT_DIR/dist/neobasic.js" -o "$SCRIPT_DIR/dist/neobasic.qjs"

# ── Done ─────────────────────────────────────────────────────────
echo ""
echo "=== Build complete ==="
echo "    dist/neobasic.js"
echo "    dist/neobasic.qjs"
echo "    dist/neobasic$EXE_EXT"
