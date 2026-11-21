#!/usr/bin/env node
/**
 * Tooling for the versioned Developer API contract package (@twforge/developer-api). Versions, tags, the changelog and
 * GitHub releases are managed by release-please (see README.md, "Developer API Contract").
 *
 * Commands:
 *   package       Assemble the npm package in build/developer-api-package (run after api:bundle + api:types).
 *   check-compat  Enforce the contract rules on the assembled bundle (run after package): info.version equals
 *                 developer-api/version.txt and matches the /api/vN path, every "sanctioned" oasdiff check is `err` in
 *                 oasdiff-levels.txt, and compared with the merge-base with origin/main the major version is unchanged
 *                 and there are no breaking or potentially breaking changes (oasdiff ERR/WARN).
 *                 Uses `oasdiff` from PATH (or $OASDIFF) with the policy in .oasdiff.yaml.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = 'developer-api/openapi.yaml';
const templateDir = join(root, 'developer-api', 'npm');
const outDir = join(root, 'build', 'developer-api-package');
const levelsFile = 'oasdiff-levels.txt';
// Passed explicitly so a missing or unreadable policy fails loudly instead of oasdiff silently using its defaults.
const oasdiffConfig = ['--config', '.oasdiff.yaml'];
const versionFile = 'developer-api/version.txt';
const execOptions = { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 };

const inGitHubActions = process.env.GITHUB_ACTIONS === 'true';

/**
 * Prints an error and exits. In GitHub Actions it is a workflow command (shown as annotation, inline in the PR diff
 * when `file`/`line` are given); locally it is plain text.
 */
function fail(message, { file, line } = {}) {
  if (inGitHubActions) {
    const location = file ? ` file=${file}${line ? `,line=${line}` : ''}` : '';
    // Workflow command data must encode %, CR and LF, or multi-line messages are cut off after the first line.
    const data = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    console.error(`::error${location}::${data}`);
  } else {
    const location = file ? `${file}${line ? `:${line}` : ''}: ` : '';
    console.error(`Error: ${location}${message}`);
  }
  process.exit(1);
}

/**
 * Finds the `info.version` line by its `# x-release-please-version` marker, the same way release-please's updater
 * does: its 1-based line (to anchor annotations) and version.
 */
function findVersion(text) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes('x-release-please-version'));
  return { line: index + 1 || undefined, value: /\d+\.\d+\.\d+/.exec(lines[index] ?? '')?.[0] };
}

/** Location of `info.version` in the source spec, for annotations about the version. */
function versionLocation() {
  return { file: specPath, line: findVersion(readFileSync(join(root, specPath), 'utf8')).line };
}

/** Runs oasdiff and returns its result. Exit codes outside `okStatuses` (e.g. 102: spec not loadable) abort. */
function oasdiff(args, { quiet = false, okStatuses = [0, 1] } = {}) {
  const result = spawnSync(process.env.OASDIFF || 'oasdiff', args, execOptions);
  if (result.stdout && !quiet) console.log(result.stdout.trimEnd());
  if (result.stderr) console.error(result.stderr.trimEnd());
  if (result.error) fail(`Could not run oasdiff: ${result.error.message}`);
  if (!okStatuses.includes(result.status)) fail(`oasdiff ${args[0]} failed with exit code ${result.status}.`);
  return result;
}

function git(args) {
  return execFileSync('git', args, { ...execOptions, stdio: 'pipe' }).trim();
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  if (!match) fail(`"${version}" is not a valid release version (expected MAJOR.MINOR.PATCH).`);
  return match.slice(1).map(Number);
}

/** The major version of info.version must equal the /api/vN path version of the servers. */
function checkPathVersion(spec) {
  const [major] = parseSemver(spec.info.version);
  const pathVersions = new Set(
    (spec.servers ?? []).map((server) => /\/api\/v(\d+)(?:\/|$)/.exec(server.url ?? '')?.[1]).map(Number),
  );
  if (pathVersions.size !== 1 || pathVersions.has(NaN)) {
    fail(`All servers in ${specPath} must use the same /api/v<N> path version.`, { file: specPath });
  }
  const [pathVersion] = pathVersions;
  if (major !== pathVersion) {
    fail(
      `info.version ${spec.info.version} does not match the API path version /api/v${pathVersion}. ` +
        'Breaking changes are not allowed within an API version: a new major version needs a new /api/vN spec file. ' +
        'If release-please proposed this version because of a "!" or BREAKING CHANGE commit, set "release-as" in ' +
        'release-please-config.json (see README.md).',
      versionLocation(),
    );
  }
}

/**
 * oasdiff accepts some removals after deprecation ("sanctioned" checks, info level by default). Our policy forbids
 * them, so every sanctioned check must be raised to `err` in the severity-levels file referenced by .oasdiff.yaml.
 * Guards against oasdiff upgrades that add new sanctioned checks.
 */
function checkSeverityLevels() {
  const levels = new Map(
    readFileSync(join(root, levelsFile), 'utf8')
      .split('\n')
      .map((line) => line.replace(/#.*/, '').trim().split(/\s+/))
      .filter(([id]) => id),
  );
  const { stdout } = oasdiff(['checks', 'changelog', '--tags', 'sanctioned', '--format', 'json'], {
    quiet: true,
    okStatuses: [0],
  });
  const missing = JSON.parse(stdout)
    .map((check) => check.id)
    .filter((id) => levels.get(id) !== 'err');
  if (missing.length > 0) {
    fail(
      `These oasdiff checks allow removals after deprecation and must be set to "err" in ${levelsFile}: ${missing.join(', ')}`,
      { file: levelsFile },
    );
  }
}

/** Reads a JSON file of the assembled package in build/developer-api-package. */
function readPackageFile(file) {
  try {
    return JSON.parse(readFileSync(join(outDir, file), 'utf8'));
  } catch (error) {
    fail(`Could not read ${join(outDir, file)} (${error.message}). Run "npm run api:package" first.`);
  }
}

function buildPackage() {
  // The version of the bundle being packaged (written by api:bundle), not a fresh bundling run.
  const { version } = readPackageFile('openapi.json').info;
  parseSemver(version);
  const pkg = JSON.parse(readFileSync(join(templateDir, 'package.json'), 'utf8'));
  pkg.version = version;
  writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  for (const file of ['README.md', 'LICENSE']) copyFileSync(join(templateDir, file), join(outDir, file));
  // Types-only package; an empty module keeps runtime resolvers happy if someone imports without `import type`.
  writeFileSync(join(outDir, 'index.js'), 'export {};\n');
  console.log(`Assembled ${pkg.name}@${version} in ${outDir}`);
}

/** release-please bumps info.version and version.txt together; a manual edit of only one of them is a mistake. */
function checkVersionFile(version) {
  let fileVersion;
  try {
    fileVersion = readFileSync(join(root, versionFile), 'utf8').trim();
  } catch (error) {
    fail(
      `Could not read ${versionFile} (${error.message}). It is release-please's version file and must contain the ` +
        `same version as info.version in ${specPath}.`,
      { file: versionFile },
    );
  }
  if (fileVersion !== version) {
    fail(
      `info.version (${version}) differs from ${versionFile} (${fileVersion}). Versions are bumped by the ` +
        'release-please release PR; don\'t change them by hand.',
      versionLocation(),
    );
  }
}

function checkCompat() {
  // The bundle written by api:package: the same bundling as the published package.
  const spec = readPackageFile('openapi.json');
  const headVersion = spec.info?.version;
  const [headMajor] = parseSemver(headVersion);
  checkVersionFile(headVersion);
  checkPathVersion(spec);
  checkSeverityLevels();

  let sha;
  try {
    sha = git(['merge-base', 'HEAD', 'origin/main']);
  } catch (error) {
    const reason = (error.stderr || error.message).trim();
    fail(`Could not find the merge-base with origin/main (fetch the full history): ${reason}`);
  }
  const base = `${sha}:${specPath}`;
  let baseText;
  try {
    baseText = git(['show', base]);
  } catch (error) {
    fail(`Could not read ${base}: ${(error.stderr || error.message).trim()}`);
  }
  // The file keeps the API version it was created with: a new major version needs a new /api/vN spec file.
  // A base spec without the marker predates the release setup (main before this tooling); oasdiff still compares it.
  const baseVersion = findVersion(baseText).value;
  if (baseVersion === undefined) {
    console.log(`${base} has no x-release-please-version marker, skipping the major-version comparison.`);
  } else if (parseSemver(baseVersion)[0] !== headMajor) {
    fail(`info.version ${headVersion} changes the major version of ${base} (${baseVersion}).`, versionLocation());
  }

  console.log(`Comparing ${specPath} (${headVersion}) with the merge-base ${sha.slice(0, 7)}.`);
  // Exit code 1 = breaking (ERR) or potentially breaking (WARN) changes. Severity overrides come from .oasdiff.yaml.
  // In GitHub Actions, each finding becomes an annotation on the affected line of the PR diff.
  const format = inGitHubActions ? ['--format', 'githubactions'] : ['--color', 'never'];
  if (oasdiff(['breaking', base, specPath, '--fail-on', 'WARN', ...oasdiffConfig, ...format]).status === 1) {
    fail(`Breaking changes are not allowed within API version ${headMajor}; they need a new /api/vN spec file.`);
  }
  console.log('No breaking changes.');
}

const [command] = process.argv.slice(2);
switch (command) {
  case 'package':
    buildPackage();
    break;
  case 'check-compat':
    checkCompat();
    break;
  default:
    fail(`Unknown command "${command ?? ''}". Expected one of: package, check-compat.`);
}
