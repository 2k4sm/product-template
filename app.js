import express from "express";
import { fileURLToPath } from "node:url";

const publicDirectory = fileURLToPath(new URL("./public", import.meta.url));

export function createApp(pool) {
  const app = express();
  app.locals.pool = pool;

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  app.use(express.static(publicDirectory));

  return app;
}
