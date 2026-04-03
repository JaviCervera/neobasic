'use strict';

// ---------------------------------------------------------------------------
// IO (QuickJS — globalThis.std is registered by the neobasic binary)
// ---------------------------------------------------------------------------

function loadString(filename) {
  return globalThis.std.loadFile(filename) ?? '';
}

function input(prompt) {
  if (prompt) {
    globalThis.std.out.puts(prompt);
    globalThis.std.out.flush();
  }
  return globalThis.std.in.getline() ?? '';
}

function print(message) {
  console.log(message);
}

function saveString(filename, str, append) {
  const existing = append ? (globalThis.std.loadFile(filename) ?? '') : '';
  const f = globalThis.std.open(filename, 'w');
  if (f) {
    f.puts(existing + str);
    f.close();
  }
}

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

const _RAD2DEG = 180 / Math.PI;
const _DEG2RAD = Math.PI / 180;

function abs(x)            { return Math.abs(x); }
function acos(x)           { return Math.acos(x); }
function acosDeg(x)        { return Math.acos(x) * _RAD2DEG; }
function asin(x)           { return Math.asin(x); }
function asinDeg(x)        { return Math.asin(x) * _RAD2DEG; }
function atan(x)           { return Math.atan(x); }
function atan2(y, x)       { return Math.atan2(y, x); }
function atan2Deg(y, x)    { return Math.atan2(y, x) * _RAD2DEG; }
function atanDeg(x)        { return Math.atan(x) * _RAD2DEG; }
function ceil(x)           { return Math.ceil(x); }
function clamp(x, min, max){ return Math.min(Math.max(x, min), max); }
function cos(x)            { return Math.cos(x); }
function cosDeg(x)         { return Math.cos(x * _DEG2RAD); }
function exp(x)            { return Math.exp(x); }
function floor(x)          { return Math.floor(x); }
function log(x)            { return Math.log(x); }
function max(a, b)         { return Math.max(a, b); }
function min(a, b)         { return Math.min(a, b); }
function pow(x, y)         { return Math.pow(x, y); }
function sgn(x)            { return x < 0 ? -1 : x > 0 ? 1 : 0; }
function sin(x)            { return Math.sin(x); }
function sinDeg(x)         { return Math.sin(x * _DEG2RAD); }
function sqrt(x)           { return Math.sqrt(x); }
function tan(x)            { return Math.tan(x); }
function tanDeg(x)         { return Math.tan(x * _DEG2RAD); }

// ---------------------------------------------------------------------------
// String
// ---------------------------------------------------------------------------

function asc(str, index)        { return str.charCodeAt(index); }
function chr(code)              { return String.fromCharCode(code); }
function find(str, find, offset){ return str.indexOf(find, offset); }
function join(list, separator)  { return list.join(separator); }
function left(str, count)       { return str.substring(0, count); }
function len(str)               { return str.length; }
function lower(str)             { return str.toLowerCase(); }
function mid(str, offset, count){ return str.substring(offset, offset + count); }
function replace(str, find, rep){ return str.split(find).join(rep); }
function right(str, count)      { return count === 0 ? '' : str.slice(-count); }
function split(str, separator)  { return str.split(separator); }
function str(val)               { return String(val); }
function strf(val)              { return String(val); }
function trim(str)              { return str.trim(); }
function upper(str)             { return str.toUpperCase(); }

function val(s) {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function valf(s) {
  const n = parseFloat(s);
  return isNaN(n) ? 0.0 : n;
}

// Filename helpers

function stripDir(filename) {
  return filename.replace(/^.*[/\\]/, '');
}

function extractDir(filename) {
  const m = filename.match(/^(.*[/\\])/);
  return m ? m[1] : '';
}

function stripExt(filename) {
  const base = stripDir(filename);
  const dir = extractDir(filename);
  const dotIdx = base.lastIndexOf('.');
  if (dotIdx <= 0) return filename;
  return dir + base.substring(0, dotIdx);
}

function extractExt(filename) {
  const base = stripDir(filename);
  const dotIdx = base.lastIndexOf('.');
  if (dotIdx <= 0) return '';
  return base.substring(dotIdx + 1);
}

module.exports = {
  // IO
  input, loadString, print, saveString,
  // Math
  abs, acos, acosDeg, asin, asinDeg, atan, atan2, atan2Deg, atanDeg,
  ceil, clamp, cos, cosDeg, exp, floor, log, max, min, pow, sgn,
  sin, sinDeg, sqrt, tan, tanDeg,
  // String
  asc, chr, extractDir, extractExt, find, join, left, len, lower,
  mid, replace, right, split, str, strf, stripDir, stripExt, trim, upper,
  val, valf,
};
