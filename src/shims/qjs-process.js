// Injected as a global replacement for `process` in the QuickJS bundle.
// esbuild --inject replaces every free reference to `process` with this export.
import * as _std from "std";
import * as _os from "os";

// QuickJS only guarantees console.log; polyfill the rest.
if (typeof console.error !== "function") console.error = console.log;
if (typeof console.warn  !== "function") console.warn  = console.log;

// QuickJS scriptArgs = [script, arg1, arg2, ...]
// Node process.argv  = [node,   script, arg1, arg2, ...]
// CLI code does process.argv.slice(2), so we prepend a dummy entry.
export const process = {
  argv: ["qjs", ...(typeof scriptArgs !== "undefined" ? scriptArgs : [])],
  cwd: () => _os.getcwd()[0],
  exit: (code) => _std.exit(code !== undefined ? code : 0),
};
