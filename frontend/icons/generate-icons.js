/**
 * Icon Generation Script
 * Generates all required PWA icons from source logo
 * 
 * Prerequisites: npm install sharp
 * Usage: node generate-icons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_LOGO = path.join(__dirname, 'bhaktitube-logo.png');
const ICONS_DIR = __dirname;
const BRAND_COLOR = '#FF6B35';

const ICONS = [
  { name: 'icon-72x72.png', size: 72 },
  { name: 'icon-96x96.png', size: 96 },
  { name: 'icon-128x128.png', size: 128 },
  { name: 'icon-144x144.png', size: 144 },
  { name: 'icon-152x152.png', size: 152 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-384x384.png', size: 384 },
  { name: 'icon-512x512.png', size: 512 }
];

const MASKABLE_ICONS = [
  { name: 'maskable-icon-192x192.png', size: 192 },
  { name: 'maskable-icon-512x512.png', size: 512 }
];

const SHORTCUT_ICONS = [
  { name: 'shortcut-shorts-96x96.png', size: 96, label: 'S' },
  { name: 'shortcut-journey-96x96.png', size: 96, label: 'J' },
  { name: 'shortcut-channels-96x96.png', size: 96, label: 'C' }
];

async function generateIcon(config, isMaskable = false) {
  const { name, size, label } = config;
  const outputPath = path.join(ICONS_DIR, name);

  try {
    let transformer = sharp(SOURCE_LOGO).resize(size, size, {
      fit: 'contain',
      background: isMaskable ? { r: 255, g: 107, b: 53, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 }
    });

    if (isMaskable) {
      // For maskable icons, ensure full coverage with brand color
      transformer = transformer
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .flatten({ background: BRAND_COLOR });
    }

    if (label) {
      // Add text label for shortcut icons
      const svgText = `
        <svg width="${size}" height="${size}">
          <rect width="${size}" height="${size}" fill="${BRAND_COLOR}"/>
          <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.5}" 
                font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">
            ${label}
          </text>
        </svg>
      `;
      
      const svgBuffer = Buffer.from(svgText);
      transformer = sharp(svgBuffer).resize(size, size);
    }

    await transformer.png().toFile(outputPath);
    console.log(`✓ Generated ${name}`);
  } catch (error) {
    console.error(`✗ Failed to generate ${name}:`, error.message);
  }
}

async function generateAllIcons() {
  console.log('🎨 Generating PWA icons...\n');

  // Check if source logo exists
  if (!fs.existsSync(SOURCE_LOGO)) {
    console.error(`❌ Source logo not found at: ${SOURCE_LOGO}`);
    console.log('Please ensure the logo file exists before running this script.');
    process.exit(1);
  }

  // Generate standard icons
  console.log('Standard Icons:');
  for (const icon of ICONS) {
    await generateIcon(icon);
  }

  // Generate maskable icons
  console.log('\nMaskable Icons:');
  for (const icon of MASKABLE_ICONS) {
    await generateIcon(icon, true);
  }

  // Generate shortcut icons
  console.log('\nShortcut Icons:');
  for (const icon of SHORTCUT_ICONS) {
    await generateIcon(icon);
  }

  console.log('\n✅ All icons generated successfully!');
}

// Run the script
generateAllIcons().catch(error => {
  console.error('❌ Error generating icons:', error);
  process.exit(1);
});
