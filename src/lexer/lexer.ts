import { LexerError } from "../errors.js";
import { Token, TokenKind, KEYWORDS } from "./tokens.js";

export function lex(source: string, file = "<stdin>"): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  function peek(): string {
    return pos < source.length ? source[pos] : "\0";
  }

  function peekAt(offset: number): string {
    const i = pos + offset;
    return i < source.length ? source[i] : "\0";
  }

  function advance(): string {
    const ch = source[pos];
    pos++;
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  function error(msg: string, l?: number, c?: number): never {
    throw new LexerError(msg, file, l ?? line, c ?? col);
  }

  function skipWhitespace(): void {
    while (pos < source.length) {
      const ch = peek();
      if (ch === " " || ch === "\t" || ch === "\r") {
        advance();
      } else {
        break;
      }
    }
  }

  function skipSingleLineComment(): void {
    // Skip everything until end of line (don't consume the newline)
    while (pos < source.length && peek() !== "\n") {
      advance();
    }
  }

  function skipBlockComment(): void {
    // We've already consumed '/*'
    let depth = 1;
    while (pos < source.length && depth > 0) {
      if (peek() === "/" && peekAt(1) === "*") {
        advance();
        advance();
        depth++;
      } else if (peek() === "*" && peekAt(1) === "/") {
        advance();
        advance();
        depth--;
      } else {
        advance();
      }
    }
    if (depth > 0) {
      error("Unterminated block comment");
    }
  }

  function readString(): Token {
    const startLine = line;
    const startCol = col;
    advance(); // consume opening "
    let value = "";
    while (pos < source.length && peek() !== '"') {
      if (peek() === "\n") {
        error("Unterminated string literal", startLine, startCol);
      }
      value += advance();
    }
    if (pos >= source.length) {
      error("Unterminated string literal", startLine, startCol);
    }
    advance(); // consume closing "
    return { kind: TokenKind.StringLiteral, value, line: startLine, col: startCol };
  }

  function readNumber(): Token {
    const startLine = line;
    const startCol = col;
    let value = "";
    let isFloat = false;

    while (pos < source.length && isDigit(peek())) {
      value += advance();
    }

    if (peek() === "." && isDigit(peekAt(1))) {
      isFloat = true;
      value += advance(); // consume '.'
      while (pos < source.length && isDigit(peek())) {
        value += advance();
      }
    }

    return {
      kind: isFloat ? TokenKind.FloatLiteral : TokenKind.IntLiteral,
      value,
      line: startLine,
      col: startCol,
    };
  }

  function readIdentifierOrKeyword(): Token {
    const startLine = line;
    const startCol = col;
    let value = "";

    while (pos < source.length && isIdentChar(peek())) {
      value += advance();
    }

    const lower = value.toLowerCase();
    const keyword = KEYWORDS.get(lower);
    if (keyword !== undefined) {
      return { kind: keyword, value, line: startLine, col: startCol };
    }
    return { kind: TokenKind.Identifier, value, line: startLine, col: startCol };
  }

  while (pos < source.length) {
    skipWhitespace();
    if (pos >= source.length) break;

    const startLine = line;
    const startCol = col;
    const ch = peek();

    // Single-line comment
    if (ch === "'") {
      skipSingleLineComment();
      continue;
    }

    // Block comment or Slash operator
    if (ch === "/") {
      if (peekAt(1) === "*") {
        advance();
        advance();
        skipBlockComment();
        continue;
      }
      advance();
      tokens.push({ kind: TokenKind.Slash, value: "/", line: startLine, col: startCol });
      continue;
    }

    // Newline
    if (ch === "\n") {
      advance();
      // Collapse consecutive newlines into one token
      if (tokens.length > 0 && tokens[tokens.length - 1].kind !== TokenKind.Newline) {
        tokens.push({ kind: TokenKind.Newline, value: "\n", line: startLine, col: startCol });
      }
      continue;
    }

    // String literal
    if (ch === '"') {
      tokens.push(readString());
      continue;
    }

    // Number literal
    if (isDigit(ch)) {
      tokens.push(readNumber());
      continue;
    }

    // Identifier or keyword
    if (isIdentStart(ch)) {
      tokens.push(readIdentifierOrKeyword());
      continue;
    }

    // Two-character operators
    if (ch === "=" && peekAt(1) === "=") {
      advance(); advance();
      tokens.push({ kind: TokenKind.EqualEqual, value: "==", line: startLine, col: startCol });
      continue;
    }
    if (ch === "<" && peekAt(1) === ">") {
      advance(); advance();
      tokens.push({ kind: TokenKind.NotEqual, value: "<>", line: startLine, col: startCol });
      continue;
    }
    if (ch === "<" && peekAt(1) === "=") {
      advance(); advance();
      tokens.push({ kind: TokenKind.LessEqual, value: "<=", line: startLine, col: startCol });
      continue;
    }
    if (ch === ">" && peekAt(1) === "=") {
      advance(); advance();
      tokens.push({ kind: TokenKind.GreaterEqual, value: ">=", line: startLine, col: startCol });
      continue;
    }

    // Single-character tokens
    switch (ch) {
      case "+": advance(); tokens.push({ kind: TokenKind.Plus, value: "+", line: startLine, col: startCol }); continue;
      case "-": advance(); tokens.push({ kind: TokenKind.Minus, value: "-", line: startLine, col: startCol }); continue;
      case "*": advance(); tokens.push({ kind: TokenKind.Star, value: "*", line: startLine, col: startCol }); continue;
      case "=": advance(); tokens.push({ kind: TokenKind.Equal, value: "=", line: startLine, col: startCol }); continue;
      case "<": advance(); tokens.push({ kind: TokenKind.Less, value: "<", line: startLine, col: startCol }); continue;
      case ">": advance(); tokens.push({ kind: TokenKind.Greater, value: ">", line: startLine, col: startCol }); continue;
      case ".": advance(); tokens.push({ kind: TokenKind.Dot, value: ".", line: startLine, col: startCol }); continue;
      case "(": advance(); tokens.push({ kind: TokenKind.LParen, value: "(", line: startLine, col: startCol }); continue;
      case ")": advance(); tokens.push({ kind: TokenKind.RParen, value: ")", line: startLine, col: startCol }); continue;
      case "[": advance(); tokens.push({ kind: TokenKind.LBracket, value: "[", line: startLine, col: startCol }); continue;
      case "]": advance(); tokens.push({ kind: TokenKind.RBracket, value: "]", line: startLine, col: startCol }); continue;
      case ",": advance(); tokens.push({ kind: TokenKind.Comma, value: ",", line: startLine, col: startCol }); continue;
      case ":": advance(); tokens.push({ kind: TokenKind.Colon, value: ":", line: startLine, col: startCol }); continue;
      default:
        error(`Unexpected character: '${ch}'`);
    }
  }

  tokens.push({ kind: TokenKind.EOF, value: "", line, col });
  return tokens;
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentChar(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}

export { TokenKind, type Token } from "./tokens.js";
