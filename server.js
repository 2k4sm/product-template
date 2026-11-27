import { Pool } from "pg";

import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? "8080");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const server = createApp(pool).listen(port, "0.0.0.0", () => {
  console.log(`Listening on port ${server.address().port}`);
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
