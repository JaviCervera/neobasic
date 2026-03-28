import { describe, it, expect, vi, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import { compileSource } from "../../src/compiler.js";

const nodeRequire = createRequire(import.meta.url);

function run(source: string, vars: string[]): Record<string, unknown> {
  const js = compileSource(source);
  const fn = new Function(js + `\nreturn { ${vars.join(", ")} };`);
  return fn();
}

function runWithRequire(source: string, vars: string[]): Record<string, unknown> {
  const js = compileSource(source);
  const fn = new Function("require", js + `\nreturn { ${vars.join(", ")} };`);
  return fn(nodeRequire);
}

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

describe("Math", () => {
  it("Abs positive", () => {
    const r = run(`r = Abs(3.5)`, ["r"]);
    expect(r.r).toBeCloseTo(3.5);
  });

  it("Abs negative", () => {
    const r = run(`r = Abs(-7.2)`, ["r"]);
    expect(r.r).toBeCloseTo(7.2);
  });

  it("Ceil", () => {
    const r = run(`r = Ceil(2.1)`, ["r"]);
    expect(r.r).toBeCloseTo(3);
  });

  it("Floor", () => {
    const r = run(`r = Floor(2.9)`, ["r"]);
    expect(r.r).toBeCloseTo(2);
  });

  it("Sqrt", () => {
    const r = run(`r = Sqrt(9.0)`, ["r"]);
    expect(r.r).toBeCloseTo(3);
  });

  it("Exp", () => {
    const r = run(`r = Exp(1.0)`, ["r"]);
    expect(r.r).toBeCloseTo(Math.E, 10);
  });

  it("Log", () => {
    const r = run(`r = Log(2.718281828)`, ["r"]);
    expect(r.r).toBeCloseTo(1, 5);
  });

  it("Pow", () => {
    const r = run(`r = Pow(2.0, 10.0)`, ["r"]);
    expect(r.r).toBeCloseTo(1024);
  });

  it("Sin", () => {
    const r = run(`r = Sin(0.0)`, ["r"]);
    expect(r.r).toBeCloseTo(0);
  });

  it("Cos", () => {
    const r = run(`r = Cos(0.0)`, ["r"]);
    expect(r.r).toBeCloseTo(1);
  });

  it("Tan", () => {
    const r = run(`r = Tan(0.0)`, ["r"]);
    expect(r.r).toBeCloseTo(0);
  });

  it("ASin", () => {
    const r = run(`r = ASin(1.0)`, ["r"]);
    expect(r.r).toBeCloseTo(Math.PI / 2, 10);
  });

  it("ACos", () => {
    const r = run(`r = ACos(1.0)`, ["r"]);
    expect(r.r).toBeCloseTo(0, 10);
  });

  it("ATan", () => {
    const r = run(`r = ATan(1.0)`, ["r"]);
    expect(r.r).toBeCloseTo(Math.PI / 4, 10);
  });

  it("ATan2", () => {
    const r = run(`r = ATan2(1.0, 1.0)`, ["r"]);
    expect(r.r).toBeCloseTo(Math.PI / 4, 10);
  });

  it("Max", () => {
    const r = run(`r = Max(3.0, 7.0)`, ["r"]);
    expect(r.r).toBeCloseTo(7);
  });

  it("Min", () => {
    const r = run(`r = Min(3.0, 7.0)`, ["r"]);
    expect(r.r).toBeCloseTo(3);
  });

  it("Clamp below min", () => {
    const r = run(`r = Clamp(-5.0, 0.0, 10.0)`, ["r"]);
    expect(r.r).toBeCloseTo(0);
  });

  it("Clamp within range", () => {
    const r = run(`r = Clamp(5.0, 0.0, 10.0)`, ["r"]);
    expect(r.r).toBeCloseTo(5);
  });

  it("Clamp above max", () => {
    const r = run(`r = Clamp(15.0, 0.0, 10.0)`, ["r"]);
    expect(r.r).toBeCloseTo(10);
  });

  it("Sgn negative", () => {
    const r = run(`r = Sgn(-3.0)`, ["r"]);
    expect(r.r).toBeCloseTo(-1);
  });

  it("Sgn zero", () => {
    const r = run(`r = Sgn(0.0)`, ["r"]);
    expect(r.r).toBeCloseTo(0);
  });

  it("Sgn positive", () => {
    const r = run(`r = Sgn(5.0)`, ["r"]);
    expect(r.r).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// Math (degrees)
// ---------------------------------------------------------------------------

describe("Math (degrees)", () => {
  it("SinDeg 90 = 1", () => {
    const r = run(`r = SinDeg(90.0)`, ["r"]);
    expect(r.r).toBeCloseTo(1, 10);
  });

  it("CosDeg 0 = 1", () => {
    const r = run(`r = CosDeg(0.0)`, ["r"]);
    expect(r.r).toBeCloseTo(1, 10);
  });

  it("CosDeg 90 = 0", () => {
    const r = run(`r = CosDeg(90.0)`, ["r"]);
    expect(r.r).toBeCloseTo(0, 10);
  });

  it("TanDeg 45 = 1", () => {
    const r = run(`r = TanDeg(45.0)`, ["r"]);
    expect(r.r).toBeCloseTo(1, 10);
  });

  it("ASinDeg 1 = 90", () => {
    const r = run(`r = ASinDeg(1.0)`, ["r"]);
    expect(r.r).toBeCloseTo(90, 10);
  });

  it("ACosDeg 1 = 0", () => {
    const r = run(`r = ACosDeg(1.0)`, ["r"]);
    expect(r.r).toBeCloseTo(0, 10);
  });

  it("ATanDeg 1 = 45", () => {
    const r = run(`r = ATanDeg(1.0)`, ["r"]);
    expect(r.r).toBeCloseTo(45, 10);
  });

  it("ATan2Deg 1,1 = 45", () => {
    const r = run(`r = ATan2Deg(1.0, 1.0)`, ["r"]);
    expect(r.r).toBeCloseTo(45, 10);
  });
});

// ---------------------------------------------------------------------------
// String
// ---------------------------------------------------------------------------

describe("String", () => {
  it("Str", () => {
    const r = run(`s = Str(42)`, ["s"]);
    expect(r.s).toBe("42");
  });

  it("StrF", () => {
    const r = run(`s = StrF(3.14)`, ["s"]);
    expect(r.s).toBe("3.14");
  });

  it("Val", () => {
    const r = run(`a = Val("123")`, ["a"]);
    expect(r.a).toBe(123);
  });

  it("ValF", () => {
    const r = run(`a = ValF("1.5")`, ["a"]);
    expect(r.a).toBeCloseTo(1.5);
  });

  it("Len", () => {
    const r = run(`a = Len("hello")`, ["a"]);
    expect(r.a).toBe(5);
  });

  it("Left", () => {
    const r = run(`s = Left("hello", 3)`, ["s"]);
    expect(r.s).toBe("hel");
  });

  it("Left count 0", () => {
    const r = run(`s = Left("hello", 0)`, ["s"]);
    expect(r.s).toBe("");
  });

  it("Right", () => {
    const r = run(`s = Right("hello", 3)`, ["s"]);
    expect(r.s).toBe("llo");
  });

  it("Right count 0", () => {
    const r = run(`s = Right("hello", 0)`, ["s"]);
    expect(r.s).toBe("");
  });

  it("Mid", () => {
    const r = run(`s = Mid("hello", 1, 3)`, ["s"]);
    expect(r.s).toBe("ell");
  });

  it("Upper", () => {
    const r = run(`s = Upper("hello")`, ["s"]);
    expect(r.s).toBe("HELLO");
  });

  it("Lower", () => {
    const r = run(`s = Lower("HELLO")`, ["s"]);
    expect(r.s).toBe("hello");
  });

  it("Trim", () => {
    const r = run(`s = Trim("  hi  ")`, ["s"]);
    expect(r.s).toBe("hi");
  });

  it("Replace", () => {
    const r = run(`s = Replace("aabbaa", "a", "x")`, ["s"]);
    expect(r.s).toBe("xxbbxx");
  });

  it("Find found", () => {
    const r = run(`a = Find("hello world", "world", 0)`, ["a"]);
    expect(r.a).toBe(6);
  });

  it("Find not found", () => {
    const r = run(`a = Find("hello", "xyz", 0)`, ["a"]);
    expect(r.a).toBe(-1);
  });

  it("Find with offset", () => {
    const r = run(`a = Find("abcabc", "a", 1)`, ["a"]);
    expect(r.a).toBe(3);
  });

  it("Split", () => {
    const r = run(`a = Split("x,y,z", ",")`, ["a"]);
    const arr = r.a as string[];
    expect(arr[0]).toBe("x");
    expect(arr[1]).toBe("y");
    expect(arr[2]).toBe("z");
  });

  it("Join", () => {
    const r = run(`a As String[] = ["x", "y", "z"]\nb = Join(a, "-")`, ["b"]);
    expect(r.b).toBe("x-y-z");
  });
});

// ---------------------------------------------------------------------------
// Char functions
// ---------------------------------------------------------------------------

describe("Char functions", () => {
  it("Asc", () => {
    const r = run(`a = Asc("ABC", 0)`, ["a"]);
    expect(r.a).toBe(65);
  });

  it("Asc index 1", () => {
    const r = run(`a = Asc("ABC", 1)`, ["a"]);
    expect(r.a).toBe(66);
  });

  it("Chr", () => {
    const r = run(`s = Chr(65)`, ["s"]);
    expect(r.s).toBe("A");
  });
});

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

describe("Filename helpers", () => {
  it("StripDir removes directory", () => {
    const r = run(`s = StripDir("path/to/file.txt")`, ["s"]);
    expect(r.s).toBe("file.txt");
  });

  it("StripDir no directory", () => {
    const r = run(`s = StripDir("file.txt")`, ["s"]);
    expect(r.s).toBe("file.txt");
  });

  it("StripDir backslash", () => {
    const r = run(`s = StripDir("path\\\\to\\\\file.txt")`, ["s"]);
    expect(r.s).toBe("file.txt");
  });

  it("ExtractDir returns directory with trailing slash", () => {
    const r = run(`s = ExtractDir("path/to/file.txt")`, ["s"]);
    expect(r.s).toBe("path/to/");
  });

  it("ExtractDir no directory returns empty", () => {
    const r = run(`s = ExtractDir("file.txt")`, ["s"]);
    expect(r.s).toBe("");
  });

  it("StripExt removes extension", () => {
    const r = run(`s = StripExt("file.txt")`, ["s"]);
    expect(r.s).toBe("file");
  });

  it("StripExt with path", () => {
    const r = run(`s = StripExt("path/to/file.txt")`, ["s"]);
    expect(r.s).toBe("path/to/file");
  });

  it("StripExt dotfile unchanged", () => {
    const r = run(`s = StripExt(".htaccess")`, ["s"]);
    expect(r.s).toBe(".htaccess");
  });

  it("StripExt no extension", () => {
    const r = run(`s = StripExt("noext")`, ["s"]);
    expect(r.s).toBe("noext");
  });

  it("ExtractExt returns extension without dot", () => {
    const r = run(`s = ExtractExt("file.txt")`, ["s"]);
    expect(r.s).toBe("txt");
  });

  it("ExtractExt dotfile returns empty", () => {
    const r = run(`s = ExtractExt(".htaccess")`, ["s"]);
    expect(r.s).toBe("");
  });

  it("ExtractExt no extension returns empty", () => {
    const r = run(`s = ExtractExt("noext")`, ["s"]);
    expect(r.s).toBe("");
  });

  it("ExtractExt with path", () => {
    const r = run(`s = ExtractExt("path/to/file.txt")`, ["s"]);
    expect(r.s).toBe("txt");
  });
});

// ---------------------------------------------------------------------------
// IO
// ---------------------------------------------------------------------------

describe("IO", () => {
  it("Print calls console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    run(`Print("hello")`, []);
    expect(spy).toHaveBeenCalledWith("hello");
    spy.mockRestore();
  });

  const tmpFile = path.join(os.tmpdir(), `neobasic_core_test_${Date.now()}.txt`);

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it("SaveString writes a file (overwrite)", () => {
    runWithRequire(`SaveString("${tmpFile.replace(/\\/g, "\\\\")}", "hello", False)`, []);
    expect(fs.readFileSync(tmpFile, "utf8")).toBe("hello");
  });

  it("SaveString appends to a file", () => {
    runWithRequire(`SaveString("${tmpFile.replace(/\\/g, "\\\\")}", "hello", False)`, []);
    runWithRequire(`SaveString("${tmpFile.replace(/\\/g, "\\\\")}", " world", True)`, []);
    expect(fs.readFileSync(tmpFile, "utf8")).toBe("hello world");
  });

  it("SaveString overwrites existing content", () => {
    runWithRequire(`SaveString("${tmpFile.replace(/\\/g, "\\\\")}", "first", False)`, []);
    runWithRequire(`SaveString("${tmpFile.replace(/\\/g, "\\\\")}", "second", False)`, []);
    expect(fs.readFileSync(tmpFile, "utf8")).toBe("second");
  });

  it("LoadString reads a file", () => {
    fs.writeFileSync(tmpFile, "content", "utf8");
    const r = runWithRequire(`s = LoadString("${tmpFile.replace(/\\/g, "\\\\")}")`, ["s"]);
    expect(r.s).toBe("content");
  });

  it("LoadString returns empty string on missing file", () => {
    const r = runWithRequire(`s = LoadString("nonexistent_file_abc123.txt")`, ["s"]);
    expect(r.s).toBe("");
  });
});
