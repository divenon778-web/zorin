import sharp from "sharp";

const SVG_WHITE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="transparent"/>
  <path d="M 90 100 L 422 100 L 422 170 L 186 170 L 358 350 L 90 350 L 90 280 L 326 280 L 154 100 Z" fill="white"/>
</svg>`;

async function main() {
  await sharp(Buffer.from(SVG_WHITE)).resize(512, 512).png().toFile("public/icons/logo-white.png");
  console.log("✓ logo-white.png");
}

main().catch(console.error);
