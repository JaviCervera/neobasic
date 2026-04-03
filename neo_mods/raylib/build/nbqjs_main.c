/*
 * neobasic — NeoBasic QuickJS interpreter
 *
 * Custom QuickJS entry point that additionally registers the
 * "raylib_native" built-in C module so compiled NeoBasic programs
 * that import raylib can call Raylib directly without any DLL.
 *
 * CLI behaviour:
 *   neobasic -c <file.nb> [-o <out.js>]
 *       Runs neobasic.js (located next to this binary) with the given
 *       arguments forwarded, compiling the NeoBasic source to JavaScript.
 *
 *   neobasic -r <file.nb>
 *       Compiles <file.nb> in memory (no .js file is written) using
 *       neobasic.js, then executes the resulting JavaScript immediately.
 *
 *   neobasic -r <file.js>
 *       Runs <file.js> directly.
 *
 *   neobasic [args...]
 *       Runs program.js in the current working directory, forwarding
 *       all arguments to the script via process.argv.slice(2).
 *
 * Based on QuickJS qjs.c (Copyright Fabrice Bellard / Charlie Gordon).
 * QuickJS is MIT-licensed; see lib/quickjs-2025-09-13/LICENSE.
 */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#if defined(_WIN32)
#include <windows.h>
#endif

/* Forward-declare _NSGetExecutablePath to avoid including <mach-o/dyld.h>,
 * which defines FALSE/TRUE in an enum that conflicts with QuickJS cutils.h. */
#if defined(__APPLE__)
#include <stdint.h>
extern int _NSGetExecutablePath(char *buf, uint32_t *bufsize);
#endif

#include "cutils.h"
#include "quickjs-libc.h"

/* Declared in raylib_qjs_module.c */
JSModuleDef *js_init_module_raylib(JSContext *ctx, const char *module_name);

extern const uint8_t qjsc_repl[];
extern const uint32_t qjsc_repl_size;

/* ── In-memory compilation support ─────────────────────────────────────────
 * When neobasic -r file.nb is used, the C host registers __neobasic_emit as
 * a global function.  The compiler (neobasic.js --emit) calls it with the
 * compiled JavaScript string instead of writing a file to disk.
 * g_emitted_code holds the JSValue until the host consumes it.
 */
static JSValue g_emitted_code;

static JSValue js_neobasic_emit(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    (void)this_val;
    if (argc > 0 && JS_IsString(argv[0])) {
        JS_FreeValue(ctx, g_emitted_code);
        g_emitted_code = JS_DupValue(ctx, argv[0]);
    }
    return JS_UNDEFINED;
}

static int eval_buf(JSContext *ctx, const void *buf, int buf_len,
                    const char *filename, int eval_flags)
{
    JSValue val;
    int ret;

    if ((eval_flags & JS_EVAL_TYPE_MASK) == JS_EVAL_TYPE_MODULE) {
        val = JS_Eval(ctx, buf, buf_len, filename,
                      eval_flags | JS_EVAL_FLAG_COMPILE_ONLY);
        if (!JS_IsException(val)) {
            js_module_set_import_meta(ctx, val, TRUE, TRUE);
            val = JS_EvalFunction(ctx, val);
        }
        val = js_std_await(ctx, val);
    } else {
        val = JS_Eval(ctx, buf, buf_len, filename, eval_flags);
    }
    if (JS_IsException(val)) {
        js_std_dump_error(ctx);
        ret = -1;
    } else {
        ret = 0;
    }
    JS_FreeValue(ctx, val);
    return ret;
}

static int eval_file(JSContext *ctx, const char *filename, int module)
{
    uint8_t *buf;
    int ret, eval_flags;
    size_t buf_len;

    buf = js_load_file(ctx, &buf_len, filename);
    if (!buf) {
        perror(filename);
        exit(1);
    }

    if (module < 0) {
        module = (has_suffix(filename, ".mjs") ||
                  JS_DetectModule((const char *)buf, buf_len));
    }
    if (module)
        eval_flags = JS_EVAL_TYPE_MODULE;
    else
        eval_flags = JS_EVAL_TYPE_GLOBAL;
    ret = eval_buf(ctx, buf, buf_len, filename, eval_flags);
    js_free(ctx, buf);
    return ret;
}

static JSContext *JS_NewCustomContext(JSRuntime *rt)
{
    JSContext *ctx;
    ctx = JS_NewContext(rt);
    if (!ctx)
        return NULL;
    /* system modules */
    js_init_module_std(ctx, "std");
    js_init_module_os(ctx, "os");
    /* NeoBasic raylib native module */
    js_init_module_raylib(ctx, "raylib_native");
    return ctx;
}

#define PROG_NAME "neobasic"

/* Return the directory containing this executable (no trailing slash).
 * Falls back to argv0's dirname when the OS path cannot be determined. */
static void get_exe_dir(const char *argv0, char *buf, size_t buf_size)
{
    buf[0] = '\0';
#if defined(__APPLE__)
    {
        uint32_t size = (uint32_t)buf_size;
        char tmp[4096];
        if (_NSGetExecutablePath(tmp, &size) == 0) {
            char *slash = strrchr(tmp, '/');
            if (slash) { size_t n = slash - tmp; if (n < buf_size) { memcpy(buf, tmp, n); buf[n] = '\0'; return; } }
        }
    }
#elif defined(__linux__) || defined(__GLIBC__)
    {
        char tmp[4096];
        ssize_t len = readlink("/proc/self/exe", tmp, sizeof(tmp) - 1);
        if (len > 0) {
            tmp[len] = '\0';
            char *slash = strrchr(tmp, '/');
            if (slash) { size_t n = slash - tmp; if (n < buf_size) { memcpy(buf, tmp, n); buf[n] = '\0'; return; } }
        }
    }
#elif defined(_WIN32)
    {
        char tmp[4096];
        DWORD len = GetModuleFileNameA(NULL, tmp, (DWORD)sizeof(tmp));
        if (len > 0) {
            char *slash = strrchr(tmp, '\\');
            if (slash) { size_t n = slash - tmp; if (n < buf_size) { memcpy(buf, tmp, n); buf[n] = '\0'; return; } }
        }
    }
#endif
    /* Fallback: derive from argv0 */
    {
        const char *slash = strrchr(argv0, '/');
#if defined(_WIN32)
        const char *bslash = strrchr(argv0, '\\');
        if (bslash && (!slash || bslash > slash)) slash = bslash;
#endif
        if (slash) {
            size_t n = slash - argv0;
            if (n < buf_size) { memcpy(buf, argv0, n); buf[n] = '\0'; }
        } else {
            /* argv0 has no directory component — binary was found via PATH */
            buf[0] = '.'; buf[1] = '\0';
        }
    }
}

static void help(void) {
    printf("NeoBasic " CONFIG_VERSION "\n"
           "usage: " PROG_NAME " -c <file.nb> [-o <output.js>]\n"
           "       " PROG_NAME " -r <file.nb|file.js>\n"
           "       " PROG_NAME " [args...]\n"
           "\n"
           "  -c <file.nb>          Compile a NeoBasic source file to JavaScript\n"
           "                        (writes <file>.js next to the source)\n"
           "  -o <output.js>        Output path for -c (default: <input>.js)\n"
           "  -r <file.nb>          Compile and run a NeoBasic file in one step\n"
           "                        (no .js file is written to disk)\n"
           "  -r <file.js>          Run a JavaScript file directly\n"
           "  -h, --help            Show this help message\n"
           "  -v, --version         Show version\n"
           "\n"
           "  When called without -c or -r, runs program.js in the current\n"
           "  directory and forwards all arguments to it.\n");
    exit(0);
}

/* Returns 1 if the path ends with the given suffix (case-sensitive). */
static int path_has_suffix(const char *path, const char *suffix)
{
    size_t plen = strlen(path);
    size_t slen = strlen(suffix);
    return plen >= slen && strcmp(path + plen - slen, suffix) == 0;
}

int main(int argc, char **argv)
{
    int is_compile = (argc >= 2 && strcmp(argv[1], "-c") == 0);
    int is_run     = (argc >= 2 && strcmp(argv[1], "-r") == 0);
    int is_help    = (argc >= 2 && (strcmp(argv[1], "--help") == 0 || strcmp(argv[1], "-h") == 0));
    int is_version = (argc >= 2 && (strcmp(argv[1], "--version") == 0 || strcmp(argv[1], "-v") == 0));

    if (is_help)    { help(); return 0; }
    if (is_version) { printf("neobasic " CONFIG_VERSION "\n"); return 0; }

    if (is_run && argc < 3) {
        fprintf(stderr, PROG_NAME ": -r requires a filename\n");
        return 1;
    }

    /* Locate neobasic.js (the bundled compiler) next to this binary */
    char exe_dir[4096];
    get_exe_dir(argv[0], exe_dir, sizeof(exe_dir));
    char neobasic_js[4096];
    snprintf(neobasic_js, sizeof(neobasic_js), "%s/neobasic.js", exe_dir);

    /* Determine the script to run and the argv array QuickJS will see.
     *
     * js_std_add_helpers(ctx, helper_argc, helper_argv) sets scriptArgs so that
     * process.argv.slice(2) == helper_argv[1..].  We build helper_argv so that
     * the script and any user-visible args map correctly.
     */
    char script_path[4096];
    int run_mode_nb = 0; /* -r .nb: compile in memory then exec */

    int helper_argc;
    char **helper_argv;

    if (is_compile) {
        /* -c mode: forward all original args to the compiler */
        snprintf(script_path, sizeof(script_path), "%s", neobasic_js);
        helper_argc = argc;
        helper_argv = (char **)malloc((size_t)helper_argc * sizeof(char *));
        if (!helper_argv) goto oom;
        helper_argv[0] = script_path;
        for (int i = 1; i < argc; i++) helper_argv[i] = argv[i];

    } else if (is_run) {
        const char *run_file = argv[2];

        if (path_has_suffix(run_file, ".nb")) {
            /* Compile in memory, then execute */
            run_mode_nb = 1;
            snprintf(script_path, sizeof(script_path), "%s", neobasic_js);
            /* Compiler args: neobasic.js -c <file.nb> --emit */
            helper_argc = 4;
            helper_argv = (char **)malloc(4 * sizeof(char *));
            if (!helper_argv) goto oom;
            helper_argv[0] = script_path;
            helper_argv[1] = "-c";
            helper_argv[2] = (char *)run_file;
            helper_argv[3] = "--emit";

        } else {
            /* .js (or other extension): run directly */
            snprintf(script_path, sizeof(script_path), "%s", run_file);
            /* Forward argv[3..] as user args */
            helper_argc = argc - 2;
            helper_argv = (char **)malloc((size_t)helper_argc * sizeof(char *));
            if (!helper_argv) goto oom;
            helper_argv[0] = script_path;
            for (int i = 1; i < helper_argc; i++) helper_argv[i] = argv[i + 2];
        }

    } else {
        /* Default: run program.js in cwd, forward all original args */
        snprintf(script_path, sizeof(script_path), "program.js");
        helper_argc = argc;
        helper_argv = (char **)malloc((size_t)helper_argc * sizeof(char *));
        if (!helper_argv) goto oom;
        helper_argv[0] = script_path;
        for (int i = 1; i < argc; i++) helper_argv[i] = argv[i];
    }

    /* ── QuickJS runtime / context setup ─────────────────────────────── */
    JSRuntime *rt = JS_NewRuntime();
    if (!rt) { fprintf(stderr, PROG_NAME ": cannot allocate JS runtime\n"); free(helper_argv); return 2; }
    js_std_set_worker_new_context_func(JS_NewCustomContext);
    js_std_init_handlers(rt);
    JSContext *ctx = JS_NewCustomContext(rt);
    if (!ctx) { fprintf(stderr, PROG_NAME ": cannot allocate JS context\n"); JS_FreeRuntime(rt); free(helper_argv); return 2; }

    JS_SetModuleLoaderFunc2(rt, NULL, js_module_loader, js_module_check_attributes, NULL);
    JS_SetHostPromiseRejectionTracker(rt, js_std_promise_rejection_tracker, NULL);

    /* For -r .nb: register __neobasic_emit so the compiler can hand back the
     * compiled JS string without writing any file to disk. */
    g_emitted_code = JS_UNDEFINED;
    if (run_mode_nb) {
        JSValue global = JS_GetGlobalObject(ctx);
        JSValue emit_fn = JS_NewCFunction(ctx, js_neobasic_emit, "__neobasic_emit", 1);
        JS_SetPropertyStr(ctx, global, "__neobasic_emit", emit_fn);
        JS_FreeValue(ctx, global);
    }

    js_std_add_helpers(ctx, helper_argc, helper_argv);
    free(helper_argv);

    /* ── Phase 1: run script_path (compiler or user program) ─────────── */
    int ret = eval_file(ctx, script_path, -1);
    if (ret == 0) js_std_loop(ctx);

    /* ── Phase 2 (only for -r .nb): execute the emitted code ─────────── */
    if (ret == 0 && run_mode_nb) {
        if (JS_IsUndefined(g_emitted_code)) {
            fprintf(stderr, PROG_NAME ": -r: compiler produced no output for '%s'\n", argv[2]);
            ret = 1;
        } else {
            size_t code_len;
            const char *code_str = JS_ToCStringLen(ctx, &code_len, g_emitted_code);
            if (!code_str) {
                ret = 1;
            } else {
                /* Compiled NeoBasic output is always a plain script (IIFEs),
                 * never an ES module, so use GLOBAL eval. */
                int eval_flags = JS_DetectModule(code_str, code_len)
                    ? JS_EVAL_TYPE_MODULE : JS_EVAL_TYPE_GLOBAL;
                ret = eval_buf(ctx, code_str, (int)code_len, argv[2], eval_flags);
                JS_FreeCString(ctx, code_str);
                if (ret == 0) js_std_loop(ctx);
            }
            JS_FreeValue(ctx, g_emitted_code);
            g_emitted_code = JS_UNDEFINED;
        }
    }

    js_std_free_handlers(rt);
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    return (ret != 0) ? 1 : 0;

oom:
    fprintf(stderr, PROG_NAME ": out of memory\n");
    return 2;
}

