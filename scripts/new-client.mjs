// node scripts/new-client.mjs <id> "Academy Name" [--owner "Full Name"]
// Scaffolds clients/<id>/ from clients/_template. Rejects invalid, reserved and existing ids.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { CLIENTS_DIR, ClientError, checkId, validateClient } from "./lib/client.mjs";

function fail(msg) { console.error(`new-client failed: ${msg}`); process.exit(1); }

const args = process.argv.slice(2);
let ownerArg = null;
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--owner") { ownerArg = args[++i]; if (!ownerArg) fail("--owner needs a name."); }
  else if (args[i].startsWith("--")) fail(`unknown option ${args[i]}`);
  else pos.push(args[i]);
}
if (pos.length !== 2) fail('usage: node scripts/new-client.mjs <id> "Academy Name" [--owner "Full Name"]');
const [id, academy] = pos;

try {
  checkId(id);
  const dir = resolve(CLIENTS_DIR, id);
  if (!dir.startsWith(CLIENTS_DIR + sep) || resolve(dir, "..") !== CLIENTS_DIR) throw new ClientError("refusing to write outside clients/.");
  if (existsSync(dir)) throw new ClientError(`clients/${id} already exists.`);

  const tpl = JSON.parse(readFileSync(join(CLIENTS_DIR, "_template", "client.json"), "utf8"));
  const biz = academy.trim();
  const words = biz.match(/[A-Za-z0-9]+/g) || [id.replace(/-/g, "")];
  const main = words[0].toUpperCase().slice(0, 16);
  const accent = words.slice(1).join("").toUpperCase().slice(0, 16);
  const ownerName = (ownerArg ?? "Owner Name").trim();
  const ow = ownerName.split(/\s+/);
  const initials = (ow.length > 1 ? ow[0][0] + ow[ow.length - 1][0] : ow[0].slice(0, 2)).toUpperCase();
  const c = structuredClone(tpl);
  Object.assign(c, { id, appName: (main + (accent ? " " + accent : "")).slice(0, 24), businessName: biz, storagePrefix: `bjj-${id}` });
  c.wordmark = { main, accent };
  c.owner = { name: ownerName, short: ow[0], initials };
  c.contact.instagram = id.replace(/-/g, ".").slice(0, 30);
  c.site.title = `${biz} — Academy software`;
  c.site.description = `${biz} runs on one workspace: members, schedule, check-ins, billing, belts, leads, staff, shop and reports.`;
  c.site.heroLead = `${biz} puts members, class check-ins, billing, belt promotions and lead follow-up in one fast, mobile-friendly workspace.`;
  validateClient(c, id); // never write a config that the build would reject

  mkdirSync(dir); // fails if it appeared meanwhile
  try {
    writeFileSync(join(dir, "client.json"), JSON.stringify(c, null, 2) + "\n");
    copyFileSync(join(CLIENTS_DIR, "_template", "logo.svg"), join(dir, "logo.svg"));
  } catch (e) { rmSync(dir, { recursive: true, force: true }); throw e; }

  console.log(`Created clients/${id}/ (client.json, logo.svg). Next:
  1. Edit clients/${id}/client.json: owner, email, instagram, currency, colours, site text.
  2. Replace clients/${id}/logo.svg with the academy's single-colour logo (square viewBox).
  3. npm run build, then npm run preview and open /${id}/`);
} catch (e) {
  if (e instanceof ClientError) fail(e.message);
  throw e;
}
