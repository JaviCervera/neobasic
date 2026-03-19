import { describe, it, expect } from "vitest";
import { lex } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import type { Program, Stmt } from "../../src/parser/ast.js";

function p(source: string): Program {
  return parse(lex(source));
}

function firstStmt(source: string): Stmt {
  const prog = p(source);
  expect(prog.statements.length).toBeGreaterThanOrEqual(1);
  return prog.statements[0];
}

describe("Parser", () => {
  describe("variable declarations and assignments", () => {
    it("parses assignment with type inference", () => {
      const s = firstStmt("a = 25");
      expect(s.kind).toBe("VarAssign");
      if (s.kind === "VarAssign") {
        expect(s.name).toBe("a");
        expect(s.value.kind).toBe("IntLiteral");
      }
    });

    it("parses typed variable declaration", () => {
      const s = firstStmt("b As Float = 162.36");
      expect(s.kind).toBe("VarDecl");
      if (s.kind === "VarDecl") {
        expect(s.name).toBe("b");
        expect(s.typeAnnotation?.kind).toBe("SimpleType");
        expect(s.initializer?.kind).toBe("FloatLiteral");
      }
    });

    it("parses typed declaration without initializer", () => {
      const s = firstStmt("d As Int");
      expect(s.kind).toBe("VarDecl");
      if (s.kind === "VarDecl") {
        expect(s.name).toBe("d");
        expect(s.initializer).toBeNull();
      }
    });
  });

  describe("constants", () => {
    it("parses Const declaration", () => {
      const s = firstStmt('Const HELLO = "hello"');
      expect(s.kind).toBe("ConstDecl");
      if (s.kind === "ConstDecl") {
        expect(s.name).toBe("HELLO");
        expect(s.value.kind).toBe("StringLiteral");
      }
    });
  });

  describe("arrays", () => {
    it("parses array type declaration", () => {
      const s = firstStmt("arr As Int[10]");
      expect(s.kind).toBe("VarDecl");
      if (s.kind === "VarDecl") {
        expect(s.typeAnnotation?.kind).toBe("ArrayType");
      }
    });

    it("parses unsized array", () => {
      const s = firstStmt("arr2 As String[]");
      expect(s.kind).toBe("VarDecl");
      if (s.kind === "VarDecl") {
        expect(s.typeAnnotation?.kind).toBe("ArrayType");
        if (s.typeAnnotation?.kind === "ArrayType") {
          expect(s.typeAnnotation.size).toBeNull();
        }
      }
    });

    it("parses multidimensional array", () => {
      const s = firstStmt("arr As Int[][]");
      expect(s.kind).toBe("VarDecl");
      if (s.kind === "VarDecl") {
        const ta = s.typeAnnotation;
        expect(ta?.kind).toBe("ArrayType");
        if (ta?.kind === "ArrayType") {
          expect(ta.elementType.kind).toBe("ArrayType");
        }
      }
    });

    it("parses array literal", () => {
      const s = firstStmt("a = [1, 2, 3]");
      if (s.kind === "VarAssign") {
        expect(s.value.kind).toBe("ArrayLiteral");
      }
    });

    it("parses array index access", () => {
      const s = firstStmt("a = arr[0]");
      if (s.kind === "VarAssign") {
        expect(s.value.kind).toBe("IndexExpr");
      }
    });

    it("parses array index assignment", () => {
      const s = firstStmt("arr[1] = 42");
      expect(s.kind).toBe("IndexAssign");
    });
  });

  describe("user-defined types", () => {
    it("parses Type declaration", () => {
      const s = firstStmt(`Type Person
  Id As Int
  Name As String
EndType`);
      expect(s.kind).toBe("TypeDecl");
      if (s.kind === "TypeDecl") {
        expect(s.name).toBe("Person");
        expect(s.fields).toHaveLength(2);
        expect(s.fields[0].name).toBe("Id");
        expect(s.fields[1].name).toBe("Name");
      }
    });

    it("parses New expression", () => {
      const s = firstStmt("p = New Person");
      if (s.kind === "VarAssign") {
        expect(s.value.kind).toBe("NewExpr");
        if (s.value.kind === "NewExpr") {
          expect(s.value.typeName).toBe("Person");
        }
      }
    });

    it("parses member access", () => {
      const s = firstStmt("a = p.Name");
      if (s.kind === "VarAssign") {
        expect(s.value.kind).toBe("MemberExpr");
      }
    });

    it("parses member assignment", () => {
      const s = firstStmt('p.Name = "John"');
      expect(s.kind).toBe("MemberAssign");
    });
  });

  describe("expressions", () => {
    it("parses arithmetic", () => {
      const s = firstStmt("a = 3 + 4 * 2");
      if (s.kind === "VarAssign") {
        // Should be: 3 + (4 * 2)
        expect(s.value.kind).toBe("BinaryExpr");
        if (s.value.kind === "BinaryExpr") {
          expect(s.value.op).toBe("+");
          expect(s.value.right.kind).toBe("BinaryExpr");
        }
      }
    });

    it("parses Mod", () => {
      const s = firstStmt("a = 3 Mod 2");
      if (s.kind === "VarAssign" && s.value.kind === "BinaryExpr") {
        expect(s.value.op).toBe("Mod");
      }
    });

    it("parses relational operators", () => {
      const s = firstStmt("a = 10 == 9");
      if (s.kind === "VarAssign" && s.value.kind === "BinaryExpr") {
        expect(s.value.op).toBe("==");
      }
    });

    it("parses <> operator", () => {
      const s = firstStmt("a = 10 <> 5");
      if (s.kind === "VarAssign" && s.value.kind === "BinaryExpr") {
        expect(s.value.op).toBe("<>");
      }
    });

    it("parses boolean operators", () => {
      const s = firstStmt("a = b And c Or d");
      // Should be: (b And c) Or d
      if (s.kind === "VarAssign" && s.value.kind === "BinaryExpr") {
        expect(s.value.op).toBe("Or");
      }
    });

    it("parses Not", () => {
      const s = firstStmt("a = Not b");
      if (s.kind === "VarAssign") {
        expect(s.value.kind).toBe("UnaryExpr");
        if (s.value.kind === "UnaryExpr") {
          expect(s.value.op).toBe("Not");
        }
      }
    });

    it("parses unary minus", () => {
      const s = firstStmt("a = -5");
      if (s.kind === "VarAssign") {
        expect(s.value.kind).toBe("UnaryExpr");
        if (s.value.kind === "UnaryExpr") {
          expect(s.value.op).toBe("-");
        }
      }
    });

    it("parses parenthesised expressions", () => {
      const s = firstStmt("a = (3 + 4) * 2");
      if (s.kind === "VarAssign" && s.value.kind === "BinaryExpr") {
        expect(s.value.op).toBe("*");
        expect(s.value.left.kind).toBe("BinaryExpr");
      }
    });
  });

  describe("function calls", () => {
    it("parses function call with args", () => {
      const s = firstStmt('Print("hello")');
      expect(s.kind).toBe("ExprStmt");
      if (s.kind === "ExprStmt") {
        expect(s.expr.kind).toBe("CallExpr");
        if (s.expr.kind === "CallExpr") {
          expect(s.expr.callee).toBe("Print");
          expect(s.expr.args).toHaveLength(1);
        }
      }
    });

    it("parses function call with no args", () => {
      const s = firstStmt("Foo()");
      if (s.kind === "ExprStmt" && s.expr.kind === "CallExpr") {
        expect(s.expr.args).toHaveLength(0);
      }
    });
  });

  describe("conditions", () => {
    it("parses single-line If..Then", () => {
      const s = firstStmt('If a > 5 Then Print("big")');
      expect(s.kind).toBe("IfStmt");
      if (s.kind === "IfStmt") {
        expect(s.body).toHaveLength(1);
        expect(s.elseBody).toHaveLength(0);
      }
    });

    it("parses single-line If..Then..Else", () => {
      const s = firstStmt('If a > 5 Then Print("big") Else Print("small")');
      expect(s.kind).toBe("IfStmt");
      if (s.kind === "IfStmt") {
        expect(s.body).toHaveLength(1);
        expect(s.elseBody).toHaveLength(1);
      }
    });

    it("parses multi-line If..EndIf", () => {
      const s = firstStmt(`If a > 5
  b = 1
EndIf`);
      expect(s.kind).toBe("IfStmt");
      if (s.kind === "IfStmt") {
        expect(s.body).toHaveLength(1);
      }
    });

    it("parses If..ElseIf..Else..EndIf", () => {
      const s = firstStmt(`If a == 0
  b = 1
ElseIf a == 1
  b = 2
Else
  b = 3
EndIf`);
      expect(s.kind).toBe("IfStmt");
      if (s.kind === "IfStmt") {
        expect(s.elseIfs).toHaveLength(1);
        expect(s.elseBody).toHaveLength(1);
      }
    });

    it("parses Select..Case..Default..EndSelect", () => {
      const s = firstStmt(`Select n
  Case 1
    a = 1
  Case 2
    a = 2
  Default
    a = 0
EndSelect`);
      expect(s.kind).toBe("SelectStmt");
      if (s.kind === "SelectStmt") {
        expect(s.cases).toHaveLength(2);
        expect(s.defaultBody).toHaveLength(1);
      }
    });
  });

  describe("loops", () => {
    it("parses Do..Loop", () => {
      const s = firstStmt(`Do
  a = 1
Loop`);
      expect(s.kind).toBe("DoLoopStmt");
    });

    it("parses While..EndWhile", () => {
      const s = firstStmt(`While a < 10
  a = a + 1
EndWhile`);
      expect(s.kind).toBe("WhileStmt");
    });

    it("parses Repeat..Until", () => {
      const s = firstStmt(`Repeat
  a = a + 1
Until a == 10`);
      expect(s.kind).toBe("RepeatUntilStmt");
    });

    it("parses For..To..Next", () => {
      const s = firstStmt(`For i = 1 To 10
  a = i
Next`);
      expect(s.kind).toBe("ForStmt");
      if (s.kind === "ForStmt") {
        expect(s.variable).toBe("i");
        expect(s.step).toBeNull();
      }
    });

    it("parses For..To..Step..Next", () => {
      const s = firstStmt(`For i = 10 To 1 Step -1
  a = i
Next`);
      expect(s.kind).toBe("ForStmt");
      if (s.kind === "ForStmt") {
        expect(s.step).not.toBeNull();
      }
    });

    it("parses For..In..Next", () => {
      const s = firstStmt(`For word In ["hello", "world"]
  a = word
Next`);
      expect(s.kind).toBe("ForInStmt");
    });

    it("parses Continue", () => {
      const s = firstStmt("Continue");
      expect(s.kind).toBe("ContinueStmt");
    });

    it("parses Exit", () => {
      const s = firstStmt("Exit");
      expect(s.kind).toBe("ExitStmt");
    });
  });

  describe("functions", () => {
    it("parses function declaration", () => {
      const s = firstStmt(`Function HalfValue(value As Int) As Int
  Return value / 2
EndFunction`);
      expect(s.kind).toBe("FunctionDecl");
      if (s.kind === "FunctionDecl") {
        expect(s.name).toBe("HalfValue");
        expect(s.params).toHaveLength(1);
        expect(s.returnType?.kind).toBe("SimpleType");
        expect(s.body).toHaveLength(1);
      }
    });

    it("parses function with no return type", () => {
      const s = firstStmt(`Function DoStuff()
  a = 1
EndFunction`);
      if (s.kind === "FunctionDecl") {
        expect(s.returnType).toBeNull();
      }
    });

    it("parses return statement with value", () => {
      const prog = p(`Function Foo() As Int
  Return 42
EndFunction`);
      const fn = prog.statements[0];
      if (fn.kind === "FunctionDecl") {
        const ret = fn.body[0];
        expect(ret.kind).toBe("ReturnStmt");
        if (ret.kind === "ReturnStmt") {
          expect(ret.value?.kind).toBe("IntLiteral");
        }
      }
    });
  });

  describe("include and import", () => {
    it("parses Include", () => {
      const s = firstStmt('Include "file.nb"');
      expect(s.kind).toBe("IncludeStmt");
      if (s.kind === "IncludeStmt") {
        expect(s.path).toBe("file.nb");
      }
    });

    it("parses Import", () => {
      const s = firstStmt('Import "ext"');
      expect(s.kind).toBe("ImportStmt");
      if (s.kind === "ImportStmt") {
        expect(s.moduleName).toBe("ext");
      }
    });
  });

  describe("colon separator", () => {
    it("parses multiple statements on one line", () => {
      const prog = p("a = 1 : b = 2");
      expect(prog.statements).toHaveLength(2);
    });
  });

  describe("complex programs", () => {
    it("parses a multi-statement program", () => {
      const prog = p(`Const PI = 3
a = PI + 1
If a > 3
  b = a * 2
EndIf`);
      expect(prog.statements).toHaveLength(3);
    });
  });
});
