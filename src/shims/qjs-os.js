import * as _std from "std";

export function homedir() {
  return _std.getenv("HOME") || _std.getenv("USERPROFILE") || "";
}
