// Pure-JS path shim. Normalises all separators to "/" for consistency;
// QuickJS's std.open() and os.* accept forward slashes on Windows too.
function norm(p) {
  const str = p.replace(/\\/g, "/");
  const unixAbs = str.startsWith("/");
  const out = [];
  for (const s of str.split("/")) {
    if (s === "..") {
      if (out.length > 0) out.pop();
    } else if (s !== "." && s !== "") {
      out.push(s);
    }
  }
  const result = out.join("/");
  return unixAbs ? "/" + result : result || ".";
}

export function join(...parts) {
  return norm(parts.filter((p) => p !== "").join("/"));
}

export function dirname(p) {
  p = norm(p);
  const i = p.lastIndexOf("/");
  if (i < 0) return ".";
  if (i === 0) return "/";
  // Keep drive root: "C:/foo" → "C:"
  if (/^[a-zA-Z]:$/.test(p.slice(0, i))) return p.slice(0, i);
  return p.slice(0, i);
}

export function basename(p, ext) {
  p = norm(p);
  const base = p.split("/").pop() || "";
  if (ext && base.endsWith(ext)) return base.slice(0, -ext.length);
  return base;
}

export function resolve(...parts) {
  // Like Node's path.resolve: start from cwd, apply each segment in order.
  // `process` is replaced at bundle time by the qjs-process.js inject shim.
  // NOTE: do NOT call norm() on individual parts — that would strip ".." before
  // it can be applied against the accumulated base.  Normalise separators only,
  // then let the final norm() collapse all ".." segments in one pass.
  let resolved = norm(process.cwd());
  for (const p of parts) {
    const n = p.replace(/\\/g, "/");
    if (n.startsWith("/") || /^[a-zA-Z]:/.test(n)) resolved = n;
    else resolved = resolved + "/" + n;
  }
  return norm(resolved);
}

export function parse(p) {
  p = norm(p);
  const slashIdx = p.lastIndexOf("/");
  const base = slashIdx >= 0 ? p.slice(slashIdx + 1) : p;
  const dir = slashIdx > 0 ? p.slice(0, slashIdx) : slashIdx === 0 ? "/" : ".";
  const dotIdx = base.lastIndexOf(".");
  const name = dotIdx > 0 ? base.slice(0, dotIdx) : base;
  const ext = dotIdx > 0 ? base.slice(dotIdx) : "";
  return { root: "", dir, base, ext, name };
}
