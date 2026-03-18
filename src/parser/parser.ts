import { ParseError } from "../errors.js";
import { Token, TokenKind } from "../lexer/tokens.js";
import {
  Program, Stmt, Expr, TypeAnnotation,
  BinaryOp, FunctionParam, TypeField, SelectCase,
} from "./ast.js";

export function parse(tokens: Token[], file = "<stdin>"): Program {
  let pos = 0;

  // ── Helpers ───────────────────────────────────────────────

  function current(): Token {
    return tokens[pos];
  }

  function at(kind: TokenKind): boolean {
    return current().kind === kind;
  }

  function atAny(...kinds: TokenKind[]): boolean {
    return kinds.includes(current().kind);
  }

  function expect(kind: TokenKind, msg?: string): Token {
    if (current().kind !== kind) {
      const t = current();
      error(msg ?? `Expected ${kind} but got ${t.kind} ('${t.value}')`, t.line, t.col);
    }
    return advance();
  }

  function advance(): Token {
    const t = tokens[pos];
    pos++;
    return t;
  }

  function error(msg: string, line?: number, col?: number): never {
    const t = current();
    throw new ParseError(msg, file, line ?? t.line, col ?? t.col);
  }

  function skipNewlines(): void {
    while (at(TokenKind.Newline) || at(TokenKind.Colon)) {
      advance();
    }
  }

  function expectTerminator(): void {
    if (!atAny(TokenKind.Newline, TokenKind.Colon, TokenKind.EOF)) {
      error(`Expected end of statement but got '${current().value}'`);
    }
    if (atAny(TokenKind.Newline, TokenKind.Colon)) {
      advance();
    }
  }

  // ── Type Annotations ─────────────────────────────────────

  function parseTypeAnnotation(): TypeAnnotation {
    const t = expect(TokenKind.Identifier, "Expected type name");
    let ta: TypeAnnotation = { kind: "SimpleType", name: t.value, line: t.line, col: t.col };

    while (at(TokenKind.LBracket)) {
      const bl = current();
      advance(); // consume [
      let size: number | null = null;
      if (at(TokenKind.IntLiteral)) {
        size = parseInt(advance().value, 10);
      }
      expect(TokenKind.RBracket, "Expected ']'");
      ta = { kind: "ArrayType", elementType: ta, size, line: bl.line, col: bl.col };
    }

    return ta;
  }

  // ── Expressions ───────────────────────────────────────────
  // Precedence (low to high):
  //   Or
  //   And
  //   Not (unary)
  //   == <> < > <= >=
  //   + -
  //   * / Mod
  //   Unary -
  //   Call / Index / Member / Primary

  function parseExpr(): Expr {
    return parseOr();
  }

  function parseOr(): Expr {
    let left = parseAnd();
    while (at(TokenKind.Or)) {
      const op = advance();
      const right = parseAnd();
      left = { kind: "BinaryExpr", op: "Or", left, right, line: op.line, col: op.col };
    }
    return left;
  }

  function parseAnd(): Expr {
    let left = parseNot();
    while (at(TokenKind.And)) {
      const op = advance();
      const right = parseNot();
      left = { kind: "BinaryExpr", op: "And", left, right, line: op.line, col: op.col };
    }
    return left;
  }

  function parseNot(): Expr {
    if (at(TokenKind.Not)) {
      const op = advance();
      const operand = parseNot();
      return { kind: "UnaryExpr", op: "Not", operand, line: op.line, col: op.col };
    }
    return parseComparison();
  }

  function parseComparison(): Expr {
    let left = parseAddSub();
    const compOps: Record<string, BinaryOp> = {
      [TokenKind.EqualEqual]: "==",
      [TokenKind.NotEqual]: "<>",
      [TokenKind.Less]: "<",
      [TokenKind.Greater]: ">",
      [TokenKind.LessEqual]: "<=",
      [TokenKind.GreaterEqual]: ">=",
    };
    while (current().kind in compOps) {
      const op = advance();
      const right = parseAddSub();
      left = { kind: "BinaryExpr", op: compOps[op.kind], left, right, line: op.line, col: op.col };
    }
    return left;
  }

  function parseAddSub(): Expr {
    let left = parseMulDivMod();
    while (atAny(TokenKind.Plus, TokenKind.Minus)) {
      const op = advance();
      const right = parseMulDivMod();
      const bop: BinaryOp = op.kind === TokenKind.Plus ? "+" : "-";
      left = { kind: "BinaryExpr", op: bop, left, right, line: op.line, col: op.col };
    }
    return left;
  }

  function parseMulDivMod(): Expr {
    let left = parseUnary();
    while (atAny(TokenKind.Star, TokenKind.Slash, TokenKind.Mod)) {
      const op = advance();
      const right = parseUnary();
      const bop: BinaryOp = op.kind === TokenKind.Star ? "*" : op.kind === TokenKind.Slash ? "/" : "Mod";
      left = { kind: "BinaryExpr", op: bop, left, right, line: op.line, col: op.col };
    }
    return left;
  }

  function parseUnary(): Expr {
    if (at(TokenKind.Minus)) {
      const op = advance();
      const operand = parseUnary();
      return { kind: "UnaryExpr", op: "-", operand, line: op.line, col: op.col };
    }
    return parsePostfix();
  }

  function parsePostfix(): Expr {
    let expr = parsePrimary();

    while (true) {
      if (at(TokenKind.LBracket)) {
        const bl = current();
        advance();
        const index = parseExpr();
        expect(TokenKind.RBracket, "Expected ']'");
        expr = { kind: "IndexExpr", object: expr, index, line: bl.line, col: bl.col };
      } else if (at(TokenKind.Dot)) {
        const dl = current();
        advance();
        const member = expect(TokenKind.Identifier, "Expected member name").value;
        expr = { kind: "MemberExpr", object: expr, member, line: dl.line, col: dl.col };
      } else {
        break;
      }
    }

    return expr;
  }

  function parsePrimary(): Expr {
    const t = current();

    // Parenthesised expression
    if (at(TokenKind.LParen)) {
      advance();
      const expr = parseExpr();
      expect(TokenKind.RParen, "Expected ')'");
      return expr;
    }

    // Array literal
    if (at(TokenKind.LBracket)) {
      advance();
      const elements: Expr[] = [];
      if (!at(TokenKind.RBracket)) {
        elements.push(parseExpr());
        while (at(TokenKind.Comma)) {
          advance();
          elements.push(parseExpr());
        }
      }
      expect(TokenKind.RBracket, "Expected ']'");
      return { kind: "ArrayLiteral", elements, line: t.line, col: t.col };
    }

    // Literals
    if (at(TokenKind.IntLiteral)) {
      advance();
      return { kind: "IntLiteral", value: parseInt(t.value, 10), line: t.line, col: t.col };
    }
    if (at(TokenKind.FloatLiteral)) {
      advance();
      return { kind: "FloatLiteral", value: parseFloat(t.value), line: t.line, col: t.col };
    }
    if (at(TokenKind.StringLiteral)) {
      advance();
      return { kind: "StringLiteral", value: t.value, line: t.line, col: t.col };
    }
    if (at(TokenKind.True)) {
      advance();
      return { kind: "BoolLiteral", value: true, line: t.line, col: t.col };
    }
    if (at(TokenKind.False)) {
      advance();
      return { kind: "BoolLiteral", value: false, line: t.line, col: t.col };
    }
    if (at(TokenKind.Null)) {
      advance();
      return { kind: "NullLiteral", line: t.line, col: t.col };
    }

    // New expression
    if (at(TokenKind.New)) {
      advance();
      const name = expect(TokenKind.Identifier, "Expected type name after 'New'").value;
      return { kind: "NewExpr", typeName: name, line: t.line, col: t.col };
    }

    // Identifier or function call
    if (at(TokenKind.Identifier)) {
      advance();
      if (at(TokenKind.LParen)) {
        advance();
        const args: Expr[] = [];
        if (!at(TokenKind.RParen)) {
          args.push(parseExpr());
          while (at(TokenKind.Comma)) {
            advance();
            args.push(parseExpr());
          }
        }
        expect(TokenKind.RParen, "Expected ')'");
        return { kind: "CallExpr", callee: t.value, args, line: t.line, col: t.col };
      }
      return { kind: "Identifier", name: t.value, line: t.line, col: t.col };
    }

    error(`Unexpected token: '${t.value}'`);
  }

  // ── Statements ────────────────────────────────────────────

  function parseStatement(): Stmt {
    const t = current();

    if (at(TokenKind.Include)) return parseInclude();
    if (at(TokenKind.Import)) return parseImport();
    if (at(TokenKind.Const)) return parseConst();
    if (at(TokenKind.If)) return parseIf();
    if (at(TokenKind.Select)) return parseSelect();
    if (at(TokenKind.For)) return parseFor();
    if (at(TokenKind.While)) return parseWhile();
    if (at(TokenKind.Do)) return parseDoLoop();
    if (at(TokenKind.Repeat)) return parseRepeatUntil();
    if (at(TokenKind.Function)) return parseFunctionDecl();
    if (at(TokenKind.Type)) return parseTypeDecl();
    if (at(TokenKind.Return)) return parseReturn();
    if (at(TokenKind.Continue)) { advance(); return { kind: "ContinueStmt", line: t.line, col: t.col }; }
    if (at(TokenKind.Exit)) { advance(); return { kind: "ExitStmt", line: t.line, col: t.col }; }

    // Assignment, declaration, or expression statement
    return parseAssignOrExpr();
  }

  function parseAssignOrExpr(): Stmt {
    const t = current();

    // Check for: identifier As Type [= expr]  or  identifier = expr
    if (at(TokenKind.Identifier)) {
      const savedPos = pos;
      const name = advance();

      // Variable declaration: `name As Type [= expr]`
      if (at(TokenKind.As)) {
        advance();
        const typeAnnotation = parseTypeAnnotation();
        let initializer: Expr | null = null;
        if (at(TokenKind.Equal)) {
          advance();
          initializer = parseExpr();
        }
        return {
          kind: "VarDecl",
          name: name.value,
          typeAnnotation,
          initializer,
          line: t.line,
          col: t.col,
        };
      }

      // Simple assignment: `name = expr`
      if (at(TokenKind.Equal)) {
        advance();
        const value = parseExpr();
        return { kind: "VarAssign", name: name.value, value, line: t.line, col: t.col };
      }

      // Could be expr followed by member/index assignment, or just an expression statement
      // Backtrack and parse as expression
      pos = savedPos;
    }

    // Parse as expression, then check for assignment
    const expr = parseExpr();

    if (at(TokenKind.Equal)) {
      advance();
      const value = parseExpr();

      // member assignment: expr.member = value
      if (expr.kind === "MemberExpr") {
        return {
          kind: "MemberAssign",
          object: expr.object,
          member: expr.member,
          value,
          line: t.line,
          col: t.col,
        };
      }

      // index assignment: expr[idx] = value
      if (expr.kind === "IndexExpr") {
        return {
          kind: "IndexAssign",
          object: expr.object,
          index: expr.index,
          value,
          line: t.line,
          col: t.col,
        };
      }

      // If the expression is just an identifier, it's a simple variable assignment
      if (expr.kind === "Identifier") {
        return { kind: "VarAssign", name: expr.name, value, line: t.line, col: t.col };
      }

      error("Invalid assignment target");
    }

    // Check if this is a variable declaration inferred from assignment (identifier = expr)
    // Already handled above, so this is an expression statement
    return { kind: "ExprStmt", expr, line: t.line, col: t.col };
  }

  function parseInclude(): Stmt {
    const t = expect(TokenKind.Include);
    const path = expect(TokenKind.StringLiteral, "Expected file path after 'Include'");
    return { kind: "IncludeStmt", path: path.value, line: t.line, col: t.col };
  }

  function parseImport(): Stmt {
    const t = expect(TokenKind.Import);
    const moduleName = expect(TokenKind.StringLiteral, "Expected module name after 'Import'");
    return { kind: "ImportStmt", moduleName: moduleName.value, line: t.line, col: t.col };
  }

  function parseConst(): Stmt {
    const t = expect(TokenKind.Const);
    const name = expect(TokenKind.Identifier, "Expected constant name");
    expect(TokenKind.Equal, "Expected '=' after constant name");
    const value = parseExpr();
    return { kind: "ConstDecl", name: name.value, value, line: t.line, col: t.col };
  }

  function parseIf(): Stmt {
    const t = expect(TokenKind.If);
    const condition = parseExpr();

    // Single-line If: If condition Then stmt [Else stmt]
    if (at(TokenKind.Then)) {
      advance();
      const body = [parseStatement()];
      let elseBody: Stmt[] = [];
      if (at(TokenKind.Else)) {
        advance();
        elseBody = [parseStatement()];
      }
      return { kind: "IfStmt", condition, body, elseIfs: [], elseBody, line: t.line, col: t.col };
    }

    // Multi-line If
    skipNewlines();
    const body = parseBlock(TokenKind.EndIf, TokenKind.Else, TokenKind.ElseIf);

    const elseIfs: { condition: Expr; body: Stmt[] }[] = [];
    while (at(TokenKind.ElseIf)) {
      advance();
      const eifCond = parseExpr();
      skipNewlines();
      const eifBody = parseBlock(TokenKind.EndIf, TokenKind.Else, TokenKind.ElseIf);
      elseIfs.push({ condition: eifCond, body: eifBody });
    }

    let elseBody: Stmt[] = [];
    if (at(TokenKind.Else)) {
      advance();
      skipNewlines();
      elseBody = parseBlock(TokenKind.EndIf);
    }

    expect(TokenKind.EndIf, "Expected 'EndIf'");
    return { kind: "IfStmt", condition, body, elseIfs, elseBody, line: t.line, col: t.col };
  }

  function parseSelect(): Stmt {
    const t = expect(TokenKind.Select);
    const expr = parseExpr();
    skipNewlines();

    const cases: SelectCase[] = [];
    let defaultBody: Stmt[] = [];

    while (at(TokenKind.Case)) {
      advance();
      const values: Expr[] = [parseExpr()];
      while (at(TokenKind.Comma)) {
        advance();
        values.push(parseExpr());
      }
      skipNewlines();
      const body = parseBlock(TokenKind.Case, TokenKind.Default, TokenKind.EndSelect);
      cases.push({ values, body });
    }

    if (at(TokenKind.Default)) {
      advance();
      skipNewlines();
      defaultBody = parseBlock(TokenKind.EndSelect);
    }

    expect(TokenKind.EndSelect, "Expected 'EndSelect'");
    return { kind: "SelectStmt", expr, cases, defaultBody, line: t.line, col: t.col };
  }

  function parseFor(): Stmt {
    const t = expect(TokenKind.For);
    const varName = expect(TokenKind.Identifier, "Expected variable name");

    // For..In
    if (at(TokenKind.In)) {
      advance();
      const iterable = parseExpr();
      skipNewlines();
      const body = parseBlock(TokenKind.Next);
      expect(TokenKind.Next, "Expected 'Next'");
      return { kind: "ForInStmt", variable: varName.value, iterable, body, line: t.line, col: t.col };
    }

    // For..To
    expect(TokenKind.Equal, "Expected '=' in For loop");
    const start = parseExpr();
    expect(TokenKind.To, "Expected 'To'");
    const end = parseExpr();
    let step: Expr | null = null;
    if (at(TokenKind.Step)) {
      advance();
      step = parseExpr();
    }
    skipNewlines();
    const body = parseBlock(TokenKind.Next);
    expect(TokenKind.Next, "Expected 'Next'");
    return { kind: "ForStmt", variable: varName.value, start, end, step, body, line: t.line, col: t.col };
  }

  function parseWhile(): Stmt {
    const t = expect(TokenKind.While);
    const condition = parseExpr();
    skipNewlines();
    const body = parseBlock(TokenKind.EndWhile);
    expect(TokenKind.EndWhile, "Expected 'EndWhile'");
    return { kind: "WhileStmt", condition, body, line: t.line, col: t.col };
  }

  function parseDoLoop(): Stmt {
    const t = expect(TokenKind.Do);
    skipNewlines();
    const body = parseBlock(TokenKind.Loop);
    expect(TokenKind.Loop, "Expected 'Loop'");
    return { kind: "DoLoopStmt", body, line: t.line, col: t.col };
  }

  function parseRepeatUntil(): Stmt {
    const t = expect(TokenKind.Repeat);
    skipNewlines();
    const body = parseBlock(TokenKind.Until);
    expect(TokenKind.Until, "Expected 'Until'");
    const condition = parseExpr();
    return { kind: "RepeatUntilStmt", body, condition, line: t.line, col: t.col };
  }

  function parseFunctionDecl(): Stmt {
    const t = expect(TokenKind.Function);
    const name = expect(TokenKind.Identifier, "Expected function name");
    expect(TokenKind.LParen, "Expected '('");

    const params: FunctionParam[] = [];
    if (!at(TokenKind.RParen)) {
      params.push(parseFunctionParam());
      while (at(TokenKind.Comma)) {
        advance();
        params.push(parseFunctionParam());
      }
    }
    expect(TokenKind.RParen, "Expected ')'");

    let returnType: TypeAnnotation | null = null;
    if (at(TokenKind.As)) {
      advance();
      returnType = parseTypeAnnotation();
    }

    skipNewlines();
    const body = parseBlock(TokenKind.EndFunction);
    expect(TokenKind.EndFunction, "Expected 'EndFunction'");

    return {
      kind: "FunctionDecl",
      name: name.value,
      params,
      returnType,
      body,
      line: t.line,
      col: t.col,
    };
  }

  function parseFunctionParam(): FunctionParam {
    const name = expect(TokenKind.Identifier, "Expected parameter name");
    expect(TokenKind.As, "Expected 'As' after parameter name");
    const typeAnnotation = parseTypeAnnotation();
    return { name: name.value, typeAnnotation };
  }

  function parseTypeDecl(): Stmt {
    const t = expect(TokenKind.Type);
    const name = expect(TokenKind.Identifier, "Expected type name");
    skipNewlines();

    const fields: TypeField[] = [];
    while (!at(TokenKind.EndType) && !at(TokenKind.EOF)) {
      const fieldName = expect(TokenKind.Identifier, "Expected field name");
      expect(TokenKind.As, "Expected 'As' after field name");
      const typeAnnotation = parseTypeAnnotation();
      fields.push({ name: fieldName.value, typeAnnotation });
      skipNewlines();
    }

    expect(TokenKind.EndType, "Expected 'EndType'");
    return { kind: "TypeDecl", name: name.value, fields, line: t.line, col: t.col };
  }

  function parseReturn(): Stmt {
    const t = expect(TokenKind.Return);
    let value: Expr | null = null;
    if (!atAny(TokenKind.Newline, TokenKind.Colon, TokenKind.EOF)) {
      value = parseExpr();
    }
    return { kind: "ReturnStmt", value, line: t.line, col: t.col };
  }

  // Parse statements until one of the terminator tokens is reached
  function parseBlock(...terminators: TokenKind[]): Stmt[] {
    const stmts: Stmt[] = [];
    while (!terminators.includes(current().kind) && !at(TokenKind.EOF)) {
      skipNewlines();
      if (terminators.includes(current().kind) || at(TokenKind.EOF)) break;
      stmts.push(parseStatement());
      // Consume statement terminator if present
      if (atAny(TokenKind.Newline, TokenKind.Colon)) {
        advance();
      }
    }
    return stmts;
  }

  // ── Top-level ─────────────────────────────────────────────

  const statements: Stmt[] = [];
  skipNewlines();
  while (!at(TokenKind.EOF)) {
    statements.push(parseStatement());
    if (atAny(TokenKind.Newline, TokenKind.Colon)) {
      advance();
    }
    skipNewlines();
  }

  return { statements };
}
