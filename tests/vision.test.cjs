const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
test('The active homepage includes the globe, real feeds, locations and source search', () => {
    const home = read('components/FinalHome.tsx');
    for (const feature of ['<HomeGlobe', '<NewsFeed', '<WorldEvents', '<GlobalSourcesExplorer', '<LocationPicker']) {
        assert.ok(home.includes(feature), `Missing ${feature}`);
    }
    for (const route of ['/news', '/records', '/explore', '/about']) {
        assert.ok(home.includes(route), `Missing link to ${route}`);
    }
});
test('The globe has independent WebGL, Canvas, and image rendering paths', () => {
    const globe = read('components/HomeGlobe.tsx');
    const home = read('components/FinalHome.tsx');
    assert.match(globe, /earth-blue-marble\.webp/);
    assert.match(globe, /renderer === 'webgl'/);
    assert.match(globe, /setRenderer\('image'\)/);
    assert.match(globe, /onTextureReady/);
    assert.doesNotMatch(home, /council approves|breaking tonight|minutes ago/i);
});
test('Only the active site and editorial stylesheets are imported', () => {
    const layout = read('app/layout.tsx');
    assert.match(layout, /import '\.\/site\.css'/);
    assert.match(layout, /import '\.\/edition\.css'/);
    for (const obsolete of ['globals.css', 'orbital.css', 'vision.css', 'final.css']) {
        assert.ok(!layout.includes(obsolete), `Unused stylesheet still imported: ${obsolete}`);
    }
    assert.match(read('app/site.css'), /prefers-reduced-motion/);
    assert.match(read('app/edition.css'), /eh-edition-earth-canvas/);
});
test('Navigation links to real routes and modal search supports Escape', () => {
    const header = read('components/SiteHeader.tsx');
    const footer = read('components/SiteFooter.tsx');
    for (const route of ['/news', '/explore', '/records', '/timelines', '/account']) {
        assert.ok(header.includes(route), route);
    }
    assert.ok(footer.includes('/saved'));
    assert.match(header, /event\.key === 'Escape'/);
});
test('The records interface queries the real discovery route and links to sources', () => {
    const records = read('components/GlobalSourcesExplorer.tsx');
    assert.match(records, /\/api\/discover/);
    assert.match(records, /location\.countryCode/);
    assert.match(records, /AbortController/);
    assert.match(records, /item\.url/);
    assert.match(records, /rel="noopener noreferrer"/);
});
