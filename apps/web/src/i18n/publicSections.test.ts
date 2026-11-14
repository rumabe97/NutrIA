import { describe, expect, it } from 'vitest';
import { dirname, join, relative, resolve } from 'node:path';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { PUBLIC_SECTIONS } from './publicSections';

/**
 * The public pages are sent a part of the dictionary (`publicSections.ts`). A client component
 * that reads a section left out of it gets `undefined` — on a prerendered page the build fails,
 * but a string read only after a press (a refused password, a wrong code) would fail in front of
 * somebody. This is what makes that a red test instead.
 *
 * It walks every import from the public trees' files, keeps what runs in the browser (a file
 * marked `'use client'` and everything such a file imports), and asks the type checker for every
 * place those files hold the dictionary: which section is read there, or — refused — a use that
 * cannot be read off the source (a computed key, a spread, the whole object handed to something
 * that does not declare it wants one).
 */

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = join(WEB, 'src');
const REPOSITORY = resolve(WEB, '../..');

/** The public trees: the two public roots and the page for an address that matches nothing. */
const PUBLIC_ROOTS = [join(SOURCE, 'app/(es)'), join(SOURCE, 'app/en')];
const PUBLIC_FILES = [join(SOURCE, 'app/global-not-found.tsx')];

const SCRIPT = /\.tsx?$/;
const TEST = /\.test\.tsx?$/;

function filesUnder(folder: string): string[] {
  return readdirSync(folder).flatMap(name => {
    const path = join(folder, name);

    if (statSync(path).isDirectory()) {
      return filesUnder(path);
    }

    return SCRIPT.test(name) && !TEST.test(name) ? [path] : [];
  });
}

const parsedConfig = ts.getParsedCommandLineOfConfigFile(
  join(WEB, 'tsconfig.json'),
  {},
  { ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => expect.fail(String(diagnostic.messageText)) }
);
const options = parsedConfig?.options ?? {};

interface Parsed {
  client: boolean;
  /** Imports that reach the browser: value imports, re-exports and `import()`. */
  imports: string[];
  /** An `import()` whose address is not a literal: it cannot be followed. */
  opaque: number[];
}

const parsedFiles = new Map<string, Parsed>();

function parse(file: string): Parsed {
  const known = parsedFiles.get(file);

  if (known) {
    return known;
  }

  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const first = source.statements[0];
  const parsed: Parsed = {
    client: Boolean(first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use client'),
    imports: [],
    opaque: []
  };

  const follow = (specifier: string) => {
    const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;

    // A package's own code never holds this app's dictionary; a stylesheet is not a script.
    if (resolved && SCRIPT.test(resolved) && !resolved.includes('/node_modules/') && !resolved.endsWith('.d.ts')) {
      parsed.imports.push(resolve(resolved));
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const erased =
        clause?.isTypeOnly === true ||
        (clause !== undefined &&
          clause.name === undefined &&
          named !== undefined &&
          ts.isNamedImports(named) &&
          named.elements.length > 0 &&
          named.elements.every(element => element.isTypeOnly));

      if (!erased) {
        follow(node.moduleSpecifier.text);
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      follow(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [address] = node.arguments;

      if (address && ts.isStringLiteralLike(address)) {
        follow(address.text);
      } else {
        parsed.opaque.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  parsedFiles.set(file, parsed);

  return parsed;
}

/** Every file reachable from `starts`, the starts included. */
function reach(starts: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...starts];

  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (!seen.has(file) && existsSync(file)) {
      seen.add(file);
      queue.push(...parse(file).imports);
    }
  }

  return seen;
}

function name(file: string): string {
  return relative(REPOSITORY, file);
}

/** What the browser runs on a public page: the client files reachable from it, and what they import. */
function publicClientFiles(): { files: string[]; opaque: string[] } {
  const reachable = reach([...PUBLIC_ROOTS.flatMap(filesUnder), ...PUBLIC_FILES]);
  const files = reach([...reachable].filter(file => parse(file).client));
  const opaque = [...files].flatMap(file => parse(file).opaque.map(line => `${name(file)}:${line}`));

  return { files: [...files].sort(), opaque };
}

/** Whether a node is a value being used, rather than a name being declared, a type, or an import. */
function isUse(node: ts.Node): node is ts.Expression {
  if (!ts.isExpression(node) || ts.isObjectBindingPattern(node)) {
    return false;
  }

  const parent = node.parent as ts.Node & { name?: ts.Node };

  if (ts.isIdentifier(node) && parent.name === node) {
    return false;
  }

  for (let above: ts.Node | undefined = parent; above && !ts.isSourceFile(above); above = above.parent) {
    if (
      ts.isTypeNode(above) ||
      ts.isImportDeclaration(above) ||
      ts.isExportDeclaration(above) ||
      ts.isTypeAliasDeclaration(above) ||
      ts.isInterfaceDeclaration(above)
    ) {
      return false;
    }
  }

  return true;
}

interface Reading {
  /** Section → the places it is read. */
  sections: Map<string, string[]>;
  /** Uses of the whole dictionary that cannot be read off the source. */
  unreadable: string[];
}

function read(files: readonly string[]): Reading {
  const program = ts.createProgram({ options: { ...options, noEmit: true }, rootNames: [...files, join(SOURCE, 'i18n/dictionaries/es-ES.ts')] });
  const checker = program.getTypeChecker();
  const dictionaryFile = program.getSourceFile(join(SOURCE, 'i18n/dictionaries/es-ES.ts'));
  const moduleSymbol = dictionaryFile && checker.getSymbolAtLocation(dictionaryFile);
  const dictionarySymbol = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find(symbol => symbol.name === 'Dictionary');

  if (!dictionarySymbol) {
    throw new Error('The Dictionary type was not found in i18n/dictionaries/es-ES.ts');
  }

  const dictionaryType = checker.getDeclaredTypeOfSymbol(dictionarySymbol);
  const vague = ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never;
  const isDictionary = (type: ts.Type | undefined): boolean =>
    type !== undefined &&
    (type.flags & vague) === 0 &&
    (type === dictionaryType || (checker.isTypeAssignableTo(type, dictionaryType) && checker.isTypeAssignableTo(dictionaryType, type)));

  const reading: Reading = { sections: new Map(), unreadable: [] };

  for (const file of files) {
    const source = program.getSourceFile(file);

    if (!source) {
      throw new Error(`${name(file)} is not in the program`);
    }

    const at = (node: ts.Node) => `${name(file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
    const record = (section: string, node: ts.Node) => reading.sections.set(section, [...(reading.sections.get(section) ?? []), at(node)]);
    const refuse = (node: ts.Node, why: string) => reading.unreadable.push(`${at(node)} — ${why}`);

    const pattern = (binding: ts.ObjectBindingPattern) => {
      for (const element of binding.elements) {
        const key = element.propertyName ?? element.name;

        if (element.dotDotDotToken) {
          refuse(element, 'the rest of the dictionary is collected');
        } else if (ts.isIdentifier(key) || ts.isStringLiteral(key)) {
          record(key.text, element);
        } else {
          refuse(element, 'a section is read by a computed key');
        }
      }
    };

    const visit = (node: ts.Node) => {
      // A parameter or a variable declared with a pattern: `({ auth }: Dictionary)`, `const { theme } = useDictionary()`.
      if (
        (ts.isParameter(node) || ts.isVariableDeclaration(node)) &&
        ts.isObjectBindingPattern(node.name) &&
        isDictionary(checker.getTypeAtLocation(node.name))
      ) {
        pattern(node.name);
      }

      if (isUse(node) && isDictionary(checker.getTypeAtLocation(node))) {
        const parent = node.parent;

        if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
          record(parent.name.text, parent);
        } else if (ts.isElementAccessExpression(parent) && parent.expression === node) {
          if (ts.isStringLiteralLike(parent.argumentExpression)) {
            record(parent.argumentExpression.text, parent);
          } else {
            refuse(parent, 'a section is read by a computed key');
          }
        } else if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
          // A name for it is followed where the name is used; a pattern was read above.
        } else if (
          ts.isParenthesizedExpression(parent) ||
          ts.isNonNullExpression(parent) ||
          ts.isAsExpression(parent) ||
          ts.isSatisfiesExpression(parent)
        ) {
          // The wrapper has the same type and is judged on its own visit.
        } else if (ts.isShorthandPropertyAssignment(parent) || isDictionary(checker.getContextualType(node))) {
          // Handed to something that declares it wants a dictionary: read in that file.
        } else if (ts.isArrayLiteralExpression(parent)) {
          // A hook's dependency list. Anything taken back out of an array is a dictionary again, and judged there.
        } else {
          refuse(node, 'the whole dictionary is used in a way this check cannot read');
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return reading;
}

describe('the part of the dictionary the public pages are sent', () => {
  const { files, opaque } = publicClientFiles();
  const { sections, unreadable } = read(files);

  it('follows every import of the public pages', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(opaque).toEqual([]);
  });

  it('can read every use of the dictionary in the browser', () => {
    expect(unreadable).toEqual([]);
  });

  it('holds every section a public page reads in the browser', () => {
    const sent = new Set<string>(PUBLIC_SECTIONS);
    const missing = [...sections].filter(([section]) => !sent.has(section)).map(([section, places]) => `${section} — read at ${places[0]}`);

    expect(missing).toEqual([]);
  });

  it('holds nothing a public page does not read', () => {
    expect(PUBLIC_SECTIONS.filter(section => !sections.has(section))).toEqual([]);
  });
});
