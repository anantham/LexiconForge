const fs = require('fs');
const path = require('path');

const steeringDir = path.join(__dirname, '..', 'public', 'steering');
const outputFile = path.join(__dirname, '..', 'public', 'steering-images.json');
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

try {
  if (!fs.existsSync(steeringDir)) {
    console.log(`[SteeringImages] Directory ${steeringDir} not found. Writing empty list.`);
    fs.writeFileSync(outputFile, '[]');
    process.exit(0);
  }

  const files = fs.readdirSync(steeringDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext);
  });

  fs.writeFileSync(outputFile, JSON.stringify(imageFiles, null, 2));
  console.log(`Successfully generated steering image list at ${outputFile}`);
  console.log(`Found ${imageFiles.length} images:`, imageFiles);
} catch (error) {
  console.error('Failed to generate steering image list:', error);
  // Create an empty file on error to prevent build failures
  fs.writeFileSync(outputFile, '[]');
}
