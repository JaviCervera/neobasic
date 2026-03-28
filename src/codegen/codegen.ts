import {
  Program, Stmt, Expr, TypeAnnotation,
} from "../parser/ast.js";
import { CheckResult } from "../checker/checker.js";
import { NbType } from "../checker/types.js";

export interface CodegenOptions {
  /** Module name → JS source, inlined as an IIFE in the generated output. */
  moduleContents?: Map<string, string>;
  /** Module names that require async initialisation (WASM etc.). */
  asyncModules?: Set<string>;
  /** Wrap entire output in an async IIFE to support top-level await. */
  async?: boolean;
  /** Additional type definitions from modules (name → fields), emitted as type factories. */
  moduleTypes?: Map<string, { fields: { name: string; type: NbType }[] }>;
}

export function generate(program: Program, checkResult: CheckResult, options?: CodegenOptions): string {
  const lines: string[] = [];
  let indent = 0;
  const env = checkResult.env;
  const exprTypes = checkResult.exprTypes;

  // Tracks variable names that have been declared with let/const in the current scope,
  // so that type-inferred assignments (VarAssign) emit `let` only on first use.
  let declaredVars = new Set<string>();

  // Collect all top-level (global) variable names so that assignments to globals
  // inside functions don't emit a spurious `let` (which would create a local shadow).
  const globalVars = new Set<string>();
  for (const stmt of program.statements) {
    if (stmt.kind === "VarDecl" || stmt.kind === "VarAssign" || stmt.kind === "ConstDecl") {
      globalVars.add(id(stmt.name));
    }
  }

  function emit(line: string): void {
    lines.push("  ".repeat(indent) + line);
  }

  function emitRaw(line: string): void {
    lines.push(line);
  }

  function id(name: string): string {
    return name.toLowerCase();
  }

  // ── Async wrapper (if needed) ────────────────────────────────

  const needsAsync = options?.async ?? false;
  if (needsAsync) {
    emit("(async () => {");
    indent++;
  }

  // ── Module imports ──────────────────────────────────────────

  if (options?.moduleContents && options.moduleContents.size > 0) {
    const asyncModules = options.asyncModules ?? new Set<string>();
    for (const [moduleName, jsSource] of options.moduleContents) {
      const isAsyncModule = asyncModules.has(moduleName);
      if (isAsyncModule) {
        emit(`const ${id(moduleName)} = await (async () => {`);
      } else {
        emit(`const ${id(moduleName)} = (() => {`);
      }
      indent++;
      emit("const module = { exports: {} };");
      for (const line of jsSource.trimEnd().split("\n")) {
        emitRaw(line.length > 0 ? `${"  ".repeat(indent)}${line}` : "");
      }
      emit("return module.exports;");
      indent--;
      emit("})();");
    }
    emitRaw("");
  }

  // ── Type factories ────────────────────────────────────────

  // Module-provided types
  if (options?.moduleTypes) {
    for (const [typeName, typeDef] of options.moduleTypes) {
      const name = id(typeName);
      emit(`function ${name}$$new() {`);
      indent++;
      emit("return {");
      indent++;
      for (const field of typeDef.fields) {
        emit(`${id(field.name)}: ${defaultValueFor(field.type)},`);
      }
      indent--;
      emit("};");
      indent--;
      emit("}");
      emitRaw("");
    }
  }

  // User-defined types
  for (const stmt of program.statements) {
    if (stmt.kind === "TypeDecl") {
      emitTypeFactory(stmt);
      emitRaw("");
    }
  }

  // ── Statements ────────────────────────────────────────────

  for (const stmt of program.statements) {
    if (stmt.kind === "TypeDecl") continue; // Already emitted
    emitStmt(stmt);
  }

  function emitTypeFactory(stmt: Stmt & { kind: "TypeDecl" }): void {
    const name = id(stmt.name);
    emit(`function ${name}$$new() {`);
    indent++;
    emit("return {");
    indent++;
    for (const field of stmt.fields) {
      const typeDecl = env.types.get(name);
      const fieldDef = typeDecl?.fields.find(f => f.name.toLowerCase() === field.name.toLowerCase());
      const defaultVal = fieldDef ? defaultValueFor(fieldDef.type) : "null";
      emit(`${id(field.name)}: ${defaultVal},`);
    }
    indent--;
    emit("};");
    indent--;
    emit("}");
  }

  function defaultValueFor(t: NbType): string {
    switch (t.kind) {
      case "Int": return "0";
      case "Float": return "0.0";
      case "String": return '""';
      case "Bool": return "false";
      case "Array": return "[]";
      case "UDT": return "null";
      case "Null": return "null";
      case "Void": return "undefined";
    }
  }

  function emitStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case "VarDecl": {
        const init = stmt.initializer ? emitExpr(stmt.initializer) : defaultValueForAnnotation(stmt.typeAnnotation);
        declaredVars.add(id(stmt.name));
        emit(`let ${id(stmt.name)} = ${init};`);
        break;
      }

      case "VarAssign": {
        const varName = id(stmt.name);
        if (!declaredVars.has(varName)) {
          declaredVars.add(varName);
          emit(`let ${varName} = ${emitExpr(stmt.value)};`);
        } else {
          emit(`${varName} = ${emitExpr(stmt.value)};`);
        }
        break;
      }

      case "IndexAssign": {
        emit(`${emitExpr(stmt.object)}[${emitExpr(stmt.index)}] = ${emitExpr(stmt.value)};`);
        break;
      }

      case "MemberAssign": {
        const obj = emitExpr(stmt.object);
        const member = stmt.member.toLowerCase();
        // Special: array.Length setter
        if (member === "length") {
          const objType = exprTypes.get(stmt.object);
          if (objType?.kind === "Array") {
            emit(`${obj}.length = (${emitExpr(stmt.value)}) + 1;`);
            break;
          }
        }
        emit(`${obj}.${member} = ${emitExpr(stmt.value)};`);
        break;
      }

      case "ConstDecl": {
        declaredVars.add(id(stmt.name));
        emit(`const ${id(stmt.name)} = ${emitExpr(stmt.value)};`);
        break;
      }

      case "IfStmt": {
        emit(`if (${emitExpr(stmt.condition)}) {`);
        indent++;
        for (const s of stmt.body) emitStmt(s);
        indent--;
        for (const eif of stmt.elseIfs) {
          emit(`} else if (${emitExpr(eif.condition)}) {`);
          indent++;
          for (const s of eif.body) emitStmt(s);
          indent--;
        }
        if (stmt.elseBody.length > 0) {
          emit("} else {");
          indent++;
          for (const s of stmt.elseBody) emitStmt(s);
          indent--;
        }
        emit("}");
        break;
      }

      case "SelectStmt": {
        // Emit as if/else chain since Select doesn't fall through
        const exprCode = emitExpr(stmt.expr);
        const tempVar = `__sel_${stmt.line}_${stmt.col}`;
        emit(`const ${tempVar} = ${exprCode};`);
        let first = true;
        for (const c of stmt.cases) {
          const conditions = c.values.map(v => `${tempVar} === ${emitExpr(v)}`).join(" || ");
          emit(`${first ? "if" : "} else if"} (${conditions}) {`);
          indent++;
          for (const s of c.body) emitStmt(s);
          indent--;
          first = false;
        }
        if (stmt.defaultBody.length > 0) {
          emit("} else {");
          indent++;
          for (const s of stmt.defaultBody) emitStmt(s);
          indent--;
        }
        if (stmt.cases.length > 0 || stmt.defaultBody.length > 0) {
          emit("}");
        }
        break;
      }

      case "ForStmt": {
        const varName = id(stmt.variable);
        const start = emitExpr(stmt.start);
        const end = emitExpr(stmt.end);
        if (stmt.step) {
          const step = emitExpr(stmt.step);
          emit(`for (let ${varName} = ${start}; ${step} > 0 ? ${varName} <= ${end} : ${varName} >= ${end}; ${varName} += ${step}) {`);
        } else {
          emit(`for (let ${varName} = ${start}; ${varName} <= ${end}; ${varName}++) {`);
        }
        indent++;
        for (const s of stmt.body) emitStmt(s);
        indent--;
        emit("}");
        break;
      }

      case "ForInStmt": {
        emit(`for (const ${id(stmt.variable)} of ${emitExpr(stmt.iterable)}) {`);
        indent++;
        for (const s of stmt.body) emitStmt(s);
        indent--;
        emit("}");
        break;
      }

      case "WhileStmt": {
        emit(`while (${emitExpr(stmt.condition)}) {`);
        indent++;
        for (const s of stmt.body) emitStmt(s);
        indent--;
        emit("}");
        break;
      }

      case "DoLoopStmt": {
        emit("while (true) {");
        indent++;
        for (const s of stmt.body) emitStmt(s);
        indent--;
        emit("}");
        break;
      }

      case "RepeatUntilStmt": {
        emit("do {");
        indent++;
        for (const s of stmt.body) emitStmt(s);
        indent--;
        emit(`} while (!(${emitExpr(stmt.condition)}));`);
        break;
      }

      case "FunctionDecl": {
        const params = stmt.params.map(p => id(p.name)).join(", ");
        emit(`function ${id(stmt.name)}(${params}) {`);
        indent++;
        const outerDeclaredVars = declaredVars;
        // Start with all globals + params so that assignments to global variables
        // inside this function emit bare assignment (not `let`).
        declaredVars = new Set([...globalVars, ...stmt.params.map(p => id(p.name))]);
        for (const s of stmt.body) emitStmt(s);
        declaredVars = outerDeclaredVars;
        indent--;
        emit("}");
        emitRaw("");
        break;
      }

      case "TypeDecl": {
        // Already handled at the top
        break;
      }

      case "ReturnStmt": {
        if (stmt.value) {
          emit(`return ${emitExpr(stmt.value)};`);
        } else {
          emit("return;");
        }
        break;
      }

      case "ContinueStmt": {
        emit("continue;");
        break;
      }

      case "ExitStmt": {
        emit("break;");
        break;
      }

      case "ExprStmt": {
        emit(`${emitExpr(stmt.expr)};`);
        break;
      }

      case "IncludeStmt":
      case "ImportStmt":
        // Handled by the compiler orchestrator
        break;
    }
  }

  function emitExpr(expr: Expr): string {
    switch (expr.kind) {
      case "IntLiteral":
        return String(expr.value);
      case "FloatLiteral":
        return String(expr.value);
      case "StringLiteral":
        return JSON.stringify(expr.value);
      case "BoolLiteral":
        return expr.value ? "true" : "false";
      case "NullLiteral":
        return "null";

      case "Identifier":
        return id(expr.name);

      case "BinaryExpr": {
        const left = emitExpr(expr.left);
        const right = emitExpr(expr.right);

        // Int / Int → Math.trunc
        if (expr.op === "/") {
          const lt = exprTypes.get(expr.left);
          const rt = exprTypes.get(expr.right);
          if (lt?.kind === "Int" && rt?.kind === "Int") {
            return `Math.trunc(${left} / ${right})`;
          }
        }

        const opMap: Record<string, string> = {
          "+": "+", "-": "-", "*": "*", "/": "/",
          "Mod": "%",
          "==": "===", "<>": "!==",
          "<": "<", ">": ">", "<=": "<=", ">=": ">=",
          "And": "&&", "Or": "||",
        };

        return `(${left} ${opMap[expr.op]} ${right})`;
      }

      case "UnaryExpr": {
        const operand = emitExpr(expr.operand);
        if (expr.op === "Not") return `(!${operand})`;
        return `(-${operand})`;
      }

      case "CallExpr": {
        const callee = id(expr.callee);
        const func = env.funcs.get(callee);
        // If it's an external module function, use the module prefix
        if (func?.isExternal && func.externalName) {
          const args = expr.args.map(a => emitExpr(a)).join(", ");
          const call = `${func.externalName}(${args})`;
          if (needsAsync && func.isAsync) {
            return `await ${call}`;
          }
          return call;
        }
        const args = expr.args.map(a => emitExpr(a)).join(", ");
        return `${callee}(${args})`;
      }

      case "IndexExpr":
        return `${emitExpr(expr.object)}[${emitExpr(expr.index)}]`;

      case "MemberExpr": {
        const obj = emitExpr(expr.object);
        const member = expr.member.toLowerCase();
        // Special: array.Length → (arr.length - 1)
        if (member === "length") {
          const objType = exprTypes.get(expr.object);
          if (objType?.kind === "Array") {
            return `(${obj}.length - 1)`;
          }
        }
        return `${obj}.${member}`;
      }

      case "NewExpr":
        return `${id(expr.typeName)}$$new()`;

      case "ArrayLiteral": {
        const elems = expr.elements.map(e => emitExpr(e)).join(", ");
        return `[${elems}]`;
      }
    }
  }

  function defaultValueForAnnotation(ta: TypeAnnotation | null): string {
    if (!ta) return "null";
    if (ta.kind === "ArrayType") return "[]";
    switch (ta.name.toLowerCase()) {
      case "int": return "0";
      case "float": return "0.0";
      case "string": return '""';
      case "bool": return "false";
      default: return "null"; // UDT
    }
  }

  // ── Close async wrapper ─────────────────────────────────────

  if (needsAsync) {
    indent--;
    emit("})();");
  }

  return lines.join("\n") + "\n";
}
