/*
 * emscripten.h stub for native (non-Emscripten) builds.
 * Provides the minimal definitions needed to compile raylib_bridge.c
 * outside of the Emscripten toolchain.
 */
#ifndef EMSCRIPTEN_H
#define EMSCRIPTEN_H

/* Mark functions as exported - a no-op for native builds */
#define EMSCRIPTEN_KEEPALIVE

/* Minimal EM_ASM stub (not used in bridge, but prevents compile errors) */
#define EM_ASM(...) ((void)0)
#define EM_ASM_INT(...) 0

#endif /* EMSCRIPTEN_H */
