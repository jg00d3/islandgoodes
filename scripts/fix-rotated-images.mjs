import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public', 'images');

// All rotated images that need 90° clockwise rotation
const rotatedImages = [
  // Property
  'property/pool.jpg',
  'property/pool3.jpg',
  'property/hot-tub.jpg',
  'property/coconut-jake.jpg',

  // Attractions
  'attractions/akaka-falls.jpg',
  'attractions/volcano.jpg',

  // Orchid Room - all "view" images are actually room images rotated sideways
  'rooms/orchid/view1.jpg',
  'rooms/orchid/view2.jpg',
  'rooms/orchid/view3.jpg',
  'rooms/orchid/view4.jpg',
  'rooms/orchid/view5.jpg',
  'rooms/orchid/view6.jpg',
  'rooms/orchid/view7.jpg',
  'rooms/orchid/view8.jpg',
  'rooms/orchid/view9.jpg',

  // Ginger Room
  'rooms/ginger/room2.jpg',
];

async function fixRotatedImage(imagePath) {
  const fullPath = path.join(publicDir, imagePath);

  try {
    // Read the image
    const image = sharp(fullPath);
    const metadata = await image.metadata();

    // Rotate 90 degrees clockwise and save
    const rotated = await sharp(fullPath)
      .rotate(90)
      .jpeg({ quality: 85 })
      .toBuffer();

    // Write back to the same file
    await sharp(rotated).toFile(fullPath);

    console.log(`Fixed: ${imagePath}`);
    return true;
  } catch (error) {
    console.error(`Error fixing ${imagePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Fixing rotated images...\n');

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
