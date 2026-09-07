import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const fail = (message) => {
  throw new Error(`SillyTavern dependency inspection failed: ${message}`);
};

const readJson = (filePath, label) => {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    fail(`${label} could not be read: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
};

const requireObject = (value, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
};

const requireString = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
};

try {
  const [option, requestedRoot, ...extra] = process.argv.slice(2);
  if (option !== '--root' || !requestedRoot || extra.length) {
    fail('usage: inspect-sillytavern-dependencies.mjs --root <runtime-directory>');
  }
  let root;
  try {
    root = fs.realpathSync(requestedRoot);
  } catch (error) {
    fail(`--root could not be resolved: ${error.message}`);
  }

  const packageJson = requireObject(
    readJson(path.join(root, 'package.json'), 'package.json'),
    'package.json',
  );
  const packageLock = requireObject(
    readJson(path.join(root, 'package-lock.json'), 'package-lock.json'),
    'package-lock.json',
  );
  const dependencies = requireObject(packageJson.dependencies, 'package.json dependencies');
  const packages = requireObject(packageLock.packages, 'package-lock.json packages');
  const multerRecord = requireObject(
    packages['node_modules/multer'],
    "package-lock.json packages['node_modules/multer']",
  );

  const result = {
    declaredMulter: requireString(
      dependencies.multer,
      'package.json dependencies.multer',
    ),
    lockedMulter: requireString(
      multerRecord.version,
      "package-lock.json packages['node_modules/multer'].version",
    ),
    resolved: requireString(
      multerRecord.resolved,
      "package-lock.json packages['node_modules/multer'].resolved",
    ),
    integrity: requireString(
      multerRecord.integrity,
      "package-lock.json packages['node_modules/multer'].integrity",
    ),
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
