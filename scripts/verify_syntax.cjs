const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const skips = new Set(['.compiled', 'node_modules', '.next', '.git']);
const files = [];
function visit(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (skips.has(entry.name))
            continue;
        const filename = path.join(folder, entry.name);
        if (entry.isDirectory())
            visit(filename);
        else if (/\.tsx?$/.test(entry.name))
            files.push(filename);
    }
}
visit(root);
let failures = 0;
for (const filename of files) {
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const diagnostic of source.parseDiagnostics) {
        const { line } = source.getLineAndCharacterOfPosition(diagnostic.start || 0);
        console.error(`${path.relative(root, filename)}:${line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
        failures++;
    }
}
console.log(`${files.length} TypeScript/TSX files parsed; ${failures} syntax errors`);
process.exitCode = failures ? 1 : 0;
