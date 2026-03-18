'use strict';

const fs = require('fs');

function print(message) {
  console.log(message);
}

function input() {
  const buf = Buffer.alloc(1);
  let line = '';
  while (true) {
    const n = fs.readSync(0, buf, 0, 1, null);
    if (n === 0) break;
    const ch = buf.toString('utf8', 0, 1);
    if (ch === '\n') break;
    if (ch !== '\r') line += ch;
  }
  return line;
}

function str(val) {
  return String(val);
}

function strf(val) {
  return String(val);
}

function val(s) {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function valf(s) {
  const n = parseFloat(s);
  return isNaN(n) ? 0.0 : n;
}

module.exports = { print, input, str, strf, val, valf };
