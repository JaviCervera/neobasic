export class NeoBasicError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly line: number,
    public readonly col: number,
  ) {
    super(`${file}:${line}:${col}: ${message}`);
    this.name = "NeoBasicError";
  }
}

export class LexerError extends NeoBasicError {
  constructor(message: string, file: string, line: number, col: number) {
    super(message, file, line, col);
    this.name = "LexerError";
  }
}

export class ParseError extends NeoBasicError {
  constructor(message: string, file: string, line: number, col: number) {
    super(message, file, line, col);
    this.name = "ParseError";
  }
}

export class TypeError extends NeoBasicError {
  constructor(message: string, file: string, line: number, col: number) {
    super(message, file, line, col);
    this.name = "TypeError";
  }
}

export class ModuleError extends NeoBasicError {
  constructor(message: string, file: string, line: number, col: number) {
    super(message, file, line, col);
    this.name = "ModuleError";
  }
}
