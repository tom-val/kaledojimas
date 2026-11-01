/**
 * Draws every app icon from one jack-o'-lantern definition into assets/images.
 * sharp is only needed here, so it is not a dependency:
 *   cd app && npm install --no-save sharp && node scripts/generate-icons.mjs
 */
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = fileURLToPath(new URL('../assets/images/', import.meta.url));

// The pumpkin is drawn around (0, 0) and spans about 680 wide, 680 tall including the stem.
const RIBS = [
  [-215, 118, 205],
  [215, 118, 205],
  [-125, 135, 245],
  [125, 135, 245],
  [0, 130, 262],
];
const STEM = 'M-46 -205 C-40 -258 -24 -296 14 -332 C24 -342 74 -312 68 -298 C50 -270 44 -240 48 -205 Z';
const EYES = ['M-125 -105 L-212 10 L-48 10 Z', 'M125 -105 L212 10 L48 10 Z'];
const NOSE = 'M0 22 L-34 74 L34 74 Z';
const MOUTH =
  'M-248 82 L-150 118 L-112 84 L-52 128 L0 96 L52 128 L112 84 L150 118 L248 82 ' +
  'C214 180 112 232 58 236 L52 196 L-4 200 L-8 240 C-110 240 -214 180 -248 82 Z';
const FACE = [...EYES, NOSE, MOUTH];

const paths = (list, attrs) => list.map((d) => `<path d="${d}" ${attrs}/>`).join('');
const ribs = (attrs) =>
  RIBS.map(([cx, rx, ry]) => `<ellipse cx="${cx}" cy="30" rx="${rx}" ry="${ry}" ${attrs}/>`).join('');

const pumpkin = `
  <path d="${STEM}" fill="url(#stem)" stroke="#2F4A1C" stroke-width="10" stroke-linejoin="round"/>
  ${ribs('fill="url(#rib)" stroke="#B84A08" stroke-width="10"')}
  ${paths(FACE, 'fill="url(#flame)" stroke="#6E2A04" stroke-width="12" stroke-linejoin="round"')}
`;

// Android tints a monochrome icon itself, so only the shape counts: the face and rib gaps are holes.
const silhouette = `
  <mask id="holes" maskUnits="userSpaceOnUse" x="-512" y="-512" width="1024" height="1024">
    <rect x="-512" y="-512" width="1024" height="1024" fill="#000"/>
    <path d="${STEM}" fill="#fff" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>
    ${ribs('fill="#fff"')}
    ${paths(FACE, 'fill="#000" stroke="#000" stroke-width="12" stroke-linejoin="round"')}
  </mask>
  <rect x="-512" y="-512" width="1024" height="1024" fill="#fff" mask="url(#holes)"/>
`;

const defs = `
  <defs>
    <linearGradient id="rib" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FF9B3D"/>
      <stop offset="0.55" stop-color="#FF7A1A"/>
      <stop offset="1" stop-color="#D9520A"/>
    </linearGradient>
    <linearGradient id="stem" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8DB255"/>
      <stop offset="1" stop-color="#4C7029"/>
    </linearGradient>
    <radialGradient id="flame" gradientUnits="userSpaceOnUse" cx="0" cy="60" r="290">
      <stop offset="0" stop-color="#FFF6C2"/>
      <stop offset="0.6" stop-color="#FFD24A"/>
      <stop offset="1" stop-color="#FFA51F"/>
    </radialGradient>
    <radialGradient id="night" cx="0.5" cy="0.5" r="0.72">
      <stop offset="0" stop-color="#3C2A63"/>
      <stop offset="0.65" stop-color="#1C1330"/>
      <stop offset="1" stop-color="#0F0A1A"/>
    </radialGradient>
  </defs>
`;

const NIGHT = '<rect width="1024" height="1024" fill="url(#night)"/>';

const svg = (content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${content}</svg>`;

// Stem pokes up from the centre, so the drawing sits slightly low in its own coordinates.
const centered = (scale, content) =>
  `<g transform="translate(512 ${512 + 18 * scale}) scale(${scale})">${content}</g>`;

async function render(file, content, { size = 1024, opaque = false } = {}) {
  let image = sharp(Buffer.from(svg(content))).resize(size, size);
  if (opaque) image = image.flatten({ background: '#0F0A1A' });
  await image.png().toFile(OUT + file);
  console.log(file);
}

// Apple rejects an app icon with an alpha channel, hence opaque.
await render('icon.png', NIGHT + centered(1.13, pumpkin), { opaque: true });
// Launchers crop adaptive icons to the middle 66%, so the Android pumpkin stays inside that circle.
await render('android-icon-background.png', NIGHT, { opaque: true });
await render('android-icon-foreground.png', centered(0.84, pumpkin));
await render('android-icon-monochrome.png', centered(0.84, silhouette));
await render('splash-icon.png', centered(1.4, pumpkin));
await render('favicon.png', centered(1.45, pumpkin), { size: 64 });
