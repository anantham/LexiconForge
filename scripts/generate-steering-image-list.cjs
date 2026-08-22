const fs = require('fs');
const path = require('path');

const steeringDir = path.join(__dirname, '..', 'public', 'steering');
const outputFile = path.join(__dirname, '..', 'public', 'steering-images.json');
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// public/steering-images.json is a GENERATED artifact and is intentionally
// untracked (see .gitignore). The []-on-missing-dir behavior is a deliberate
// Vercel accommodation (archived WORKLOG: "unblocking Vercel builds without
// checking in sensitive assets"): deployments without the gitignored source
// images must ship an honest empty manifest, not a stale file list. Writes
// stay idempotent so local installs do not churn the ignored file needlessly.
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
    console.warn(`[SteeringImages] Directory ${steeringDir} not found; writing empty manifest (deployments have no steering assets).`);
    writeIfChanged('[]');
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
  // Keep builds unblocked: an invalid/missing manifest becomes [].
  writeIfChanged('[]');
}
