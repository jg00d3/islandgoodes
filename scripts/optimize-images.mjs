import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

const SOURCE_DIR = 'C:/dev/islandgoodes/CLAUDES PICTURES/NewPics';
const DEST_DIR = 'C:/dev/islandgoodes/public/images';

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function processImage(src, dest, options = {}) {
  const { rotate = 0, width = 1200, quality = 80 } = options;

  await ensureDir(dest);

  let pipeline = sharp(src);

  if (rotate) {
    pipeline = pipeline.rotate(rotate);
  }

  await pipeline
    .resize(width, null, { withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toFile(dest);

  console.log(`Processed: ${dest}`);
}

// Process images
const images = [
  // Hot tub (needs rotation)
  {
    src: `${SOURCE_DIR}/POOL & HOT TUB/hot tub 2.jpg`,
    dest: `${DEST_DIR}/property/hot-tub-new.jpg`,
    options: { rotate: 90, width: 1200 }
  },
  // Mauna Kea Room photos
  {
    src: `${SOURCE_DIR}/Mauna Kea Room/Mauna Kea Room 2.jpg`,
    dest: `${DEST_DIR}/rooms/mauna-kea/room-new.jpg`,
    options: { rotate: 90, width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/Mauna Kea Room/Mauna Kea Lanai 1.jpg`,
    dest: `${DEST_DIR}/rooms/mauna-kea/lanai-new.jpg`,
    options: { rotate: 90, width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/Mauna Kea Room/Mauna Kea Bathroom 1.jpg`,
    dest: `${DEST_DIR}/rooms/mauna-kea/bathroom-new.jpg`,
    options: { rotate: 90, width: 1200 }
  },
  // Hilo Bay Room photos
  {
    src: `${SOURCE_DIR}/Hilo Bay Room/Hilo Bay Room 1.jpg`,
    dest: `${DEST_DIR}/rooms/hilo-bay/room-new.jpg`,
    options: { rotate: 90, width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/Hilo Bay Room/Hilo Bay Lanai 1.jpg`,
    dest: `${DEST_DIR}/rooms/hilo-bay/lanai-new.jpg`,
    options: { rotate: 90, width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/Hilo Bay Room/Hilo Bay Bathroom 1.jpg`,
    dest: `${DEST_DIR}/rooms/hilo-bay/bathroom-new.jpg`,
    options: { rotate: 90, width: 1200 }
  },
  // Ginger Room photos
  {
    src: `${SOURCE_DIR}/Ginger Room/ginger room .jpg`,
    dest: `${DEST_DIR}/rooms/ginger/room-new.jpg`,
    options: { rotate: 90, width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/Ginger Room/ginger room setting area.jpg`,
    dest: `${DEST_DIR}/rooms/ginger/sitting-new.jpg`,
    options: { rotate: 90, width: 1200 }
  },
];

console.log('Starting image optimization...\n');

for (const img of images) {
  try {
    await processImage(img.src, img.dest, img.options);
  } catch (err) {
    console.error(`Error processing ${img.src}: ${err.message}`);
  }
}

console.log('\nDone!');
