// Writes the files that depend on a client's config into a directory that already holds the app source
// (the repo root for `sync-default`, or a copy of it under dist/ for the build).
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { clientJs, clientCss } from "./client.mjs";
import { writeSvgAssets } from "./icons.mjs";

export function generateClientFiles(client, dir) {
  mkdirSync(join(dir, "js"), { recursive: true });
  mkdirSync(join(dir, "css"), { recursive: true });
  writeFileSync(join(dir, "js", "client.js"), clientJs(client));
  writeFileSync(join(dir, "css", "client.css"), clientCss(client));
  writeSvgAssets(client, join(dir, "assets"));
}
