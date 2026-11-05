import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REVIEWED_COMMIT = '51ad27fb86d39a3daca3adaa970375c9670c12df';
const BASE_PAIR = ['12c30fc061e38c0a35becca70fab9c6fb991a7f0', '95b4dbc33c62829e2aff383f286889ebdcc15ffd'];
const HARDENED_PAIR = ['47898a96d79c053a90acb5502283161ff8c49b16', 'c4f410036f0dfe5194764ae56620eb76a362ea44'];
const EXTENSION = 'public/scripts/extensions/lexiconforge-portal';
// Data locations from the reviewed release; never inspect their private bytes.
// Executable plugins and third-party extensions are deliberately not exempt.
const DATA_DIRECTORIES = new Set([
  '.git', 'node_modules', 'data', 'uploads', 'cache', 'backups', 'vectors', 'thumbnails', 'certs',
  'public/chats', 'public/characters', 'public/User Avatars', 'public/backgrounds',
  'public/groups', 'public/group chats', 'public/worlds', 'public/user', 'public/themes',
  'public/OpenAI Settings', 'public/KoboldAI Settings', 'public/NovelAI Settings',
  'public/TextGen Settings', 'public/instruct', 'public/context', 'public/movingUI',
  'public/QuickReplies', 'public/assets', 'public/error',
]);
const DATA_FILES = new Set([
  'config.yaml', 'config.conf', 'config.conf.bak', 'secrets.json', '.env',
  'whitelist.txt', 'content.log', 'access.log', 'public/settings.json',
  'public/stats.json', 'public/css/bg_load.css', 'public/css/user.css',
]);
const fail = (message) => { throw new Error(`SillyTavern source verification failed: ${message}`); };
const blobHash = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const gitEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const git = (root, args) => execFileSync('git', [
  '--no-replace-objects', '-c', 'core.fsmonitor=false', '-C', root, ...args,
], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: {
  ...gitEnvironment, GIT_CONFIG_COUNT: '0', GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
} });

const readTree = (root, revision) => new Map(git(root, ['ls-tree', '-rz', revision])
  .split('\0').filter(Boolean).map((record) => {
    const [metadata, name] = record.split('\t');
    const [mode, type, hash] = metadata.split(' ');
    if (type !== 'blob' || !['100644', '100755', '120000'].includes(mode)) fail(`unsupported source entry ${name}`);
    return [name, { mode, hash }];
  }));

const readWorkingBlob = (root, name, mode) => {
  const file = path.join(root, name);
  const parents = name.split('/').slice(0, -1);
  let current = root;
  for (const parent of parents) {
    current = path.join(current, parent);
    if (!fs.lstatSync(current).isDirectory()) fail(`source parent is not a real directory: ${name}`);
  }
  const stat = fs.lstatSync(file);
  if (mode === '120000') {
    if (!stat.isSymbolicLink()) fail(`source file type changed: ${name}`);
    return blobHash(Buffer.from(fs.readlinkSync(file)));
  }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`source file type changed: ${name}`);
  return blobHash(fs.readFileSync(file));
};

const verifyExtension = (target, source) => {
  const names = fs.readdirSync(target).sort();
  if (JSON.stringify(names) !== JSON.stringify(fs.readdirSync(source).sort())) fail('installed extension differs from reviewed source');
  for (const name of names) {
    const left = path.join(target, name), right = path.join(source, name);
    const a = fs.lstatSync(left), b = fs.lstatSync(right);
    if (a.isDirectory() && b.isDirectory()) verifyExtension(left, right);
    else if (!a.isFile() || !b.isFile() || !fs.readFileSync(left).equals(fs.readFileSync(right))) {
      fail('installed extension differs from reviewed source');
    }
  }
};

// The expected identity is an internal test seam, never a CLI override.
export function verifySource(rootInput, expected = { commit: REVIEWED_COMMIT, basePair: BASE_PAIR, hardenedPair: HARDENED_PAIR }) {
  const root = fs.realpathSync(rootInput);
  if (fs.realpathSync(git(root, ['rev-parse', '--show-toplevel']).trim()) !== root) fail('runtime must be the Git checkout root');
  if (git(root, ['rev-parse', 'HEAD']).trim() !== expected.commit) fail('runtime must be the exact reviewed official SillyTavern 1.18.0 commit; ancestry or matching manifests alone are insufficient');
  const tree = readTree(root, expected.commit);
  const index = git(root, ['ls-files', '--stage', '-z']).split('\0').filter(Boolean);
  if (index.length !== tree.size || index.some((record) => {
    const [metadata, name] = record.split('\t');
    const [mode, hash, stage] = metadata.split(' ');
    return stage !== '0' || tree.get(name)?.hash !== hash || tree.get(name)?.mode !== mode;
  })) fail('runtime contains staged changes');

  const pair = ['package.json', 'package-lock.json'].map((name) => readWorkingBlob(root, name, '100644'));
  if (![expected.basePair, expected.hardenedPair].some((allowed) => pair.every((hash, index) => hash === allowed[index]))) {
    fail('working manifests must be the exact reviewed base or hardened pair');
  }
  for (const [name, { mode, hash }] of tree) {
    if (name === 'package.json' || name === 'package-lock.json') continue;
    if (readWorkingBlob(root, name, mode) !== hash) fail(`unreviewed working source bytes: ${name}; use a checkout with core.autocrlf=false`);
  }
  const extensionSource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../st-extension');
  const walk = (relative = '') => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (tree.has(name)) continue;
      if (name === '.git' && entry.isFile()) continue;
      if (DATA_DIRECTORIES.has(name)) {
        if (!entry.isDirectory()) fail(`runtime data path must be a real directory: ${name}`);
        continue;
      }
      if (DATA_FILES.has(name) || /^config\.yaml\.lexiconforge-backup-\d+$/.test(name)) {
        if (!entry.isFile()) fail(`runtime data path must be a regular file: ${name}`);
        continue;
      }
      if (name === EXTENSION) {
        if (!entry.isDirectory()) fail('installed extension must be a real directory');
        verifyExtension(path.join(root, name), extensionSource);
      } else if (entry.isDirectory()) walk(name);
      else fail(`unreviewed runtime path: ${name}`);
    }
  };
  walk();
  return { commit: expected.commit, sourceFiles: tree.size, hardened: pair[0] === expected.hardenedPair[0] };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [option, root, ...extra] = process.argv.slice(2);
    if (option !== '--root' || !root || extra.length) fail('usage: verify-sillytavern-source.mjs --root <runtime-directory>');
    process.stdout.write(`${JSON.stringify(verifySource(root))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
