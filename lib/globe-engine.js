const TAU = Math.PI * 2;
export function radians(value) { return value * Math.PI / 180; }
export function wrapAngle(value) { return ((value + Math.PI) % TAU + TAU) % TAU - Math.PI; }
export function angularDifference(from, to) { return wrapAngle(to - from); }
export function geoPoint(lat, lon) { const a = radians(lat), b = radians(lon); return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)]; }
export function transformPoint(point, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x = point[0] * cy + point[2] * sy, z = point[2] * cy - point[0] * sy;
    return [x, point[1] * cp - z * sp, point[1] * sp + z * cp];
}
export function projectGeo(lat, lon, yaw, pitch, zoom, width, height) {
    const q = transformPoint(geoPoint(lat, lon), yaw, pitch), depth = 3.65 - q[2], f = 2.92 * zoom, aspect = width / Math.max(height, 1);
    const nx = q[0] * f / aspect / depth, ny = q[1] * f / depth;
    return { x: (nx + 1) / 2 * width, y: (1 - ny) / 2 * height, visible: q[2] > .16 && Math.abs(nx) < .96 && Math.abs(ny) < .94, front: q[2] > .16 };
}
export function makeSphere(rows = 72, columns = 144) {
    const data = [], indices = [];
    for (let r = 0; r <= rows; r++) {
        const lat = -Math.PI / 2 + Math.PI * r / rows;
        for (let c = 0; c <= columns; c++) {
            const lon = -Math.PI + TAU * c / columns;
            const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
            data.push(x, y, z, c / columns, r / rows);
        }
    }
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < columns; c++) {
            const a = r * (columns + 1) + c, b = a + columns + 1;
            indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
    return { vertices: new Float32Array(data), indices: new Uint16Array(indices) };
}
const vertexSource = `attribute vec3 aPosition; attribute vec2 aUV; uniform float uYaw;uniform float uPitch;uniform float uAspect;uniform float uZoom;varying vec2 vUV; varying vec3 vNormal; varying float vDepth;
void main(){float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);
vec3 q=vec3(aPosition.x*cy+aPosition.z*sy,aPosition.y,aPosition.z*cy-aPosition.x*sy);
vec3 p=vec3(q.x,q.y*cp-q.z*sp,q.y*sp+q.z*cp);
float depth=3.65-p.z;
float f=2.92*uZoom;
gl_Position=vec4(p.x*f/uAspect,p.y*f,(depth-2.0)*0.5,depth);
vUV=aUV;vNormal=p;vDepth=p.z;
}`;
const fragmentSource = `precision highp float;
varying vec2 vUV; varying vec3 vNormal; varying float vDepth;
uniform sampler2D uEarth;uniform sampler2D uNight;uniform sampler2D uCloud;
uniform float uHasNight;uniform float uHasCloud;
void main(){
 vec3 day=texture2D(uEarth,vUV).rgb;
 vec3 n=normalize(vNormal);
 vec3 sun=normalize(vec3(-0.43,0.48,0.76));
 float facing=dot(n,sun);
 float daylight=smoothstep(-0.21,0.25,facing);
 float diffuse=0.25+0.84*max(facing,0.0);
 vec3 litDay=day*diffuse;
 vec3 lights=texture2D(uNight,vUV).rgb*1.55*uHasNight;
 vec3 color=mix(lights+day*0.016,litDay,daylight);
 float clouds=texture2D(uCloud,vUV).r*uHasCloud;
 float cloudLight=0.14+0.84*max(facing,0.0);
 color=mix(color,vec3(0.88,0.92,0.96)*cloudLight,clouds*0.52*smoothstep(-0.26,0.18,facing));
 float limb=pow(1.0-max(n.z,0.0),5.0);
 color+=vec3(0.12,0.29,0.46)*limb*(0.3+0.7*daylight);
 color=pow(max(color,0.0),vec3(0.93));
 gl_FragColor=vec4(color,1.0);
}`;
function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader)
        throw new Error('WebGL shader allocation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const e = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Globe shader: ' + e);
    }
    return shader;
}
export function createGlobe(canvas, options = {}) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, premultipliedAlpha: false }) || canvas.getContext('experimental-webgl', { alpha: true, antialias: true, depth: true });
    if (!gl)
        throw new Error('WebGL is unavailable');
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource), fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource), program = gl.createProgram();
    if (!program)
        throw new Error('WebGL program allocation failed');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error('Globe program: ' + gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const mesh = makeSphere(), vertexBuffer = gl.createBuffer(), indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition'), uv = gl.getAttribLocation(program, 'aUV');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12);
    const uYaw = gl.getUniformLocation(program, 'uYaw'), uPitch = gl.getUniformLocation(program, 'uPitch'), uZoom = gl.getUniformLocation(program, 'uZoom'), uAspect = gl.getUniformLocation(program, 'uAspect');
    let destroyed = false;
    const assetSources = {
        day: [options.textureUrl || '/api/earth-texture?layer=day', '/media/earth-blue-marble.webp', 'https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg'],
        night: ['/api/earth-texture?layer=night', 'https://www.solarsystemscope.com/textures/download/2k_earth_nightmap.jpg'],
        clouds: ['/api/earth-texture?layer=clouds', 'https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg']
    };
    const textures = {};
    const hasNight = gl.getUniformLocation(program, 'uHasNight');
    const hasCloud = gl.getUniformLocation(program, 'uHasCloud');
    let nightLoaded = false, cloudLoaded = false;
    for (const [i, name] of ['day', 'night', 'clouds'].entries()) {
        const texture = gl.createTexture();
        textures[name] = texture;
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        const pixel = name === 'day' ? [20, 33, 54, 255] : [0, 0, 0, 255];
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(pixel));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.uniform1i(gl.getUniformLocation(program, name === 'day' ? 'uEarth' : name === 'night' ? 'uNight' : 'uCloud'), i);
        const sources = assetSources[name];
        function load(index) {
            if (destroyed)
                return;
            if (index >= sources.length) {
                return;
            }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                if (destroyed)
                    return;
                gl.activeTexture(gl.TEXTURE0 + i);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
                gl.generateMipmap(gl.TEXTURE_2D);
                if (name === 'night')
                    nightLoaded = true;
                if (name === 'clouds')
                    cloudLoaded = true;
                options.onTextureReady?.(name, index === sources.length - 1 && name === 'day' ? 'fallback' : 'real');
            };
            img.onerror = () => load(index + 1);
            img.src = sources[index];
        }
        load(0);
    }
    let targetYaw = -radians(options.longitude ?? -120), targetPitch = radians(options.latitude ?? 33), targetZoom = options.zoom ?? .93;
    let yaw = targetYaw, pitch = targetPitch, zoom = targetZoom, active = true, raf = 0, last = 0, dragging = false, pointerX = 0, pointerY = 0;
    const reduced = !!(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
    }
    function animate(now) {
        if (destroyed)
            return;
        raf = requestAnimationFrame(animate);
        if (!active)
            return;
        if (now - last < 16)
            return;
        const dt = Math.min(50, now - last || 16);
        last = now;
        if (options.autoRotate && !dragging && !reduced && Math.abs(angularDifference(yaw, targetYaw)) < 0.03 && targetZoom <= 1.01) {
            targetYaw += dt * .000012;
        }
        const smoothing = 1 - Math.exp(-dt / 190);
        yaw += angularDifference(yaw, targetYaw) * smoothing;
        pitch += (targetPitch - pitch) * smoothing;
        zoom += (targetZoom - zoom) * smoothing;
        resize();
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform1f(uYaw, yaw);
        gl.uniform1f(uPitch, pitch);
        gl.uniform1f(uZoom, zoom);
        gl.uniform1f(uAspect, canvas.width / canvas.height);
        gl.uniform1f(hasNight, nightLoaded ? 1 : 0);
        gl.uniform1f(hasCloud, cloudLoaded ? 1 : 0);
        for (const [i, name] of ['day', 'night', 'clouds'].entries()) {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, textures[name]);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
        if (options.onFrame)
            options.onFrame({ yaw, pitch, zoom, width: canvas.clientWidth, height: canvas.clientHeight });
    }
    const down = e => { dragging = true; pointerX = e.clientX; pointerY = e.clientY; canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = 'grabbing'; options.onInteract?.(); };
    const move = e => {
        if (!dragging)
            return;
        const dx = e.clientX - pointerX, dy = e.clientY - pointerY;
        pointerX = e.clientX;
        pointerY = e.clientY;
        targetYaw += dx * .0065;
        targetPitch = Math.max(-1.15, Math.min(1.15, targetPitch + dy * .0055));
    };
    const up = e => {
        dragging = false;
        canvas.style.cursor = 'grab';
        if (canvas.hasPointerCapture?.(e.pointerId))
            canvas.releasePointerCapture(e.pointerId);
    };
    const wheel = e => {
        if (!e.ctrlKey && !e.metaKey)
            return;
        e.preventDefault();
        targetZoom = Math.max(.74, Math.min(3.45, targetZoom - e.deltaY * .002));
        options.onInteract?.();
    };
    const keys = e => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Escape'].includes(e.key)) {
            e.preventDefault();
            options.onInteract?.();
            if (e.key === 'ArrowLeft')
                targetYaw -= .20;
            else if (e.key === 'ArrowRight')
                targetYaw += .20;
            else if (e.key === 'ArrowUp')
                targetPitch = Math.min(1.15, targetPitch + .14);
            else if (e.key === 'ArrowDown')
                targetPitch = Math.max(-1.15, targetPitch - .14);
            else if (e.key === '+' || e.key === '=')
                targetZoom = Math.min(3.45, targetZoom + .22);
            else if (e.key === '-')
                targetZoom = Math.max(.74, targetZoom - .22);
            else if (e.key === 'Escape') {
                targetZoom = .93;
                targetPitch = radians(22);
                targetYaw = -radians(-100);
            }
        }
    };
    const lost = () => { dragging = false; };
    const ctxLost = e => { e.preventDefault(); active = false; };
    const ctxRestored = () => { active = true; };
    canvas.addEventListener('keydown', keys);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', lost);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('webglcontextlost', ctxLost);
    canvas.addEventListener('webglcontextrestored', ctxRestored);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { active = entry.isIntersecting && !document.hidden; });
    observer?.observe(canvas);
    const visibility = () => { active = !document.hidden; };
    document.addEventListener('visibilitychange', visibility);
    raf = requestAnimationFrame(animate);
    return { focus(lat, lon, nextZoom = 1.55) { targetYaw = yaw + angularDifference(yaw, -radians(lon)); targetPitch = Math.max(-1.15, Math.min(1.15, radians(lat))); targetZoom = Math.max(.74, Math.min(3.45, nextZoom)); },
        setZoom(value) { targetZoom = Math.max(.74, Math.min(3.45, value)); }, getZoom() { return targetZoom; }, reset() { targetYaw = yaw + angularDifference(yaw, -radians(-100)); targetPitch = radians(22); targetZoom = .93; }, getState() { return { yaw, pitch, zoom, width: canvas.clientWidth, height: canvas.clientHeight }; },
        destroy() {
            destroyed = true;
            cancelAnimationFrame(raf);
            observer?.disconnect();
            document.removeEventListener('visibilitychange', visibility);
            canvas.removeEventListener('keydown', keys);
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', up);
            canvas.removeEventListener('lostpointercapture', lost);
            canvas.removeEventListener('wheel', wheel);
            canvas.removeEventListener('webglcontextlost', ctxLost);
            canvas.removeEventListener('webglcontextrestored', ctxRestored);
            for (const name of ['day', 'night', 'clouds'])
                gl.deleteTexture(textures[name]);
            gl.deleteBuffer(vertexBuffer);
            gl.deleteBuffer(indexBuffer);
            gl.deleteShader(vertex);
            gl.deleteShader(fragment);
            gl.deleteProgram(program);
        }
    };
}
