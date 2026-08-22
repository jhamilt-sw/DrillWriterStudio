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

/*
 * Stamp authorship and dates onto every source and documentation file.
 *
 * A "last modified" date written by hand is wrong within a week — somebody
 * edits a file, forgets the header, and the stamp now says something false,
 * which is worse than saying nothing. So the stamp is generated: run
 * `npm run stamp` and every file gets a current one.
 *
 * Idempotent by design. An existing stamp is recognised by its SPDX line and
 * replaced rather than added to, so running this twice does not leave two
 * banners, and running it after an edit costs nothing.
 *
 * **`--check` deliberately ignores the date.** It verifies that every file
 * carries a stamp and that the stamp's *content* — author, attribution, licence
 * — matches the current values, so a rename or a policy change cannot be half
 * applied. It does not require the date to be today's, because that would put
 * continuous integration permanently in the red: the date on a file is the day
 * its stamp was last refreshed, and the day after any push that is yesterday.
 *
 * `Last modified` therefore means "when the stamp was last run", not "when this
 * line of code changed" — git answers the second question properly and this
 * script should not pretend to.
 *
 * Usage:
 *   node scripts/stamp-authorship.mjs            stamp with today's date
 *   node scripts/stamp-authorship.mjs --check    fail if a stamp is missing or stale in content
 *   node scripts/stamp-authorship.mjs --date=…   stamp with a fixed date
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const AUTHOR = 'Jasper Hamilton';
const CREATED = '2026-08-21';
const PROJECT = 'DrillWriter Studio';
const LICENSE = 'Apache-2.0';
const AI_NOTICE =
  'Portions of this code and its documentation were generated or refined ' +
  'using AI tools under human direction.';
/*
 * A courtesy request, deliberately not a licensing term.
 *
 * Apache-2.0 already obliges anyone redistributing this to retain the
 * copyright notice and NOTICE file and to document their changes. Asking for
 * anything *beyond* the license as a condition would quietly stop this being
 * Apache-2.0 software and make it something nobody can safely depend on. The
 * wording therefore states that it is a request; NOTICE carries the full text.
 */
const ATTRIBUTION =
  'Credit to the original author in derivative works is appreciated as a ' +
  'courtesy. It is not required by the license; see NOTICE.';

/** Directories never worth walking into. */
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.git', '.github', 'coverage']);

/** Files that must not carry a banner: JSON has no comments, licenses are verbatim. */
const SKIP_FILES = new Set(['LICENSE', 'NOTICE', 'CHANGELOG.md']);

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const dateArg = args.find((arg) => arg.startsWith('--date='));
const today = dateArg ? dateArg.slice('--date='.length) : new Date().toISOString().slice(0, 10);

if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`Not a date: ${today}`);
  process.exit(2);
}

/** The banner body, as lines, without any comment syntax. */
function bannerLines() {
  return [
    PROJECT,
    `Author: ${AUTHOR}`,
    `AI assistance: ${AI_NOTICE}`,
    `Attribution: ${ATTRIBUTION}`,
    `Created: ${CREATED}  ·  Last modified: ${today}`,
    `SPDX-License-Identifier: ${LICENSE}`,
  ];
}

/** Wrap a long line so the banner does not run past 80 columns. */
function wrap(text, width, indent) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length + indent > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function blockComment(open, prefix, close) {
  const body = bannerLines().flatMap((line) =>
    // Continuations are indented so a wrapped label still reads as one
    // statement rather than as a new field.
    line.length + prefix.length <= 78
      ? [line]
      : wrap(line, 78, prefix.length).map((part, i) => (i === 0 ? part : `  ${part}`)),
  );
  return [open, ...body.map((line) => `${prefix}${line}`.trimEnd()), close].join('\n');
}

const STYLES = {
  block: {
    banner: () => blockComment('/*', ' * ', ' */'),
    // A previous banner: a leading block comment carrying the SPDX line.
    existing: /^\/\*\r?\n(?:[^\n]*\r?\n)*?[^\n]*SPDX-License-Identifier[^\n]*\r?\n \*\/\r?\n+/,
  },
  html: {
    banner: () => blockComment('<!--', '  ', '-->'),
    existing: /^<!--\r?\n(?:[^\n]*\r?\n)*?[^\n]*SPDX-License-Identifier[^\n]*\r?\n-->\r?\n+/,
  },
  markdown: {
    banner: () =>
      [
        '<!--',
        ...bannerLines().flatMap((line) =>
          line.length <= 76
            ? [`  ${line}`]
            : wrap(line, 76, 2).map((part, i) => (i === 0 ? `  ${part}` : `    ${part}`)),
        ),
        '-->',
      ].join('\n'),
    existing: /^<!--\r?\n(?:[^\n]*\r?\n)*?[^\n]*SPDX-License-Identifier[^\n]*\r?\n-->\r?\n+/,
  },
};

function styleFor(path) {
  switch (extname(path)) {
    case '.ts':
    case '.tsx':
    case '.css':
    case '.mjs':
    case '.js':
      return STYLES.block;
    case '.html':
      return STYLES.html;
    case '.md':
      return STYLES.markdown;
    default:
      return null;
  }
}

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      yield* walk(full);
    } else if (!SKIP_FILES.has(entry.name)) {
      yield full;
    }
  }
}

const stale = [];
let stamped = 0;

for await (const path of walk(ROOT)) {
  const style = styleFor(path);
  if (!style) continue;

  const original = readFileSync(path, 'utf8');

  /*
   * Some files reserve their first line and a banner cannot go above it.
   *
   * A shebang is only honoured at byte zero — pushed down by one line the
   * script stops being executable, which is how this script broke the license
   * checker the first time it ran. A doctype pushed below a comment drops some
   * browsers into quirks mode, which is quieter and worse.
   */
  const reserved = /^(#![^\n]*\n|<!doctype html>\n|<!DOCTYPE html>\n)?/.exec(original);
  const prologue = reserved?.[0] ?? '';
  const rest = original.slice(prologue.length);

  const body = rest.replace(style.existing, '');
  const next = `${prologue}${style.banner()}\n\n${body.replace(/^\n+/, '')}`;

  if (checkOnly) {
    // Compare everything but the date. A file stamped last week is fine; a file
    // with no stamp, or one still naming the old project, is not.
    const withoutDate = (text) => text.replace(/Last modified: \d{4}-\d{2}-\d{2}/, '');
    if (withoutDate(next) !== withoutDate(original)) stale.push(relative(ROOT, path));
    continue;
  }

  if (next === original) continue;
  writeFileSync(path, next);
  stamped += 1;
}

if (checkOnly) {
  if (stale.length > 0) {
    console.error(`Authorship stamp missing or out of date in ${stale.length} file(s):`);
    for (const path of stale.slice(0, 20)) console.error(`  ${path}`);
    if (stale.length > 20) console.error(`  …and ${stale.length - 20} more`);
    console.error('Run `npm run stamp` to update them.');
    process.exit(1);
  }
  console.log('Every file carries a current authorship stamp.');
} else {
  console.log(`Stamped ${stamped} file(s) as of ${today}.`);
}
