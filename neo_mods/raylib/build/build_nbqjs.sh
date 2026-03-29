#!/usr/bin/env bash
# =================================================================
# build_nbqjs.sh  --  Build nbqjs (NeoBasic QuickJS + Raylib native)
# Works on Linux, macOS, and MSYS2/MINGW64 on Windows.
#
# Sources:
#   QuickJS  -- lib/quickjs-2025-09-13/
#   Raylib   -- lib/raylib-5.0/src/
#   Module   -- neo_mods/raylib/build/ (this directory)
#
# Prerequisites:
#   Linux/macOS : gcc, libX11-dev, libXrandr-dev, libXinerama-dev,
#                 libXcursor-dev, libXi-dev, libGL-dev (or mesa-dev)
#   MSYS2       : pacman -S mingw-w64-x86_64-gcc (mingw64 shell)
# =================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/obj"
QJS_DIR="$SCRIPT_DIR/../../../lib/quickjs-2025-09-13"
RL_SRC="$SCRIPT_DIR/../../../lib/raylib-5.0/src"
DIST="$SCRIPT_DIR/../../../dist"

# ── locate compiler ─────────────────────────────────────────────
GCC="${GCC:-gcc}"
command -v "$GCC" >/dev/null 2>&1 || { echo "ERROR: gcc not found."; exit 1; }
echo "Using compiler: $($GCC --version | head -1)"

# ── always regenerate QJS module ────────────────────────────────
echo "Generating raylib_qjs_module.c..."
python3 "$SCRIPT_DIR/gen_qjs_module.py"

mkdir -p "$BUILD_DIR" "$DIST"

# ── platform flags ──────────────────────────────────────────────
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
        PLAT_CFLAGS="-DPLATFORM_DESKTOP -DGRAPHICS_API_OPENGL_33 -D_WIN32_WINNT=0x0501"
        PLAT_LIBS="-lopengl32 -lgdi32 -lwinmm -lm -lpthread"
        EXE_EXT=".exe"
        RL_SOURCES="rcore rshapes rtextures rtext rmodels raudio utils rglfw"
        ;;
    Darwin*)
        PLAT_CFLAGS="-DPLATFORM_DESKTOP -DGRAPHICS_API_OPENGL_33"
        PLAT_LIBS="-framework OpenGL -framework Cocoa -framework IOKit -framework CoreAudio -framework CoreVideo -lm -lpthread"
        EXE_EXT=""
        RL_SOURCES="rcore rshapes rtextures rtext rmodels raudio utils rglfw"
        ;;
    *)  # Linux
        PLAT_CFLAGS="-DPLATFORM_DESKTOP -DGRAPHICS_API_OPENGL_33"
        PLAT_LIBS="-lGL -lm -lpthread -ldl -lrt -lX11"
        EXE_EXT=""
        RL_SOURCES="rcore rshapes rtextures rtext rmodels raudio utils rglfw"
        ;;
esac

CFLAGS="-O2 $PLAT_CFLAGS \
    -I$QJS_DIR \
    -I$RL_SRC \
    -I$RL_SRC/external/glfw/include \
    -I$SCRIPT_DIR \
    -DCONFIG_VERSION='\"2025-09-13\"'"

# ── Step 1: compile Raylib ───────────────────────────────────────
echo "[1/5] Compiling Raylib..."
RL_OBJS=""
for f in $RL_SOURCES; do
    echo "  $f.c"
    eval "$GCC $CFLAGS -c $RL_SRC/$f.c -o $BUILD_DIR/$f.o"
    RL_OBJS="$RL_OBJS $BUILD_DIR/$f.o"
done

# ── Step 2: compile QuickJS ──────────────────────────────────────
echo "[2/5] Compiling QuickJS..."
for f in quickjs dtoa libregexp libunicode cutils quickjs-libc; do
    echo "  $f.c"
    eval "$GCC $CFLAGS -c $QJS_DIR/$f.c -o $BUILD_DIR/$f.o"
done

# ── Step 3: compile QJS module ──────────────────────────────────
echo "[3/5] Compiling raylib QJS module..."
eval "$GCC $CFLAGS -c $SCRIPT_DIR/raylib_qjs_module.c -o $BUILD_DIR/raylib_qjs_module.o"

echo "[4/5] Compiling nbqjs_main.c..."
eval "$GCC $CFLAGS -c $SCRIPT_DIR/nbqjs_main.c -o $BUILD_DIR/nbqjs_main.o"

echo "[4b] Compiling qjsc_stubs.c..."
eval "$GCC $CFLAGS -c $SCRIPT_DIR/qjsc_stubs.c -o $BUILD_DIR/qjsc_stubs.o"

# ── Step 4: link ─────────────────────────────────────────────────
echo "[5/5] Linking nbqjs$EXE_EXT..."
eval "$GCC -o $DIST/nbqjs$EXE_EXT \
    $BUILD_DIR/nbqjs_main.o \
    $BUILD_DIR/raylib_qjs_module.o \
    $BUILD_DIR/quickjs.o $BUILD_DIR/dtoa.o \
    $BUILD_DIR/libregexp.o $BUILD_DIR/libunicode.o \
    $BUILD_DIR/cutils.o $BUILD_DIR/quickjs-libc.o \
    $BUILD_DIR/qjsc_stubs.o \
    $RL_OBJS \
    $PLAT_LIBS"

echo ""
echo "=== nbqjs$EXE_EXT built: $DIST/nbqjs$EXE_EXT ==="
