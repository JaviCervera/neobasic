import { describe, it, expect } from "vitest";
import { lex } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import { check, type CheckerEnv, type FuncSymbol, STRING, VOID } from "../../src/checker/index.js";
import { generate } from "../../src/codegen/index.js";

function gen(source: string, env?: Partial<CheckerEnv>): string {
  const tokens = lex(source);
  const ast = parse(tokens);
  const result = check(ast, "<test>", env);
  return generate(ast, result);
}

function expectContains(source: string, expected: string, env?: Partial<CheckerEnv>) {
  const output = gen(source, env);
  expect(output).toContain(expected);
}

describe("Code Generator", () => {
  describe("variables", () => {
    it("emits variable assignment", () => {
      expectContains("a = 25", "a = 25;");
    });

    it("emits typed variable declaration", () => {
      expectContains("b As Float = 162.36", "let b = 162.36;");
    });

    it("emits declaration without initializer with default value", () => {
      expectContains("d As Int", "let d = 0;");
    });

    it("lowercases identifiers", () => {
      expectContains("MyVar = 5", "myvar = 5;");
    });
  });

  describe("constants", () => {
    it("emits const declaration", () => {
      expectContains('Const HELLO = "hello"', 'const hello = "hello";');
    });
  });

  describe("arithmetic", () => {
    it("emits basic arithmetic", () => {
      expectContains("a = 3 + 4", "(3 + 4)");
    });

    it("emits Mod as %", () => {
      expectContains("a = 3 Mod 2", "(3 % 2)");
    });

    it("emits Int / Int as Math.trunc", () => {
      expectContains("a = 7 / 2", "Math.trunc(7 / 2)");
    });

    it("does not trunc Float division", () => {
      const output = gen("a = 7.0 / 2.0");
      expect(output).not.toContain("Math.trunc");
      expect(output).toContain("(7 / 2)");
    });
  });

  describe("relational and boolean operators", () => {
    it("emits == as ===", () => {
      expectContains("a = 10 == 10", "(10 === 10)");
    });

    it("emits <> as !==", () => {
      expectContains("a = 10 <> 5", "(10 !== 5)");
    });

    it("emits And as &&", () => {
      expectContains("a = True And False", "(true && false)");
    });

    it("emits Or as ||", () => {
      expectContains("a = True Or False", "(true || false)");
    });

    it("emits Not as !", () => {
      expectContains("a = Not True", "(!true)");
    });
  });

  describe("strings", () => {
    it("emits string literals", () => {
      expectContains('a = "hello"', '"hello"');
    });
  });

  describe("conditions", () => {
    it("emits If..EndIf", () => {
      const output = gen("a = 5\nIf a > 3\n  b = 1\nEndIf");
      expect(output).toContain("if ((a > 3)) {");
      expect(output).toContain("b = 1;");
      expect(output).toContain("}");
    });

    it("emits If..Else..EndIf", () => {
      const output = gen("a = 5\nIf a > 3\n  b = 1\nElse\n  b = 2\nEndIf");
      expect(output).toContain("} else {");
    });

    it("emits Select as if/else chain", () => {
      const output = gen("n = 1\nSelect n\n  Case 1\n    a = 1\n  Case 2\n    a = 2\n  Default\n    a = 0\nEndSelect");
      expect(output).toContain("if (");
      expect(output).toContain("} else if (");
      expect(output).toContain("} else {");
    });
  });

  describe("loops", () => {
    it("emits Do..Loop as while(true)", () => {
      expectContains("Do\n  a = 1\nLoop", "while (true) {");
    });

    it("emits While..EndWhile", () => {
      expectContains("a = 0\nWhile a < 10\n  a = a + 1\nEndWhile", "while ((a < 10)) {");
    });

    it("emits Repeat..Until as do..while", () => {
      const output = gen("a = 0\nRepeat\n  a = a + 1\nUntil a == 10");
      expect(output).toContain("do {");
      expect(output).toContain("} while (!");
    });

    it("emits For..To..Next", () => {
      const output = gen("For i = 1 To 10\n  a = i\nNext");
      expect(output).toContain("for (let i = 1; i <= 10; i++) {");
    });

    it("emits For..To..Step..Next with step", () => {
      const output = gen("For i = 10 To 1 Step -1\n  a = i\nNext");
      expect(output).toContain("for (let i = 10;");
      expect(output).toContain("i += (-1))");
    });

    it("emits For..In as for..of", () => {
      const output = gen('For word In ["hello", "world"]\n  a = word\nNext');
      expect(output).toContain('for (const word of ["hello", "world"]) {');
    });

    it("emits Continue as continue", () => {
      expectContains("Do\n  Continue\nLoop", "continue;");
    });

    it("emits Exit as break", () => {
      expectContains("Do\n  Exit\nLoop", "break;");
    });
  });

  describe("functions", () => {
    it("emits function declaration", () => {
      const output = gen("Function HalfValue(value As Int) As Int\n  Return value / 2\nEndFunction");
      expect(output).toContain("function halfvalue(value) {");
      expect(output).toContain("return Math.trunc(value / 2);");
    });

    it("emits function call", () => {
      const funcs = new Map<string, FuncSymbol>();
      funcs.set("print", {
        params: [{ name: "msg", type: STRING }],
        returnType: VOID,
        isExternal: true,
        externalName: "print",
      });
      expectContains('Print("hello")', 'print("hello")', { funcs });
    });
  });

  describe("user-defined types", () => {
    it("emits type factory function", () => {
      const output = gen("Type Person\n  Name As String\n  Age As Int\nEndType");
      expect(output).toContain("function person$$new() {");
      expect(output).toContain('name: "",');
      expect(output).toContain("age: 0,");
    });

    it("emits New as factory call", () => {
      const output = gen("Type Person\n  Name As String\nEndType\np As Person = New Person");
      expect(output).toContain("person$$new()");
    });

    it("emits member access", () => {
      const output = gen("Type Person\n  Name As String\nEndType\np As Person = New Person\na = p.Name");
      expect(output).toContain("p.name");
    });

    it("emits member assignment", () => {
      const output = gen('Type Person\n  Name As String\nEndType\np As Person = New Person\np.Name = "John"');
      expect(output).toContain('p.name = "John";');
    });
  });

  describe("arrays", () => {
    it("emits array literal", () => {
      expectContains("a = [1, 2, 3]", "[1, 2, 3]");
    });

    it("emits array index", () => {
      expectContains("arr As Int[] = [1, 2, 3]\na = arr[0]", "arr[0]");
    });

    it("emits array.Length as .length - 1", () => {
      const output = gen("arr As Int[] = [1, 2, 3]\na = arr.Length");
      expect(output).toContain("(arr.length - 1)");
    });

    it("emits array.Length setter as .length + 1", () => {
      const output = gen("arr As Int[] = [1, 2, 3]\narr.Length = 20");
      expect(output).toContain("arr.length = (20) + 1;");
    });
  });

  describe("module imports", () => {
    const coreFunc: FuncSymbol = {
      params: [{ name: "message", type: STRING }],
      returnType: VOID,
      isExternal: true,
      externalName: "core.print",
    };

    it("inlines module as IIFE", () => {
      const funcs = new Map<string, FuncSymbol>([["print", coreFunc]]);
      const tokens = lex('Print("hi")', undefined);
      const ast = parse(tokens);
      const result = check(ast, "<test>", { funcs });
      const output = generate(ast, result, {
        moduleContents: new Map([["core", 'module.exports = { print: function(m) {} };']]),
      });
      expect(output).toContain("const core = (() => {");
      expect(output).toContain("const module = { exports: {} };");
      expect(output).toContain("return module.exports;");
      expect(output).toContain("})();");
      expect(output).not.toContain("require(");
    });

    it("bundled output is executable and exposes module functions", () => {
      const funcs = new Map<string, FuncSymbol>([["print", coreFunc]]);
      const tokens = lex('Print("hi")', undefined);
      const ast = parse(tokens);
      const result = check(ast, "<test>", { funcs });
      const output = generate(ast, result, {
        moduleContents: new Map([["core", 'module.exports = { print: function(m) { return m; } };']]),
      });
      const fn = new Function(output);
      expect(() => fn()).not.toThrow();
    });
    it("wraps output in async IIFE when async option is set", () => {
      const funcs = new Map<string, FuncSymbol>([["print", coreFunc]]);
      const tokens = lex('Print("hi")', undefined);
      const ast = parse(tokens);
      const result = check(ast, "<test>", { funcs });
      const output = generate(ast, result, {
        moduleContents: new Map([["raylib", 'module.exports = { init: async function() {} };']]),
        asyncModules: new Set(["raylib"]),
        async: true,
      });
      expect(output).toContain("(async () => {");
      expect(output).toContain("await (async () => {");
      expect(output).toMatch(/\}\)\(\);\s*$/); // ends with })();
    });

    it("awaits only functions individually marked isAsync", () => {
      const asyncFunc: FuncSymbol = {
        params: [],
        returnType: VOID,
        isExternal: true,
        externalName: "mymod.doThing",
        isAsync: true,
      };
      const syncFunc: FuncSymbol = {
        params: [],
        returnType: VOID,
        isExternal: true,
        externalName: "mymod.otherThing",
        isAsync: false,
      };
      const funcs = new Map<string, FuncSymbol>([
        ["dothing", asyncFunc],
        ["otherthing", syncFunc],
      ]);
      const tokens = lex("DoThing()\nOtherThing()", undefined);
      const ast = parse(tokens);
      const result = check(ast, "<test>", { funcs });
      const output = generate(ast, result, {
        moduleContents: new Map([["mymod", "module.exports = {};"]]),
        async: true,
      });
      expect(output).toContain("await mymod.doThing()");
      expect(output).not.toContain("await mymod.otherThing()");
      expect(output).toContain("mymod.otherThing()");
    });

    it("does not use async IIFE when async option is false", () => {
      const funcs = new Map<string, FuncSymbol>([["print", coreFunc]]);
      const tokens = lex('Print("hi")', undefined);
      const ast = parse(tokens);
      const result = check(ast, "<test>", { funcs });
      const output = generate(ast, result, {
        moduleContents: new Map([["core", 'module.exports = { print: function(m) {} };']]),
      });
      expect(output).not.toContain("(async () => {");
      expect(output).not.toContain("await");
    });
  });

  describe("variable scoping", () => {
    it("emits let only once for variable first assigned inside an If block", () => {
      const output = gen("a = 1\nIf a == 1\n  b = 10\nEndIf\nb = 20");
      // b should get `let` on first assignment inside If, plain assignment outside
      const lines = output.split("\n").map(l => l.trim());
      expect(lines.filter(l => l === "let b = 10;")).toHaveLength(1);
      expect(lines.filter(l => l === "b = 20;")).toHaveLength(1);
      expect(lines.filter(l => l === "let b = 20;")).toHaveLength(0);
    });
  });

  describe("Null", () => {
    it("emits Null as null", () => {
      expectContains("Type Foo\n  X As Int\nEndType\na As Foo = Null", "let a = null;");
    });
  });
});
