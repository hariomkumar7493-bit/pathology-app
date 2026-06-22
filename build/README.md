# Build Resources

Place your application icon here:

- `icon.ico` - Windows icon (256x256 recommended, multi-size .ico)
- `icon.png` - PNG version (512x512 recommended)

## How to create icon.ico

1. Create a 512x512 PNG logo
2. Convert to .ico using:
   - Online: https://convertico.com/
   - Or ImageMagick: `magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`

Place the generated `icon.ico` in this `build/` folder before running `npm run electron:build`.
