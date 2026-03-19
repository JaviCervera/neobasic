import { describe, it, expect } from "vitest";
import { lex, TokenKind } from "../../src/lexer/index.js";

function kinds(source: string): TokenKind[] {
  return lex(source).map((t) => t.kind);
}

describe("Lexer", () => {
  describe("literals", () => {
    it("lexes integer literals", () => {
      const tokens = lex("42");
      expect(tokens).toHaveLength(2); // IntLiteral + EOF
      expect(tokens[0].kind).toBe(TokenKind.IntLiteral);
      expect(tokens[0].value).toBe("42");
    });

    it("lexes float literals", () => {
      const tokens = lex("3.14");
      expect(tokens[0].kind).toBe(TokenKind.FloatLiteral);
      expect(tokens[0].value).toBe("3.14");
    });

    it("does not treat dot without trailing digit as float", () => {
      const k = kinds("42.foo");
      expect(k).toEqual([
        TokenKind.IntLiteral,
        TokenKind.Dot,
        TokenKind.Identifier,
        TokenKind.EOF,
      ]);
    });

    it("lexes string literals", () => {
      const tokens = lex('"hello, world"');
      expect(tokens[0].kind).toBe(TokenKind.StringLiteral);
      expect(tokens[0].value).toBe("hello, world");
    });

    it("throws on unterminated string", () => {
      expect(() => lex('"oops')).toThrow("Unterminated string literal");
    });
  });

  describe("identifiers and keywords", () => {
    it("lexes identifiers", () => {
      const tokens = lex("myVar");
      expect(tokens[0].kind).toBe(TokenKind.Identifier);
      expect(tokens[0].value).toBe("myVar");
    });

    it("lexes keywords case-insensitively", () => {
      expect(lex("If")[0].kind).toBe(TokenKind.If);
      expect(lex("IF")[0].kind).toBe(TokenKind.If);
      expect(lex("if")[0].kind).toBe(TokenKind.If);
      expect(lex("iF")[0].kind).toBe(TokenKind.If);
    });

    it("preserves original case in value", () => {
      expect(lex("If")[0].value).toBe("If");
      expect(lex("IF")[0].value).toBe("IF");
    });

    it("recognises all keywords", () => {
      const keywords = [
        "If", "Then", "Else", "ElseIf", "EndIf",
        "For", "To", "Step", "Next", "In",
        "While", "EndWhile", "Do", "Loop",
        "Repeat", "Until",
        "Select", "Case", "Default", "EndSelect",
        "Function", "EndFunction", "Return",
        "Type", "EndType", "New", "Null",
        "True", "False", "And", "Or", "Not", "Mod",
        "As", "Const", "Include", "Import",
        "Continue", "Exit",
      ];
      for (const kw of keywords) {
        const tokens = lex(kw);
        expect(tokens[0].kind).not.toBe(TokenKind.Identifier);
      }
    });
  });

  describe("operators", () => {
    it("lexes all operators", () => {
      const k = kinds("+ - * / == = <> <= >= < > .");
      expect(k).toEqual([
        TokenKind.Plus, TokenKind.Minus, TokenKind.Star, TokenKind.Slash,
        TokenKind.EqualEqual, TokenKind.Equal, TokenKind.NotEqual,
        TokenKind.LessEqual, TokenKind.GreaterEqual,
        TokenKind.Less, TokenKind.Greater, TokenKind.Dot, TokenKind.EOF,
      ]);
    });
  });

  describe("delimiters", () => {
    it("lexes all delimiters", () => {
      const k = kinds("( ) [ ] , :");
      expect(k).toEqual([
        TokenKind.LParen, TokenKind.RParen,
        TokenKind.LBracket, TokenKind.RBracket,
        TokenKind.Comma, TokenKind.Colon,
        TokenKind.EOF,
      ]);
    });
  });

  describe("comments", () => {
    it("skips single-line comments", () => {
      const k = kinds("a 'this is a comment\nb");
      expect(k).toEqual([
        TokenKind.Identifier, TokenKind.Newline,
        TokenKind.Identifier, TokenKind.EOF,
      ]);
    });

    it("skips block comments", () => {
      const k = kinds("a /* block */ b");
      expect(k).toEqual([TokenKind.Identifier, TokenKind.Identifier, TokenKind.EOF]);
    });

    it("handles nested block comments", () => {
      const k = kinds("a /* outer /* inner */ still outer */ b");
      expect(k).toEqual([TokenKind.Identifier, TokenKind.Identifier, TokenKind.EOF]);
    });

    it("throws on unterminated block comment", () => {
      expect(() => lex("/* oops")).toThrow("Unterminated block comment");
    });
  });

  describe("newlines", () => {
    it("produces newline tokens", () => {
      const k = kinds("a\nb");
      expect(k).toEqual([
        TokenKind.Identifier, TokenKind.Newline,
        TokenKind.Identifier, TokenKind.EOF,
      ]);
    });

    it("collapses consecutive newlines", () => {
      const k = kinds("a\n\n\nb");
      expect(k).toEqual([
        TokenKind.Identifier, TokenKind.Newline,
        TokenKind.Identifier, TokenKind.EOF,
      ]);
    });

    it("does not produce leading newlines", () => {
      const k = kinds("\n\na");
      expect(k).toEqual([TokenKind.Identifier, TokenKind.EOF]);
    });
  });

  describe("colon as statement separator", () => {
    it("lexes colon between statements", () => {
      const k = kinds("a = 1 : b = 2");
      expect(k).toContain(TokenKind.Colon);
    });
  });

  describe("source locations", () => {
    it("tracks line and column", () => {
      const tokens = lex("a\nb");
      expect(tokens[0]).toMatchObject({ line: 1, col: 1 });
      expect(tokens[2]).toMatchObject({ line: 2, col: 1 }); // tokens[1] is Newline
    });
  });

  describe("complex example", () => {
    it("lexes a function declaration", () => {
      const source = `Function HalfValue(value As Int) As Int
  Return value / 2
EndFunction`;
      const k = kinds(source);
      expect(k).toEqual([
        TokenKind.Function, TokenKind.Identifier, TokenKind.LParen,
        TokenKind.Identifier, TokenKind.As, TokenKind.Identifier,
        TokenKind.RParen, TokenKind.As, TokenKind.Identifier, TokenKind.Newline,
        TokenKind.Return, TokenKind.Identifier, TokenKind.Slash,
        TokenKind.IntLiteral, TokenKind.Newline,
        TokenKind.EndFunction, TokenKind.EOF,
      ]);
    });

    it("lexes array declaration", () => {
      const k = kinds("arr As Int[10]");
      expect(k).toEqual([
        TokenKind.Identifier, TokenKind.As, TokenKind.Identifier,
        TokenKind.LBracket, TokenKind.IntLiteral, TokenKind.RBracket,
        TokenKind.EOF,
      ]);
    });
  });

  describe("edge cases", () => {
    it("handles empty source", () => {
      const tokens = lex("");
      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(TokenKind.EOF);
    });

    it("throws on unexpected character", () => {
      expect(() => lex("@")).toThrow("Unexpected character");
    });

    it("handles identifiers with underscores and digits", () => {
      const tokens = lex("my_var2");
      expect(tokens[0].kind).toBe(TokenKind.Identifier);
      expect(tokens[0].value).toBe("my_var2");
    });
  });
});
