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

// Process remaining images
const images = [
  // Orchid Room - kitchen photos
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/orchid-kitchen-1.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/kitchen.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/orchid-kitchen-2.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/kitchen2.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/orchid-kitchen-3.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/kitchen3.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/orchid-unit-9.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/unit.jpg`,
    options: { width: 1200 }
  },

  // Activity images for guide/blog
  {
    src: `${SOURCE_DIR}/KAYAKING/pexels-thilo-lehnert-1378678-3413678.jpg`,
    dest: `${DEST_DIR}/activities/kayaking.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/Manta Ray/pexels-dajana-reci-289671698-32279565.jpg`,
    dest: `${DEST_DIR}/activities/manta-ray.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ZIPLINE/pexels-melissa-villaran-304836-4938780.jpg`,
    dest: `${DEST_DIR}/activities/zipline.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/HELICOPTER/pexels-seurafrancis99-6844971.jpg`,
    dest: `${DEST_DIR}/activities/helicopter.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/KONA COFFEE FARM/pexels-michael-burrows-7125434.jpg`,
    dest: `${DEST_DIR}/activities/coffee-farm.jpg`,
    options: { width: 1200 }
  },

  // Beach photos
  {
    src: `${SOURCE_DIR}/BEACH PARK RICHARDSONS/b&b ROOMS 063.JPG`,
    dest: `${DEST_DIR}/beaches/richardsons.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/BEACH PARKS CARL SMITH/b&b ROOMS 089.JPG`,
    dest: `${DEST_DIR}/beaches/carlsmith.jpg`,
    options: { width: 1200 }
  },

  // Gardens
  {
    src: `${SOURCE_DIR}/GARDENS/b&b ROOMS 043.JPG`,
    dest: `${DEST_DIR}/property/garden.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/GARDENS/b&b ROOMS 044.JPG`,
    dest: `${DEST_DIR}/property/garden2.jpg`,
    options: { width: 1200 }
  },

  // Additional waterfalls/ocean views
  {
    src: `${SOURCE_DIR}/WATER FALLS AND OCEAN VIEWS/Hawaii March 2005 019.jpg`,
    dest: `${DEST_DIR}/scenery/ocean-view.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/WATER FALLS AND OCEAN VIEWS/Turtles moving in on the Kids!.jpg`,
    dest: `${DEST_DIR}/scenery/turtles.jpg`,
    options: { width: 1200 }
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
