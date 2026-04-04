#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./compiler.js";
import { NeoBasicError } from "./errors.js";

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  if (args[0] === "--version" || args[0] === "-v") {
    console.log("neobasic 0.1.0");
    process.exit(0);
  }

  if (args[0] !== "-c") {
    console.error(`Unknown command: ${args[0]}`);
    printUsage();
    process.exit(1);
  }

  // Parse compile command options
  let inputFile: string | null = null;
  let outputFile: string | null = null;
  let emitToGlobal = false; // --emit: pass compiled JS to globalThis.__neobasic_emit instead of writing to disk
  let browserExport = false; // --browser: create browser bundle (.js + .html)

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "-o" || args[i] === "--output") {
      i++;
      if (i >= args.length) {
        console.error("Missing output file path after -o");
        process.exit(1);
      }
      outputFile = args[i];
    } else if (args[i] === "--emit") {
      emitToGlobal = true;
    } else if (args[i] === "--browser") {
      browserExport = true;
    } else if (args[i].startsWith("-")) {
      console.error(`Unknown option: ${args[i]}`);
      process.exit(1);
    } else {
      inputFile = args[i];
    }
  }

  if (!inputFile) {
    console.error("No input file specified");
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  // Default output: same name with .js extension
  if (!outputFile) {
    const parsed = path.parse(inputFile);
    outputFile = path.join(parsed.dir || ".", `${parsed.name}.js`);
  }

  try {
    const result = compile(inputFile!);

    if (browserExport) {
      writeBrowserBundle(inputFile!, outputFile!, result.js, false);
    } else {
      // --emit: hand code back to the C host via a registered global function
      // (used by `neobasic -r file.nb` to compile in memory without writing a file)
      const g = globalThis as Record<string, unknown>;
      if (emitToGlobal && typeof g.__neobasic_emit === "function") {
        (g.__neobasic_emit as (code: string) => void)(result.js);
      } else {
        fs.writeFileSync(outputFile!, result.js, "utf-8");
        console.log(`Compiled ${inputFile} -> ${outputFile}`);
      }
    }
  } catch (e) {
    if (e instanceof NeoBasicError) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

/**
 * Write a browser bundle: a self-contained .js file that embeds the
 * neobasic_browser_base.js runtime and the compiled program, plus a
 * minimal .html that loads it.
 *
 * @param inputFile  - original .nb source path (for display only)
 * @param jsOut      - output .js path
 * @param program    - compiled JS string (isBytecode=false) or base64 bytecode (isBytecode=true)
 * @param isBytecode - whether program is base64-encoded bytecode
 */
function writeBrowserBundle(
  inputFile: string,
  jsOut: string,
  program: string,
  isBytecode: boolean
): void {
  // Locate neobasic_browser_base.js next to neobasic.js (this file)
  const selfDir = path.dirname(fileURLToPath(import.meta.url));
  const basePath = path.join(selfDir, "neobasic_browser_base.js");
  if (!fs.existsSync(basePath)) {
    console.error(`Browser runtime not found: ${basePath}`);
    console.error(
      "Run  bash interpreter/build_browser.sh  first (requires Emscripten)."
    );
    process.exit(1);
  }
  const baseRuntime = fs.readFileSync(basePath, "utf-8");

  // Build the JS bundle: preamble that embeds the program + base runtime
  const jsBundle = buildBrowserJsPreamble(program, isBytecode) + "\n" + baseRuntime;

  // HTML path: same base name as JS, .html extension
  const htmlOut = jsOut.replace(/\.js$/i, ".html");
  const htmlJsFilename = path.basename(jsOut);

  fs.writeFileSync(jsOut, jsBundle, "utf-8");
  fs.writeFileSync(htmlOut, buildBrowserHtml(htmlJsFilename), "utf-8");
  console.log(`Browser export: ${jsOut}  ${htmlOut}`);
  console.log(`  (from: ${inputFile})`);
}

/**
 * Build the JS preamble that sets up Module.onRuntimeInitialized to run
 * the embedded program once the Emscripten runtime is ready.
 */
function buildBrowserJsPreamble(program: string, isBytecode: boolean): string {
  const progJson = JSON.stringify(program);
  if (isBytecode) {
    return `\
var Module = typeof Module !== 'undefined' ? Module : {};
Module.canvas = Module.canvas || document.getElementById('canvas');
(function () {
  var __nb_prog = ${progJson};
  var _orig = Module.onRuntimeInitialized;
  Module.onRuntimeInitialized = function () {
    if (_orig) _orig.call(this);
    var bin = atob(__nb_prog);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var ptr = Module._malloc(bytes.length);
    Module.HEAPU8.set(bytes, ptr);
    Module.ccall('nb_run_bytecode', null, ['number', 'number'],
                 [ptr, bytes.length], { async: true });
    Module._free(ptr);
  };
})();`;
  } else {
    return `\
var Module = typeof Module !== 'undefined' ? Module : {};
Module.canvas = Module.canvas || document.getElementById('canvas');
(function () {
  var __nb_prog = ${progJson};
  var _orig = Module.onRuntimeInitialized;
  Module.onRuntimeInitialized = function () {
    if (_orig) _orig.call(this);
    Module.ccall('nb_run_js', null, ['string'], [__nb_prog], { async: true });
  };
})();`;
  }
}

/** Minimal HTML that loads the JS bundle and provides a fullscreen canvas. */
function buildBrowserHtml(jsFilename: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NeoBasic</title>
  <style>
    * { margin: 0; padding: 0; }
    body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script src="${jsFilename}"></script>
</body>
</html>
`;
}

function printUsage(): void {
  console.log(`Usage: neobasic -c <file.nb> [-o <output.js>] [--browser]

Options:
  -c <file.nb>          Compile a NeoBasic source file to JavaScript
  -o, --output <file>   Output file path (default: <input>.js)
  --browser             Export as browser bundle (.js + .html) instead of plain JS
  --emit                Pass compiled JS to globalThis.__neobasic_emit (internal)
  -h, --help            Show this help message
  -v, --version         Show version`);
}

main();
