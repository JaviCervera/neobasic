import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { lex } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import { check } from "../../src/checker/index.js";
import { generate } from "../../src/codegen/index.js";
import { compile } from "../../src/compiler.js";

const FIXTURES = path.join(import.meta.dirname, "fixtures");

/** Compile a .nb fixture to JS, run it, return the global scope */
function compileAndRun(filename: string): Record<string, unknown> {
  const source = fs.readFileSync(path.join(FIXTURES, filename), "utf-8");
  const tokens = lex(source, filename);
  const ast = parse(tokens, filename);
  const result = check(ast, filename);
  const js = generate(ast, result);

  // Wrap in a function to capture variables, then return them
  // We run with eval since these are simple test programs
  const fn = new Function(`
    ${js}
    return { ${extractVarNames(js).join(", ")} };
  `);
  return fn();
}

/** Extract top-level variable names from generated JS */
function extractVarNames(js: string): string[] {
  const names = new Set<string>();
  // Match: "varname = " at the start of a line (not inside a function)
  // and "let varname = "
  for (const line of js.split("\n")) {
    const trimmed = line.trim();
    const letMatch = trimmed.match(/^let (\w+) =/);
    if (letMatch) names.add(letMatch[1]);
    const assignMatch = trimmed.match(/^(\w+) =/);
    if (assignMatch && !trimmed.startsWith("const ") && !trimmed.startsWith("let ") && !trimmed.startsWith("function ")) {
      names.add(assignMatch[1]);
    }
    const constMatch = trimmed.match(/^const (\w+) =/);
    if (constMatch && !constMatch[1].startsWith("__")) names.add(constMatch[1]);
  }
  return [...names];
}

describe("Integration Tests", () => {
  describe("variables.nb", () => {
    it("compiles and runs correctly", () => {
      const scope = compileAndRun("variables.nb");
      expect(scope.a).toBe(25);
      expect(scope.b).toBeCloseTo(162.36);
      expect(scope.c).toBe("hello");
      expect(scope.pi).toBe(3);
    });
  });

  describe("functions.nb", () => {
    it("compiles and runs correctly", () => {
      const scope = compileAndRun("functions.nb");
      expect(scope.result).toBe(10); // Double(5) = 10
      expect(scope.result2).toBe(7); // Add(3, 4) = 7
    });
  });

  describe("recursion.nb", () => {
    it("compiles and runs correctly", () => {
      const scope = compileAndRun("recursion.nb");
      expect(scope.result).toBe(120); // 5! = 120
    });
  });

  describe("udts.nb", () => {
    it("compiles and runs correctly", () => {
      const scope = compileAndRun("udts.nb");
      expect(scope.p).toEqual({ name: "John", age: 30 });
      expect(scope.name).toBe("John");
      expect(scope.age).toBe(30);
    });
  });

  describe("arrays.nb", () => {
    it("compiles and runs correctly", () => {
      const scope = compileAndRun("arrays.nb");
      expect(scope.first).toBe(10);
      expect(scope.arr).toEqual([10, 99, 30]);
      expect(scope.len).toBe(2); // length is index of last element: 3 elements → 2
    });
  });

  describe("loops.nb", () => {
    it("compiles and runs correctly", () => {
      const scope = compileAndRun("loops.nb");
      expect(scope.a).toBe(5);         // While loop
      expect(scope.sum).toBe(55);       // For 1..10
      expect(scope.sum2).toBe(55);      // For 10..1 Step -1
      expect(scope.total).toBe(15);     // For..In [1,2,3,4,5]
      expect(scope.count).toBe(3);      // Do..Loop with Exit at 3
      expect(scope.r).toBe(5);          // Repeat..Until
    });
  });

  describe("module bundling", () => {
    const moduleFixture = path.join(FIXTURES, "module-import.nb");

    it("bundles module as IIFE", () => {
      const result = compile(moduleFixture);
      expect(result.js).toContain("const testmod = (() => {");
      expect(result.js).toContain("const module = { exports: {} };");
      expect(result.js).toContain("return module.exports;");
      expect(result.js).toContain("})();");
      expect(result.js).not.toContain("require(");
    });

    it("bundled output runs correctly", () => {
      const result = compile(moduleFixture);
      const fn = new Function(`${result.js}\nreturn { result };`);
      expect(fn().result).toBe(42); // Double(21) = 42
    });
  });

  describe("complex expressions", () => {
    it("integer division truncates", () => {
      const source = "a = 7 / 2";
      const tokens = lex(source);
      const ast = parse(tokens);
      const result = check(ast);
      const js = generate(ast, result);
      const fn = new Function(`${js}\nreturn { a };`);
      expect(fn().a).toBe(3);
    });

    it("Mod works correctly", () => {
      const source = "a = 7 Mod 3";
      const tokens = lex(source);
      const ast = parse(tokens);
      const result = check(ast);
      const js = generate(ast, result);
      const fn = new Function(`${js}\nreturn { a };`);
      expect(fn().a).toBe(1);
    });

    it("string concatenation works", () => {
      const source = 'a = "hello" + " world"';
      const tokens = lex(source);
      const ast = parse(tokens);
      const result = check(ast);
      const js = generate(ast, result);
      const fn = new Function(`${js}\nreturn { a };`);
      expect(fn().a).toBe("hello world");
    });

    it("boolean operators work", () => {
      const source = "a = True And False\nb = True Or False\nc = Not True";
      const tokens = lex(source);
      const ast = parse(tokens);
      const result = check(ast);
      const js = generate(ast, result);
      const fn = new Function(`${js}\nreturn { a, b, c };`);
      const scope = fn();
      expect(scope.a).toBe(false);
      expect(scope.b).toBe(true);
      expect(scope.c).toBe(false);
    });

    it("Select statement works", () => {
      const source = `n = 2
Select n
  Case 1
    result = 10
  Case 2
    result = 20
  Default
    result = 0
EndSelect`;
      const tokens = lex(source);
      const ast = parse(tokens);
      const result = check(ast);
      const js = generate(ast, result);
      const fn = new Function(`${js}\nreturn { n, result };`);
      expect(fn().result).toBe(20);
    });

    it("ElseIf works", () => {
      const source = `a = 4
If a == 0
  result = 0
ElseIf a Mod 2 == 0
  result = 1
Else
  result = 2
EndIf`;
      const tokens = lex(source);
      const ast = parse(tokens);
      const result = check(ast);
      const js = generate(ast, result);
      const fn = new Function(`${js}\nreturn { a, result };`);
      expect(fn().result).toBe(1);
    });

    it("Continue in loops works", () => {
      const source = `sum = 0
For i = 1 To 10
  If i Mod 2 == 0 Then Continue
  sum = sum + i
Next`;
      const tokens = lex(source);
      const ast = parse(tokens);
      const result = check(ast);
      const js = generate(ast, result);
      const fn = new Function(`${js}\nreturn { sum };`);
      expect(fn().sum).toBe(25); // 1+3+5+7+9
    });
  });
});
