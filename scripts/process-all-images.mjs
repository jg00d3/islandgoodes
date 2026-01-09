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

// ALL remaining images to process
const images = [
  // =================== AMENITIES ===================
  {
    src: `${SOURCE_DIR}/AMENITIES/AMENITIES/KITCHENNETTE 2.jpg`,
    dest: `${DEST_DIR}/property/kitchenette2.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/AMENITIES/AMENITIES/sleep number bed.jpg`,
    dest: `${DEST_DIR}/property/sleep-number2.jpg`,
    options: { width: 1200 }
  },

  // =================== ANIMALS AND PEOPLE ===================
  {
    src: `${SOURCE_DIR}/ANIMALS AND PEOPLE/coconut Jake.jpg`,
    dest: `${DEST_DIR}/property/coconut-jake.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ANIMALS AND PEOPLE/Garvin and Laura.jpg`,
    dest: `${DEST_DIR}/property/hosts2.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ANIMALS AND PEOPLE/MISS KITTY.jpg`,
    dest: `${DEST_DIR}/property/miss-kitty.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ANIMALS AND PEOPLE/Prudy 2021.jpg`,
    dest: `${DEST_DIR}/property/prudy.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ANIMALS AND PEOPLE/Prudy and Jasper 2021.jpg`,
    dest: `${DEST_DIR}/property/prudy-jasper.jpg`,
    options: { width: 1200 }
  },

  // =================== DONKEY/HORSE ===================
  {
    src: `${SOURCE_DIR}/DONKEY/donkey006.jpg`,
    dest: `${DEST_DIR}/attractions/donkey.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/DONKEY/Horse/20241106_111819.jpg`,
    dest: `${DEST_DIR}/attractions/horse.jpg`,
    options: { width: 1200 }
  },

  // =================== FALLS AKAKA ===================
  {
    src: `${SOURCE_DIR}/FALLS AKAKA/b&b ROOMS 165.JPG`,
    dest: `${DEST_DIR}/attractions/akaka-falls.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/FALLS AKAKA/pexels-revlisajwinston-14539733.jpg`,
    dest: `${DEST_DIR}/attractions/akaka-falls2.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/FALLS AKAKA/pexels-the-six-2148199655-31973832.jpg`,
    dest: `${DEST_DIR}/attractions/akaka-falls3.jpg`,
    options: { width: 1200 }
  },

  // =================== HILO BAY (scenery) ===================
  {
    src: `${SOURCE_DIR}/HILO BAY/b&b ROOMS 040.JPG`,
    dest: `${DEST_DIR}/scenery/hilo-bay.jpg`,
    options: { width: 1200 }
  },

  // =================== PLANTS AND TREES ===================
  {
    src: `${SOURCE_DIR}/PLANTS AND TREES/Hawaii March 2005 080.jpg`,
    dest: `${DEST_DIR}/property/tropical-plants.jpg`,
    options: { width: 1200 }
  },

  // =================== POOL & HOT TUB ===================
  {
    src: `${SOURCE_DIR}/POOL & HOT TUB/POOL 1.jpg`,
    dest: `${DEST_DIR}/property/pool3.jpg`,
    options: { width: 1200 }
  },

  // =================== VOLCANO ===================
  {
    src: `${SOURCE_DIR}/VOLCANO/pexels-james-lee-932763-33295503.jpg`,
    dest: `${DEST_DIR}/attractions/volcano-lava.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/VOLCANO/Volcano1.jpg`,
    dest: `${DEST_DIR}/attractions/volcano.jpg`,
    options: { width: 1200 }
  },

  // =================== WATER FALLS AND OCEAN VIEWS ===================
  {
    src: `${SOURCE_DIR}/WATER FALLS AND OCEAN VIEWS/Chuck's pictures October 2007 023.jpg`,
    dest: `${DEST_DIR}/scenery/ocean-view2.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/WATER FALLS AND OCEAN VIEWS/hilo-hi-island-goode-s.jpg`,
    dest: `${DEST_DIR}/scenery/island-goodes-view.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/WATER FALLS AND OCEAN VIEWS/HiloBay.jpg`,
    dest: `${DEST_DIR}/scenery/hilo-bay2.jpg`,
    options: { width: 1200 }
  },

  // =================== CLAUDE WEBSITE CORRECTIONS ===================
  {
    src: `${SOURCE_DIR}/Claude website corrections/Looming_large.jpg`,
    dest: `${DEST_DIR}/attractions/volcano-looming.jpg`,
    options: { width: 1200 }
  },

  // =================== LAUNDRY ===================
  {
    src: `${SOURCE_DIR}/Laundry/Laundry.png`,
    dest: `${DEST_DIR}/property/laundry.jpg`,
    options: { width: 1200 }
  },

  // =================== GINGER ROOM (remaining/fix rotation) ===================
  {
    src: `${SOURCE_DIR}/Ginger Room/ginger room .jpg`,
    dest: `${DEST_DIR}/rooms/ginger/room2.jpg`,
    options: { width: 1200, rotate: 90 }
  },

  // =================== HILO BAY ROOM (remaining) ===================
  {
    src: `${SOURCE_DIR}/Hilo Bay Room/Hilo Bay Bathroom 1.jpg`,
    dest: `${DEST_DIR}/rooms/hilo-bay/bathroom6.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/Hilo Bay Room/Hilo Bay Bathroom 2.jpg`,
    dest: `${DEST_DIR}/rooms/hilo-bay/bathroom7.jpg`,
    options: { width: 1200 }
  },

  // =================== MAUNA KEA ROOM (remaining) ===================
  {
    src: `${SOURCE_DIR}/Mauna Kea Room/Mauna Kea Closet 3.jpg`,
    dest: `${DEST_DIR}/rooms/mauna-kea/closet3.jpg`,
    options: { width: 1200 }
  },

  // =================== ORCHID ROOM (remaining - all the dated photos) ===================
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152111.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/view10.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152215.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/view11.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152221.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/view12.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152543.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/living.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152602.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/living2.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152634.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/living3.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152710.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/room2.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152751.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/bathroom3.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152803.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/bathroom4.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152922.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/closet.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_152949.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/closet2.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_153030.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/entrance.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/20230814_153117.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/entrance2.jpg`,
    options: { width: 1200 }
  },
  {
    src: `${SOURCE_DIR}/ORCHID UNIT PICTURES/orchid-kitchen-5.jpg`,
    dest: `${DEST_DIR}/rooms/orchid/kitchen5.jpg`,
    options: { width: 1200 }
  },

  // =================== WATERFALLS folder ===================
  // Check if there's a separate Waterfalls folder
];

console.log(`Starting image optimization...\n`);
console.log(`Processing ${images.length} images\n`);

let processed = 0;
let errors = 0;

for (const img of images) {
  try {
    await processImage(img.src, img.dest, img.options);
    processed++;
  } catch (err) {
    console.error(`Error processing ${img.src}: ${err.message}`);
    errors++;
  }
}

console.log(`\nDone!`);
console.log(`Processed: ${processed} images`);
console.log(`Errors: ${errors}`);
