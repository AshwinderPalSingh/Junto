// Renders the Junto mark (two overlapping squares, monochrome) into the PWA icons.
// Usage: npm run icons
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const INK = "#0a0a0a";
const PAPER = "#ffffff";

/** The mark on a 32-unit grid, matching views/components/logo.tsx. */
const glyph = (fg, bg) => `
  <rect x="3" y="9" width="17" height="17" fill="${fg}"/>
  <rect x="12" y="4" width="17" height="17" fill="none" stroke="${fg}" stroke-width="2"/>
  <rect x="12" y="9" width="8" height="12" fill="${bg}"/>
  <rect x="13" y="10" width="6" height="10" fill="${fg}" fill-opacity="0.35"/>`;

/** A square tile with the mark centred; `inset` is the share of the tile left as margin on each side. */
const tile = (size, { inset = 0.16, background = INK, foreground = PAPER, transparent = false } = {}) => {
  const scale = (1 - inset * 2) * (size / 32);
  const offset = size * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${transparent ? "" : `<rect width="${size}" height="${size}" fill="${background}"/>`}
  <g transform="translate(${offset} ${offset}) scale(${scale}) translate(-0.5 1.5)">${glyph(foreground, transparent ? "transparent" : background)}</g>
</svg>`;
};

const out = new URL("../public/icons/", import.meta.url).pathname;
const targets = [
  ["icon-192.png", tile(192)],
  ["icon-512.png", tile(512)],
  // Maskable icons are cropped to a circle/squircle by the OS: keep the mark inside the 80% safe zone.
  ["maskable-512.png", tile(512, { inset: 0.24 })],
  ["apple-touch-icon.png", tile(180, { inset: 0.18 })],
  // Android status-bar badge: white silhouette on transparent.
  ["badge-96.png", tile(96, { inset: 0.1, transparent: true })],
];
for (const [name, svg] of targets) {
  await sharp(Buffer.from(svg)).png().toFile(out + name);
  console.log("wrote", name);
}

// Browser-tab icon: an SVG that follows the system theme.
writeFileSync(
  new URL("../src/app/icon.svg", import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .t { fill: ${INK}; } .f { fill: ${PAPER}; } .s { stroke: ${PAPER}; }
    @media (prefers-color-scheme: dark) { .t { fill: ${PAPER}; } .f { fill: ${INK}; } .s { stroke: ${INK}; } }
  </style>
  <rect class="t" width="32" height="32"/>
  <g transform="translate(4 4) scale(0.75) translate(-0.5 1.5)">
    <rect class="f" x="3" y="9" width="17" height="17"/>
    <rect class="s" x="12" y="4" width="17" height="17" fill="none" stroke-width="2"/>
    <rect class="t" x="12" y="9" width="8" height="12"/>
    <rect class="f" x="13" y="10" width="6" height="10" fill-opacity="0.35"/>
  </g>
</svg>
`,
);
console.log("wrote src/app/icon.svg");

// favicon.ico for browsers that ask for it directly: one 48×48 PNG inside an ICO container.
const png = await sharp(Buffer.from(tile(48, { inset: 0.12 }))).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(48, 6); // width
header.writeUInt8(48, 7); // height
header.writeUInt8(0, 8); // palette
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14); // image size
header.writeUInt32LE(22, 18); // image offset
writeFileSync(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([header, png]));
console.log("wrote src/app/favicon.ico");
