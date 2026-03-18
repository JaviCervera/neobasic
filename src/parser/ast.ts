// ── Source location ──────────────────────────────────────────────

export interface Loc {
  line: number;
  col: number;
}

// ── Type annotations (syntactic, before semantic analysis) ──────

export type TypeAnnotation =
  | SimpleType
  | ArrayTypeAnnotation;

export interface SimpleType extends Loc {
  kind: "SimpleType";
  name: string; // "Int", "Float", "String", or user-defined name
}

export interface ArrayTypeAnnotation extends Loc {
  kind: "ArrayType";
  elementType: TypeAnnotation;
  size: number | null; // null means unsized (`Int[]`), number means sized (`Int[10]`)
}

// ── Expressions ─────────────────────────────────────────────────

export type Expr =
  | IntLiteral
  | FloatLiteral
  | StringLiteral
  | BoolLiteral
  | NullLiteral
  | IdentifierExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | IndexExpr
  | MemberExpr
  | NewExpr
  | ArrayLiteralExpr;

export interface IntLiteral extends Loc {
  kind: "IntLiteral";
  value: number;
}

export interface FloatLiteral extends Loc {
  kind: "FloatLiteral";
  value: number;
}

export interface StringLiteral extends Loc {
  kind: "StringLiteral";
  value: string;
}

export interface BoolLiteral extends Loc {
  kind: "BoolLiteral";
  value: boolean;
}

export interface NullLiteral extends Loc {
  kind: "NullLiteral";
}

export interface IdentifierExpr extends Loc {
  kind: "Identifier";
  name: string;
}

export type BinaryOp =
  | "+" | "-" | "*" | "/" | "Mod"
  | "==" | "<>" | "<" | ">" | "<=" | ">="
  | "And" | "Or";

export interface BinaryExpr extends Loc {
  kind: "BinaryExpr";
  op: BinaryOp;
  left: Expr;
  right: Expr;
}

export interface UnaryExpr extends Loc {
  kind: "UnaryExpr";
  op: "-" | "Not";
  operand: Expr;
}

export interface CallExpr extends Loc {
  kind: "CallExpr";
  callee: string;
  args: Expr[];
}

export interface IndexExpr extends Loc {
  kind: "IndexExpr";
  object: Expr;
  index: Expr;
}

export interface MemberExpr extends Loc {
  kind: "MemberExpr";
  object: Expr;
  member: string;
}

export interface NewExpr extends Loc {
  kind: "NewExpr";
  typeName: string;
}

export interface ArrayLiteralExpr extends Loc {
  kind: "ArrayLiteral";
  elements: Expr[];
}

// ── Statements ──────────────────────────────────────────────────

export type Stmt =
  | VarDecl
  | VarAssign
  | IndexAssign
  | MemberAssign
  | ConstDecl
  | IfStmt
  | SelectStmt
  | ForStmt
  | ForInStmt
  | WhileStmt
  | DoLoopStmt
  | RepeatUntilStmt
  | FunctionDecl
  | TypeDecl
  | ReturnStmt
  | ContinueStmt
  | ExitStmt
  | ExprStmt
  | IncludeStmt
  | ImportStmt;

export interface VarDecl extends Loc {
  kind: "VarDecl";
  name: string;
  typeAnnotation: TypeAnnotation | null;
  initializer: Expr | null;
}

export interface VarAssign extends Loc {
  kind: "VarAssign";
  name: string;
  value: Expr;
}

export interface IndexAssign extends Loc {
  kind: "IndexAssign";
  object: Expr;
  index: Expr;
  value: Expr;
}

export interface MemberAssign extends Loc {
  kind: "MemberAssign";
  object: Expr;
  member: string;
  value: Expr;
}

export interface ConstDecl extends Loc {
  kind: "ConstDecl";
  name: string;
  value: Expr;
}

export interface IfStmt extends Loc {
  kind: "IfStmt";
  condition: Expr;
  body: Stmt[];
  elseIfs: { condition: Expr; body: Stmt[] }[];
  elseBody: Stmt[];
}

export interface SelectCase {
  values: Expr[];
  body: Stmt[];
}

export interface SelectStmt extends Loc {
  kind: "SelectStmt";
  expr: Expr;
  cases: SelectCase[];
  defaultBody: Stmt[];
}

export interface ForStmt extends Loc {
  kind: "ForStmt";
  variable: string;
  start: Expr;
  end: Expr;
  step: Expr | null;
  body: Stmt[];
}

export interface ForInStmt extends Loc {
  kind: "ForInStmt";
  variable: string;
  iterable: Expr;
  body: Stmt[];
}

export interface WhileStmt extends Loc {
  kind: "WhileStmt";
  condition: Expr;
  body: Stmt[];
}

export interface DoLoopStmt extends Loc {
  kind: "DoLoopStmt";
  body: Stmt[];
}

export interface RepeatUntilStmt extends Loc {
  kind: "RepeatUntilStmt";
  body: Stmt[];
  condition: Expr;
}

export interface FunctionParam {
  name: string;
  typeAnnotation: TypeAnnotation;
}

export interface FunctionDecl extends Loc {
  kind: "FunctionDecl";
  name: string;
  params: FunctionParam[];
  returnType: TypeAnnotation | null;
  body: Stmt[];
}

export interface TypeField {
  name: string;
  typeAnnotation: TypeAnnotation;
}

export interface TypeDecl extends Loc {
  kind: "TypeDecl";
  name: string;
  fields: TypeField[];
}

export interface ReturnStmt extends Loc {
  kind: "ReturnStmt";
  value: Expr | null;
}

export interface ContinueStmt extends Loc {
  kind: "ContinueStmt";
}

export interface ExitStmt extends Loc {
  kind: "ExitStmt";
}

export interface ExprStmt extends Loc {
  kind: "ExprStmt";
  expr: Expr;
}

export interface IncludeStmt extends Loc {
  kind: "IncludeStmt";
  path: string;
}

export interface ImportStmt extends Loc {
  kind: "ImportStmt";
  moduleName: string;
}

// ── Program (top-level) ─────────────────────────────────────────

export interface Program {
  statements: Stmt[];
}
