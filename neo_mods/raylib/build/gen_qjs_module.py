#!/usr/bin/env python3
"""
Generates raylib_qjs_module.c from raylib_bridge.c.

For each bridge function we emit a QJS C wrapper that:
  - reads arguments from the JS stack
  - calls the same Raylib API (or reuses the bridge handle table)
  - returns an appropriate JS value

We include raylib_bridge.c verbatim (stripped of EMSCRIPTEN_KEEPALIVE) so we
can reuse its handle table and call bridge_* directly from C, keeping the
generator simple and the generated file self-consistent.
"""

import re, sys, os, textwrap

# ── camelCase helper ─────────────────────────────────────────────────────────

def to_camel(name):
    """bridge_InitWindow  ->  initWindow"""
    s = name[len('bridge_'):]
    return s[0].lower() + s[1:]

# ── C argument extraction ─────────────────────────────────────────────────────

def extract_args(params_str):
    """
    Parse a comma-separated C parameter list and return a list of
    (c_type, arg_name) tuples.  Handles 'void' (returns empty list).
    """
    params_str = params_str.strip()
    if params_str == 'void' or params_str == '':
        return []
    result = []
    for i, p in enumerate(params_str.split(',')):
        p = p.strip()
        # strip leading qualifiers
        parts = p.split()
        if not parts:
            continue
        # last token is the name; everything before is the type
        name = parts[-1].lstrip('*')
        ctype = ' '.join(parts[:-1])
        if parts[-1].startswith('*'):
            ctype += '*'
        result.append((ctype, f'a{i}'))
    return result

# ── JS arg reading code ───────────────────────────────────────────────────────

def read_arg(idx, ctype, name, lines, str_names):
    """Emit the C statement(s) that read argv[idx] into a local variable."""
    ctype = ctype.strip()
    if ctype in ('int', 'unsigned int'):
        lines.append(f'    int32_t {name}; JS_ToInt32(ctx, &{name}, argv[{idx}]);')
    elif ctype == 'float':
        lines.append(f'    double _d{idx}; JS_ToFloat64(ctx, &_d{idx}, argv[{idx}]); float {name} = (float)_d{idx};')
    elif ctype == 'double':
        lines.append(f'    double {name}; JS_ToFloat64(ctx, &{name}, argv[{idx}]);')
    elif ctype in ('const char*', 'const char *'):
        lines.append(f'    const char *{name} = JS_ToCString(ctx, argv[{idx}]);')
        str_names.append(name)
    else:
        # fallback: treat as int
        lines.append(f'    int32_t {name}; JS_ToInt32(ctx, &{name}, argv[{idx}]);')

# ── Return value code ─────────────────────────────────────────────────────────

STRUCT_RETURNS = {
    # functions whose float* return holds a Vector2
    'bridge_GetMousePosition': ('v2', ['x','y']),
    'bridge_GetMouseDelta':    ('v2', ['x','y']),
    'bridge_GetMouseWheelMoveV': ('v2', ['x','y']),
    'bridge_GetTouchPosition': ('v2', ['x','y']),
    'bridge_GetCollisionRec':  ('rect', ['x','y','width','height']),
    'bridge_MeasureTextEx':    ('v2',   ['x','y']),
}

def return_code(ret_type, bridge_call, fname):
    """Return the C snippet that calls bridge_call and returns a JSValue."""
    ret_type = ret_type.strip()
    if ret_type == 'void':
        return f'    {bridge_call};\n    return JS_UNDEFINED;'
    elif ret_type == 'int':
        return f'    return JS_NewInt32(ctx, {bridge_call});'
    elif ret_type == 'float':
        return f'    return JS_NewFloat64(ctx, (double)({bridge_call}));'
    elif ret_type == 'double':
        return f'    return JS_NewFloat64(ctx, {bridge_call});'
    elif ret_type == 'const char*':
        return (f'    const char *_ret = {bridge_call};\n'
                f'    return _ret ? JS_NewString(ctx, _ret) : JS_NULL;')
    elif ret_type == 'float*':
        # pick field names from our lookup table
        info = STRUCT_RETURNS.get(fname, ('v2', ['x','y']))
        fields = info[1]
        n = len(fields)
        lines = [f'    float *_r = {bridge_call};']
        lines.append(f'    JSValue _obj = JS_NewObject(ctx);')
        for i, f in enumerate(fields):
            lines.append(f'    JS_SetPropertyStr(ctx, _obj, "{f}", JS_NewFloat64(ctx, (double)_r[{i}]));')
        lines.append('    return _obj;')
        return '\n'.join(lines)
    else:
        # unknown – treat as int
        return f'    return JS_NewInt32(ctx, (int)({bridge_call}));'

# ── Parse bridge.c ───────────────────────────────────────────────────────────

FUNC_RE = re.compile(
    r'EMSCRIPTEN_KEEPALIVE\s+'   # attribute
    r'([\w\s*]+?)\s+'             # return type (greedy for 'const char*' etc.)
    r'(bridge_\w+)\s*\('         # function name
    r'([^)]*)\)',                  # parameters
    re.MULTILINE
)

def parse_bridge(src):
    """Return list of (ret_type, name, params_str) from bridge.c source."""
    funcs = []
    for m in FUNC_RE.finditer(src):
        ret = m.group(1).strip()
        name = m.group(2).strip()
        params = m.group(3).strip()
        funcs.append((ret, name, params))
    return funcs

# ── Color constants and pure-JS helpers (no bridge equivalent) ────────────────

COLOR_CONSTANTS = [
    ("lightgray",  200, 200, 200, 255),
    ("gray",       130, 130, 130, 255),
    ("darkgray",    80,  80,  80, 255),
    ("yellow",     253, 249,   0, 255),
    ("gold",       255, 203,   0, 255),
    ("orange",     255, 161,   0, 255),
    ("pink",       255, 109, 194, 255),
    ("red",        230,  41,  55, 255),
    ("maroon",     190,  33,  55, 255),
    ("green",        0, 228,  48, 255),
    ("lime",         0, 158,  47, 255),
    ("darkgreen",    0, 117,  44, 255),
    ("skyblue",    102, 191, 255, 255),
    ("blue",         0, 121, 241, 255),
    ("darkblue",     0,  82, 172, 255),
    ("purple",     200, 122, 255, 255),
    ("violet",     135,  60, 190, 255),
    ("darkpurple", 112,  31, 126, 255),
    ("beige",      211, 176, 131, 255),
    ("brown",      127, 106,  79, 255),
    ("darkbrown",   76,  63,  47, 255),
    ("white",      255, 255, 255, 255),
    ("black",        0,   0,   0, 255),
    ("blank",        0,   0,   0,   0),
    ("magenta",    255,   0, 255, 255),
    ("raywhite",   245, 245, 245, 255),
]

def color_func(name, r, g, b, a):
    """Generate a QJS function that returns a Color object literal."""
    cname = f'js_raylib_color_{name}'
    return (name, cname, f"""\
static JSValue {cname}(JSContext *ctx, JSValueConst this_val,
    int argc, JSValueConst *argv)
{{
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, obj, "r", JS_NewInt32(ctx, {r}));
    JS_SetPropertyStr(ctx, obj, "g", JS_NewInt32(ctx, {g}));
    JS_SetPropertyStr(ctx, obj, "b", JS_NewInt32(ctx, {b}));
    JS_SetPropertyStr(ctx, obj, "a", JS_NewInt32(ctx, {a}));
    return obj;
}}""")

TEXT_HELPERS = """\
static JSValue js_raylib_textSubtext(JSContext *ctx, JSValueConst this_val,
    int argc, JSValueConst *argv)
{
    const char *s = JS_ToCString(ctx, argv[0]);
    int32_t pos = 0, len = 0;
    JS_ToInt32(ctx, &pos, argv[1]);
    JS_ToInt32(ctx, &len, argv[2]);
    if (!s) return JS_NULL;
    int slen = (int)strlen(s);
    if (pos < 0) pos = 0;
    if (pos > slen) pos = slen;
    if (len < 0) len = 0;
    if (pos + len > slen) len = slen - pos;
    JSValue ret = JS_NewStringLen(ctx, s + pos, len);
    JS_FreeCString(ctx, s);
    return ret;
}
static JSValue js_raylib_textToUpper(JSContext *ctx, JSValueConst this_val,
    int argc, JSValueConst *argv)
{
    const char *s = JS_ToCString(ctx, argv[0]);
    if (!s) return JS_NULL;
    char *buf = (char *)malloc(strlen(s) + 1);
    for (int i = 0; s[i]; i++) buf[i] = (char)toupper((unsigned char)s[i]);
    buf[strlen(s)] = 0;
    JSValue ret = JS_NewString(ctx, buf);
    free(buf); JS_FreeCString(ctx, s);
    return ret;
}
static JSValue js_raylib_textToLower(JSContext *ctx, JSValueConst this_val,
    int argc, JSValueConst *argv)
{
    const char *s = JS_ToCString(ctx, argv[0]);
    if (!s) return JS_NULL;
    char *buf = (char *)malloc(strlen(s) + 1);
    for (int i = 0; s[i]; i++) buf[i] = (char)tolower((unsigned char)s[i]);
    buf[strlen(s)] = 0;
    JSValue ret = JS_NewString(ctx, buf);
    free(buf); JS_FreeCString(ctx, s);
    return ret;
}
static JSValue js_raylib_textToInteger(JSContext *ctx, JSValueConst this_val,
    int argc, JSValueConst *argv)
{
    const char *s = JS_ToCString(ctx, argv[0]);
    if (!s) return JS_NewInt32(ctx, 0);
    int v = atoi(s);
    JS_FreeCString(ctx, s);
    return JS_NewInt32(ctx, v);
}
static JSValue js_raylib_textToFloat(JSContext *ctx, JSValueConst this_val,
    int argc, JSValueConst *argv)
{
    const char *s = JS_ToCString(ctx, argv[0]);
    if (!s) return JS_NewFloat64(ctx, 0.0);
    double v = atof(s);
    JS_FreeCString(ctx, s);
    return JS_NewFloat64(ctx, v);
}
static JSValue js_raylib_textFindIndex(JSContext *ctx, JSValueConst this_val,
    int argc, JSValueConst *argv)
{
    const char *s = JS_ToCString(ctx, argv[0]);
    const char *find = JS_ToCString(ctx, argv[1]);
    int idx = -1;
    if (s && find) {
        const char *p = strstr(s, find);
        if (p) idx = (int)(p - s);
    }
    if (s) JS_FreeCString(ctx, s);
    if (find) JS_FreeCString(ctx, find);
    return JS_NewInt32(ctx, idx);
}
#include <ctype.h>
"""

TEXT_HELPER_ENTRIES = [
    # textSubtext and textFindIndex are not in bridge, so add them here.
    # textToUpper, textToLower, textToInteger are already exported via bridge.
    ("textSubtext",    "js_raylib_textSubtext",    3),
    ("textFindIndex",  "js_raylib_textFindIndex",   2),
    # textToFloat is not in the bridge either
    ("textToFloat",    "js_raylib_textToFloat",     1),
]

# ── Main generator ────────────────────────────────────────────────────────────

HEADER = """\
/*
 * raylib_qjs_module.c — QuickJS native module for Raylib
 *
 * AUTO-GENERATED by gen_qjs_module.py — do not edit by hand.
 *
 * Compiles into nbqjs.exe as a built-in module named "raylib_native".
 * Wraps the bridge layer (raylib_bridge.c, stripped of emscripten attrs)
 * so that the exact same handle table and flattened-struct convention is
 * reused without changes.
 *
 * Exported JS function names are camelCase versions of the bridge names,
 * matching the names in raylib_wrapper.js so that raylib.js can use them
 * transparently for both WASM and native QJS targets.
 */

/* Provide a minimal emscripten.h stub so raylib_bridge.c compiles natively */
#define EMSCRIPTEN_KEEPALIVE   /* strip emscripten attribute */
/* Tell raylib_bridge.c's #include <emscripten.h> to use our local stub */
#include "emscripten.h"
#include "raylib_bridge.c"     /* pull in the bridge (handle table + all fns) */

#include "quickjs.h"

#define countof(x) (sizeof(x) / sizeof((x)[0]))

"""

FOOTER_TMPL = """
/* -- Module init ------------------------------------------------- */

JSModuleDef *js_init_module_raylib(JSContext *ctx, const char *module_name)
{
    JSModuleDef *m = JS_NewCModule(ctx, module_name, js_raylib_init);
    if (!m) return NULL;
    JS_AddModuleExportList(ctx, m, js_raylib_funcs, countof(js_raylib_funcs));
    return m;
}
"""

def generate(bridge_src, out_file):
    funcs = parse_bridge(bridge_src)
    print(f'[gen] Parsed {len(funcs)} bridge functions', file=sys.stderr)

    wrappers = []   # list of (js_name, c_wrapper_name, arg_count)
    bodies   = []

    for ret, fname, params_str in funcs:
        js_name    = to_camel(fname)
        c_name     = f'js_raylib_{fname[len("bridge_"):]}'
        args       = extract_args(params_str)
        nargs      = len(args)

        lines = [f'static JSValue {c_name}(JSContext *ctx, JSValueConst this_val,']
        lines.append(f'    int argc, JSValueConst *argv)')
        lines.append('{')

        str_names = []
        for i, (ctype, aname) in enumerate(args):
            read_arg(i, ctype, aname, lines, str_names)

        # build the call expression
        call_args = ', '.join(a[1] for a in args)
        call      = f'{fname}({call_args})'

        # return
        ret_code = return_code(ret, call, fname)
        # free cstrings before return
        for sn in str_names:
            if 'return JS_UNDEFINED' in ret_code:
                # insert frees before return
                ret_code = ret_code.replace(
                    'return JS_UNDEFINED;',
                    f'JS_FreeCString(ctx, {sn});\n    return JS_UNDEFINED;')
            else:
                # inject frees before the final return
                parts = ret_code.rsplit('return', 1)
                ret_code = parts[0] + f'JS_FreeCString(ctx, {sn});\n    return' + parts[1]

        lines.append(ret_code)
        lines.append('}')
        bodies.append('\n'.join(lines))
        wrappers.append((js_name, c_name, nargs))

    # generate color constant functions
    color_wrappers = []
    color_bodies   = []
    for name, r, g, b, a in COLOR_CONSTANTS:
        js_name, cname, body = color_func(name, r, g, b, a)
        color_wrappers.append((js_name, cname, 0))
        color_bodies.append(body)

    with open(out_file, 'w', encoding='utf-8', newline='\n') as f:
        f.write(HEADER)

        # write bridge wrappers
        f.write('\n'.join(bodies))
        f.write('\n\n')

        # write text helpers (with ctype.h include)
        f.write(TEXT_HELPERS)
        f.write('\n')

        # write color constant functions
        f.write('\n'.join(color_bodies))
        f.write('\n\n')

        # write function table
        all_wrappers = wrappers + color_wrappers + TEXT_HELPER_ENTRIES
        f.write('static const JSCFunctionListEntry js_raylib_funcs[] = {\n')
        for entry in all_wrappers:
            js_name, c_name, nargs = entry
            f.write(f'    JS_CFUNC_DEF("{js_name}", {nargs}, {c_name}),\n')
        f.write('};\n\n')

        # write module init body
        f.write('static int js_raylib_init(JSContext *ctx, JSModuleDef *m)\n')
        f.write('{\n')
        f.write('    return JS_SetModuleExportList(ctx, m, js_raylib_funcs,\n')
        f.write('                                 countof(js_raylib_funcs));\n')
        f.write('}\n')

        f.write(FOOTER_TMPL)

    total = len(wrappers) + len(color_wrappers) + len(TEXT_HELPER_ENTRIES)
    print(f'[gen] Wrote {total} function wrappers to {out_file}', file=sys.stderr)

if __name__ == '__main__':
    bridge_path = os.path.join(os.path.dirname(__file__), 'raylib_bridge.c')
    out_path    = os.path.join(os.path.dirname(__file__), 'raylib_qjs_module.c')

    with open(bridge_path, 'r', encoding='utf-8', errors='replace') as f:
        src = f.read()

    generate(src, out_path)
