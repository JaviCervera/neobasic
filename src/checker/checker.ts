import { TypeError } from "../errors.js";
import {
  Program, Stmt, Expr, TypeAnnotation,
} from "../parser/ast.js";
import {
  NbType, INT, FLOAT, STRING, BOOL, NULL, VOID,
  arrayOf, udtOf, typeEquals, typeToString, isAssignable,
} from "./types.js";

// ── Symbol tables ───────────────────────────────────────────────

export interface VarSymbol {
  type: NbType;
  isConst: boolean;
}

export interface FuncSymbol {
  params: { name: string; type: NbType }[];
  returnType: NbType;
  isExternal: boolean;
  externalName?: string;
  /** True when the function returns a Promise and call sites must use await. */
  isAsync?: boolean;
}

export interface TypeDeclSymbol {
  fields: { name: string; type: NbType }[];
}

export interface CheckerEnv {
  vars: Map<string, VarSymbol>;
  funcs: Map<string, FuncSymbol>;
  types: Map<string, TypeDeclSymbol>;
  modules: Map<string, string>; // module name → js file (set by module loader)
}

export interface CheckResult {
  env: CheckerEnv;
  /** Maps every AST expression node (by reference) to its resolved type */
  exprTypes: Map<Expr, NbType>;
}

// ── Checker ─────────────────────────────────────────────────────

export function check(
  program: Program,
  file = "<stdin>",
  env?: Partial<CheckerEnv>,
): CheckResult {
  const vars = new Map<string, VarSymbol>(env?.vars);
  const funcs = new Map<string, FuncSymbol>(env?.funcs);
  const types = new Map<string, TypeDeclSymbol>(env?.types);
  const modules = new Map<string, string>(env?.modules);
  const exprTypes = new Map<Expr, NbType>();

  // Current function context (for return type checking)
  let currentFuncReturnType: NbType | null = null;

  function err(msg: string, line: number, col: number): never {
    throw new TypeError(msg, file, line, col);
  }

  // ── Resolve type annotations to NbType ────────────────────

  function resolveTypeAnnotation(ta: TypeAnnotation): NbType {
    if (ta.kind === "ArrayType") {
      return arrayOf(resolveTypeAnnotation(ta.elementType));
    }
    const name = ta.name.toLowerCase();
    switch (name) {
      case "int": return INT;
      case "float": return FLOAT;
      case "string": return STRING;
      case "bool": return BOOL;
      default:
        if (!types.has(name)) {
          err(`Unknown type '${ta.name}'`, ta.line, ta.col);
        }
        return udtOf(name);
    }
  }

  // ── Check expressions ─────────────────────────────────────

  function checkExpr(expr: Expr): NbType {
    const t = checkExprInner(expr);
    exprTypes.set(expr, t);
    return t;
  }

  function checkExprInner(expr: Expr): NbType {
    switch (expr.kind) {
      case "IntLiteral": return INT;
      case "FloatLiteral": return FLOAT;
      case "StringLiteral": return STRING;
      case "BoolLiteral": return BOOL;
      case "NullLiteral": return NULL;

      case "Identifier": {
        const sym = vars.get(expr.name.toLowerCase());
        if (!sym) err(`Undefined variable '${expr.name}'`, expr.line, expr.col);
        return sym.type;
      }

      case "BinaryExpr": {
        const lt = checkExpr(expr.left);
        const rt = checkExpr(expr.right);

        // Boolean operators
        if (expr.op === "And" || expr.op === "Or") {
          if (lt.kind !== "Bool" && lt.kind !== "Int") {
            err(`Operator '${expr.op}' requires Bool or Int operands, got ${typeToString(lt)}`, expr.line, expr.col);
          }
          if (rt.kind !== "Bool" && rt.kind !== "Int") {
            err(`Operator '${expr.op}' requires Bool or Int operands, got ${typeToString(rt)}`, expr.line, expr.col);
          }
          return BOOL;
        }

        // String concatenation
        if (expr.op === "+") {
          if (lt.kind === "String" && rt.kind === "String") return STRING;
        }

        // Relational operators
        if (["==", "<>", "<", ">", "<=", ">="].includes(expr.op)) {
          // Allow comparing same types, or Int/Float mix
          if (
            typeEquals(lt, rt) ||
            (isNumeric(lt) && isNumeric(rt)) ||
            (lt.kind === "String" && rt.kind === "String") ||
            (lt.kind === "Null" || rt.kind === "Null")
          ) {
            return BOOL;
          }
          err(`Cannot compare ${typeToString(lt)} and ${typeToString(rt)}`, expr.line, expr.col);
        }

        // Arithmetic operators
        if (["+", "-", "*", "/", "Mod"].includes(expr.op)) {
          if (!isNumeric(lt)) err(`Operator '${expr.op}' requires numeric operands, got ${typeToString(lt)}`, expr.line, expr.col);
          if (!isNumeric(rt)) err(`Operator '${expr.op}' requires numeric operands, got ${typeToString(rt)}`, expr.line, expr.col);
          // Int / Int → Int (truncated), any Float → Float
          if (lt.kind === "Float" || rt.kind === "Float") return FLOAT;
          return INT;
        }

        return err(`Unknown operator '${expr.op}'`, expr.line, expr.col);
      }

      case "UnaryExpr": {
        const ot = checkExpr(expr.operand);
        if (expr.op === "-") {
          if (!isNumeric(ot)) err(`Unary '-' requires numeric operand, got ${typeToString(ot)}`, expr.line, expr.col);
          return ot;
        }
        if (expr.op === "Not") {
          if (ot.kind !== "Bool" && ot.kind !== "Int") {
            err(`'Not' requires Bool or Int operand, got ${typeToString(ot)}`, expr.line, expr.col);
          }
          return BOOL;
        }
        return err(`Unknown unary operator '${expr.op}'`, expr.line, expr.col);
      }

      case "CallExpr": {
        const funcName = expr.callee.toLowerCase();
        const func = funcs.get(funcName);
        if (!func) err(`Undefined function '${expr.callee}'`, expr.line, expr.col);
        if (expr.args.length !== func.params.length) {
          err(
            `Function '${expr.callee}' expects ${func.params.length} arguments, got ${expr.args.length}`,
            expr.line, expr.col,
          );
        }
        for (let i = 0; i < expr.args.length; i++) {
          const argType = checkExpr(expr.args[i]);
          const paramType = func.params[i].type;
          if (!isAssignable(argType, paramType)) {
            err(
              `Argument ${i + 1} of '${expr.callee}': cannot assign ${typeToString(argType)} to ${typeToString(paramType)}`,
              expr.args[i].line, expr.args[i].col,
            );
          }
        }
        return func.returnType;
      }

      case "IndexExpr": {
        const objType = checkExpr(expr.object);
        if (objType.kind !== "Array") {
          err(`Cannot index non-array type ${typeToString(objType)}`, expr.line, expr.col);
        }
        const idxType = checkExpr(expr.index);
        if (idxType.kind !== "Int") {
          err(`Array index must be Int, got ${typeToString(idxType)}`, expr.line, expr.col);
        }
        return objType.elementType;
      }

      case "MemberExpr": {
        const objType = checkExpr(expr.object);

        // Special: array.Length
        if (objType.kind === "Array" && expr.member.toLowerCase() === "length") {
          return INT;
        }

        if (objType.kind !== "UDT") {
          err(`Cannot access member '${expr.member}' on type ${typeToString(objType)}`, expr.line, expr.col);
        }

        const typeDecl = types.get(objType.name);
        if (!typeDecl) err(`Unknown type '${objType.name}'`, expr.line, expr.col);

        const field = typeDecl.fields.find(f => f.name.toLowerCase() === expr.member.toLowerCase());
        if (!field) {
          err(`Type '${objType.name}' has no field '${expr.member}'`, expr.line, expr.col);
        }
        return field.type;
      }

      case "NewExpr": {
        const tName = expr.typeName.toLowerCase();
        if (!types.has(tName)) {
          err(`Unknown type '${expr.typeName}'`, expr.line, expr.col);
        }
        return udtOf(tName);
      }

      case "ArrayLiteral": {
        if (expr.elements.length === 0) {
          // Empty array literal — type will be inferred from context
          return arrayOf(NULL);
        }
        const firstType = checkExpr(expr.elements[0]);
        for (let i = 1; i < expr.elements.length; i++) {
          const elemType = checkExpr(expr.elements[i]);
          if (!isAssignable(elemType, firstType)) {
            err(
              `Array literal: element ${i} has type ${typeToString(elemType)}, expected ${typeToString(firstType)}`,
              expr.elements[i].line, expr.elements[i].col,
            );
          }
        }
        return arrayOf(firstType);
      }
    }
  }

  // ── Check statements ──────────────────────────────────────

  function checkStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case "VarDecl": {
        const name = stmt.name.toLowerCase();
        if (vars.has(name) && !preRegisteredGlobals.has(name)) {
          err(`Variable '${stmt.name}' is already declared`, stmt.line, stmt.col);
        }
        preRegisteredGlobals.delete(name);
        let varType: NbType;
        if (stmt.typeAnnotation) {
          varType = resolveTypeAnnotation(stmt.typeAnnotation);
          if (stmt.initializer) {
            const initType = checkExpr(stmt.initializer);
            if (!isAssignable(initType, varType)) {
              err(
                `Cannot assign ${typeToString(initType)} to ${typeToString(varType)}`,
                stmt.line, stmt.col,
              );
            }
          }
        } else if (stmt.initializer) {
          varType = checkExpr(stmt.initializer);
          if (varType.kind === "Null") {
            err("Cannot infer type from Null", stmt.line, stmt.col);
          }
        } else {
          err("Variable declaration requires a type or initializer", stmt.line, stmt.col);
        }
        vars.set(name, { type: varType, isConst: false });
        break;
      }

      case "VarAssign": {
        const name = stmt.name.toLowerCase();
        const sym = vars.get(name);
        const valType = checkExpr(stmt.value);
        if (!sym) {
          // First assignment — implicit declaration (type inferred)
          if (valType.kind === "Null") {
            err("Cannot infer type from Null", stmt.line, stmt.col);
          }
          vars.set(name, { type: valType, isConst: false });
        } else {
          if (sym.isConst) {
            err(`Cannot assign to constant '${stmt.name}'`, stmt.line, stmt.col);
          }
          if (!isAssignable(valType, sym.type)) {
            err(
              `Cannot assign ${typeToString(valType)} to ${typeToString(sym.type)}`,
              stmt.line, stmt.col,
            );
          }
        }
        break;
      }

      case "IndexAssign": {
        const objType = checkExpr(stmt.object);
        if (objType.kind !== "Array") {
          err(`Cannot index non-array type ${typeToString(objType)}`, stmt.line, stmt.col);
        }
        const idxType = checkExpr(stmt.index);
        if (idxType.kind !== "Int") {
          err(`Array index must be Int, got ${typeToString(idxType)}`, stmt.line, stmt.col);
        }
        const valType = checkExpr(stmt.value);
        if (!isAssignable(valType, objType.elementType)) {
          err(
            `Cannot assign ${typeToString(valType)} to array element of type ${typeToString(objType.elementType)}`,
            stmt.line, stmt.col,
          );
        }
        break;
      }

      case "MemberAssign": {
        const objType = checkExpr(stmt.object);

        // Special: array.Length = value
        if (objType.kind === "Array" && stmt.member.toLowerCase() === "length") {
          const valType = checkExpr(stmt.value);
          if (valType.kind !== "Int") {
            err(`Array length must be Int, got ${typeToString(valType)}`, stmt.line, stmt.col);
          }
          break;
        }

        if (objType.kind !== "UDT") {
          err(`Cannot assign member '${stmt.member}' on type ${typeToString(objType)}`, stmt.line, stmt.col);
        }
        const typeDecl = types.get(objType.name);
        if (!typeDecl) err(`Unknown type '${objType.name}'`, stmt.line, stmt.col);
        const field = typeDecl.fields.find(f => f.name.toLowerCase() === stmt.member.toLowerCase());
        if (!field) {
          err(`Type '${objType.name}' has no field '${stmt.member}'`, stmt.line, stmt.col);
        }
        const valType = checkExpr(stmt.value);
        if (!isAssignable(valType, field.type)) {
          err(
            `Cannot assign ${typeToString(valType)} to field '${stmt.member}' of type ${typeToString(field.type)}`,
            stmt.line, stmt.col,
          );
        }
        break;
      }

      case "ConstDecl": {
        const name = stmt.name.toLowerCase();
        if (vars.has(name) && !preRegisteredGlobals.has(name)) {
          err(`Constant '${stmt.name}' is already declared`, stmt.line, stmt.col);
        }
        preRegisteredGlobals.delete(name);
        const valType = checkExpr(stmt.value);
        vars.set(name, { type: valType, isConst: true });
        break;
      }

      case "IfStmt": {
        checkExpr(stmt.condition);
        for (const s of stmt.body) checkStmt(s);
        for (const eif of stmt.elseIfs) {
          checkExpr(eif.condition);
          for (const s of eif.body) checkStmt(s);
        }
        for (const s of stmt.elseBody) checkStmt(s);
        break;
      }

      case "SelectStmt": {
        checkExpr(stmt.expr);
        for (const c of stmt.cases) {
          for (const v of c.values) checkExpr(v);
          for (const s of c.body) checkStmt(s);
        }
        for (const s of stmt.defaultBody) checkStmt(s);
        break;
      }

      case "ForStmt": {
        const startType = checkExpr(stmt.start);
        const endType = checkExpr(stmt.end);
        if (!isNumeric(startType) || !isNumeric(endType)) {
          err("For loop bounds must be numeric", stmt.line, stmt.col);
        }
        if (stmt.step) {
          const stepType = checkExpr(stmt.step);
          if (!isNumeric(stepType)) {
            err("For loop step must be numeric", stmt.line, stmt.col);
          }
        }
        const varName = stmt.variable.toLowerCase();
        vars.set(varName, { type: INT, isConst: false });
        for (const s of stmt.body) checkStmt(s);
        break;
      }

      case "ForInStmt": {
        const iterType = checkExpr(stmt.iterable);
        if (iterType.kind !== "Array") {
          err(`For..In requires an array, got ${typeToString(iterType)}`, stmt.line, stmt.col);
        }
        const varName = stmt.variable.toLowerCase();
        vars.set(varName, { type: iterType.elementType, isConst: false });
        for (const s of stmt.body) checkStmt(s);
        break;
      }

      case "WhileStmt": {
        checkExpr(stmt.condition);
        for (const s of stmt.body) checkStmt(s);
        break;
      }

      case "DoLoopStmt": {
        for (const s of stmt.body) checkStmt(s);
        break;
      }

      case "RepeatUntilStmt": {
        for (const s of stmt.body) checkStmt(s);
        checkExpr(stmt.condition);
        break;
      }

      case "FunctionDecl": {
        const funcName = stmt.name.toLowerCase();
        const params = stmt.params.map(p => ({
          name: p.name,
          type: resolveTypeAnnotation(p.typeAnnotation),
        }));
        const returnType = stmt.returnType ? resolveTypeAnnotation(stmt.returnType) : VOID;

        // Register function in global scope
        funcs.set(funcName, { params, returnType, isExternal: false });

        // Create a child scope for the function body
        const outerVars = new Map(vars);
        for (const param of params) {
          vars.set(param.name.toLowerCase(), { type: param.type, isConst: false });
        }

        const prevRetType = currentFuncReturnType;
        currentFuncReturnType = returnType;
        for (const s of stmt.body) checkStmt(s);
        currentFuncReturnType = prevRetType;

        // Restore outer scope (function-scoped: params don't leak)
        // Keep vars from function scope that were already in outer scope
        for (const [key] of vars) {
          if (!outerVars.has(key) && !params.some(p => p.name.toLowerCase() === key)) {
            // Variable declared inside function — don't leak
          }
        }
        // Restore original vars
        vars.clear();
        for (const [k, v] of outerVars) vars.set(k, v);
        break;
      }

      case "TypeDecl": {
        // Already registered in pre-pass — skip
        break;
      }

      case "ReturnStmt": {
        if (currentFuncReturnType === null) {
          err("Return statement outside of function", stmt.line, stmt.col);
        }
        if (stmt.value) {
          if (currentFuncReturnType.kind === "Void") {
            err("A function with no return type cannot return a value", stmt.line, stmt.col);
          }
          const retType = checkExpr(stmt.value);
          if (!isAssignable(retType, currentFuncReturnType)) {
            err(
              `Cannot return ${typeToString(retType)} from function expecting ${typeToString(currentFuncReturnType)}`,
              stmt.line, stmt.col,
            );
          }
        } else if (currentFuncReturnType.kind !== "Void") {
          err(`Function expects return type ${typeToString(currentFuncReturnType)}`, stmt.line, stmt.col);
        }
        break;
      }

      case "ContinueStmt":
      case "ExitStmt":
        // Valid — loop context checking could be added later
        break;

      case "ExprStmt":
        checkExpr(stmt.expr);
        break;

      case "IncludeStmt":
      case "ImportStmt":
        // Handled before type checking by the compiler orchestrator
        break;
    }
  }

  // ── First pass: register all top-level types and functions ─
  for (const stmt of program.statements) {
    if (stmt.kind === "TypeDecl") {
      const name = stmt.name.toLowerCase();
      if (types.has(name)) {
        err(`Type '${stmt.name}' is already declared`, stmt.line, stmt.col);
      }
      // Pre-register so fields can reference other types
      types.set(name, { fields: [] });
    }
  }

  for (const stmt of program.statements) {
    if (stmt.kind === "TypeDecl") {
      const name = stmt.name.toLowerCase();
      const fields = stmt.fields.map(f => ({
        name: f.name,
        type: resolveTypeAnnotation(f.typeAnnotation),
      }));
      types.set(name, { fields });
    }
  }

  for (const stmt of program.statements) {
    if (stmt.kind === "FunctionDecl") {
      const funcName = stmt.name.toLowerCase();
      const params = stmt.params.map(p => ({
        name: p.name,
        type: resolveTypeAnnotation(p.typeAnnotation),
      }));
      const returnType = stmt.returnType ? resolveTypeAnnotation(stmt.returnType) : VOID;
      funcs.set(funcName, { params, returnType, isExternal: false });
    }
  }

  // ── Pre-pass: register all top-level variables as globals ──────────
  // This ensures functions defined before a variable assignment can still
  // reference that variable — all top-level assignments create globals.
  const preRegisteredGlobals = new Set<string>();
  {
    let changed = true;
    while (changed) {
      changed = false;
      for (const stmt of program.statements) {
        if (stmt.kind === "FunctionDecl" || stmt.kind === "TypeDecl") continue;
        if (stmt.kind === "VarDecl") {
          const name = stmt.name.toLowerCase();
          if (vars.has(name)) continue;
          try {
            let varType: NbType;
            if (stmt.typeAnnotation) {
              varType = resolveTypeAnnotation(stmt.typeAnnotation);
            } else if (stmt.initializer) {
              varType = checkExpr(stmt.initializer);
              if (varType.kind === "Null") continue;
            } else continue;
            vars.set(name, { type: varType, isConst: false });
            preRegisteredGlobals.add(name);
            changed = true;
          } catch { /* defer — expression may reference a not-yet-known variable */ }
        } else if (stmt.kind === "VarAssign") {
          const name = stmt.name.toLowerCase();
          if (vars.has(name)) continue;
          try {
            const valType = checkExpr(stmt.value);
            if (valType.kind === "Null") continue;
            vars.set(name, { type: valType, isConst: false });
            preRegisteredGlobals.add(name);
            changed = true;
          } catch { /* defer */ }
        } else if (stmt.kind === "ConstDecl") {
          const name = stmt.name.toLowerCase();
          if (vars.has(name)) continue;
          try {
            const valType = checkExpr(stmt.value);
            vars.set(name, { type: valType, isConst: true });
            preRegisteredGlobals.add(name);
            changed = true;
          } catch { /* defer */ }
        }
      }
    }
  }

  // ── Second pass: check all statements ─────────────────────
  for (const stmt of program.statements) {
    checkStmt(stmt);
  }

  return {
    env: { vars, funcs, types, modules },
    exprTypes,
  };
}

function isNumeric(t: NbType): boolean {
  return t.kind === "Int" || t.kind === "Float";
}
