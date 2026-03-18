// ── Semantic types (after analysis) ─────────────────────────────

export type NbType =
  | IntType
  | FloatType
  | StringType
  | BoolType
  | NullType
  | ArrayType
  | UDTType
  | VoidType;

export interface IntType { kind: "Int"; }
export interface FloatType { kind: "Float"; }
export interface StringType { kind: "String"; }
export interface BoolType { kind: "Bool"; }
export interface NullType { kind: "Null"; }
export interface VoidType { kind: "Void"; }

export interface ArrayType {
  kind: "Array";
  elementType: NbType;
}

export interface UDTType {
  kind: "UDT";
  name: string;
}

// Singletons for convenience
export const INT: IntType = { kind: "Int" };
export const FLOAT: FloatType = { kind: "Float" };
export const STRING: StringType = { kind: "String" };
export const BOOL: BoolType = { kind: "Bool" };
export const NULL: NullType = { kind: "Null" };
export const VOID: VoidType = { kind: "Void" };

export function arrayOf(element: NbType): ArrayType {
  return { kind: "Array", elementType: element };
}

export function udtOf(name: string): UDTType {
  return { kind: "UDT", name: name.toLowerCase() };
}

export function typeEquals(a: NbType, b: NbType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "Array" && b.kind === "Array") {
    return typeEquals(a.elementType, b.elementType);
  }
  if (a.kind === "UDT" && b.kind === "UDT") {
    return a.name === b.name;
  }
  return true;
}

export function typeToString(t: NbType): string {
  switch (t.kind) {
    case "Int": return "Int";
    case "Float": return "Float";
    case "String": return "String";
    case "Bool": return "Bool";
    case "Null": return "Null";
    case "Void": return "Void";
    case "Array": return `${typeToString(t.elementType)}[]`;
    case "UDT": return t.name;
  }
}

/** Check if `from` type is assignable to `to` type */
export function isAssignable(from: NbType, to: NbType): boolean {
  if (typeEquals(from, to)) return true;
  // Null is assignable to UDT types
  if (from.kind === "Null" && to.kind === "UDT") return true;
  // Int is promotable to Float
  if (from.kind === "Int" && to.kind === "Float") return true;
  return false;
}
