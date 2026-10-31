const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
class FakeCanvas {
    constructor() {
        this.style = {};
        this.clientWidth = 400;
        this.clientHeight = 360;
        this.width = 400;
        this.height = 360;
        this.handlers = new Map();
        this.drawCalls = 0;
        this.capture = null;
    }
    getContext(type) {
        if (type !== '2d')
            return null;
        return {
            clearRect() { },
            drawImage: () => { this.drawCalls++; },
            createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
            putImageData() { },
            getImageData: () => ({
                width: 4,
                height: 2,
                data: new Uint8ClampedArray(4 * 2 * 4).fill(180),
            }),
        };
    }
    getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight }; }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    removeEventListener(name) { this.handlers.delete(name); }
    emit(name, properties = {}) {
        this.handlers.get(name)?.({
            pointerId: 5,
            clientX: 100,
            clientY: 100,
            preventDefault() { },
            ...properties,
        });
    }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
}
test('Canvas globe draws frames and responds to city, drag, keyboard and zoom', async () => {
    const originals = {
        Image: global.Image,
        document: global.document,
        window: global.window,
        requestAnimationFrame: global.requestAnimationFrame,
        cancelAnimationFrame: global.cancelAnimationFrame,
    };
    const pending = [];
    const originalGlobals = () => {
        for (const [name, value] of Object.entries(originals)) {
            if (value === undefined)
                delete global[name];
            else
                global[name] = value;
        }
    };
    global.window = { devicePixelRatio: 1 };
    global.document = { hidden: false, createElement: () => new FakeCanvas() };
    global.Image = class {
        naturalWidth = 4;
        naturalHeight = 2;
        set src(value) { this.url = value; queueMicrotask(() => this.onload?.()); }
    };
    global.requestAnimationFrame = callback => { pending.push(callback); return pending.length; };
    global.cancelAnimationFrame = () => { };
    let instance;
    try {
        const { createCanvasGlobe } = await import(pathToFileURL(path.join(__dirname, '../lib/globe-fallback.js')).href);
        const canvas = new FakeCanvas();
        let imageReady = false;
        instance = createCanvasGlobe(canvas, {
            autoRotate: false,
            textureUrl: '/media/earth-blue-marble.webp',
            onTextureReady: () => { imageReady = true; },
        });
        await Promise.resolve();
        assert.equal(imageReady, true, 'Texture loading callback ran');
        const step = time => {
            const next = pending.shift();
            assert.equal(typeof next, 'function');
            next(time);
        };
        step(100);
        assert.ok(canvas.drawCalls > 0, 'A sphere frame was drawn');
        const before = instance.getState();
        instance.focus(35.6762, 139.6503, 1.48);
        assert.equal(instance.getZoom(), 1.48);
        step(200);
        step(300);
        const after = instance.getState();
        assert.ok(after.zoom > before.zoom, 'Location focus zooms in');
        assert.ok(Math.abs(after.yaw - before.yaw) > 0.01, 'Location focus turns Earth');
        canvas.emit('pointerdown');
        canvas.emit('pointermove', { clientX: 170, clientY: 110 });
        canvas.emit('pointerup');
        assert.equal(canvas.capture, null, 'Pointer capture released after dragging');
        const headingBeforeDrag = instance.getState().yaw;
        step(400);
        assert.ok(Math.abs(instance.getState().yaw - headingBeforeDrag) > 0.01, 'Drag changes heading');
        canvas.emit('keydown', { key: '+' });
        assert.ok(instance.getZoom() > 1.48, 'Keyboard zoom in changes target zoom');
        instance.setZoom(999);
        assert.equal(instance.getZoom(), 3.4, 'Zoom is clamped to renderer limit');
        instance.reset();
        assert.equal(instance.getZoom(), 0.99, 'Reset restores the original view');
        instance.destroy();
        assert.equal(canvas.handlers.size, 0, 'All event handlers removed on destroy');
        assert.ok(canvas.drawCalls >= 4, 'Multiple frames were rendered');
    }
    finally {
        instance?.destroy();
        originalGlobals();
    }
});
