import sharp from "sharp";
import { writeFileSync } from "fs";

const SVG_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A855F7"/>
      <stop offset="50%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#6D28D9"/>
    </linearGradient>
    <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C084FC"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" fill="transparent"/>
  <g filter="url(#glow)" opacity="0.3">
    <path d="M 100 120 L 400 120 L 400 170 L 200 170 L 340 320 L 120 320 L 120 270 L 310 270 L 170 120 Z" fill="#7C3AED"/>
  </g>
  <path d="M 110 110 L 402 110 L 402 168 L 196 168 L 344 340 L 110 340 L 110 282 L 316 282 L 170 110 Z" fill="url(#g1)"/>
  <path d="M 110 110 L 260 110 L 260 140 L 140 140 L 140 168 L 196 168 Z" fill="url(#g2)" opacity="0.4"/>
  <path d="M 250 282 L 380 282 L 380 310 L 280 310 L 250 340 L 110 340 L 110 310 L 250 310 Z" fill="url(#g2)" opacity="0.3"/>
</svg>`;

const SVG_LOGO_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A855F7"/>
      <stop offset="50%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#6D28D9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="transparent"/>
  <path d="M 90 100 L 422 100 L 422 170 L 186 170 L 358 350 L 90 350 L 90 280 L 326 280 L 154 100 Z" fill="url(#g1)"/>
</svg>`;

const SIZES = [
  { svg: SVG_LOGO_ICON, out: "public/icons/favicon-16x16.png", w: 16, h: 16 },
  { svg: SVG_LOGO_ICON, out: "public/icons/favicon-32x32.png", w: 32, h: 32 },
  { svg: SVG_LOGO_ICON, out: "public/icons/android-chrome-192x192.png", w: 192, h: 192 },
  { svg: SVG_LOGO_ICON, out: "public/icons/android-chrome-512x512.png", w: 512, h: 512 },
  { svg: SVG_LOGO_ICON, out: "public/icons/apple-touch-icon.png", w: 180, h: 180 },
  { svg: SVG_LOGO, out: "public/icons/logo.png", w: 512, h: 512 },
  { svg: SVG_LOGO, out: "public/icons/CD1CB55E-5059-4BAA-B236-7C57F0A49F5B.png", w: 512, h: 512 },
];

async function main() {
  for (const { svg, out, w, h } of SIZES) {
    await sharp(Buffer.from(svg)).resize(w, h).png().toFile(out);
    console.log(`✓ ${out} (${w}x${h})`);
  }

  // Also create favicon.ico from 32x32
  const icoBuf = await sharp(Buffer.from(SVG_LOGO_ICON)).resize(32, 32).png().toBuffer();
  writeFileSync("public/icons/favicon.ico", icoBuf);
  console.log("✓ favicon.ico (32x32)");
}

main().catch(console.error);
