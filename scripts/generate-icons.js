import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sizes = [192, 512];

async function generateIcons() {
  try {
    for (const size of sizes) {
      await sharp(path.join(__dirname, '..', 'public', 'icons', 'source-icon.jpg'))
        .resize(size, size)
        .png()
        .toFile(path.join(__dirname, '..', 'public', 'icons', `icon-${size}x${size}.png`));
      console.log(`Generated ${size}x${size} icon`);
    }
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons(); 