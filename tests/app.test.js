import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import test from "node:test";

import { Pool } from "pg";

import { createApp } from "../app.js";

async function withApp(run) {
  const pool = new Pool();
  const server = createApp(pool).listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`, pool);
  } finally {
    server.close();
    await once(server, "close");
    await pool.end();
  }
}

test("GET /healthz returns ok without opening a database connection", async () => {
  await withApp(async (baseUrl, pool) => {
    const response = await fetch(`${baseUrl}/healthz`);

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
    assert.equal(await response.text(), '{"status":"ok"}');
    assert.equal(pool.totalCount, 0);
  });
});

test("GET / serves plain HTML, CSS, and JavaScript assets", async () => {
  await withApp(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/`);
    const html = await page.text();

    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /^text\/html/);
    assert.match(html, /<link rel="stylesheet" href="\/styles\.css" \/>/);
    assert.match(html, /<script src="\/app\.js" defer><\/script>/);

    const [styles, script] = await Promise.all([
      fetch(`${baseUrl}/styles.css`),
      fetch(`${baseUrl}/app.js`),
    ]);
    assert.equal(styles.status, 200);
    assert.match(styles.headers.get("content-type"), /^text\/css/);
    assert.equal(script.status, 200);
    assert.match(
      script.headers.get("content-type"),
      /^(text|application)\/javascript/,
    );
  });
});

test(
  "server.js honors PORT and shuts down cleanly",
  { timeout: 10_000 },
  async () => {
    const child = spawn(process.execPath, ["server.js"], {
      cwd: new URL("../", import.meta.url),
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = once(child, "exit");
    let stdout = "";
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    try {
      const baseUrl = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Server did not start: ${stdout}${stderr}`));
        }, 5_000);
        child.once("error", reject);
        child.once("exit", (code) => {
          clearTimeout(timeout);
          reject(new Error(`Server exited early (${code}): ${stdout}${stderr}`));
        });
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
          const match = stdout.match(/Listening on port (\d+)/);
          if (match) {
            clearTimeout(timeout);
            resolve(`http://127.0.0.1:${match[1]}`);
          }
        });
      });

      const response = await fetch(`${baseUrl}/healthz`);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), '{"status":"ok"}');
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
      }
      const [code, signal] = await exited;
      assert.equal(code, 0, `Server failed: ${stdout}${stderr}`);
      assert.equal(signal, null);
    }
  },
);
