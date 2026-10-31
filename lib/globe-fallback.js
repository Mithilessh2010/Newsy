const RADIANS = Math.PI / 180;
const MIN_ZOOM = 0.74;
const MAX_ZOOM = 3.4;
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function turnDifference(from, to) {
    const tau = 2 * Math.PI;
    return ((to - from + Math.PI) % tau + tau) % tau - Math.PI;
}
export function createCanvasGlobe(canvas, options = {}) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context)
        throw new Error('Canvas 2D is unavailable');
    let disposed = false;
    let dragging = false;
    let requestId = 0;
    let lastFrame = 0;
    let ready = false;
    let yaw = -(options.longitude ?? -100) * RADIANS;
    let pitch = (options.latitude ?? 25) * RADIANS;
    let zoom = options.zoom ?? 0.99;
    let targetYaw = yaw;
    let targetPitch = pitch;
    let targetZoom = zoom;
    let pointer = [0, 0];
    const image = new Image();
    const textureCanvas = document.createElement('canvas');
    const textureContext = textureCanvas.getContext('2d', { willReadFrequently: true });
    if (!textureContext)
        throw new Error('Texture canvas is unavailable');
    const resolution = 320;
    const sphereCanvas = document.createElement('canvas');
    sphereCanvas.width = resolution;
    sphereCanvas.height = resolution;
    const sphereContext = sphereCanvas.getContext('2d');
    if (!sphereContext)
        throw new Error('Sphere canvas is unavailable');
    const frame = sphereContext.createImageData(resolution, resolution);
    let source = null;
    let sourceWidth = 0;
    let sourceHeight = 0;
    image.onload = () => {
        if (disposed)
            return;
        textureCanvas.width = image.naturalWidth;
        textureCanvas.height = image.naturalHeight;
        textureContext.drawImage(image, 0, 0);
        const data = textureContext.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
        source = data.data;
        sourceWidth = data.width;
        sourceHeight = data.height;
        ready = true;
        options.onTextureReady?.('day', 'fallback');
    };
    image.onerror = () => {
        if (!disposed)
            options.onError?.(new Error('Earth image could not be loaded'));
    };
    image.src = options.textureUrl || '/media/earth-blue-marble.webp';
    function drawSphere() {
        if (!ready || !source)
            return;
        const cp = Math.cos(pitch);
        const sp = Math.sin(pitch);
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        const pixels = frame.data;
        const light = [-0.43, 0.48, 0.76];
        for (let py = 0; py < resolution; py++) {
            const ny = 1 - 2 * (py + 0.5) / resolution;
            for (let px = 0; px < resolution; px++) {
                const nx = 2 * (px + 0.5) / resolution - 1;
                const radiusSquared = nx * nx + ny * ny;
                const offset = (py * resolution + px) * 4;
                if (radiusSquared >= 1) {
                    pixels[offset + 3] = 0;
                    continue;
                }
                const nz = Math.sqrt(1 - radiusSquared);
                const worldY = ny * cp + nz * sp;
                const unpitchedZ = -ny * sp + nz * cp;
                const worldX = nx * cy - unpitchedZ * sy;
                const worldZ = nx * sy + unpitchedZ * cy;
                const longitude = Math.atan2(worldX, worldZ);
                const latitude = Math.asin(clamp(worldY, -1, 1));
                const tx = Math.floor((longitude / (2 * Math.PI) + 0.5) * (sourceWidth - 1));
                const ty = Math.floor((0.5 - latitude / Math.PI) * (sourceHeight - 1));
                const texel = (ty * sourceWidth + tx) * 4;
                const diffuse = 0.29 + 0.76 * Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
                const atmosphere = Math.pow(1 - nz, 7) * 25;
                pixels[offset] = Math.min(255, source[texel] * diffuse + atmosphere * 0.3);
                pixels[offset + 1] = Math.min(255, source[texel + 1] * diffuse + atmosphere * 0.7);
                pixels[offset + 2] = Math.min(255, source[texel + 2] * diffuse + atmosphere);
                pixels[offset + 3] = 255;
            }
        }
        sphereContext.putImageData(frame, 0, 0);
        const rectangle = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = Math.max(1, Math.round(rectangle.width * ratio));
        const height = Math.max(1, Math.round(rectangle.height * ratio));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        context.clearRect(0, 0, width, height);
        const diameter = Math.min(width, height) * 0.76 * zoom;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(sphereCanvas, (width - diameter) / 2, (height - diameter) / 2, diameter, diameter);
    }
    function animate(time) {
        if (disposed)
            return;
        requestId = requestAnimationFrame(animate);
        if (document.hidden || time - lastFrame < 65)
            return;
        lastFrame = time;
        if (options.autoRotate && !dragging && Math.abs(turnDifference(yaw, targetYaw)) < 0.006 && zoom < 1.05) {
            targetYaw += 0.0025;
        }
        yaw += turnDifference(yaw, targetYaw) * 0.18;
        pitch += (targetPitch - pitch) * 0.18;
        zoom += (targetZoom - zoom) * 0.18;
        drawSphere();
    }
    function onPointerDown(event) {
        dragging = true;
        canvas.style.cursor = 'grabbing';
        pointer = [event.clientX, event.clientY];
        canvas.setPointerCapture?.(event.pointerId);
        options.onInteract?.();
    }
    function onPointerMove(event) {
        if (!dragging)
            return;
        targetYaw += (event.clientX - pointer[0]) * 0.0065;
        targetPitch = clamp(targetPitch + (event.clientY - pointer[1]) * 0.0055, -1.15, 1.15);
        pointer = [event.clientX, event.clientY];
    }
    function onPointerUp(event) {
        dragging = false;
        canvas.style.cursor = 'grab';
        if (event && canvas.hasPointerCapture?.(event.pointerId)) {
            canvas.releasePointerCapture?.(event.pointerId);
        }
    }
    function onKeys(event) {
        if (event.key === 'ArrowLeft')
            targetYaw -= 0.18;
        else if (event.key === 'ArrowRight')
            targetYaw += 0.18;
        else if (event.key === 'ArrowUp')
            targetPitch = clamp(targetPitch + 0.12, -1.15, 1.15);
        else if (event.key === 'ArrowDown')
            targetPitch = clamp(targetPitch - 0.12, -1.15, 1.15);
        else if (event.key === '+' || event.key === '=')
            targetZoom = clamp(targetZoom + 0.2, MIN_ZOOM, MAX_ZOOM);
        else if (event.key === '-')
            targetZoom = clamp(targetZoom - 0.2, MIN_ZOOM, MAX_ZOOM);
        else if (event.key === 'Escape') {
            targetYaw = -(-100) * RADIANS;
            targetPitch = 25 * RADIANS;
            targetZoom = 0.99;
        }
        else
            return;
        event.preventDefault();
    }
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('keydown', onKeys);
    requestId = requestAnimationFrame(animate);
    return {
        focus(latitude, longitude, nextZoom = 1.48) {
            targetYaw = yaw + turnDifference(yaw, -longitude * RADIANS);
            targetPitch = clamp(latitude * RADIANS, -1.15, 1.15);
            targetZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        },
        setZoom(value) { targetZoom = clamp(value, MIN_ZOOM, MAX_ZOOM); },
        getZoom() { return targetZoom; },
        getState() { return { yaw, pitch, zoom, width: canvas.clientWidth, height: canvas.clientHeight }; },
        reset() {
            targetYaw = -(-100) * RADIANS;
            targetPitch = 25 * RADIANS;
            targetZoom = 0.99;
        },
        destroy() {
            disposed = true;
            cancelAnimationFrame(requestId);
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
            canvas.removeEventListener('keydown', onKeys);
        },
    };
}
