import * as fs from "node:fs";
import * as path from "node:path";
import { lex } from "./lexer/index.js";
import { parse, Program, Stmt } from "./parser/index.js";
import { check, CheckResult, CheckerEnv, FuncSymbol, VarSymbol } from "./checker/index.js";
import { generate } from "./codegen/index.js";
import { resolveModule } from "./modules/index.js";
import { NeoBasicError } from "./errors.js";

export interface CompileOptions {
  /** Working directory for resolving includes and modules. Defaults to the source file's directory. */
  cwd?: string;
}

export interface CompileResult {
  js: string;
  env: CheckerEnv;
}

export function compile(sourceFile: string, options?: CompileOptions): CompileResult {
  const absPath = path.resolve(sourceFile);
  const cwd = options?.cwd ?? path.dirname(absPath);
  const source = fs.readFileSync(absPath, "utf-8");

  // 1. Lex + parse main file
  const tokens = lex(source, absPath);
  const mainAst = parse(tokens, absPath);

  // 2. Process includes (collect into a single AST)
  const included = new Set<string>([absPath]);
  const allStatements: Stmt[] = [];
  const importStmts: Stmt[] = [];

  function collectIncludes(stmts: Stmt[], fromFile: string): void {
    for (const stmt of stmts) {
      if (stmt.kind === "IncludeStmt") {
        const includePath = path.resolve(path.dirname(fromFile), stmt.path);
        if (included.has(includePath)) continue;
        included.add(includePath);

        if (!fs.existsSync(includePath)) {
          throw new NeoBasicError(`Included file not found: ${stmt.path}`, fromFile, stmt.line, stmt.col);
        }
        const inclSource = fs.readFileSync(includePath, "utf-8");
        const inclTokens = lex(inclSource, includePath);
        const inclAst = parse(inclTokens, includePath);
        collectIncludes(inclAst.statements, includePath);
      } else if (stmt.kind === "ImportStmt") {
        importStmts.push(stmt);
      } else {
        allStatements.push(stmt);
      }
    }
  }

  collectIncludes(mainAst.statements, absPath);

  // 3. Resolve modules
  const moduleContents = new Map<string, string>();
  const env: Partial<CheckerEnv> = {
    funcs: new Map<string, FuncSymbol>(),
    vars: new Map<string, VarSymbol>(),
  };

  for (const stmt of importStmts) {
    if (stmt.kind === "ImportStmt") {
      const moduleDef = resolveModule(stmt.moduleName, cwd);
      moduleContents.set(moduleDef.name, fs.readFileSync(moduleDef.jsPath, "utf-8"));

      // Register module functions
      for (const [name, func] of moduleDef.funcs) {
        env.funcs!.set(name, func);
      }

      // Register module constants
      for (const [name, constDef] of moduleDef.consts) {
        env.vars!.set(name, { type: constDef.type, isConst: true });
      }
    }
  }

  // 4. Type check
  const program: Program = { statements: allStatements };
  const checkResult = check(program, absPath, env);

  // 5. Generate JS
  const js = generate(program, checkResult, { moduleContents });

  return { js, env: checkResult.env };
}
