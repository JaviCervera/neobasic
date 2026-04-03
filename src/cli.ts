#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
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
    // --emit: hand code back to the C host via a registered global function
    // (used by `neobasic -r file.nb` to compile in memory without writing a file)
    const g = globalThis as Record<string, unknown>;
    if (emitToGlobal && typeof g.__neobasic_emit === "function") {
      (g.__neobasic_emit as (code: string) => void)(result.js);
    } else {
      fs.writeFileSync(outputFile!, result.js, "utf-8");
      console.log(`Compiled ${inputFile} -> ${outputFile}`);
    }
  } catch (e) {
    if (e instanceof NeoBasicError) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

function printUsage(): void {
  console.log(`Usage: neobasic -c <file.nb> [-o <output.js>]

Options:
  -c <file.nb>          Compile a NeoBasic source file to JavaScript
  -o, --output <file>   Output file path (default: <input>.js)
  --emit                Pass compiled JS to globalThis.__neobasic_emit (internal)
  -h, --help            Show this help message
  -v, --version         Show version`);
}

main();
