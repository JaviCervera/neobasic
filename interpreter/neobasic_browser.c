/*
 * neobasic_browser — NeoBasic browser entry point (Emscripten)
 *
 * Compiled with emcc.  Exports two C functions callable from JavaScript:
 *
 *   nb_run_js(code)            — run a compiled NeoBasic program (JS string)
 *   nb_run_bytecode(data, len) — run a precompiled QuickJS bytecode blob
 *
 * The game loop calls WindowShouldClose() which internally calls
 * emscripten_sleep(16) via rcore_web.c.  With -sASYNCIFY the C stack is
 * suspended each frame and resumed by the browser, so both entry points
 * must be called from JS with: Module.ccall(..., {async: true})
 *
 * Based on QuickJS qjs.c (Copyright Fabrice Bellard / Charlie Gordon).
 * QuickJS is MIT-licensed; see lib/quickjs-2025-09-13/LICENSE.
 */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
/* Stub for builds that accidentally include this file without emcc */
#include "emscripten.h"
#endif

#include "cutils.h"
#include "quickjs-libc.h"

/* Declared in raylib_qjs_module.c */
JSModuleDef *js_init_module_raylib(JSContext *ctx, const char *module_name);

extern const uint8_t qjsc_repl[];
extern const uint32_t qjsc_repl_size;

/* ── Context factory ─────────────────────────────────────────────────────── */

static JSContext *JS_NewBrowserContext(JSRuntime *rt)
{
    JSContext *ctx = JS_NewContext(rt);
    if (!ctx) return NULL;
    js_init_module_std(ctx, "std");
    js_init_module_os(ctx, "os");
    js_init_module_raylib(ctx, "raylib_native");
    return ctx;
}

/* Set globalThis.std / globalThis.os so that core.js IO functions don't
 * throw "Cannot read property of undefined".  File IO won't work in the
 * browser but math/string/print functions work fine.  */
static void setup_global_std(JSContext *ctx)
{
    static const char src[] =
        "import * as std from 'std';\n"
        "import * as os  from 'os';\n"
        "globalThis.std = std;\n"
        "globalThis.os  = os;\n";
    JSValue v = JS_Eval(ctx, src, sizeof(src) - 1, "<std-setup>",
                        JS_EVAL_TYPE_MODULE);
    if (!JS_IsException(v)) v = js_std_await(ctx, v);
    if (JS_IsException(v)) js_std_dump_error(ctx);
    JS_FreeValue(ctx, v);
}

/* ── Shared context lifecycle ────────────────────────────────────────────── */

static JSContext *create_context(void)
{
    JSRuntime *rt = JS_NewRuntime();
    if (!rt) return NULL;
    js_std_set_worker_new_context_func(JS_NewBrowserContext);
    js_std_init_handlers(rt);
    JSContext *ctx = JS_NewBrowserContext(rt);
    if (!ctx) { JS_FreeRuntime(rt); return NULL; }
    JS_SetModuleLoaderFunc2(rt, NULL, js_module_loader,
                            js_module_check_attributes, NULL);
    JS_SetHostPromiseRejectionTracker(rt,
                                      js_std_promise_rejection_tracker, NULL);
    char *argv[] = { "neobasic" };
    js_std_add_helpers(ctx, 1, argv);
    setup_global_std(ctx);
    return ctx;
}

static void destroy_context(JSContext *ctx)
{
    JSRuntime *rt = JS_GetRuntime(ctx);
    js_std_free_handlers(rt);
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
}

/* ── Exported entry points ───────────────────────────────────────────────── */

/* Run a compiled NeoBasic program supplied as a JavaScript string.
 * Must be called with Module.ccall('nb_run_js', null, ['string'], [code], {async: true})
 * because the game loop uses emscripten_sleep() via ASYNCIFY. */
EMSCRIPTEN_KEEPALIVE
void nb_run_js(const char *code)
{
    JSContext *ctx = create_context();
    if (!ctx) return;

    /* Strip shebang line if present */
    size_t len = strlen(code);
    if (len >= 2 && code[0] == '#' && code[1] == '!') {
        while (len > 0 && *code != '\n') { code++; len--; }
        if (len > 0) { code++; len--; }
    }

    int flags = JS_DetectModule(code, len)
                ? JS_EVAL_TYPE_MODULE : JS_EVAL_TYPE_GLOBAL;
    JSValue val = JS_Eval(ctx, code, (int)len, "<program>", flags);
    if (!JS_IsException(val)) val = js_std_await(ctx, val);
    if (JS_IsException(val))  js_std_dump_error(ctx);
    JS_FreeValue(ctx, val);
    js_std_loop(ctx);

    destroy_context(ctx);
}

/* Run a precompiled QuickJS bytecode blob.
 * Must be called with Module.ccall('nb_run_bytecode', null, ['number','number'],
 *   [ptr, len], {async: true}) */
EMSCRIPTEN_KEEPALIVE
void nb_run_bytecode(const uint8_t *data, size_t len)
{
    JSContext *ctx = create_context();
    if (!ctx) return;

    JSValue obj = JS_ReadObject(ctx, data, len, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(obj)) {
        js_std_dump_error(ctx);
        goto done;
    }
    if (JS_VALUE_GET_TAG(obj) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, obj) < 0) {
            js_std_dump_error(ctx);
            JS_FreeValue(ctx, obj);
            goto done;
        }
        js_module_set_import_meta(ctx, obj, FALSE, TRUE);
    }
    {
        JSValue result = JS_EvalFunction(ctx, obj); /* consumes obj */
        if (!JS_IsException(result)) result = js_std_await(ctx, result);
        if (JS_IsException(result))  js_std_dump_error(ctx);
        JS_FreeValue(ctx, result);
        js_std_loop(ctx);
    }

done:
    destroy_context(ctx);
}
