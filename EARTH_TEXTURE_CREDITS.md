# Real Earth imagery and credits

Day, night and cloud Earth maps are **Solar System Scope** textures, built using NASA Blue Marble and other geodata. They are distributed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**. This project serves images through an allowlisted proxy which caches the original resources; it does not claim to own the imagery.

Original source: https://www.solarsystemscope.com/textures/
License: https://creativecommons.org/licenses/by/4.0/

The maps were not manually retouched in this patch; the WebGL renderer applies directional lighting, realistic terminator, cloud blending and a restrained atmosphere. Satellite colors are composites and are not an up-to-the-minute picture of Earth. Map pins are location markers, **not** proof that a current event occurred there.

If your hosting cannot reach the Solar System Scope texture server, the globe renders a neutral sphere, displays an availability note, and still provides location navigation; it deliberately does **not** revert to the old illustrated texture. For the best reliability, download the three `2k_earth_*map.jpg` assets and put them in `public/`, then change the component's texture paths to the self-hosted files.


The bundle includes `public/media/earth-blue-marble.webp`, derived from the NASA Blue Marble Earth image used in the v13 preview. It serves as a local fallback when the Earth texture provider is unreachable. Do not imply this image is live satellite imagery.
