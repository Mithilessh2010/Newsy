const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('Search route narrows the same query value before passing it to feedLocationKey', () => {
    const route = fs.readFileSync(path.join(__dirname, '../app/api/search/route.ts'), 'utf8');
    assert.match(route, /const rawScope\s*=\s*params\.get\('scope'\)\s*;\s*const scope\s*=\s*isNewsScope\(rawScope\)\s*\?\s*rawScope\s*:\s*'local'\s*;/);
    assert.doesNotMatch(route, /isNewsScope\(params\.get\('scope'\)\)\?params\.get\('scope'\)/);
});
