#!/usr/bin/env python3
"""
Generates raylib_qjs_module.c from raylib_bridge.c + raylib.nbm.

For each bridge function we emit a QJS C wrapper that:
  - reads arguments from the JS stack
  - calls the same Raylib API (or reuses the bridge handle table)
  - returns an appropriate JS value

Struct parameters (Vector2, Vector3, Color, Rectangle, Camera2D, etc.) are
collapsed into single JS object arguments, matching the API exposed by the
WASM path so that NeoBasic-generated code works identically on both targets.

The NBM file is parsed to determine the exact NeoBasic type of each parameter,
which drives how many C bridge args each JS argument expands to and how to
read the JS object's fields.

We include raylib_bridge.c verbatim (stripped of EMSCRIPTEN_KEEPALIVE) so we
can reuse its handle table and call bridge_* directly from C, keeping the
generator simple and the generated file self-consistent.
"""

import re, sys, os

# ── Handle types: passed as a single int (handle id), never expanded ─────────
# Value types not listed here are expanded field-by-field from JS objects.

HANDLE_TYPES = {
    'image', 'texture', 'rendertexture', 'font', 'glyphinfo',
    'sound', 'music', 'wave', 'audiostream', 'shader',
    'mesh', 'material', 'model', 'modelanimation', 'boneinfo',
}

# ── camelCase helper ─────────────────────────────────────────────────────────

def to_camel(name):
    """bridge_InitWindow  ->  initWindow"""
    s = name[len('bridge_'):]
    return s[0].lower() + s[1:]

# ── NBM parser ────────────────────────────────────────────────────────────────

def parse_nbm(nbm_path):
    """
    Parse raylib.nbm and return:
      type_fields : {typename_lower: [(field_lower, nb_field_type), ...]}
      func_params : {js_name: [(nb_param_type, param_name), ...]}
    """
    with open(nbm_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Parse Type...EndType blocks
    type_fields = {}
    for m in re.finditer(r'\bType\s+(\w+)(.*?)EndType', content,
                         re.DOTALL | re.IGNORECASE):
        tname = m.group(1).lower()
        fields = []
        for fm in re.finditer(r'^\s*(\w+)\s+As\s+(\w+)',
                               m.group(2), re.IGNORECASE | re.MULTILINE):
            fields.append((fm.group(1).lower(), fm.group(2)))
        type_fields[tname] = fields

    # Parse Function declarations with JS name mapping
    # Matches: [Async] Function Name(params) [As RetType] = "jsName"
    func_params = {}
    for m in re.finditer(
        r'(?:Async\s+)?Function\s+\w+\s*\(([^)]*)\)'
        r'\s*(?:As\s+\w+(?:\[\])?\s*)?=\s*"(\w+)"',
        content, re.IGNORECASE
    ):
        params_str = m.group(1).strip()
        js_name    = m.group(2)
        params = []
        if params_str:
            for p in params_str.split(','):
                p = p.strip()
                pm = re.match(r'(\w+)\s+As\s+(\w+(?:\[\])?)', p, re.IGNORECASE)
                if pm:
                    params.append((pm.group(2), pm.group(1)))  # (nbType, paramName)
        func_params[js_name] = params

    return type_fields, func_params

# ── C argument extraction ─────────────────────────────────────────────────────

def extract_args(params_str):
    """
    Parse a comma-separated C parameter list and return a list of
    (c_type, gen_name, orig_name) tuples.  Handles 'void' (returns empty list).
    """
    params_str = params_str.strip()
    if params_str == 'void' or params_str == '':
        return []
    result = []
    for i, p in enumerate(params_str.split(',')):
        p = p.strip()
        parts = p.split()
        if not parts:
            continue
        orig_name = parts[-1].lstrip('*')
        ctype = ' '.join(parts[:-1])
        if parts[-1].startswith('*'):
            ctype += '*'
        result.append((ctype, f'a{i}', orig_name))
    return result

# ── Color group detection (fallback when no NBM info) ────────────────────────

def group_colors(args):
    """
    Detect consecutive groups of (int, r[N]?), (int, g[N]?), (int, b[N]?),
    (int, a[N]?) in the arg list and replace each group with a single
    ('color', suffix, gen_names) placeholder.

    Returns a list of items, each one of:
      ('scalar', ctype, gen_name, orig_name)
      ('color',  suffix, [r_gen, g_gen, b_gen, a_gen], js_obj_idx)
    """
    result = []
    i = 0
    color_idx = 0
    while i < len(args):
        # Try to match a Color group starting at i
        if i + 3 < len(args):
            a0 = args[i];   a1 = args[i+1]; a2 = args[i+2]; a3 = args[i+3]
            # All four must be int
            if all(a[0].strip() in ('int', 'unsigned int') for a in [a0,a1,a2,a3]):
                n0, n1, n2, n3 = a0[2], a1[2], a2[2], a3[2]
                # Match r[N], g[N], b[N], a[N] with the same suffix N
                m = re.fullmatch(r'r(\d*)', n0)
                if m:
                    suf = m.group(1)
                    if n1 == f'g{suf}' and n2 == f'b{suf}' and n3 == f'a{suf}':
                        result.append(('color', suf, [a0[1], a1[1], a2[1], a3[1]], color_idx))
                        color_idx += 1
                        i += 4
                        continue
        result.append(('scalar', args[i][0], args[i][1], args[i][2]))
        i += 1
    return result

# ── JS arg reading code ───────────────────────────────────────────────────────

def emit_read_scalar(idx, ctype, name, lines, str_names):
    """Emit C to read argv[idx] into a local variable."""
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
        lines.append(f'    int32_t {name}; JS_ToInt32(ctx, &{name}, argv[{idx}]);')

def emit_read_color(js_idx, suf, gen_names, lines):
    """
    Emit C to read a JS Color object from argv[js_idx] into local int32_t
    variables named r[suf], g[suf], b[suf], a[suf].
    """
    rn, gn, bn, an = gen_names
    lines.append(f'    int32_t {rn}=0,{gn}=0,{bn}=0,{an}=0;')
    lines.append(f'    {{')
    lines.append(f'        JSValue _cobj = argv[{js_idx}], _cf;')
    lines.append(f'        _cf=JS_GetPropertyStr(ctx,_cobj,"r"); JS_ToInt32(ctx,&{rn},_cf); JS_FreeValue(ctx,_cf);')
    lines.append(f'        _cf=JS_GetPropertyStr(ctx,_cobj,"g"); JS_ToInt32(ctx,&{gn},_cf); JS_FreeValue(ctx,_cf);')
    lines.append(f'        _cf=JS_GetPropertyStr(ctx,_cobj,"b"); JS_ToInt32(ctx,&{bn},_cf); JS_FreeValue(ctx,_cf);')
    lines.append(f'        _cf=JS_GetPropertyStr(ctx,_cobj,"a"); JS_ToInt32(ctx,&{an},_cf); JS_FreeValue(ctx,_cf);')
    lines.append(f'    }}')

def emit_read_struct(js_idx, nb_type_lower, type_fields, c_args, c_arg_idx_start, lines):
    """
    Emit C to read a struct JS object from argv[js_idx].
    Declares local variables for each field, then reads them from the JS object.
    Returns (list_of_gen_names, num_c_args_consumed).
    """
    fields = type_fields[nb_type_lower]
    field_vars = []  # (gen_name, field_name_lower, field_type_lower)

    # Declare variables (must happen before the block for C89 compat)
    for i, (fld_name, fld_type) in enumerate(fields):
        idx = c_arg_idx_start + i
        if idx >= len(c_args):
            break
        gn = c_args[idx][1]
        flt = fld_type.lower()
        if flt in ('int', 'bool'):
            lines.append(f'    int32_t {gn} = 0;')
        else:
            lines.append(f'    float {gn} = 0.0f;')
        field_vars.append((gn, fld_name, flt))

    # Read fields from JS object inside a block (temp JSValues)
    if field_vars:
        lines.append(f'    {{')
        lines.append(f'        JSValue _sobj = argv[{js_idx}], _sf;')
        for gn, fld_name, flt in field_vars:
            if flt in ('int', 'bool'):
                lines.append(
                    f'        _sf=JS_GetPropertyStr(ctx,_sobj,"{fld_name}");'
                    f' JS_ToInt32(ctx,&{gn},_sf); JS_FreeValue(ctx,_sf);')
            else:
                lines.append(
                    f'        {{ double _d; _sf=JS_GetPropertyStr(ctx,_sobj,"{fld_name}");'
                    f' JS_ToFloat64(ctx,&_d,_sf); JS_FreeValue(ctx,_sf); {gn}=(float)_d; }}')
        lines.append(f'    }}')

    return [v[0] for v in field_vars], len(field_vars)

# ── Return value code ─────────────────────────────────────────────────────────

STRUCT_RETURNS = {
    'bridge_GetMousePosition': ('v2', ['x','y']),
    'bridge_GetMouseDelta':    ('v2', ['x','y']),
    'bridge_GetMouseWheelMoveV': ('v2', ['x','y']),
    'bridge_GetTouchPosition': ('v2', ['x','y']),
    'bridge_GetCollisionRec':  ('rect', ['x','y','width','height']),
    'bridge_MeasureTextEx':    ('v2',   ['x','y']),
}

def return_code(ret_type, bridge_call, fname):
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
        info = STRUCT_RETURNS.get(fname, ('v2', ['x','y']))
        fields = info[1]
        lines = [f'    float *_r = {bridge_call};']
        lines.append(f'    JSValue _obj = JS_NewObject(ctx);')
        for i, f in enumerate(fields):
            lines.append(f'    JS_SetPropertyStr(ctx, _obj, "{f}", JS_NewFloat64(ctx, (double)_r[{i}]));')
        lines.append('    return _obj;')
        return '\n'.join(lines)
    else:
        return f'    return JS_NewInt32(ctx, (int)({bridge_call}));'

# ── Parse bridge.c ───────────────────────────────────────────────────────────

FUNC_RE = re.compile(
    r'EMSCRIPTEN_KEEPALIVE\s+'
    r'([\w\s*]+?)\s+'
    r'(bridge_\w+)\s*\('
    r'([^)]*)\)',
    re.MULTILINE
)

def parse_bridge(src):
    funcs = []
    for m in FUNC_RE.finditer(src):
        ret = m.group(1).strip()
        name = m.group(2).strip()
        params = m.group(3).strip()
        funcs.append((ret, name, params))
    return funcs

# ── Color constants ───────────────────────────────────────────────────────────

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
#include <ctype.h>
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
"""

TEXT_HELPER_ENTRIES = [
    ("textSubtext",    "js_raylib_textSubtext",    3),
    ("textFindIndex",  "js_raylib_textFindIndex",   2),
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
 * Struct parameters (Color, Vector2, Vector3, Rectangle, Camera2D, etc.) are
 * collapsed into single JS object arguments, driven by raylib.nbm type info,
 * matching the WASM path API so that NeoBasic-generated code runs identically
 * on both targets.
 */
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

def generate(bridge_src, nbm_path, out_file):
    type_fields, func_params = parse_nbm(nbm_path)
    funcs = parse_bridge(bridge_src)
    print(f'[gen] Parsed {len(funcs)} bridge functions', file=sys.stderr)
    print(f'[gen] Loaded {len(func_params)} NBM function signatures', file=sys.stderr)

    wrappers = []
    bodies   = []

    for ret, fname, params_str in funcs:
        js_name = to_camel(fname)
        c_name  = f'js_raylib_{fname[len("bridge_"):]}'
        c_args  = extract_args(params_str)

        lines = [f'static JSValue {c_name}(JSContext *ctx, JSValueConst this_val,']
        lines.append(f'    int argc, JSValueConst *argv)')
        lines.append('{')

        str_names   = []
        bridge_args = []
        js_idx      = 0
        c_arg_idx   = 0

        nb_params = func_params.get(js_name)

        if nb_params is not None:
            # NBM-driven approach: use declared NeoBasic types to read JS args
            for nb_type, param_name in nb_params:
                if c_arg_idx >= len(c_args):
                    break
                nbt = nb_type.lower().rstrip('[]')

                if nbt in ('int', 'bool'):
                    gn = c_args[c_arg_idx][1]
                    lines.append(f'    int32_t {gn}; JS_ToInt32(ctx, &{gn}, argv[{js_idx}]);')
                    bridge_args.append(gn)
                    c_arg_idx += 1
                    js_idx += 1

                elif nbt == 'float':
                    gn = c_args[c_arg_idx][1]
                    lines.append(
                        f'    double _d{js_idx}; JS_ToFloat64(ctx, &_d{js_idx}, argv[{js_idx}]);'
                        f' float {gn} = (float)_d{js_idx};')
                    bridge_args.append(gn)
                    c_arg_idx += 1
                    js_idx += 1

                elif nbt == 'string':
                    gn = c_args[c_arg_idx][1]
                    lines.append(f'    const char *{gn} = JS_ToCString(ctx, argv[{js_idx}]);')
                    str_names.append(gn)
                    bridge_args.append(gn)
                    c_arg_idx += 1
                    js_idx += 1

                elif nbt in type_fields and nbt not in HANDLE_TYPES:
                    # Value struct: expand all fields from JS object
                    gns, consumed = emit_read_struct(
                        js_idx, nbt, type_fields, c_args, c_arg_idx, lines)
                    bridge_args.extend(gns)
                    c_arg_idx += consumed
                    js_idx += 1

                else:
                    # Handle type or unknown: read as single int
                    gn = c_args[c_arg_idx][1]
                    lines.append(f'    int32_t {gn}; JS_ToInt32(ctx, &{gn}, argv[{js_idx}]);')
                    bridge_args.append(gn)
                    c_arg_idx += 1
                    js_idx += 1

        else:
            # Fallback: group_colors heuristic for functions not in NBM
            grouped = group_colors(c_args)
            for item in grouped:
                if item[0] == 'scalar':
                    _, ctype, gn, _ = item
                    emit_read_scalar(js_idx, ctype, gn, lines, str_names)
                    bridge_args.append(gn)
                    js_idx += 1
                else:
                    _, suf, gen_names, _ = item
                    emit_read_color(js_idx, suf, gen_names, lines)
                    bridge_args.extend(gen_names)
                    js_idx += 1

        nargs = js_idx  # JS argument count (after collapsing struct groups)

        call = f'{fname}({", ".join(bridge_args)})'
        ret_code = return_code(ret, call, fname)

        for sn in str_names:
            if 'return JS_UNDEFINED;' in ret_code:
                ret_code = ret_code.replace(
                    'return JS_UNDEFINED;',
                    f'JS_FreeCString(ctx, {sn});\n    return JS_UNDEFINED;')
            else:
                parts = ret_code.rsplit('return', 1)
                ret_code = parts[0] + f'JS_FreeCString(ctx, {sn});\n    return' + parts[1]

        lines.append(ret_code)
        lines.append('}')
        bodies.append('\n'.join(lines))
        wrappers.append((js_name, c_name, nargs))

    # Color constant functions
    color_wrappers = []
    color_bodies   = []
    for name, r, g, b, a in COLOR_CONSTANTS:
        js_name, cname, body = color_func(name, r, g, b, a)
        color_wrappers.append((js_name, cname, 0))
        color_bodies.append(body)

    with open(out_file, 'w', encoding='utf-8', newline='\n') as f:
        f.write(HEADER)
        f.write("""
/* Provide a minimal emscripten.h stub so raylib_bridge.c compiles natively */
#define EMSCRIPTEN_KEEPALIVE   /* strip emscripten attribute */
/* Tell raylib_bridge.c's #include <emscripten.h> to use our local stub */
#include "emscripten.h"
#include "raylib_bridge.c"     /* pull in the bridge (handle table + all fns) */

#include "quickjs.h"

#define countof(x) (sizeof(x) / sizeof((x)[0]))

""")
        f.write('\n'.join(bodies))
        f.write('\n\n')
        f.write(TEXT_HELPERS)
        f.write('\n')
        f.write('\n'.join(color_bodies))
        f.write('\n\n')

        all_wrappers = wrappers + color_wrappers + TEXT_HELPER_ENTRIES
        f.write('static const JSCFunctionListEntry js_raylib_funcs[] = {\n')
        for entry in all_wrappers:
            js_nm, c_nm, na = entry
            f.write(f'    JS_CFUNC_DEF("{js_nm}", {na}, {c_nm}),\n')
        f.write('};\n\n')

        f.write('static int js_raylib_init(JSContext *ctx, JSModuleDef *m)\n')
        f.write('{\n')
        f.write('    return JS_SetModuleExportList(ctx, m, js_raylib_funcs,\n')
        f.write('                                 countof(js_raylib_funcs));\n')
        f.write('}\n')
        f.write(FOOTER_TMPL)

    total = len(wrappers) + len(color_wrappers) + len(TEXT_HELPER_ENTRIES)
    print(f'[gen] Wrote {total} function wrappers to {out_file}', file=sys.stderr)

if __name__ == '__main__':
    build_dir  = os.path.dirname(os.path.abspath(__file__))
    bridge_path = os.path.join(build_dir, 'raylib_bridge.c')
    nbm_path    = os.path.join(build_dir, '..', 'raylib.nbm')
    out_path    = os.path.join(build_dir, 'raylib_qjs_module.c')

    with open(bridge_path, 'r', encoding='utf-8', errors='replace') as f:
        src = f.read()

    generate(src, nbm_path, out_path)

