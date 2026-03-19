# NeoBasic Compiler — Implementation Plan

## Summary

NeoBasic is a structured BASIC-like language (`.nb` files) that transpiles to JavaScript. The compiler is written in **idiomatic TypeScript (strict mode)** and distributed as a **CLI tool** (`neobasic compile input.nb`). Output JS runs in Node or a browser.

## Key Design Decisions

| Topic | Decision |
|---|---|
| Integer division | `Int / Int` truncates to `Int` |
| `=` vs `==` | `=` is always assignment; `==` is always equality |
| Variable scoping | Function-scoped |
| Standard library | A bundled `core` module provides `Print`, `Str`, `StrF`, `Val`, `ValF` |
| Testing framework | Vitest |
| Output | Single `.js` file next to the source (or via `-o` flag) |

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
  errors.ts         Diagnostic error types (with source location)
  compiler.ts       Orchestrates all phases; public API
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

## Bundled modules

### `core`

Located at `neo_mods/core/`. Provides essential I/O and conversion functions:

| Function | Signature | Description |
|---|---|---|
| `Print` | `(message As String)` | Print a line to stdout |
| `Str` | `(val As Int) As String` | Convert Int to String |
| `StrF` | `(val As Float) As String` | Convert Float to String |
| `Val` | `(s As String) As Int` | Parse String to Int |
| `ValF` | `(s As String) As Float` | Parse String to Float |

Usage: `Import "core"` at the top of a `.nb` file.

## Examples

`examples/hello.nb` — demonstrates `Print`, `Str`, `StrF`, and `Val` via a factorial calculation and basic arithmetic.

## Out of scope (for now)
- Source maps
- REPL
- Watch mode
