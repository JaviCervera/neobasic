/*
 * qjs_emscripten_compat.h
 *
 * Injected via -include when compiling QuickJS under Emscripten (web target).
 * Provides stubs for POSIX/GNU symbols that quickjs-libc.c references but
 * that are not available in ENVIRONMENT=web.
 *
 * The affected features (os.exec, process env, signals) are unused in the
 * browser build, but they must compile cleanly.
 */
#pragma once
#ifdef __EMSCRIPTEN__

/* environ: list of environment variables — not available in web WASM */
#include <stddef.h>
static char *__nb_empty_environ[] = { NULL };
#define environ __nb_empty_environ

/* sighandler_t: GNU extension typedef for signal handlers */
typedef void (*sighandler_t)(int);

#endif /* __EMSCRIPTEN__ */
