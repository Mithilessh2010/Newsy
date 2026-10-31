import { FEATURED_LOCATIONS, type CommunityLocation } from './location';
const namedCoordinates: Record<string, readonly [
    number,
    number
]> = {
    Pleasanton: [37.6624, -121.8747],
    London: [51.5074, -0.1278],
    Tokyo: [35.6762, 139.6503],
    'New Delhi': [28.6139, 77.209],
    Sydney: [-33.8688, 151.2093],
    Toronto: [43.6532, -79.3832],
    'São Paulo': [-23.5558, -46.6396],
    Johannesburg: [-26.2041, 28.0473],
    Paris: [48.8566, 2.3522],
    Singapore: [1.3521, 103.8198],
    Dubai: [25.2048, 55.2708],
};
export const HOME_PLACES = FEATURED_LOCATIONS
    .filter(place => place.name in namedCoordinates)
    .slice(0, 8);
export function coordinatesFor(place: CommunityLocation): readonly [
    number,
    number
] | null {
    if (typeof place.latitude === 'number' && typeof place.longitude === 'number') {
        return [place.latitude, place.longitude];
    }
    return namedCoordinates[place.name] ?? null;
}
