const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.resolve(__dirname, '../lib/news.ts');
const source = fs.readFileSync(file, 'utf8');
test('RSS decoder uses an explicitly typed named entity lookup', () => {
    const fragment = source.slice(source.indexOf('const namedEntities:'), source.indexOf('const field='));
    const output = ts.transpileModule(fragment, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const decode = new Function('const exports = {};\n' + output + '\nreturn exports.decodeEntities;')();
    assert.equal(decode('&amp; &AMP; &lt; &gt; &quot; &apos; &nbsp; &#39;'), '& & < > " \'   \'');
    assert.equal(decode('Hello &#x1F30D;'), 'Hello 🌍');
});
