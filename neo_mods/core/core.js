'use strict';

function print(message) {
  console.log(message);
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

module.exports = { print, str, strf, val, valf };
