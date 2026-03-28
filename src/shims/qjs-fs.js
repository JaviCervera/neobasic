import * as _std from "std";
import * as _os from "os";

export function existsSync(p) {
  return _os.stat(p)[1] === 0;
}

export function readFileSync(p, _enc) {
  const content = _std.loadFile(p);
  if (content === null)
    throw new Error(`ENOENT: no such file or directory, open '${p}'`);
  return content;
}

export function writeFileSync(p, data, _enc) {
  const f = _std.open(p, "w");
  if (!f) throw new Error(`ENOENT: cannot open '${p}' for writing`);
  f.puts(data);
  f.close();
}
