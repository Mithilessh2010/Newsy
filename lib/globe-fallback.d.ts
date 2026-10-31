import type { GlobeHandle } from './globe-engine';

export function createCanvasGlobe(
  canvas: HTMLCanvasElement,
  options?: {
    textureUrl?: string;
    latitude?: number;
    longitude?: number;
    zoom?: number;
    autoRotate?: boolean;
    onTextureReady?: (name: string, source: 'fallback') => void;
    onInteract?: () => void;
    onError?: (error: Error) => void;
  },
): GlobeHandle;
