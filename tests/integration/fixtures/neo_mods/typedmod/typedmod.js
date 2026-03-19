'use strict';

function makevec(x, y) {
  return { x, y };
}

function addvecs(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function vectostr(v) {
  return `(${v.x}, ${v.y})`;
}

module.exports = { makevec, addvecs, vectostr };
