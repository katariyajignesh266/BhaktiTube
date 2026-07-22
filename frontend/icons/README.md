# PWA Icons

This directory contains all PWA icons for BhaktiTube.

## Required Icons

### Standard Icons
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

### Maskable Icons (for adaptive icons)
- maskable-icon-192x192.png
- maskable-icon-512x512.png

### Shortcut Icons
- shortcut-shorts-96x96.png
- shortcut-journey-96x96.png
- shortcut-channels-96x96.png

## How to Generate Icons

### Option 1: Using Online Tools
1. Visit https://realfavicongenerator.net/
2. Upload your logo: `../Image/v-3.png`
3. Configure settings:
   - Background color: #FF6B35
   - Margin: 10%
   - Generate all sizes
4. Download and place in this directory

### Option 2: Using ImageMagick (Command Line)
```bash
# Convert logo to PNG if needed
magick ../Image/v-3.png logo.png

# Generate standard icons
magick logo.png -resize 72x72 icon-72x72.png
magick logo.png -resize 96x96 icon-96x96.png
magick logo.png -resize 128x128 icon-128x128.png
magick logo.png -resize 144x144 icon-144x144.png
magick logo.png -resize 152x152 icon-152x152.png
magick logo.png -resize 192x192 icon-192x192.png
magick logo.png -resize 384x384 icon-384x384.png
magick logo.png -resize 512x512 icon-512x512.png

# Generate maskable icons (with safe zone)
magick logo.png -resize 512x512 -gravity center -extent 512x512 -background "#FF6B35" maskable-icon-512x512.png
magick logo.png -resize 192x192 -gravity center -extent 192x192 -background "#FF6B35" maskable-icon-192x192.png
```

### Option 3: Using Node.js with sharp
```bash
npm install sharp
node generate-icons.js
```

## Icon Specifications

- **Format**: PNG
- **Background**: #FF6B35 (brand orange)
- **Safe Zone**: 40% from center for maskable icons
- **Transparency**: Supported for standard icons
- **Quality**: High (PNG-24)

## Current Status

Icons need to be generated. Use one of the methods above to create all required icons from the source logo at `../Image/v-3.png`.
