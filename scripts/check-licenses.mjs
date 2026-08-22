#!/usr/bin/env node
/*
 * DrillWriter Studio
 * Author: Jasper Hamilton
 * AI assistance: Portions of this code and its documentation were generated
 *   or refined using AI tools under human direction.
 * Attribution: Credit to the original author in derivative works is
 *   appreciated as a courtesy. It is not required by the license; see NOTICE.
 * Created: 2026-08-21  ·  Last modified: 2026-08-22
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Keeps THIRD_PARTY_LICENSES.md honest (FR-5.2, FR-5.3).
 *
 * Two checks:
 *   1. every dependency in package.json appears in THIRD_PARTY_LICENSES.md;
 *   2. no installed package carries a license incompatible with Apache-2.0
 *      redistribution.
 *
 * The second check reads node_modules when it is present and skips quietly when
 * it is not, so the script is useful both in CI and on a fresh clone.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Strong copyleft: incompatible with shipping inside an Apache-2.0 bundle. */
const FORBIDDEN = [/\bGPL-[23]\.0/i, /\bAGPL/i, /\bSSPL/i, /\bCC-BY-NC/i];
/** Weak copyleft and unknowns: allowed, but a human should look. */
const REVIEW = [/\bLGPL/i, /\bMPL/i, /\bEPL/i, /\bCDDL/i];

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const noticePath = join(root, 'THIRD_PARTY_LICENSES.md');
const notice = readFileSync(noticePath, 'utf8');

const declared = { ...pkg.dependencies, ...pkg.devDependencies };
const problems = [];
const warnings = [];

for (const name of Object.keys(declared)) {
  if (!notice.includes(`[${name}]`) && !notice.includes(`| ${name} `)) {
    problems.push(`${name} is in package.json but missing from THIRD_PARTY_LICENSES.md`);
  }
}

const modulesDir = join(root, 'node_modules');
if (existsSync(modulesDir)) {
  for (const [name, license] of installedLicenses(modulesDir)) {
    if (FORBIDDEN.some((pattern) => pattern.test(license))) {
      problems.push(`${name} is licensed ${license}, which cannot ship inside an Apache-2.0 project`);
    } else if (REVIEW.some((pattern) => pattern.test(license))) {
      warnings.push(`${name} is licensed ${license} — weak copyleft, review before shipping`);
    } else if (license === 'UNKNOWN') {
      warnings.push(`${name} declares no license field`);
    }
  }
} else {
  warnings.push('node_modules not present — skipped the installed-package license scan');
}

for (const warning of warnings) console.warn(`warning: ${warning}`);

if (problems.length > 0) {
  console.error('\nLicense check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `License check passed: ${Object.keys(declared).length} declared dependencies, ` +
    `${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
);

/** Walk node_modules one level deep (plus scopes) reading each package.json. */
function* installedLicenses(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.bin' || entry.name === '.cache') continue;
    if (entry.name.startsWith('@')) {
      yield* installedLicenses(join(dir, entry.name));
      continue;
    }
    const manifestPath = join(dir, entry.name, 'package.json');
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const license =
        typeof manifest.license === 'string'
          ? manifest.license
          : manifest.license?.type ??
            (Array.isArray(manifest.licenses)
              ? manifest.licenses.map((l) => l.type ?? l).join(' OR ')
              : 'UNKNOWN');
      yield [manifest.name ?? entry.name, license];
    } catch {
      // A malformed manifest is not this script's problem to solve.
    }
  }
}
