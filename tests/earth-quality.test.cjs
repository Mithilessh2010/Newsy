const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('satellite day night and cloud layers used in actual WebGL shader', () => {
    const gl = read('lib/globe-engine.js');
    for (const s of ['uniform sampler2D uEarth', 'uniform sampler2D uNight', 'uniform sampler2D uCloud', 'smoothstep(-0.21,0.25,facing)', 'pow(1.0-max(n.z,0.0),5.0)'])
        assert.ok(gl.includes(s), s);
    assert.match(gl, /onTextureReady/);
    assert.match(gl, /gl\.deleteTexture\(textures\[name\]\)/);
});
test('remote texture proxy uses a hard-coded allowlist and denies arbitrary query URLs', () => {
    const route = read('app/api/earth-texture/route.ts');
    assert.match(route, /layer\s*!==\s*'day'\s*&&\s*layer\s*!==\s*'night'\s*&&\s*layer\s*!==\s*'clouds'/);
    assert.match(route, /fetch\(SOURCES\[layer\]/);
    assert.doesNotMatch(route, /fetch\(request\.nextUrl/);
    assert.match(route, /Content-Type/);
});
test('homepage delegates its actual renderer to HomeGlobe', () => {
    const home = read('components/FinalHome.tsx');
    const globe = read('components/HomeGlobe.tsx');
    assert.match(home, /<HomeGlobe ref={globe}/);
    assert.match(globe, /createGlobe\(canvas/);
    assert.match(globe, /createCanvasGlobe\(canvas/);
    assert.match(globe, /setRenderer\(renderer === 'webgl' \? 'canvas' : 'image'\)/);
    assert.match(globe, /earth-blue-marble\.webp/);
});
test('licenses document correct Solar System Scope attribution', () => {
    const credits = read('EARTH_TEXTURE_CREDITS.md');
    assert.match(credits, /CC BY 4\.0/);
    assert.match(credits, /solarsystemscope/);
});
