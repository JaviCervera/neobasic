import { describe, it, expect } from "vitest";
import { lex } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import { check, STRING, type CheckerEnv, type FuncSymbol } from "../../src/checker/index.js";

function c(source: string, env?: Partial<CheckerEnv>) {
  return check(parse(lex(source)), "<test>", env);
}

function expectNoError(source: string, env?: Partial<CheckerEnv>) {
  expect(() => c(source, env)).not.toThrow();
}

function expectError(source: string, pattern: string | RegExp, env?: Partial<CheckerEnv>) {
  expect(() => c(source, env)).toThrow(pattern);
}

describe("Checker", () => {
  describe("variable declarations", () => {
    it("infers type from integer literal", () => {
      const res = c("a = 25");
      expect(res.env.vars.get("a")?.type.kind).toBe("Int");
    });

    it("infers type from float literal", () => {
      const res = c("a = 3.14");
      expect(res.env.vars.get("a")?.type.kind).toBe("Float");
    });

    it("infers type from string literal", () => {
      const res = c('a = "hello"');
      expect(res.env.vars.get("a")?.type.kind).toBe("String");
    });

    it("uses explicit type annotation", () => {
      const res = c("b As Float = 1");
      expect(res.env.vars.get("b")?.type.kind).toBe("Float");
    });

    it("rejects reassignment with incompatible type", () => {
      expectError('a = "hello"\na = 5', /Cannot assign Int to String/);
    });

    it("rejects Null without type annotation", () => {
      expectError("a = Null", /Cannot infer type from Null/);
    });

    it("allows Null with UDT type annotation", () => {
      expectNoError("Type Person\n  Name As String\nEndType\np As Person = Null");
    });

    it("rejects duplicate variable declarations", () => {
      expectError("a As Int\na As Int", /already declared/);
    });
  });

  describe("constants", () => {
    it("declares constant", () => {
      const res = c('Const HELLO = "hello"');
      expect(res.env.vars.get("hello")?.isConst).toBe(true);
    });

    it("rejects assignment to constant", () => {
      expectError('Const HELLO = "hello"\nHELLO = "world"', /Cannot assign to constant/);
    });
  });

  describe("arithmetic", () => {
    it("Int + Int = Int", () => {
      const res = c("a = 3 + 4");
      expect(res.env.vars.get("a")?.type.kind).toBe("Int");
    });

    it("Int + Float = Float", () => {
      const res = c("a = 3 + 4.0");
      expect(res.env.vars.get("a")?.type.kind).toBe("Float");
    });

    it("Int / Int = Int", () => {
      const res = c("a = 8 / 4");
      expect(res.env.vars.get("a")?.type.kind).toBe("Int");
    });

    it("rejects string in arithmetic", () => {
      expectError('a = "hello" + 5', /requires numeric operands/);
    });

    it("string + string = string", () => {
      const res = c('a = "hello" + " world"');
      expect(res.env.vars.get("a")?.type.kind).toBe("String");
    });
  });

  describe("comparisons", () => {
    it("Int == Int = Bool", () => {
      const res = c("a = 10 == 10");
      expect(res.env.vars.get("a")?.type.kind).toBe("Bool");
    });

    it("allows comparing Int and Float", () => {
      expectNoError("a = 10 > 5.0");
    });

    it("rejects comparing incompatible types", () => {
      expectError('a = 10 == "hello"', /Cannot compare/);
    });
  });

  describe("boolean operators", () => {
    it("And produces Bool", () => {
      const res = c("a = True And False");
      expect(res.env.vars.get("a")?.type.kind).toBe("Bool");
    });

    it("Not produces Bool", () => {
      const res = c("a = Not True");
      expect(res.env.vars.get("a")?.type.kind).toBe("Bool");
    });
  });

  describe("functions", () => {
    it("type-checks function declaration and call", () => {
      expectNoError(`Function Double(x As Int) As Int
  Return x * 2
EndFunction
a = Double(5)`);
    });

    it("rejects wrong argument type", () => {
      expectError(`Function Foo(x As Int) As Int
  Return x
EndFunction
a = Foo("hello")`, /cannot assign String to Int/);
    });

    it("rejects wrong number of arguments", () => {
      expectError(`Function Foo(x As Int) As Int
  Return x
EndFunction
a = Foo(1, 2)`, /expects 1 arguments, got 2/);
    });

    it("rejects wrong return type", () => {
      expectError(`Function Foo() As Int
  Return "hello"
EndFunction`, /Cannot return String from function expecting Int/);
    });

    it("allows calling functions before their declaration (hoisting)", () => {
      expectNoError(`a = Double(5)
Function Double(x As Int) As Int
  Return x * 2
EndFunction`);
    });
  });

  describe("user-defined types", () => {
    it("checks type declaration and field access", () => {
      expectNoError(`Type Person
  Name As String
  Age As Int
EndType
p As Person = New Person
a = p.Name`);
    });

    it("rejects unknown field", () => {
      expectError(`Type Person
  Name As String
EndType
p As Person = New Person
a = p.Unknown`, /has no field/);
    });

    it("rejects member access on non-UDT", () => {
      expectError("a = 5\nb = a.Foo", /Cannot access member/);
    });
  });

  describe("arrays", () => {
    it("checks array indexing", () => {
      expectNoError("arr As Int[] = [1, 2, 3]\na = arr[0]");
    });

    it("rejects non-integer index", () => {
      expectError('arr As Int[] = [1, 2, 3]\na = arr["hi"]', /Array index must be Int/);
    });

    it("checks array.Length access", () => {
      expectNoError("arr As Int[] = [1, 2, 3]\na = arr.Length");
    });

    it("rejects heterogeneous array literal", () => {
      expectError('a = [1, "hello"]', /Array literal: element 1 has type String, expected Int/);
    });
  });

  describe("control flow", () => {
    it("checks If conditions", () => {
      expectNoError("a = 5\nIf a > 3\n  b = 1\nEndIf");
    });

    it("checks While conditions", () => {
      expectNoError("a = 0\nWhile a < 10\n  a = a + 1\nEndWhile");
    });

    it("checks For loop", () => {
      expectNoError("For i = 1 To 10\n  a = i\nNext");
    });

    it("checks For..In loop", () => {
      expectNoError('For word In ["hello", "world"]\n  a = word\nNext');
    });

    it("rejects For..In on non-array", () => {
      expectError("For x In 42\n  a = x\nNext", /requires an array/);
    });
  });

  describe("external functions", () => {
    it("accepts pre-registered external functions", () => {
      const funcs = new Map<string, FuncSymbol>();
      funcs.set("print", {
        params: [{ name: "msg", type: STRING }],
        returnType: { kind: "Void" },
        isExternal: true,
        externalName: "print",
      });
      expectNoError('Print("hello")', { funcs });
    });
  });
});
