# NeoBasic

NeoBasic is a structured, BASIC-like programming language inspired by [Blitz3D](https://en.wikipedia.org/wiki/Blitz_BASIC). It transpiles to JavaScript and can target both Node.js and web browsers.

The compiler is written in idiomatic TypeScript (strict mode) and distributed as a CLI tool.

## How it was made

This project was built with [GitHub Copilot](https://github.com/features/copilot):

- **Planning phase** — the implementation plan and architecture were designed using the **Claude Sonnet 4.6** model.
- **Implementation phase** — all source code, tests, and documentation were written using the **Claude Opus 4.6** model.

## Requirements

- **Node.js** ≥ 18
- **npm** ≥ 9

## Getting started

### Install dependencies

```bash
npm install
```

### Build the compiler

```bash
npm run build
```

This compiles the TypeScript source in `src/` to JavaScript in `dist/`.

### Run the tests

```bash
npm test
```

### Compile a NeoBasic program

```bash
node dist/cli.js compile myprogram.nb
```

This produces a single self-contained `myprogram.js` in the same directory — all imported modules are inlined into the output, so you can copy it anywhere and run it without needing any companion files.

You can specify a different output path with `-o`:

```bash
node dist/cli.js compile myprogram.nb -o output/myprogram.js
```

Then run the output with Node:

```bash
node myprogram.js
```

### Run the Hello World example

```bash
node dist/cli.js compile examples/hello.nb
node examples/hello.js
```

### Global installation (optional)

After building, you can link the CLI globally:

```bash
npm link
neobasic compile myprogram.nb
```

## Architecture

The compiler is a classic multi-phase pipeline:

```
Source (.nb) → Lexer → Parser → Type Checker → Code Generator → Output (.js)
```

| Phase | Directory | Description |
|---|---|---|
| Lexer | `src/lexer/` | Tokenises source into a flat token stream |
| Parser | `src/parser/` | Builds a typed AST via recursive descent |
| Type Checker | `src/checker/` | Name resolution, type inference, validation |
| Code Generator | `src/codegen/` | Walks the annotated AST and emits JavaScript |
| Module Loader | `src/modules/` | Resolves `.nbm` module declarations |
| Compiler | `src/compiler.ts` | Orchestrates all phases |
| CLI | `src/cli.ts` | Command-line entry point |

---

## Language Reference

### General

- NeoBasic source files use the **`.nb`** extension.
- The language is **not case sensitive** — `If`, `IF`, and `if` are all equivalent.
- **Newlines** act as statement separators. The **colon** (`:`) can also be used to separate multiple statements on a single line.

### Comments

```basic
'This comment continues until the end of the line

/*
  This is a multiline comment,
  which /* can have others nested inside */
*/
```

Block comments support nesting.

### Data types

NeoBasic has four built-in types:

| Type | Example values | Default |
|---|---|---|
| `Int` | `15`, `0`, `-165000` | `0` |
| `Float` | `15.25`, `0.0`, `-12345.6789` | `0.0` |
| `String` | `"hello, world"`, `"25"` | `""` |
| `Bool` | `True`, `False` | `False` |

Additionally, you can define your own types (see [User-defined types](#user-defined-types)).

### Variables

Variables are declared by assignment. The type is inferred from the value:

```basic
a = 25              'Type inferred to be Int
b As Float = 162.36 'Explicit type annotation
c As String = "hello"
d As Int = 0
```

You can omit the type and it will be inferred, with one exception — you cannot infer a type from `Null`:

```basic
a = Null             'Error: Cannot infer type from Null
a As Person = Null   'OK — type is explicit
```

Once declared, the type of a variable **cannot change**:

```basic
a = "hello"  'a is a String
a = 5        'Error: Can't assign Int to String
```

Variables are **function-scoped** — a variable declared anywhere inside a function is visible throughout the entire function.

### Constants

```basic
Const HELLO = "hello"
```

Constants cannot be reassigned after declaration.

### Arrays

```basic
arr As Int[10]    'Array of 11 ints (indexed 0 to 10)
arr2 As String[]  'Empty string array
```

You can read or modify the length:

```basic
arr.Length         'Returns 10
arr.Length = 20
arr.Length         'Returns 20
arr2.Length        'Returns -1
```

Arrays support **multiple dimensions** and **array literals**:

```basic
arr As Int[][] = [[1, 2, 3], [4, 5, 6]]
```

Use bracket notation to get and set elements:

```basic
arr[0]             'Returns [1, 2, 3]
arr[1] = [10, 20, 30]
```

Arrays are **homogeneous** (all elements must be the same type) and are always **passed by reference**. You cannot set an array to `Null`.

### User-defined types

```basic
Type Person
  Id As Int
  Name As String
  Height As Float
  Data As Int[3]
EndType
```

Variables of a user-defined type initially contain `Null`. Create a new instance with `New`:

```basic
p As Person = New Person
```

All fields are initialised to their default values (`0`, `0.0`, `""`, `Null`, or `[]`).

Read and write fields with dot syntax:

```basic
p.Name              'Returns "" (default)
p.Name = "John"
p.Name              'Returns "John"
```

### Expressions

#### Assignment

The `=` operator is used **only for assignment**:

```basic
a = 5  'Assign 5 to a
```

This differs from classic BASIC, where `=` serves double duty. In NeoBasic, use `==` for equality.

#### Arithmetic operators

```basic
3 + 4     '7
5 - 2     '3
7 * 3     '21
8 / 4     '2
3 Mod 2   '1
```

Integer division **truncates** — `7 / 2` produces `3`, not `3.5`. If either operand is a `Float`, the result is a `Float`.

#### Relational operators

```basic
10 == 10   'True
10 <> 5    'True  (not equal)
10 > 1     'True
10 < 1     'False
10 >= 10   'True
10 <= 9    'False
```

#### Boolean operators

```basic
If a == 1 And b == 2 Then c = 3
c = a Or b
a = True
Not a      'False
```

### Functions

Function parameter and return types must be explicitly declared:

```basic
Function HalfValue(value As Int) As Int
  Return value / 2
EndFunction
```

Call functions by name:

```basic
result = HalfValue(10)  'result is 5
```

Functions are **hoisted** — you can call a function before its declaration appears in the source.

### Conditions

#### Single-line If

When `Then` is used, the entire `If` statement must fit on one line:

```basic
If a > 5 Then Print("big")
If a > 5 Then Print("big") Else Print("small")
```

#### Multi-line If

```basic
If a > 5
  Print("a is bigger than 5")
Else
  Print("a is equal or smaller than 5")
EndIf
```

#### ElseIf

```basic
If a == 0
  Print("a is zero")
ElseIf a Mod 2 == 0
  Print("a is even")
Else
  Print("a is odd")
EndIf
```

#### Select

```basic
Select number
  Case 1
    Print("1")
  Case 2
    Print("2")
  Default
    Print("Other")
EndSelect
```

Cases **do not fall through** to the next case. `Default` is optional.

### Loops

#### Infinite loop

```basic
Do
  'Statements
Loop
```

#### While loop

```basic
a = 0
While a < 10
  a = a + 1
EndWhile
```

#### Repeat..Until loop

The condition is checked **after** each iteration:

```basic
a = 0
Repeat
  a = a + 1
Until a == 10
```

#### For loop

```basic
For i = 1 To 10
  Print(Str(i))
Next

For i = 10 To 1 Step -1
  Print(Str(i))
Next
```

#### For..In loop

```basic
For word In ["hello", "world"]
  Print(word)
Next
```

#### Loop control

- **`Continue`** — skip to the next iteration of the innermost loop.
- **`Exit`** — immediately leave the innermost loop.

### Including files

```basic
Include "file.nb"
```

`Include` statements must appear at the **top** of a file, before any other statements. Circular includes are detected and ignored.

### Modules

Modules let you call JavaScript functions from NeoBasic. A module consists of two files inside a `neo_mods/` directory:

#### Module declaration (`.nbm`)

Declare the NeoBasic signatures for your JavaScript functions, types, and constants:

```basic
'File: ext.nbm
Function Foo(a As String) = "foo"
Const VERSION = "1.0"

Type MyVec
  X As Float
  Y As Float
EndType
```

The string after `=` maps the NeoBasic name to the JavaScript function name.

Modules that require asynchronous initialisation (e.g. WASM) can declare `Async` at the top of the `.nbm` file. The compiled output will be wrapped in an async IIFE and the module loaded with `await`.

#### Module implementation (`.js`)

Provide the actual JavaScript implementation in a file with the same base name. Use `module.exports` to export the functions:

```javascript
// File: ext.js
function foo(a) {
  console.log(a);
}
module.exports = { foo };
```

By default the compiler inlines this file directly into the generated output (wrapped in an IIFE), so no separate deployment of the `.js` file is required.

#### Module directory structure

Place modules in a `neo_mods/` directory — either next to the compiler installation, in your home directory, or in your project's working directory:

```
neo_mods/
  ext/
    ext.nbm
    ext.js
```

#### Using a module

```basic
Import "ext"

Foo("hello from NeoBasic!")
```

### Core module

NeoBasic ships with a bundled `core` module that provides essential I/O and type-conversion functions. Import it with `Import "core"`.

| Function | Signature | Description |
|---|---|---|
| `Print` | `(message As String)` | Print `message` followed by a newline |
| `Str` | `(val As Int) As String` | Convert an `Int` to its string representation |
| `StrF` | `(val As Float) As String` | Convert a `Float` to its string representation |
| `Val` | `(s As String) As Int` | Parse a string as an `Int` (returns `0` on failure) |
| `ValF` | `(s As String) As Float` | Parse a string as a `Float` (returns `0.0` on failure) |

Example:

```basic
Import "core"

Print("Enter a number:")
n = Val("42")
Print("Double: " + Str(n * 2))
```

### Raylib module

NeoBasic includes a `raylib` module that provides bindings to the [Raylib](https://www.raylib.com/) game development library via WebAssembly. Import it with `Import "raylib"`.

The module exposes **27 types**, **383 functions**, and **250 constants** covering the full Raylib API:

| Category | Examples |
|---|---|
| Window management | `InitWindow`, `CloseWindow`, `WindowShouldClose`, `SetTargetFPS` |
| Drawing | `ClearBackground`, `BeginDrawing`, `EndDrawing` |
| Shapes | `DrawCircle`, `DrawRectangle`, `DrawLine`, `DrawTriangle`, `DrawPoly` |
| Input | `IsKeyPressed`, `IsMouseButtonDown`, `GetMousePosition` |
| Textures | `LoadTexture`, `DrawTexture`, `UnloadTexture` |
| Text / Fonts | `DrawText`, `LoadFont`, `MeasureText` |
| 3D | `DrawCube`, `DrawSphere`, `LoadModel`, `DrawGrid` |
| Audio | `LoadSound`, `PlaySound`, `LoadMusicStream` |
| Collision | `CheckCollisionRecs`, `CheckCollisionCircles`, `GetRayCollisionMesh` |

**Types** like `Color`, `Vector2`, `Vector3`, `Rectangle`, and `Camera2D` are mapped as NeoBasic UDTs — create them with `New` and access their fields directly.

**Predefined colors** are available as zero-argument functions: `RED()`, `GREEN()`, `BLUE()`, `WHITE()`, `BLACK()`, `RAYWHITE()`, etc.

**Keyboard/mouse/gamepad constants** are available directly: `KEY_A`, `KEY_SPACE`, `KEY_ESCAPE`, `MOUSE_BUTTON_LEFT`, etc.

Example:

```basic
Import "raylib"

InitWindow(800, 450, "NeoBasic — Raylib Example")
SetTargetFPS(60)

While Not WindowShouldClose()
  BeginDrawing()
  ClearBackground(RAYWHITE())
  DrawText("Hello from NeoBasic!", 190, 200, 20, DARKGRAY())
  DrawCircle(400, 300, 50.0, RED())
  EndDrawing()
EndWhile

CloseWindow()
```

> **Note:** The raylib module requires the WASM binary to be built from source using emscripten. See `neo_mods/raylib/build/` for instructions. The committed `raylib.js` currently contains stub wrappers — run the build script to produce the full WASM-backed implementation.

## License

See [LICENSE](LICENSE).
