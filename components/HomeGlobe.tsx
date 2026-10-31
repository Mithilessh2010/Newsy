'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, } from 'react';
import { createGlobe, type GlobeHandle } from '@/lib/globe-engine';
import { createCanvasGlobe } from '@/lib/globe-fallback';
type Renderer = 'webgl' | 'canvas' | 'image';
export type HomeGlobeHandle = {
    focus(latitude: number, longitude: number): void;
    zoomBy(amount: number): void;
    reset(): void;
};
export const HomeGlobe = forwardRef<HomeGlobeHandle, {
    place: string;
}>(function HomeGlobe({ place }, ref) {
    const element = useRef<HTMLCanvasElement>(null);
    const camera = useRef<GlobeHandle | null>(null);
    const [renderer, setRenderer] = useState<Renderer>('webgl');
    const [textureLoaded, setTextureLoaded] = useState(false);
    useImperativeHandle(ref, () => ({
        focus(latitude, longitude) {
            camera.current?.focus(latitude, longitude, 1.48);
        },
        zoomBy(amount) {
            const globe = camera.current;
            if (globe)
                globe.setZoom(globe.getZoom() + amount);
        },
        reset() {
            camera.current?.reset();
        },
    }), []);
    useEffect(() => {
        const canvas = element.current;
        if (!canvas || renderer === 'image')
            return;
        let active = true;
        const onReady = (layer: string) => {
            if (active && layer === 'day')
                setTextureLoaded(true);
        };
        try {
            const options = {
                latitude: 25,
                longitude: -100,
                zoom: 0.99,
                autoRotate: true,
                textureUrl: '/media/earth-blue-marble.webp',
                onTextureReady: onReady,
            };
            camera.current = renderer === 'webgl'
                ? createGlobe(canvas, options)
                : createCanvasGlobe(canvas, {
                    ...options,
                    onError: () => { if (active)
                        setRenderer('image'); },
                });
        }
        catch {
            setRenderer(renderer === 'webgl' ? 'canvas' : 'image');
        }
        return () => {
            active = false;
            camera.current?.destroy();
            camera.current = null;
        };
    }, [renderer]);
    return (<div className="eh-edition-earth-side">
        <div className="eh-edition-earth-halo" aria-hidden="true"/>
        <div className="eh-edition-earth-wrap">
          <div className="eh-edition-earth-still" role="img" aria-label="Satellite image of the Earth" style={{ opacity: renderer === 'image' || !textureLoaded ? 1 : 0 }}/>
          {renderer !== 'image' && (<canvas key={renderer} ref={element} className="eh-edition-earth-canvas" aria-label="Interactive Earth. Drag to rotate, use arrow keys to turn, or choose a city below." tabIndex={0}/>)}
        </div>
        <div className="eh-edition-earth-label">
          <span><i /> {place}</span>
          <div className="eh-edition-earth-controls" role="group" aria-label="Earth zoom controls">
            <button type="button" aria-label="Zoom out" onClick={() => camera.current?.setZoom(Math.max(0.74, (camera.current?.getZoom() ?? 1) - 0.23))}>−</button>
            <button type="button" aria-label="Zoom in" onClick={() => camera.current?.setZoom(Math.min(3.4, (camera.current?.getZoom() ?? 1) + 0.23))}>+</button>
          </div>
        </div>
        <div className="eh-edition-earth-hint">DRAG TO TURN THE WORLD</div>
      </div>);
});
