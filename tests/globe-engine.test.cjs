const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const load = () => import(pathToFileURL(path.join(__dirname, '../lib/globe-engine.js')).href);
test('sphere vertices indices stay within WebGL1 Uint16 limits', async () => { const { makeSphere } = await load(); const { vertices, indices } = makeSphere(); assert.equal(vertices.length, (72 + 1) * (144 + 1) * 5); assert.equal(indices.length, 72 * 144 * 6); assert.ok(Math.max(...indices) < 65535); });
test('lat lon points are unit sphere and have north south poles', async () => { const { geoPoint } = await load(); let [x, y, z] = geoPoint(90, 20); assert.ok(Math.abs(y - 1) < 1e-8); assert.ok(Math.abs(x) < 1e-8); assert.ok(Math.abs(z) < 1e-8); });
test('fly target projects a selected city to the middle of the globe', async () => { const { projectGeo, radians } = await load(); for (const [lat, lon] of [[37, -122], [51, 0], [-34, 151], [35, 139]]) {
    const p = projectGeo(lat, lon, -radians(lon), radians(lat), 1, 950, 600);
    assert.ok(p.visible);
    assert.ok(Math.abs(p.x - 475) < 1e-6);
    assert.ok(Math.abs(p.y - 300) < 1e-6);
} });
test('far hemisphere locations are hidden', async () => { const { projectGeo } = await load(); assert.equal(projectGeo(0, 180, 0, 0, .93, 900, 650).visible, false); });
test('angular difference always uses shortest rotational route', async () => { const { angularDifference, radians } = await load(); const d = angularDifference(radians(179), radians(-179)); assert.ok(Math.abs(d - radians(2)) < 1e-7); });
