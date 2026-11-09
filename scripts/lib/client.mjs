// Loads and validates clients/<id>/client.json. Dependency-free; every problem is reported with its path.
import { readFileSync, readdirSync, existsSync, lstatSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CLIENTS_DIR = join(ROOT, "clients");
export const ID_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;
export const RESERVED_IDS = new Set(["css", "js", "assets", "clients", "scripts", "dist", "node_modules", "views", "icons", "template", "github"]);

// Storage prefixes used by other apps on the same github.io origin; a client must never share them.
export const RESERVED_PREFIXES = new Set(["kyri", "demo-coach"]);

export class ClientError extends Error {}

/** Throws ClientError when `id` is not usable as a client id (shape, reserved word). */
export function checkId(id) {
  if (typeof id !== "string" || !ID_RE.test(id)) throw new ClientError(`Invalid client id "${id}": use 2-31 characters, lower-case letters, digits and hyphens, starting with a letter or digit.`);
  if (RESERVED_IDS.has(id)) throw new ClientError(`Client id "${id}" is reserved (it would clash with a folder of the app). Reserved: ${[...RESERVED_IDS].join(", ")}.`);
}

const noCtl = /^[^\u0000-\u001f\u007f]*$/;
const str = (max) => (v) => typeof v !== "string" ? "must be a string" : v.length < 1 ? "must not be empty" : v.length > max ? `must be at most ${max} characters` : !noCtl.test(v) ? "must not contain control characters" : v !== v.trim() ? "must not start or end with spaces" : null;
const re = (rx, hint) => (v) => (typeof v === "string" && rx.test(v) ? null : `must ${hint}`);
const hex = re(/^#[0-9a-f]{6}$/i, "be a colour like #1a2b3c (6 hex digits)");
const bool = (v) => (typeof v === "boolean" ? null : "must be true or false");
const optional = (check) => Object.assign((v) => check(v), { optional: true });
const OPT = { __optional: true }; // marks an optional group of fields

const strOrEmpty = (max) => (v) => (v === "" ? null : str(max)(v));
const hostname = (v) => (v === "" || (typeof v === "string" && /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(v)) ? null : "must be empty or a host name like academy.example.com");
const currency = (v) => {
  if (typeof v !== "string" || !/^[A-Z]{3}$/.test(v)) return "must be an ISO 4217 code such as EUR or USD";
  try { new Intl.NumberFormat("en", { style: "currency", currency: v }); return null; } catch { return "must be a currency code that Intl.NumberFormat accepts"; }
};

const SPEC = {
  id: re(ID_RE, "match ^[a-z0-9][a-z0-9-]{1,30}$"),
  isDefault: bool,
  appName: str(24),
  wordmark: { main: str(16), accent: strOrEmpty(16) },
  businessName: str(60),
  owner: {
    name: str(60),
    short: str(30),
    initials: re(/^\p{L}{1,3}$/u, "be 1-3 letters"),
  },
  contact: {
    email: re(/^[^\s@<>"'`]{1,64}@[^\s@<>"'`]{1,190}\.[^\s@<>"'`.]{2,}$/, "be an email address"),
    instagram: re(/^[A-Za-z0-9._]{1,30}$/, "be an Instagram handle without @ (letters, digits, . and _, up to 30)"),
  },
  locale: {
    currency,
    numberLocale: (v) => {
      try { return typeof v === "string" && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(v) && Intl.getCanonicalLocales(v).length ? null : "must be a locale such as en-GB"; }
      catch { return "must be a locale such as en-GB"; }
    },
  },
  storagePrefix: re(/^[a-z0-9-]{1,40}$/, "match ^[a-z0-9-]+$ (up to 40 characters)"),
  seed: {
    location: str(40),
    staffEmailDomain: re(/^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, "be a domain name like example.com (lower case)"),
  },
  site: {
    title: str(100),
    description: str(320),
    heroLead: str(600),
    promo: str(80),
  },
  theme: {
    themeColor: hex,
    light: { accent: hex, accentInk: hex, accent2: hex },
    dark: { accent: hex, accentInk: hex, accent2: hex },
    screen: { accent: hex, accentInk: hex },
    logo: { bg: hex, fg: hex },
  },
  deploy: { ...OPT, customDomain: hostname },
};

function walk(value, spec, path, errors) {
  if (typeof spec === "function") {
    const msg = spec(value);
    if (msg) errors.push(`${path} ${msg}`);
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push(`${path} must be an object`); return; }
  for (const key of Object.keys(value)) if (key === "__optional" || !Object.hasOwn(spec, key)) errors.push(`${path}.${key} is not a known field`);
  for (const [key, sub] of Object.entries(spec)) {
    if (key === "__optional") continue;
    const here = `${path}.${key}`;
    if (!Object.hasOwn(value, key)) {
      if (!(typeof sub === "function" && sub.optional) && !(typeof sub === "object" && sub.__optional)) errors.push(`${here} is missing`);
      continue;
    }
    walk(value[key], sub, here, errors);
  }
}

/** Validates a parsed client.json and returns it with defaults filled in. Throws ClientError listing every problem. */
export function validateClient(raw, folderId) {
  const errors = [];
  if (folderId !== undefined) { try { checkId(folderId); } catch (e) { errors.push(e.message); } }
  walk(raw, SPEC, "client", errors);
  if (!errors.length) {
    try { checkId(raw.id); } catch (e) { errors.push(e.message); }
    if (folderId !== undefined && raw.id !== folderId) errors.push(`client.id "${raw.id}" must equal its folder name "${folderId}"`);
  }
  if (!errors.length && RESERVED_PREFIXES.has(raw.storagePrefix)) errors.push(`client.storagePrefix "${raw.storagePrefix}" is reserved by another app on the same origin`);
  if (!errors.length && raw.isDefault === false && !raw.storagePrefix.startsWith("bjj-")) errors.push(`client.storagePrefix "${raw.storagePrefix}" must start with "bjj-" for every client except the default (kyri-training and other apps share the same web origin, so each app needs its own namespace)`);
  if (errors.length) throw new ClientError(`clients/${folderId ?? raw?.id}/client.json is invalid:\n  - ${errors.join("\n  - ")}`);
  return { ...raw, deploy: raw.deploy ?? { customDomain: "" } };
}

/** Throws unless `path` is a real (non-symlink) file or directory. */
export function assertRegular(path, label, { dir = false } = {}) {
  let st;
  try { st = lstatSync(path); } catch { throw new ClientError(`${label} is missing.`); }
  if (st.isSymbolicLink()) throw new ClientError(`${label} is a symbolic link; links are not allowed in client folders or the app source.`);
  if (dir ? !st.isDirectory() : !st.isFile()) throw new ClientError(`${label} must be a regular ${dir ? "folder" : "file"}.`);
}

/** Rejects symlinks and any non-regular entry anywhere below `dir`. */
export function assertTreeRegular(dir, label) {
  assertRegular(dir, label, { dir: true });
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) assertTreeRegular(p, `${label}/${e.name}`);
    else assertRegular(p, `${label}/${e.name}`);
  }
}

export function loadClient(id) {
  checkId(id);
  const dir = join(CLIENTS_DIR, id);
  const file = join(dir, "client.json");
  if (existsSync(dir)) assertTreeRegular(dir, `clients/${id}`);
  if (!existsSync(file)) throw new ClientError(`Unknown client "${id}": clients/${id}/client.json not found.`);
  let raw;
  try { raw = JSON.parse(readFileSync(file, "utf8")); } catch (e) { throw new ClientError(`clients/${id}/client.json is not valid JSON: ${e.message}`); }
  const client = validateClient(raw, id);
  if (!existsSync(join(dir, "logo.svg"))) throw new ClientError(`clients/${id}/logo.svg is missing.`);
  return { ...client, dir };
}

/** Every real client (folders starting with "_" are templates). Checks cross-client rules. */
export function loadAllClients() {
  const ids = readdirSync(CLIENTS_DIR).filter((n) => !n.startsWith("_") && !n.startsWith(".")).sort();
  for (const n of ids) assertRegular(join(CLIENTS_DIR, n), `clients/${n}`, { dir: true });
  if (!ids.length) throw new ClientError("No clients found in clients/.");
  const clients = ids.map(loadClient);
  const defaults = clients.filter((c) => c.isDefault);
  if (defaults.length !== 1) throw new ClientError(`Exactly one client must have "isDefault": true (found ${defaults.length}${defaults.length ? ": " + defaults.map((c) => c.id).join(", ") : ""}).`);
  const seen = new Map();
  for (const c of clients) {
    if (seen.has(c.storagePrefix)) throw new ClientError(`storagePrefix "${c.storagePrefix}" is used by both "${seen.get(c.storagePrefix)}" and "${c.id}"; each client needs its own.`);
    seen.set(c.storagePrefix, c.id);
  }
  return clients;
}

export const loadDefaultClient = () => loadAllClients().find((c) => c.isDefault);

// ---- generated files ---------------------------------------------------------

const GEN = (id) => `GENERATED from clients/${id}/client.json by scripts/sync-default.mjs / scripts/build.mjs. Do not edit by hand.`;

/** JSON that is safe to embed in JS even if the file is ever inlined into a <script>. */
const safeJson = (o) => JSON.stringify(o, null, 2).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));

/** js/client.js: frozen runtime config (no theme; colours live in css/client.css). */
export function clientJs(c) {
  const cfg = {
    id: c.id, appName: c.appName, wordmark: { ...c.wordmark }, businessName: c.businessName,
    owner: { ...c.owner }, contact: { ...c.contact }, locale: { ...c.locale },
    storagePrefix: c.storagePrefix, seed: { ...c.seed },
    site: { title: c.site.title, description: c.site.description, heroLead: c.site.heroLead, promo: c.site.promo },
  };
  return `// ${GEN(c.id)}
const deepFreeze = (o) => { Object.values(o).forEach((v) => v && typeof v === "object" && deepFreeze(v)); return Object.freeze(o); };
export default deepFreeze(${safeJson(cfg)});
`;
}

const rgba = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${a})`;

/** css/client.css: overrides of the brand variables of tokens.css (light is the default theme). */
export function clientCss(c) {
  const t = c.theme;
  return `/* ${GEN(c.id)} */
:root {
  --accent: ${t.light.accent};
  --accent-ink: ${t.light.accentInk};
  --accent-soft: ${rgba(t.light.accent, 0.08)};
  --accent-2: ${t.light.accent2};
  --screen-accent: ${t.screen.accent};
  --screen-accent-ink: ${t.screen.accentInk};
  --brand: ${t.logo.fg};
}

:root[data-theme="dark"] {
  --accent: ${t.dark.accent};
  --accent-ink: ${t.dark.accentInk};
  --accent-soft: ${rgba(t.dark.accent, 0.1)};
  --accent-2: ${t.dark.accent2};
}
`;
}
