// Builds every client into dist/ (default client at the root, the others in dist/<id>/).
//   node scripts/build.mjs                       all clients
//   node scripts/build.mjs --only <id>           one client, into dist/<id>/
//   node scripts/build.mjs --only <id> --as-root one client as the whole site (for its own domain)
import { cpSync, rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { ROOT, loadAllClients, ClientError, checkId, assertRegular, assertTreeRegular } from "./lib/client.mjs";
import { renderTemplate } from "./lib/brand.mjs";
import { generateClientFiles } from "./lib/generate.mjs";
import { writePngIcons, ICON_FILES } from "./lib/icons.mjs";

const DIST = join(ROOT, "dist");

function parseArgs(argv) {
  const o = { only: null, asRoot: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") { o.only = argv[++i]; if (!o.only) throw new ClientError("--only needs a client id."); }
    else if (argv[i] === "--as-root") o.asRoot = true;
    else throw new ClientError(`Unknown option "${argv[i]}". Usage: node scripts/build.mjs [--only <id> [--as-root]]`);
  }
  if (o.asRoot && !o.only) throw new ClientError("--as-root needs --only <id>.");
  return o;
}

// Generated or per-client files in assets/ are never copied from the source tree.
const SKIP_ASSETS = new Set(["logo.svg", ...ICON_FILES]);
const assetsDir = join(ROOT, "assets");
const copyFilter = (src) => !(dirname(src) === assetsDir && SKIP_ASSETS.has(basename(src)));

async function buildClient(client, dest) {
  // Never copy symlinks or special files from the app source into dist.
  for (const d of ["css", "js", "assets"]) assertTreeRegular(join(ROOT, d), d);
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(ROOT).filter((n) => n.endsWith(".html"))) {
    assertRegular(join(ROOT, f), f);
    writeFileSync(join(dest, f), renderTemplate(readFileSync(join(ROOT, f), "utf8"), client, `${f} (client ${client.id})`));
  }
  cpSync(join(ROOT, "css"), join(dest, "css"), { recursive: true });
  cpSync(join(ROOT, "js"), join(dest, "js"), { recursive: true });
  cpSync(assetsDir, join(dest, "assets"), { recursive: true, filter: copyFilter });
  generateClientFiles(client, dest);
  return writePngIcons(client, join(dest, "assets"));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let plan; // [{ client, dest }]
  if (opts.only) {
    checkId(opts.only);
    const client = loadAllClients().find((c) => c.id === opts.only); // validates every client (unique prefixes, one default) first
    if (!client) throw new ClientError(`Unknown client "${opts.only}": clients/${opts.only}/client.json not found.`);
    plan = [{ client, dest: opts.asRoot ? DIST : join(DIST, client.id) }];
  } else {
    const clients = loadAllClients();
    plan = clients.map((client) => ({ client, dest: client.isDefault ? DIST : join(DIST, client.id) }));
    // the root tree is copied first so nothing in a client folder gets overwritten
    plan.sort((a, b) => (a.dest === DIST ? -1 : b.dest === DIST ? 1 : 0));
  }
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  writeFileSync(join(DIST, ".nojekyll"), "");
  for (const { client, dest } of plan) {
    const icons = await buildClient(client, dest);
    const where = dest === DIST ? "dist/" : `dist/${client.id}/`;
    console.log(`built ${client.id.padEnd(14)} -> ${where}  (icons: ${icons.generated.length} generated, ${icons.overridden.length} from clients/${client.id}/icons)`);
  }
  for (const { dest } of plan) if (!existsSync(join(dest, "index.html"))) throw new ClientError(`${dest}/index.html was not produced.`);
  console.log("Build complete. Preview with: npm run preview");
}

main().catch((e) => {
  console.error(`Build failed: ${e.message}`);
  process.exit(1);
});
