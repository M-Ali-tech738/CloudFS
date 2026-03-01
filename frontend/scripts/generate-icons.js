const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '../public/icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate a simple SVG icon for CloudFS
function generateSVG(size) {
  const padding = Math.floor(size * 0.15);
  const fontSize = Math.floor(size * 0.35);
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#1a7a4a"/>
      <text
        x="50%"
        y="54%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-weight="bold"
        font-size="${fontSize}"
        fill="white"
      >C</text>
    </svg>
  `;
}

async function generateIcons() {
  for (const size of sizes) {
    const svg = Buffer.from(generateSVG(size));
    await sharp(svg)
      .png()
      .toFile(path.join(outputDir, `icon-${size}x${size}.png`));
    console.log(`Generated icon-${size}x${size}.png`);
  }
  console.log('All icons generated!');
}

generateIcons().catch(console.error);
