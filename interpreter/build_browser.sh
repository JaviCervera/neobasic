#!/usr/bin/env bash
# =================================================================
# build_browser.sh  --  Build NeoBasic browser runtime (Emscripten)
#
# Compiles QuickJS + Raylib (PLATFORM_WEB) + NeoBasic bridge/entry
# into a single self-contained JS file with embedded WASM.
#
# Output: dist/neobasic_browser_base.js
#   Contains the runtime only.  The actual NeoBasic program is
#   embedded by  neobasic -c file.nb --browser  or
#                neobasic -p file.nb --browser  at export time.
#
# Prerequisites:
#   Emscripten SDK (emcc on PATH) — https://emscripten.org/
#   Raylib source : lib/raylib-5.0/
#   QuickJS source: lib/quickjs-2025-09-13/
#
# Usage:
#   bash interpreter/build_browser.sh
#
# Note: first build takes several minutes (compiles QuickJS + Raylib).
# =================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QJS_DIR="$SCRIPT_DIR/../lib/quickjs-2025-09-13"
RL_SRC="$SCRIPT_DIR/../lib/raylib-5.0/src"
DIST="$SCRIPT_DIR/../dist"
OUT="$DIST/neobasic_browser_base.js"

# ── Prerequisites ────────────────────────────────────────────────
command -v emcc >/dev/null 2>&1 || {
    echo "ERROR: emcc not found."
    echo "Install the Emscripten SDK: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
}
echo "Using emcc: $(emcc --version | head -1)"

[ -d "$QJS_DIR" ] || { echo "ERROR: QuickJS source not found at $QJS_DIR"; exit 1; }
[ -d "$RL_SRC"  ] || { echo "ERROR: Raylib source not found at $RL_SRC";   exit 1; }

# ── Generate raylib_qjs_module.c (reads raylib.nbm) ─────────────
echo "Generating raylib_qjs_module.c..."
python3 "$SCRIPT_DIR/gen_qjs_module.py"

mkdir -p "$DIST"

# ── Source file lists ────────────────────────────────────────────
QJS_SOURCES=""
for f in quickjs quickjs-libc cutils dtoa libregexp libunicode; do
    QJS_SOURCES="$QJS_SOURCES $QJS_DIR/$f.c"
done

# PLATFORM_WEB: rcore.c includes platforms/rcore_web.c automatically;
# rglfw.c is NOT included (it's desktop-only GLFW).
RL_SOURCES=""
for f in rcore rshapes rtextures rtext rmodels utils raudio; do
    RL_SOURCES="$RL_SOURCES $RL_SRC/$f.c"
done

INTERPRETER_SOURCES="\
    $SCRIPT_DIR/neobasic_browser.c \
    $SCRIPT_DIR/raylib_qjs_module.c \
    $SCRIPT_DIR/qjsc_stubs.c"

ALL_SOURCES="$INTERPRETER_SOURCES $QJS_SOURCES $RL_SOURCES"

# ── Compile flags ────────────────────────────────────────────────
CFLAGS="\
    -O2 \
    -DPLATFORM_WEB \
    -DGRAPHICS_API_OPENGL_ES2 \
    -DCONFIG_VERSION=\"2025-09-13\" \
    -include $SCRIPT_DIR/qjs_emscripten_compat.h \
    -I$QJS_DIR \
    -I$RL_SRC \
    -I$RL_SRC/external/glfw/include \
    -I$SCRIPT_DIR"

# ── Link flags ───────────────────────────────────────────────────
LDFLAGS="\
    -sSINGLE_FILE=1 \
    -sUSE_GLFW=3 \
    -sFULL_ES3=1 \
    -sALLOW_MEMORY_GROWTH=1 \
    -sASYNCIFY=1 \
    -sASYNCIFY_STACK_SIZE=65536 \
    -sEXPORTED_FUNCTIONS=[\"_nb_run_js\",\"_nb_run_bytecode\",\"_malloc\",\"_free\"] \
    -sEXPORTED_RUNTIME_METHODS=[\"ccall\",\"HEAPU8\"] \
    -sENVIRONMENT=web \
    -sSTACK_SIZE=1048576 \
    -sINITIAL_MEMORY=67108864 \
    --no-entry"

# ── Build ────────────────────────────────────────────────────────
echo "Compiling neobasic_browser_base.js (this may take several minutes)..."
# shellcheck disable=SC2086
emcc $ALL_SOURCES $CFLAGS $LDFLAGS -o "$OUT"

SIZE=$(wc -c < "$OUT" | tr -d ' ')
echo ""
echo "=== Browser base built: dist/neobasic_browser_base.js ($SIZE bytes) ==="
echo ""
echo "Usage:"
echo "  neobasic -c file.nb --browser   # export as JS + HTML"
echo "  neobasic -p file.nb --browser   # export as bytecode bundle + HTML"
