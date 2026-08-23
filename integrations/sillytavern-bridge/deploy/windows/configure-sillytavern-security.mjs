import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const fail = (message) => {
  throw new Error(`SillyTavern portal security check failed: ${message}`);
};

const parseArguments = (args) => {
  const parsed = { allowedIps: [], apply: false, root: '' };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply') {
      parsed.apply = true;
    } else if (argument === '--root') {
      parsed.root = args[index + 1] ?? '';
      index += 1;
    } else if (argument === '--allowed-ip') {
      parsed.allowedIps.push(args[index + 1] ?? '');
      index += 1;
    } else {
      fail(`unknown argument ${JSON.stringify(argument)}`);
    }
  }
  return parsed;
};

const isTailscaleIpv4 = (value) => {
  if (net.isIP(value) !== 4) return false;
  const [first, second] = value.split('.').map(Number);
  return first === 100 && second >= 64 && second <= 127;
};

const assertBoolean = (config, key, expected) => {
  if (config[key] !== expected) {
    fail(`${key} must be ${expected}; found ${JSON.stringify(config[key])}`);
  }
};

const args = parseArguments(process.argv.slice(2));
if (!args.root) fail('--root is required');
if (args.allowedIps.length === 0) fail('at least one --allowed-ip is required');
if (args.allowedIps.some((value) => !isTailscaleIpv4(value))) {
  fail('every --allowed-ip must be an IPv4 address in Tailscale CGNAT range 100.64.0.0/10');
}
if (new Set(args.allowedIps).size !== args.allowedIps.length) {
  fail('--allowed-ip values must be unique');
}

const root = fs.realpathSync(args.root);
const packageJsonPath = path.join(root, 'package.json');
const configPath = path.join(root, 'config.yaml');
if (!fs.existsSync(packageJsonPath)) fail(`package.json is missing under ${root}`);
if (!fs.existsSync(configPath)) fail(`config.yaml is missing under ${root}`);

const requireFromSillyTavern = createRequire(packageJsonPath);
const yaml = requireFromSillyTavern('yaml');
const originalText = fs.readFileSync(configPath, 'utf8');
const document = yaml.parseDocument(originalText);
if (document.errors.length > 0) {
  fail(`config.yaml is invalid YAML: ${document.errors.map((error) => error.message).join('; ')}`);
}
const config = document.toJSON();

assertBoolean(config, 'listen', false);
assertBoolean(config, 'whitelistMode', true);
assertBoolean(config, 'enableForwardedWhitelist', true);
assertBoolean(config, 'basicAuthMode', false);
assertBoolean(config, 'enableUserAccounts', false);
assertBoolean(config, 'disableCsrfProtection', false);
assertBoolean(config, 'securityOverride', false);
if (config.forwardedHeaders?.xForwardedFor !== true) {
  fail('forwardedHeaders.xForwardedFor must be true');
}

const requiredWhitelist = ['::1', '127.0.0.1', ...args.allowedIps];
const currentWhitelist = Array.isArray(config.whitelist) ? config.whitelist : [];
const whitelistMatches = currentWhitelist.length === requiredWhitelist.length
  && requiredWhitelist.every((entry) => currentWhitelist.includes(entry));

if (!whitelistMatches && !args.apply) {
  fail(`whitelist must contain only loopback plus the declared device IPs; expected ${requiredWhitelist.join(', ')}`);
}

if (args.apply && !whitelistMatches) {
  const backupPath = `${configPath}.lexiconforge-backup-${Date.now()}`;
  const temporaryPath = `${configPath}.lexiconforge-tmp`;
  const whitelistNode = document.get('whitelist', true);
  if (!yaml.isSeq(whitelistNode) || !whitelistNode.range) {
    fail('whitelist must be a YAML sequence with a source range');
  }
  const [rangeStart, , rangeEnd] = whitelistNode.range;
  const lineStart = originalText.lastIndexOf('\n', rangeStart - 1) + 1;
  const indentation = originalText.slice(lineStart, rangeStart);
  const newline = originalText.includes('\r\n') ? '\r\n' : '\n';
  const replacement = requiredWhitelist
    .map((entry, index) => `${index === 0 ? '' : indentation}- ${entry}`)
    .join(newline) + newline;
  const updatedText = originalText.slice(0, rangeStart) + replacement + originalText.slice(rangeEnd);
  const updatedDocument = yaml.parseDocument(updatedText);
  if (updatedDocument.errors.length > 0) {
    fail(`generated config is invalid YAML: ${updatedDocument.errors.map((error) => error.message).join('; ')}`);
  }
  fs.copyFileSync(configPath, backupPath, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(temporaryPath, updatedText, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporaryPath, configPath);
  process.stdout.write(`Updated whitelist atomically; backup preserved at ${backupPath}\n`);
}

const verified = yaml.parse(fs.readFileSync(configPath, 'utf8'));
const verifiedWhitelist = verified.whitelist ?? [];
if (verifiedWhitelist.length !== requiredWhitelist.length
  || !requiredWhitelist.every((entry) => verifiedWhitelist.includes(entry))) {
  fail('post-write whitelist verification did not match the declared device set');
}

process.stdout.write(`SillyTavern portal security verified for ${args.allowedIps.length} tailnet device(s).\n`);
