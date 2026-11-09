// Regenerates the committed, unbuilt copy of the default client in the repo root so that
// `node server.js` works without a build: js/client.js, css/client.css, assets/logo.svg and the PNG icons.
import { join } from "node:path";
import { loadAllClients, ROOT, ClientError } from "./lib/client.mjs";
import { generateClientFiles } from "./lib/generate.mjs";
import { writePngIcons } from "./lib/icons.mjs";

try {
  const def = loadAllClients().find((c) => c.isDefault);
  generateClientFiles(def, ROOT);
  await writePngIcons(def, join(ROOT, "assets"));
  console.log(`Synced default client "${def.id}": js/client.js, css/client.css, assets/logo.svg, assets/icon-*.png`);
} catch (e) {
  if (e instanceof ClientError || /sharp/.test(e.message)) { console.error(`sync-default failed: ${e.message}`); process.exit(1); }
  throw e;
}
