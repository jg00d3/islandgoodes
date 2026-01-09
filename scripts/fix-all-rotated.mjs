import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public', 'images');

// NEW rotated images that still need 90° clockwise rotation
const rotatedImages = [
  // Hilo Bay Room
  'rooms/hilo-bay/room.jpg',
  'rooms/hilo-bay/room2.jpg',

  // Mauna Kea Room
  'rooms/mauna-kea/room.jpg',
  'rooms/mauna-kea/room2.jpg',

  // Orchid Room - living areas
  'rooms/orchid/living.jpg',
  'rooms/orchid/living2.jpg',
  'rooms/orchid/living3.jpg',
  'rooms/orchid/room2.jpg',
];

async function fixRotatedImage(imagePath) {
  const fullPath = path.join(publicDir, imagePath);

  try {
    // Read the image and rotate 90 degrees clockwise
    const rotated = await sharp(fullPath)
      .rotate(90)
      .jpeg({ quality: 85 })
      .toBuffer();

    // Write back to the same file
    await sharp(rotated).toFile(fullPath);

    console.log(`✓ Fixed: ${imagePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error fixing ${imagePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Fixing ALL rotated images...\n');

  let fixed = 0;
  let failed = 0;

  for (const imagePath of rotatedImages) {
    const success = await fixRotatedImage(imagePath);
    if (success) {
      fixed++;
    } else {
      failed++;
    }
  }

  console.log(`\nDone! Fixed ${fixed} images, ${failed} failed.`);
}

main();
