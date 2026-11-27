import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");

test("repository carries the required public product scaffolding", async () => {
  const requiredFiles = [
    "LICENSE",
    "COMMERCIAL.md",
    "CLA.md",
    "AGENTS.md",
    "README.md",
    "Dockerfile",
    ".dockerignore",
    ".env.example",
    ".github/dependabot.yml",
    ".github/workflows/cla.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/codeql.yml",
  ];
  assert.deepEqual(requiredFiles.filter((path) => !existsSync(join(root, path))), []);

  const migrations = (await readdir(join(root, "supabase/migrations"))).filter(
    (name) => /^\d{14}_.+\.sql$/.test(name),
  );
  assert.ok(migrations.length > 0, "an ordered SQL migration is required");

  const dockerfile = await read("Dockerfile");
  assert.ok((dockerfile.match(/^FROM /gm) ?? []).length >= 2);
  assert.match(dockerfile, /node:26\.13\.1-alpine/);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/healthz/);

  const ci = await read(".github/workflows/ci.yml");
  for (const required of [
    "pull_request:",
    "push:",
    "linux/amd64",
    "linux/arm64",
    "ubuntu-24.04-arm",
    "ghcr.io",
    "sha-",
  ]) {
    assert.ok(ci.includes(required), `CI is missing ${required}`);
  }

  const cla = await read(".github/workflows/cla.yml");
  assert.match(cla, /contributor-assistant\/github-action@v2\.6\.1/);
  assert.match(cla, /branch:\s*["']?cla-signatures/);
  assert.match(cla, /path-to-signatures:\s*["']?signatures\/version1\/cla\.json/);
  assert.match(cla, /allowlist:\s*["']?2k4sm,dependabot\[bot\]/);

  for (const workflow of ["cla.yml", "ci.yml", "codeql.yml"]) {
    const content = await read(`.github/workflows/${workflow}`);
    const actions = [...content.matchAll(/uses:\s*([^\s]+)@([^\s]+)/g)];
    assert.ok(actions.length > 0, `${workflow} must use an action`);
    for (const [, action, version] of actions) {
      assert.match(
        version,
        /^v\d+(?:\.\d+){0,2}$/,
        `${workflow}: ${action} must use a version tag`,
      );
    }
  }
});

test("migration scaffold creates a replaceable product schema", async () => {
  const migrations = (await readdir(join(root, "supabase/migrations"))).filter(
    (name) => /^\d{14}_.+\.sql$/.test(name),
  );
  assert.equal(migrations.length, 1);

  const sql = await read(`supabase/migrations/${migrations[0]}`);
  assert.match(sql, /create schema if not exists product;/i);
  assert.match(sql, /rename `product` .*before applying/i);
});

test("gitignore excludes local Supabase CLI state", async () => {
  const gitignore = await read(".gitignore");
  assert.match(gitignore, /^supabase\/\.temp\/$/m);
});

test("direct runtime dependencies use exact versions", async () => {
  const manifest = JSON.parse(await read("package.json"));
  for (const [dependency, version] of Object.entries(manifest.dependencies)) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${dependency} must be pinned exactly`);
  }
});

test("CI serializes first publication across native architecture jobs", async () => {
  const ci = await read(".github/workflows/ci.yml");
  const buildJob = ci.split("\n  build:\n")[1]?.split("\n  publish-manifest:\n")[0];
  assert.ok(buildJob, "the native architecture build job must exist");
  assert.match(
    buildJob,
    /strategy:\s*\n\s*fail-fast: false\s*\n\s*max-parallel: 1\s*\n/,
    "simultaneous first pushes to a new GHCR package can be denied",
  );
});
