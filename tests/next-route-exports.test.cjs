const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '../app/api');
const allowed = new Set([
    'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS',
    'config', 'generateStaticParams', 'revalidate', 'dynamic',
    'dynamicParams', 'fetchCache', 'preferredRegion', 'runtime',
    'maxDuration',
]);

function routes(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory() ? routes(filename) : entry.name === 'route.ts' ? [filename] : [];
    });
}

function names(statement) {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
        return statement.name ? [statement.name.text] : [];
    }
    if (ts.isVariableStatement(statement)) {
        return statement.declarationList.declarations.flatMap(declaration =>
            ts.isIdentifier(declaration.name) ? [declaration.name.text] : ['<destructured>']);
    }
    return ['<unsupported export>'];
}

test('Next.js API route modules export only recognized route fields', () => {
    for (const file of routes(root)) {
        const code = fs.readFileSync(file, 'utf8');
        const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        for (const statement of ast.statements) {
            const exported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
            if (!exported) continue;
            const declarations = ts.isExportDeclaration(statement)
                ? (statement.exportClause && ts.isNamedExports(statement.exportClause)
                    ? statement.exportClause.elements.map(element => element.name.text)
                    : ['<re-export>'])
                : names(statement);
            for (const name of declarations) {
                assert.ok(allowed.has(name), `${path.relative(root, file)} exports invalid Next.js route field ${name}`);
            }
        }
    }
});
