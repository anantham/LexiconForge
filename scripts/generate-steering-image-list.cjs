const fs = require('fs');
const path = require('path');

const steeringDir = path.join(__dirname, '..', 'public', 'steering');
const outputFile = path.join(__dirname, '..', 'public', 'steering-images.json');
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// The output file is TRACKED in git. This script must therefore never clobber
// a meaningful manifest with `[]` just because the (gitignored) source dir is
// absent locally, and must stay idempotent so `npm install` (prepare hook)
// does not leave every checkout dirty.
function writeIfChanged(next) {
  try {
    if (fs.existsSync(outputFile) && fs.readFileSync(outputFile, 'utf8') === next) {
      console.log(`[SteeringImages] Manifest already up to date (${outputFile})`);
      return;
    }
  } catch {
    // fall through to write
  }
  fs.writeFileSync(outputFile, next);
  console.log(`[SteeringImages] Wrote ${outputFile}`);
}

try {
  if (!fs.existsSync(steeringDir)) {
    console.warn(`[SteeringImages] Directory ${steeringDir} not found. Leaving ${outputFile} untouched.`);
    process.exit(0);
  }

  const files = fs.readdirSync(steeringDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext);
  });

  writeIfChanged(JSON.stringify(imageFiles, null, 2));
  console.log(`[SteeringImages] ${imageFiles.length} image(s):`, imageFiles);
} catch (error) {
  console.error('[SteeringImages] Failed to generate steering image list:', error);
  if (fs.existsSync(outputFile)) {
    console.warn(`[SteeringImages] Keeping existing manifest at ${outputFile}; fix the error above to refresh it.`);
    process.exit(0);
  }
  // Fresh checkout with no manifest at all: provide a valid empty one.
  fs.writeFileSync(outputFile, '[]');
}
