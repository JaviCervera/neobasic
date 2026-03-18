export enum TokenKind {
  // Literals
  IntLiteral = "IntLiteral",
  FloatLiteral = "FloatLiteral",
  StringLiteral = "StringLiteral",

  // Identifier
  Identifier = "Identifier",

  // Keywords
  If = "If",
  Then = "Then",
  Else = "Else",
  ElseIf = "ElseIf",
  EndIf = "EndIf",
  For = "For",
  To = "To",
  Step = "Step",
  Next = "Next",
  In = "In",
  While = "While",
  EndWhile = "EndWhile",
  Do = "Do",
  Loop = "Loop",
  Repeat = "Repeat",
  Until = "Until",
  Select = "Select",
  Case = "Case",
  Default = "Default",
  EndSelect = "EndSelect",
  Function = "Function",
  EndFunction = "EndFunction",
  Return = "Return",
  Type = "Type",
  EndType = "EndType",
  New = "New",
  Null = "Null",
  True = "True",
  False = "False",
  And = "And",
  Or = "Or",
  Not = "Not",
  Mod = "Mod",
  As = "As",
  Const = "Const",
  Include = "Include",
  Import = "Import",
  Continue = "Continue",
  Exit = "Exit",

  // Operators
  Plus = "Plus",
  Minus = "Minus",
  Star = "Star",
  Slash = "Slash",
  EqualEqual = "EqualEqual",
  Equal = "Equal",
  NotEqual = "NotEqual",
  LessEqual = "LessEqual",
  GreaterEqual = "GreaterEqual",
  Less = "Less",
  Greater = "Greater",
  Dot = "Dot",

  // Delimiters
  LParen = "LParen",
  RParen = "RParen",
  LBracket = "LBracket",
  RBracket = "RBracket",
  Comma = "Comma",
  Colon = "Colon",

  // Special
  Newline = "Newline",
  EOF = "EOF",
}

const KEYWORDS: ReadonlyMap<string, TokenKind> = new Map([
  ["if", TokenKind.If],
  ["then", TokenKind.Then],
  ["else", TokenKind.Else],
  ["elseif", TokenKind.ElseIf],
  ["endif", TokenKind.EndIf],
  ["for", TokenKind.For],
  ["to", TokenKind.To],
  ["step", TokenKind.Step],
  ["next", TokenKind.Next],
  ["in", TokenKind.In],
  ["while", TokenKind.While],
  ["endwhile", TokenKind.EndWhile],
  ["do", TokenKind.Do],
  ["loop", TokenKind.Loop],
  ["repeat", TokenKind.Repeat],
  ["until", TokenKind.Until],
  ["select", TokenKind.Select],
  ["case", TokenKind.Case],
  ["default", TokenKind.Default],
  ["endselect", TokenKind.EndSelect],
  ["function", TokenKind.Function],
  ["endfunction", TokenKind.EndFunction],
  ["return", TokenKind.Return],
  ["type", TokenKind.Type],
  ["endtype", TokenKind.EndType],
  ["new", TokenKind.New],
  ["null", TokenKind.Null],
  ["true", TokenKind.True],
  ["false", TokenKind.False],
  ["and", TokenKind.And],
  ["or", TokenKind.Or],
  ["not", TokenKind.Not],
  ["mod", TokenKind.Mod],
  ["as", TokenKind.As],
  ["const", TokenKind.Const],
  ["include", TokenKind.Include],
  ["import", TokenKind.Import],
  ["continue", TokenKind.Continue],
  ["exit", TokenKind.Exit],
]);

export { KEYWORDS };

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  col: number;
}
