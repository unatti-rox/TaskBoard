#!/usr/bin/env node

// Batch resizing/export pipeline: takes one master creative and exports every
// required ad size (social, display, print) with a consistent naming convention.
//
// Usage:
//   node export-creative.js <master-file> [options]
//
// Options:
//   --out=<dir>       Output directory (default: ./exports)
//   --sizes=<file>    Sizes config JSON (default: ./sizes.json next to this script)
//   --format=<ext>    Force output format for every size: jpg | png | webp
//   --fit=<mode>      cover (crop to fill, default) | contain (letterbox, keeps whole image)
//   --background=<hex> Background color used for contain fit (default: #ffffff)
//   --quality=<n>     JPEG/WebP quality 1-100 (default: 90)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function parseArgs(argv) {
  const args = { _: [] };
  for (const raw of argv) {
    if (raw.startsWith('--')) {
      const [key, value] = raw.slice(2).split('=');
      args[key] = value === undefined ? true : value;
    } else {
      args._.push(raw);
    }
  }
  return args;
}

function usageAndExit(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    'Usage: node export-creative.js <master-file> [--out=dir] [--sizes=file] ' +
      '[--format=jpg|png|webp] [--fit=cover|contain] [--background=#ffffff] [--quality=90]'
  );
  process.exit(1);
}

async function exportSize(masterPath, baseName, size, opts) {
  const format = (opts.format || size.format || 'jpg').toLowerCase();
  const ext = format === 'jpeg' ? 'jpg' : format;
  const outName = `${baseName}_${size.name}.${ext}`;
  const outPath = path.join(opts.outDir, outName);

  let pipeline = sharp(masterPath).resize(size.width, size.height, {
    fit: opts.fit === 'contain' ? 'contain' : 'cover',
    position: 'centre',
    background: opts.background,
  });

  if (ext === 'jpg') {
    pipeline = pipeline.flatten({ background: opts.background }).jpeg({ quality: opts.quality });
  } else if (ext === 'webp') {
    pipeline = pipeline.webp({ quality: opts.quality });
  } else if (ext === 'png') {
    pipeline = pipeline.png();
  } else {
    throw new Error(`Unsupported format "${format}" for size "${size.name}"`);
  }

  await pipeline.toFile(outPath);
  return outName;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const masterPath = args._[0];
  if (!masterPath) usageAndExit('missing <master-file> argument');
  if (!fs.existsSync(masterPath)) usageAndExit(`file not found: ${masterPath}`);

  const scriptDir = __dirname;
  const sizesPath = args.sizes ? path.resolve(args.sizes) : path.join(scriptDir, 'sizes.json');
  if (!fs.existsSync(sizesPath)) usageAndExit(`sizes config not found: ${sizesPath}`);

  let sizes;
  try {
    sizes = JSON.parse(fs.readFileSync(sizesPath, 'utf8'));
  } catch (err) {
    usageAndExit(`could not parse sizes config: ${err.message}`);
  }
  if (!Array.isArray(sizes) || sizes.length === 0) {
    usageAndExit('sizes config must be a non-empty JSON array');
  }
  for (const size of sizes) {
    if (!size.name || !Number.isInteger(size.width) || !Number.isInteger(size.height)) {
      usageAndExit(`invalid size entry: ${JSON.stringify(size)} (needs name, width, height)`);
    }
  }

  const outDir = path.resolve(args.out || './exports');
  fs.mkdirSync(outDir, { recursive: true });

  const baseName = path.basename(masterPath, path.extname(masterPath));
  const opts = {
    outDir,
    format: args.format,
    fit: args.fit,
    background: args.background || '#ffffff',
    quality: args.quality ? parseInt(args.quality, 10) : 90,
  };

  console.log(`Master: ${masterPath}`);
  console.log(`Sizes:  ${sizesPath} (${sizes.length} sizes)`);
  console.log(`Output: ${outDir}\n`);

  const results = [];
  for (const size of sizes) {
    try {
      const outName = await exportSize(masterPath, baseName, size, opts);
      console.log(`  ok    ${size.name.padEnd(22)} ${size.width}x${size.height}  -> ${outName}`);
      results.push({ size: size.name, ok: true });
    } catch (err) {
      console.error(`  FAIL  ${size.name.padEnd(22)} ${size.width}x${size.height}  -> ${err.message}`);
      results.push({ size: size.name, ok: false, error: err.message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} exports succeeded.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
