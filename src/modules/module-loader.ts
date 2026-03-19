import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { lex } from "../lexer/index.js";
import { Token, TokenKind } from "../lexer/tokens.js";
import { ModuleError } from "../errors.js";
import { FuncSymbol, TypeDeclSymbol } from "../checker/checker.js";
import { NbType, INT, FLOAT, STRING, BOOL, VOID, arrayOf, udtOf } from "../checker/types.js";

export interface ModuleDefinition {
  name: string;
  jsPath: string;
  async: boolean;
  funcs: Map<string, FuncSymbol>;
  consts: Map<string, { type: NbType; value: string }>;
  types: Map<string, TypeDeclSymbol>;
}

/**
 * Resolve a module by name. Searches:
 *  1. neo_mods/ next to the compiler installation
 *  2. ~/neo_mods/
 *  3. neo_mods/ in the current working directory
 */
export function resolveModule(moduleName: string, cwd: string): ModuleDefinition {
  const searchDirs = [
    path.join(cwd, "neo_mods"),
    path.join(os.homedir(), "neo_mods"),
    // Compiler install dir
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "neo_mods"),
  ];

  for (const dir of searchDirs) {
    const moduleDir = path.join(dir, moduleName);
    const nbmPath = path.join(moduleDir, `${moduleName}.nbm`);
    const jsPath = path.join(moduleDir, `${moduleName}.js`);

    if (fs.existsSync(nbmPath)) {
      if (!fs.existsSync(jsPath)) {
        throw new ModuleError(
          `Module '${moduleName}' is missing companion JS file: ${jsPath}`,
          nbmPath, 1, 1,
        );
      }

      const source = fs.readFileSync(nbmPath, "utf-8");
      const def = parseModuleFile(source, moduleName, nbmPath, jsPath);
      return def;
    }
  }

  throw new ModuleError(
    `Module '${moduleName}' not found. Searched: ${searchDirs.join(", ")}`,
    "<import>", 1, 1,
  );
}

function parseModuleFile(
  source: string,
  moduleName: string,
  nbmPath: string,
  jsPath: string,
): ModuleDefinition {
  const tokens = lex(source, nbmPath);
  const funcs = new Map<string, FuncSymbol>();
  const consts = new Map<string, { type: NbType; value: string }>();
  const types = new Map<string, TypeDeclSymbol>();
  let isAsync = false;

  let pos = 0;

  function current(): Token {
    return tokens[pos];
  }

  function at(kind: TokenKind): boolean {
    return current().kind === kind;
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function expect(kind: TokenKind, msg: string): Token {
    if (!at(kind)) {
      throw new ModuleError(msg, nbmPath, current().line, current().col);
    }
    return advance();
  }

  function skipNewlines(): void {
    while (at(TokenKind.Newline) || at(TokenKind.Colon)) advance();
  }

  function resolveType(): NbType {
    const name = expect(TokenKind.Identifier, "Expected type name").value.toLowerCase();
    let t: NbType;
    switch (name) {
      case "int": t = INT; break;
      case "float": t = FLOAT; break;
      case "string": t = STRING; break;
      case "bool": t = BOOL; break;
      default: t = udtOf(name); break;
    }
    while (at(TokenKind.LBracket)) {
      advance();
      if (at(TokenKind.IntLiteral)) advance(); // skip size
      expect(TokenKind.RBracket, "Expected ']'");
      t = arrayOf(t);
    }
    return t;
  }

  skipNewlines();

  // Check for @async directive (identifier "async" prefixed by nothing — lexed as Identifier)
  if (at(TokenKind.Identifier) && current().value.toLowerCase() === "async") {
    advance();
    isAsync = true;
    skipNewlines();
  }

  while (!at(TokenKind.EOF)) {
    if (at(TokenKind.Function)) {
      advance();
      const name = expect(TokenKind.Identifier, "Expected function name").value;
      expect(TokenKind.LParen, "Expected '('");

      const params: { name: string; type: NbType }[] = [];
      if (!at(TokenKind.RParen)) {
        const pName = expect(TokenKind.Identifier, "Expected parameter name").value;
        expect(TokenKind.As, "Expected 'As'");
        const pType = resolveType();
        params.push({ name: pName, type: pType });
        while (at(TokenKind.Comma)) {
          advance();
          const pn = expect(TokenKind.Identifier, "Expected parameter name").value;
          expect(TokenKind.As, "Expected 'As'");
          const pt = resolveType();
          params.push({ name: pn, type: pt });
        }
      }
      expect(TokenKind.RParen, "Expected ')'");

      // Optional return type
      let returnType: NbType = VOID;
      if (at(TokenKind.As)) {
        advance();
        returnType = resolveType();
      }

      // External name mapping: = "jsName"
      let externalName = name.toLowerCase();
      if (at(TokenKind.Equal)) {
        advance();
        externalName = expect(TokenKind.StringLiteral, "Expected external function name").value;
      }

      funcs.set(name.toLowerCase(), {
        params,
        returnType,
        isExternal: true,
        externalName: `${moduleName}.${externalName}`,
      });
    } else if (at(TokenKind.Const)) {
      advance();
      const name = expect(TokenKind.Identifier, "Expected constant name").value;
      expect(TokenKind.Equal, "Expected '='");
      const valueTok = advance();
      let type: NbType;
      let value: string;
      switch (valueTok.kind) {
        case TokenKind.IntLiteral: type = INT; value = valueTok.value; break;
        case TokenKind.FloatLiteral: type = FLOAT; value = valueTok.value; break;
        case TokenKind.StringLiteral: type = STRING; value = JSON.stringify(valueTok.value); break;
        case TokenKind.True: type = BOOL; value = "true"; break;
        case TokenKind.False: type = BOOL; value = "false"; break;
        default:
          throw new ModuleError(`Unexpected token in Const value: ${valueTok.value}`, nbmPath, valueTok.line, valueTok.col);
      }
      consts.set(name.toLowerCase(), { type, value });
    } else if (at(TokenKind.Type)) {
      const typeTok = advance();
      const typeName = expect(TokenKind.Identifier, "Expected type name").value;
      skipNewlines();
      const fields: { name: string; type: NbType }[] = [];
      while (!at(TokenKind.EndType) && !at(TokenKind.EOF)) {
        const fieldName = expect(TokenKind.Identifier, "Expected field name").value;
        expect(TokenKind.As, "Expected 'As' after field name");
        const fieldType = resolveType();
        fields.push({ name: fieldName.toLowerCase(), type: fieldType });
        skipNewlines();
      }
      if (!at(TokenKind.EndType)) {
        throw new ModuleError("Expected 'EndType'", nbmPath, typeTok.line, typeTok.col);
      }
      advance(); // consume EndType
      types.set(typeName.toLowerCase(), { fields });
    } else {
      throw new ModuleError(
        `Unexpected token in module file: '${current().value}'`,
        nbmPath, current().line, current().col,
      );
    }

    skipNewlines();
  }

  return { name: moduleName, jsPath, async: isAsync, funcs, consts, types };
}
