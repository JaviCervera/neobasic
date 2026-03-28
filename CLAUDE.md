# NeoBasic Compiler — Implementation Plan

## Documentation Rules

- **`CLAUDE.md` must always be kept up to date.** Whenever a design decision changes, a new phase is completed, a module is added or modified, or any architectural detail shifts, update the relevant section of this file before considering the work done.
- **`README.md` must always be kept up to date.** Any user-facing change — new functions, new CLI flags, new install steps, changed behaviour — must be reflected in `README.md` as part of the same change.

## Summary

NeoBasic is a structured BASIC-like language (`.nb` files) that transpiles to JavaScript. The compiler is written in **idiomatic TypeScript (strict mode)** and distributed as a **CLI tool** (`neobasic compile input.nb`). Output JS runs in Node or a browser.

## Key Design Decisions

| Topic | Decision |
|---|---|
| Integer division | `Int / Int` truncates to `Int` |
| `=` vs `==` | `=` is always assignment; `==` is always equality |
| Variable scoping | Top-level variables are **global** (readable and writable from any function); variables declared inside a function are local to that function |
| Standard library | A bundled `core` module (auto-imported) provides math, string, and file I/O functions |
| Testing framework | Vitest |
| Output | Single `.js` file next to the source (or via `-o` flag) |
| Node.js module mode | Compiled output uses `require` for file I/O; must run in a CJS context (no `"type": "module"` in the nearest `package.json`). The `examples/` directory ships a `{"type":"commonjs"}` package.json for this reason. |
| Library distribution | Installable directly from GitHub via `npm install github:JaviCervera/neobasic`; `prepare` script builds `dist/` automatically |
| QuickJS support | `npm run bundle:qjs` produces `dist/neobasic-qjs.js` — a self-contained CLI bundle with Node.js APIs shimmed via `src/shims/`; run as `qjs dist/neobasic-qjs.js compile file.nb` |

## Architecture

The compiler is a classic multi-phase pipeline:

```
Source (.nb)
  │
  ▼
┌─────────┐
│  Lexer  │  Tokenises source into a flat stream of tokens
└────┬────┘
     ▼
┌──────────┐
│  Parser  │  Builds a typed AST from tokens
└────┬─────┘
     ▼
┌─────────────────────┐
│  Semantic Analyser  │  Name resolution, scope analysis, type checking
└──────────┬──────────┘
           ▼
┌──────────────────┐
│  Code Generator  │  Emits JavaScript from the annotated AST
└──────────────────┘
     │
     ▼
Output (.js)
```

Module files (`.nbm` + `.js`) are resolved and processed before the main pipeline runs.

## Project Structure

```
src/
  lexer/
    tokens.ts       Token types and the Token interface
    lexer.ts        Converts source string → Token[]
  parser/
    ast.ts          All AST node types
    parser.ts       Converts Token[] → Program AST
  checker/
    types.ts        Type representation (Int, Float, String, UDT, Array, ...)
    checker.ts      Name resolution + type checker; annotates AST with types
  codegen/
    codegen.ts      Walks the typed AST and emits a JS string
  modules/
    module-loader.ts  Resolves and parses .nbm files and locates companion .js files
  shims/
    qjs-fs.js         QuickJS shim for node:fs (std.open / os.stat)
    qjs-os.js         QuickJS shim for node:os (std.getenv)
    qjs-path.js       QuickJS shim for node:path (pure JS, normalises separators)
    qjs-process.js    QuickJS shim for process global (scriptArgs, os.getcwd, std.exit); also polyfills console.error/warn
    qjs-url.js        QuickJS shim for node:url (fileURLToPath)
  errors.ts         Diagnostic error types (with source location)
  compiler.ts       Orchestrates all phases; public API (`compile`, `compileSource`)
  cli.ts            CLI entry point (compile command)
tests/
  lexer/
  parser/
  checker/
  codegen/
  integration/      End-to-end .nb → .js tests
package.json
tsconfig.json
vitest.config.ts
```

## Implementation Todos

### Phase 0 — Project scaffolding
- Initialise npm package with TypeScript (strict), Vitest, tsx, and a `bin` entry
- Configure `tsconfig.json` (strict, ESNext, Node16 module resolution)
- Add `vitest.config.ts`

### Phase 1 — Lexer
- Define `TokenKind` enum and `Token` interface (kind, value, line, col)
- Implement `lex(source: string): Token[]`
- Handle:
  - Keywords (case-insensitive): `If/Then/Else/ElseIf/EndIf`, `For/To/Step/Next/In`, `While/EndWhile`, `Do/Loop`, `Repeat/Until`, `Select/Case/Default/EndSelect`, `Function/EndFunction`, `Return`, `Type/EndType`, `New`, `Null`, `True/False`, `And/Or/Not`, `Mod`, `As`, `Const`, `Include`, `Import`, `Continue`, `Exit`
  - Identifiers
  - Integer and float literals
  - String literals
  - Operators: `+`, `-`, `*`, `/`, `==`, `=`, `<>`, `<=`, `>=`, `<`, `>`, `.`
  - Delimiters: `(`, `)`, `[`, `]`, `,`, `:`
  - Single-line comments (`'...`) and nested block comments (`/* ... */`)
  - Newlines (significant as statement separators)
- Write Vitest tests for the lexer

### Phase 2 — Parser
- Define AST node types (discriminated unions, every node carries `line`/`col`)
- Implement a recursive-descent parser: `parse(tokens: Token[]): Program`
- Handle all constructs described in the spec:
  - `Include` / `Import` at the top of a file
  - Variable declarations / assignments
  - `Const` declarations
  - Array declarations and indexing
  - `Type...EndType` declarations
  - All expression forms (arithmetic, relational, boolean, `New`, member access, array literals)
  - All statement forms (if/else/elseif/endif, select/case, loops, function calls, return)
  - Function declarations
- Write Vitest tests for the parser

### Phase 3 — Semantic Analyser
- Implement a symbol table with function-scoped variables
- Type representation: `IntType`, `FloatType`, `StringType`, `BoolType`, `NullType`, `ArrayType<T>`, `UDTType`
- Name resolution: resolve variables, functions, type names, module symbols
- Type checking:
  - Infer types for variable declarations when no explicit type is given (error if assigned `Null` without type annotation)
  - Enforce that a variable's type cannot change after declaration
  - Check function call argument types match parameter types
  - Check return types
  - Arithmetic type rules (Int op Int → Int; Int op Float → Float; Int / Int → Int truncated)
  - Array homogeneity
  - UDT field access and assignment
- Write Vitest tests for the checker

### Phase 4 — Code Generator
- Walk the type-annotated AST and produce a JS string
- Conventions:
  - All NeoBasic identifiers are lowercased in output (since the language is case-insensitive)
  - `Int / Int` emits `Math.trunc(a / b)`
  - `<>` emits `!==`; `==` emits `===`
  - `And`/`Or`/`Not` emit `&&`/`||`/`!`
  - `Mod` emits `%`
  - `New Person` emits a factory call or object literal with default fields
  - `Type` definitions emit a factory function returning a plain object
  - Variables that may be `Null` are typed as `T | null` in JS comments (optional)
  - `Array.Length` getter/setter → `.length - 1` (since NeoBasic arrays index 0..N, length is N)
  - `Continue` → `continue`; `Exit` → `break`
  - `For word In expr` → `for (const word of expr)`
  - `For i = start To end Step s` → classic `for` loop
  - `Do...Loop` → `while (true)`
  - `Repeat...Until cond` → `do { ... } while (!(cond))`
  - Imported module `.js` files are inlined into the output as IIFEs (see Phase 8)
- Write Vitest tests for the code generator

### Phase 5 — Module Loader
- Search `neo_mods/` in install dir and `~/neo_mods/` for named module directories
- Parse `.nbm` files (reuse the lexer/parser pipeline, restricted grammar: `Function` declarations and `Const` only)
- Validate that companion `.js` files exist
- Register module symbols into the global symbol table before type checking

### Phase 6 — CLI
- `neobasic compile <file.nb> [-o <out.js>]`
- Collect all `Include`-d files, resolve and concatenate their ASTs before type-checking
- Emit clear error messages with file, line, and column

### Phase 7 — Integration tests
- End-to-end test suite: compile `.nb` fixture files, run the resulting JS with Node, assert stdout
- Cover at least: variables, functions, recursion, UDTs, arrays, all loop types, modules

### Phase 8 — Module Bundling

**Problem:** The code generator originally emitted `require()` calls with absolute file paths for module imports, making compiled output non-portable (it only works on the machine it was compiled on).

**Solution:** Inline each module's JavaScript source into the generated output wrapped in a CommonJS-compatible IIFE. This produces a single self-contained `.js` file with no external dependencies beyond Node built-ins.

**IIFE wrapping convention:**
```js
const core = (() => {
  const module = { exports: {} };
  // ... verbatim content of core.js ...
  return module.exports;
})();
```

**Changes:**
- `CodegenOptions` gains `moduleContents?: Map<string, string>` (module name → JS source). Modules are inlined as IIFEs.
- `CompileOptions` gains no new fields — bundling is always on. The compiler reads each module's `.js` file and passes its content to the code generator.
- The module `.js` files are read as plain text at compile time; they are never executed directly by Node, so no `package.json` with `"type": "commonjs"` is needed alongside them.
- The code generator tracks declared variable names per scope and emits `let` for first-use assignments (`VarAssign`), making the output valid in ESM strict mode.

**Constraints:**
- Module `.js` files must use `module.exports = { ... }` (existing convention).
- Inlined modules that themselves `require()` Node built-ins (e.g. `fs`) remain valid for Node targets. Third-party npm `require()` calls inside a module are left as-is and must be satisfied at runtime.

### Phase 9 — Raylib Module

**Goal:** Add a `raylib` module that provides full access to the Raylib game development library via WebAssembly, enabling NeoBasic programs to create graphical applications.

#### 9.0 — Design Decisions

| Topic | Decision |
|---|---|
| WASM distribution | Base64-encoded WASM binary embedded in `raylib.js` |
| Async initialisation | Top-level `await`; compiled output wrapped in async IIFE when raylib is imported |
| Struct mapping | Raylib C structs mapped to NeoBasic UDTs via new `.nbm` `Type` declarations |
| Value vs handle types | Value types (Color, Vector2, …) fully marshaled; handle types (Texture, Font, …) tracked by internal `__ptr` |
| Color constants | Declared as zero-arg functions returning Color (e.g. `Function RED() As Color`) |
| Integer constants | `.nbm` `Const` declarations (keys, buttons, flags, etc.) |
| WASM build | Emscripten compilation of raylib C source; glue JS + base64 WASM bundled in module |

#### 9.1 — Infrastructure: `.nbm` Type Declarations

Extend the module definition format to support `Type…EndType` blocks:

```
Type Color
  R As Int
  G As Int
  B As Int
  A As Int
EndType
```

**Changes:**
- **`module-loader.ts`** — add `Type` keyword parsing to `parseModuleFile()`. Parse fields (name + type annotation) until `EndType`. Store in a new `types` field on `ModuleDefinition`.
- **`compiler.ts`** — register module types into `CheckerEnv.types`. Inject synthetic `TypeDecl` AST nodes so the codegen emits `type$$new()` factory functions.
- **`codegen.ts`** — no changes needed; existing TypeDecl handling emits factories for module types identically to user types.
- **`checker.ts`** — no changes needed; module types are registered the same way as user types.

#### 9.2 — Infrastructure: Async Module Support

When a module requires async initialisation (WASM loading), the compiled output must use `await`.

**Approach:**
- A bare `Async` line at the top of a `.nbm` file marks the module's initialiser as async (WASM, etc.). The compiler emits `const mod = await (async () => { … })();` for that module and wraps the whole output in an async IIFE.
- Individual functions that return a `Promise` are declared with `Async Function` in the `.nbm` file. The codegen emits `await` only for those specific call sites — other functions in the same module are called synchronously.
- `compiler.ts` sets `hasAsync` when either condition is true: any module has an async initialiser, or any registered function has `isAsync: true`.

**Example `.nbm` declaration:**
```
' Module-level async: WASM needs async init
Async

' Only this function is awaited at call sites
Async Function WindowShouldClose() As Bool = "windowShouldClose"
Function BeginDrawing() = "beginDrawing"
```

**Example compiled output:**
```js
(async () => {
  const core = (() => {
    const module = { exports: {} };
    // … core.js …
    return module.exports;
  })();

  const raylib = await (async () => {
    const module = { exports: {} };
    // … raylib.js (async WASM init) …
    return module.exports;
  })();

  // … user code …
  while (!await raylib.windowShouldClose()) {   // awaited — declared Async Function
    raylib.beginDrawing();                       // not awaited — plain Function
    // …
  }
})();
```

#### 9.3 — WASM Build Pipeline ✅

Create `neo_mods/raylib/build/` containing:

1. **`build.sh`** — compiles raylib with emscripten, base64-encodes the `.wasm`, and assembles the final `raylib.js` by combining:
   - Emscripten glue code (MODULARIZE + SINGLE_FILE, WASM embedded as base64)
   - Memory management helpers (malloc/free via emscripten exports)
   - C bridge functions that flatten struct arguments for WASM interop
   - JS wrapper functions mapping NeoBasic names to WASM bridge calls
2. **`raylib_bridge.c`** — C bridge layer (~247 functions) that flattens all struct-by-value arguments to scalars, uses a handle table for opaque types (Image, Texture, Font, etc.).
3. **`raylib_wrapper.js`** — JS wrappers mapping all ~383 NeoBasic function names to WASM bridge calls, with struct marshaling helpers.
4. **`exported_functions.txt`** — list of all bridge function symbols for emscripten linker.

**Key emscripten flags:** `-sMODULARIZE=1 -sSINGLE_FILE=1 -sUSE_GLFW=3 -sALLOW_MEMORY_GROWTH=1 -sASYNCIFY -sENVIRONMENT=web --no-entry -Os`

**Environment constraint:** The module targets `web` only — it requires a WebGL context and a `<canvas>` element and cannot function in Node.js. The wrapper must not include any Node.js environment detection; `document.getElementById('canvas')` is passed unconditionally to the Emscripten module initialiser.

**ASYNCIFY note:** Raylib's web platform calls `emscripten_sleep(16)` inside `WindowShouldClose()` for frame pacing. The JS wrapper uses `M.ccall('bridge_WindowShouldClose', ..., {async: true})` to properly handle ASYNCIFY suspension/resumption. `WindowShouldClose` is declared `Async Function` in `raylib.nbm` so only that call site is awaited; the hundreds of other Raylib calls are emitted without `await`, avoiding unnecessary microtask overhead.

**Prerequisites:** Emscripten SDK. Only needed when rebuilding; the committed `raylib.js` (~940 KB) includes the embedded WASM so end users don't need emscripten.

#### 9.4 — Struct Marshaling ✅

Two categories of types live in `raylib.js`:

**Value types** — Color, Vector2, Vector3, Vector4, Rectangle, Camera2D, Camera3D, Ray, BoundingBox, Matrix, NPatchInfo, Transform, RayCollision
- Fully user-constructable via `New`.
- All fields readable and writable by user code.
- Marshaled to WASM memory when passed to a function; marshaled back when returned.
- No hidden state.

**Handle types** — Image, Texture, RenderTexture, Font, GlyphInfo, Sound, Music, Wave, AudioStream, Shader, Mesh, Material, Model, ModelAnimation, BoneInfo
- Created only by loading/generating functions (not `New`).
- Expose user-readable fields (width, height, etc.).
- Track internal WASM pointer via a hidden `__ptr` property.
- Must be explicitly unloaded to free WASM memory.

**Marshaling helpers:**
```js
// Layout definitions
const LAYOUTS = {
  Color:   { size: 4,  fields: { r: [0,'u8'], g: [1,'u8'], b: [2,'u8'], a: [3,'u8'] } },
  Vector2: { size: 8,  fields: { x: [0,'f32'], y: [4,'f32'] } },
  // …
};

function writeStruct(ptr, layout, obj) { /* write fields to WASM heap */ }
function readStruct(ptr, layout)       { /* read fields from WASM heap → JS object */ }
function allocStruct(layout)           { /* malloc(layout.size) */ }
function freeStruct(ptr)               { /* free(ptr) */ }
function allocString(str)              { /* UTF-8 encode → WASM heap */ }
function readString(ptr)               { /* null-terminated C string → JS string */ }
```

#### 9.5 — Module Declaration (`raylib.nbm`)

The `.nbm` file declares every type, function, and constant.

**Types (~30):**

| Category | Types |
|---|---|
| Math | Vector2, Vector3, Vector4, Matrix |
| Color / Shape | Color, Rectangle |
| Camera | Camera2D, Camera3D |
| Texture | Image, Texture, RenderTexture, NPatchInfo |
| Text | Font, GlyphInfo |
| Audio | Wave, Sound, Music, AudioStream |
| 3D | Ray, RayCollision, BoundingBox, Mesh, Material, Model, ModelAnimation, Transform, Shader, BoneInfo |

**Functions (~450) by category:**

| Category | ~Count | Key examples |
|---|---|---|
| Window management | 45 | InitWindow, CloseWindow, WindowShouldClose, SetWindowTitle, GetScreenWidth |
| Cursor | 6 | ShowCursor, HideCursor, IsCursorHidden, EnableCursor, DisableCursor |
| Drawing control | 15 | ClearBackground, BeginDrawing, EndDrawing, BeginMode2D, EndMode2D, BeginMode3D |
| Timing | 4 | SetTargetFPS, GetFPS, GetFrameTime, GetTime |
| Configuration | 6 | SetConfigFlags, SetTraceLogLevel, TakeScreenshot, OpenURL |
| Input: Keyboard | 7 | IsKeyPressed, IsKeyDown, IsKeyReleased, IsKeyUp, GetKeyPressed, GetCharPressed |
| Input: Mouse | 14 | IsMouseButtonPressed, GetMousePosition, GetMouseDelta, SetMousePosition, GetMouseWheelMove |
| Input: Gamepad | 9 | IsGamepadAvailable, IsGamepadButtonPressed, GetGamepadAxisMovement |
| Input: Touch | 5 | GetTouchX, GetTouchY, GetTouchPosition, GetTouchPointCount |
| Shapes | 45 | DrawPixel, DrawLine, DrawCircle, DrawRectangle, DrawTriangle, DrawPoly, DrawRing |
| Collision (2D) | 10 | CheckCollisionRecs, CheckCollisionCircles, CheckCollisionCircleRec, GetCollisionRec |
| Image / Texture loading | 25 | LoadImage, LoadTexture, UnloadTexture, GenImageColor, ExportImage |
| Image manipulation | 40 | ImageCopy, ImageResize, ImageFlipVertical, ImageDraw, ImageDrawText |
| Texture drawing | 6 | DrawTexture, DrawTextureRec, DrawTexturePro, DrawTextureNPatch |
| Texture config | 3 | GenTextureMipmaps, SetTextureFilter, SetTextureWrap |
| Font loading | 8 | GetFontDefault, LoadFont, LoadFontEx, UnloadFont |
| Text drawing | 6 | DrawFPS, DrawText, DrawTextEx, DrawTextPro |
| Text metrics / helpers | 15 | MeasureText, MeasureTextEx, TextSubtext, TextToUpper, TextToLower |
| 3D shapes | 20 | DrawCube, DrawSphere, DrawCylinder, DrawCapsule, DrawPlane, DrawGrid |
| Model loading | 5 | LoadModel, IsModelReady, UnloadModel, GetModelBoundingBox |
| Mesh generation | 15 | GenMeshPoly, GenMeshPlane, GenMeshCube, GenMeshSphere |
| Materials | 5 | LoadMaterialDefault, SetMaterialTexture, SetModelMeshMaterial |
| Model animation | 5 | LoadModelAnimations, UpdateModelAnimation, IsModelAnimationValid |
| 3D collision | 8 | CheckCollisionSpheres, GetRayCollisionSphere, GetRayCollisionMesh |
| Audio device | 5 | InitAudioDevice, CloseAudioDevice, IsAudioDeviceReady, SetMasterVolume |
| Sound | 15 | LoadSound, PlaySound, StopSound, PauseSound, SetSoundVolume |
| Music | 15 | LoadMusicStream, PlayMusicStream, UpdateMusicStream, SetMusicVolume, GetMusicTimeLength |
| AudioStream | 12 | LoadAudioStream, PlayAudioStream, SetAudioStreamVolume |
| Color constants (zero-arg fns) | 26 | RED(), GREEN(), BLUE(), WHITE(), BLACK(), RAYWHITE(), LIGHTGRAY() |

**Constants (~230):**

| Category | ~Count | Examples |
|---|---|---|
| Keyboard keys | 110 | KEY_A = 65, KEY_SPACE = 32, KEY_ENTER = 257, KEY_ESCAPE = 256 |
| Mouse buttons | 7 | MOUSE_BUTTON_LEFT = 0, MOUSE_BUTTON_RIGHT = 1, MOUSE_BUTTON_MIDDLE = 2 |
| Gamepad buttons | 18 | GAMEPAD_BUTTON_LEFT_FACE_UP = 1, GAMEPAD_BUTTON_RIGHT_TRIGGER_2 = 17 |
| Gamepad axes | 6 | GAMEPAD_AXIS_LEFT_X = 0, GAMEPAD_AXIS_RIGHT_TRIGGER = 5 |
| Config flags | 16 | FLAG_VSYNC_HINT = 64, FLAG_FULLSCREEN_MODE = 2, FLAG_WINDOW_RESIZABLE = 4 |
| Texture filters | 6 | TEXTURE_FILTER_POINT = 0, TEXTURE_FILTER_BILINEAR = 1 |
| Texture wrap modes | 4 | TEXTURE_WRAP_REPEAT = 0, TEXTURE_WRAP_CLAMP = 1 |
| Blend modes | 8 | BLEND_ALPHA = 0, BLEND_ADDITIVE = 1, BLEND_MULTIPLIED = 2 |
| Camera modes | 5 | CAMERA_CUSTOM = 0, CAMERA_FREE = 1, CAMERA_FIRST_PERSON = 3 |
| Camera projections | 2 | CAMERA_PERSPECTIVE = 0, CAMERA_ORTHOGRAPHIC = 1 |
| Gestures | 11 | GESTURE_NONE = 0, GESTURE_TAP = 1, GESTURE_SWIPE_RIGHT = 64 |
| Mouse cursors | 10 | MOUSE_CURSOR_DEFAULT = 0, MOUSE_CURSOR_CROSSHAIR = 3 |
| Pixel formats | 20 | PIXELFORMAT_UNCOMPRESSED_GRAYSCALE = 1 |
| Log levels | 8 | LOG_ALL = 0, LOG_TRACE = 1, LOG_NONE = 7 |

#### 9.6 — Testing Strategy

- **Infrastructure unit tests:**
  - `.nbm` Type parsing (module-loader test)
  - Async IIFE codegen wrapping (codegen test)
  - Module type registration in checker (checker test)
- **Integration tests:**
  - Compile a program that imports raylib and uses basic types/functions
  - Verify compiled output structure (async IIFE wrapper, `await`, type factories)
- **Raylib-specific tests (require WASM build):**
  - Struct marshaling round-trip correctness
  - Window creation / basic drawing (may need headless or mock)

#### 9.7 — Example

`examples/raylib-hello.nb`:
```basic
Import "raylib"

InitWindow(800, 450, "NeoBasic — Raylib Example")
SetTargetFPS(60)

While Not WindowShouldClose()
  BeginDrawing()
  ClearBackground(RAYWHITE())
  DrawText("Hello from NeoBasic!", 190, 200, 20, DARKGRAY())
  EndDrawing()
EndWhile

CloseWindow()
```

#### 9.8 — Documentation

- Update `README.md` with Raylib module reference
- Document WASM build process for contributors
- Add the example above to `examples/`

### Phase 10 — Library API

**Goal:** Allow NeoBasic to be used as a Node.js library without being published to npm, installable directly from GitHub.

**Changes:**

- **`package.json`** — added `"prepare": "npm run build"` script. npm runs `prepare` automatically after `npm install github:…`, which builds `dist/` from source. This is needed because `dist/` is gitignored.

- **`src/compiler.ts`** — added `compileSource(source: string, options?: CompileSourceOptions): string`:
  - Takes a NeoBasic source string, returns compiled JavaScript string.
  - Does **not** support `Include` (throws a clear error if encountered — use `compile()` for file-based workflows with includes).
  - Accepts `CompileSourceOptions.cwd` for module resolution (defaults to `process.cwd()`).
  - Uses the same module resolution and pipeline as `compile()`.
  - `core` is always resolved from the package install directory; no configuration needed for built-in modules.

- **`README.md`** — added "Using NeoBasic as a library" section documenting:
  - GitHub install command
  - `compileSource()` high-level API
  - `compile()` for file-based use
  - Step-by-step individual phase usage (lex → parse → check → generate)
  - Module resolution behaviour

### Phase 11 — QuickJS Support

**Goal:** Allow `neobasic` to run under [QuickJS](https://bellard.org/quickjs/) as a self-contained CLI binary.

**Why a separate bundle:** The standard `dist/neobasic.js` is built with `--platform node`, leaving `node:fs`, `node:path`, `node:os`, `node:url` as static ESM imports. QuickJS cannot resolve these. Setting `globalThis` polyfills before the bundle loads does not help — static module imports are resolved before any user code runs. The solution is to replace the Node.js module imports at bundle time using esbuild's `--alias` option.

**Changes:**

- **`src/shims/qjs-*.js`** — Five shim files that substitute Node.js built-ins with QuickJS equivalents:
  - `qjs-fs.js`: `existsSync` / `readFileSync` / `writeFileSync` via QuickJS `std.open`, `std.loadFile`, `os.stat`
  - `qjs-path.js`: `join` / `dirname` / `resolve` / `parse` / `basename` in pure JS; normalises `\` → `/`; resolves `..` segments correctly (Node's `path.join` normalises `..`, unlike a naive concatenation)
  - `qjs-os.js`: `homedir` via `std.getenv("HOME")` / `USERPROFILE`
  - `qjs-url.js`: `fileURLToPath` strips `file:///` prefix (handles Windows `file:///C:/...` form)
  - `qjs-process.js`: injected as a global via esbuild `--inject`; provides `process.argv` (from `scriptArgs`, shifted to match Node's `.slice(2)` convention), `process.cwd()`, and `process.exit()`; also polyfills `console.error` / `console.warn` (QuickJS only guarantees `console.log`)

- **`src/modules/module-loader.ts`** — search path for the package's own `neo_mods/` now tries **both** `../neo_mods` and `../../neo_mods` relative to `import.meta.url`. This handles: single-file bundle at `dist/neobasic-qjs.js` (one level up) and the standard multi-file build at `dist/modules/module-loader.js` (two levels up).

- **`src/cli.ts`** — changed `→` to `->` in the compilation success message. QuickJS on Windows outputs UTF-8 but the default Windows console interprets it as CP1252, garbling the arrow.

- **`package.json`** — added `"bundle:qjs"` script:
  ```
  esbuild src/cli.ts --bundle --minify --format=esm
    --alias:node:fs=./src/shims/qjs-fs.js
    --alias:node:path=./src/shims/qjs-path.js
    --alias:node:os=./src/shims/qjs-os.js
    --alias:node:url=./src/shims/qjs-url.js
    --inject:src/shims/qjs-process.js
    --external:std --external:os
    --outfile=dist/neobasic-qjs.js
  ```
  `std` and `os` are kept external so QuickJS resolves them as built-in modules at runtime.

**Usage:**
```sh
npm run bundle:qjs
qjs dist/neobasic-qjs.js compile myprogram.nb
```

## Bundled modules

### `core`

Located at `neo_mods/core/`. Automatically imported — no `Import` statement needed.

#### IO

| Function | Signature | Description |
|---|---|---|
| `Input` | `(prompt As String) As String` | Print `prompt` and read a line from stdin (Node: `fs.readSync`; QJS `--std`: `std.in.readline`; Browser: logs a warning and returns `""`) |
| `LoadString` | `(filename As String) As String` | Read file to string (Node: `fs.readFileSync`, returns `""` on error; QJS `--std`: `std.loadFile`; Browser: `localStorage.getItem`) |
| `Print` | `(message As String)` | Print a line to stdout |
| `SaveString` | `(filename As String, str As String, append As Bool)` | Write/append string to file (Node: `writeFileSync`/`appendFileSync`; QJS `--std`: `std.open`; Browser: `localStorage.setItem`) |

#### Math

All math functions take and return `Float`.

| Function | Signature | Description |
|---|---|---|
| `Abs` | `(x As Float) As Float` | Absolute value |
| `ACos` | `(x As Float) As Float` | Arccosine (radians) |
| `ACosDeg` | `(x As Float) As Float` | Arccosine (degrees) |
| `ASin` | `(x As Float) As Float` | Arcsine (radians) |
| `ASinDeg` | `(x As Float) As Float` | Arcsine (degrees) |
| `ATan` | `(x As Float) As Float` | Arctangent (radians) |
| `ATan2` | `(y As Float, x As Float) As Float` | Two-argument arctangent (radians) |
| `ATan2Deg` | `(y As Float, x As Float) As Float` | Two-argument arctangent (degrees) |
| `ATanDeg` | `(x As Float) As Float` | Arctangent (degrees) |
| `Ceil` | `(x As Float) As Float` | Ceiling |
| `Clamp` | `(x As Float, min As Float, max As Float) As Float` | Clamp x between min and max |
| `Cos` | `(x As Float) As Float` | Cosine (radians) |
| `CosDeg` | `(x As Float) As Float` | Cosine (degrees) |
| `Exp` | `(x As Float) As Float` | e^x |
| `Floor` | `(x As Float) As Float` | Floor |
| `Log` | `(x As Float) As Float` | Natural logarithm |
| `Max` | `(a As Float, b As Float) As Float` | Maximum of two values |
| `Min` | `(a As Float, b As Float) As Float` | Minimum of two values |
| `Pow` | `(x As Float, y As Float) As Float` | x raised to power y |
| `Sgn` | `(x As Float) As Float` | Sign: -1, 0, or 1 |
| `Sin` | `(x As Float) As Float` | Sine (radians) |
| `SinDeg` | `(x As Float) As Float` | Sine (degrees) |
| `Sqrt` | `(x As Float) As Float` | Square root |
| `Tan` | `(x As Float) As Float` | Tangent (radians) |
| `TanDeg` | `(x As Float) As Float` | Tangent (degrees) |

#### String

| Function | Signature | Description |
|---|---|---|
| `Asc` | `(str As String, index As Int) As Int` | Char code at 0-based index |
| `Chr` | `(code As Int) As String` | Char from char code |
| `ExtractDir` | `(filename As String) As String` | Directory portion with trailing separator, `""` if none |
| `ExtractExt` | `(filename As String) As String` | Extension without dot; `""` if none or dotfile |
| `Find` | `(str As String, find As String, offset As Int) As Int` | 0-based indexOf, `-1` if not found |
| `Join` | `(list As String[], separator As String) As String` | Join array with separator |
| `Left` | `(str As String, count As Int) As String` | First `count` characters |
| `Len` | `(str As String) As Int` | String length |
| `Lower` | `(str As String) As String` | Convert to lowercase |
| `Mid` | `(str As String, offset As Int, count As Int) As String` | Substring (0-based offset, length count) |
| `Replace` | `(str As String, find As String, rep As String) As String` | Replace all occurrences |
| `Right` | `(str As String, count As Int) As String` | Last `count` characters |
| `Split` | `(str As String, separator As String) As String[]` | Split string into array |
| `Str` | `(val As Int) As String` | Convert Int to String |
| `StrF` | `(val As Float) As String` | Convert Float to String |
| `StripDir` | `(filename As String) As String` | Filename without directory |
| `StripExt` | `(filename As String) As String` | Filename without extension (dotfiles unchanged) |
| `Trim` | `(str As String) As String` | Remove leading/trailing whitespace |
| `Upper` | `(str As String) As String` | Convert to uppercase |
| `Val` | `(s As String) As Int` | Parse String to Int |
| `ValF` | `(s As String) As Float` | Parse String to Float |

### `raylib`

Located at `neo_mods/raylib/`. Provides full access to the [Raylib](https://www.raylib.com/) game development library via WebAssembly.

Usage: `Import "raylib"` at the top of a `.nb` file.

See Phase 9 for full implementation details.

## Examples

`examples/hello.nb` — demonstrates `Print`, `Str`, `StrF`, and `Val` via a factorial calculation and basic arithmetic.

`examples/raylib-hello.nb` — demonstrates a basic Raylib window with text rendering.

## Out of scope (for now)
- Source maps
- REPL
- Watch mode
