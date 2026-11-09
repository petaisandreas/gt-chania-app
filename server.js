// Minimal zero-dependency static file server.
//   node server.js              serves the source tree; .html files are rendered for the default client
//   node server.js --dir dist   serves a finished build as-is (preview what GitHub Pages will serve)
// Environment: PORT (default 5173), HOST (default 127.0.0.1; use 0.0.0.0 to reach it from tablets/TVs on your LAN).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDefaultClient } from "./scripts/lib/client.mjs";
import { renderTemplate } from "./scripts/lib/brand.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
const dirIdx = args.indexOf("--dir");
if (dirIdx !== -1 && !args[dirIdx + 1]) { console.error("--dir needs a folder, e.g. --dir dist"); process.exit(1); }
const preview = dirIdx !== -1;
const root = resolve(here, preview ? args[dirIdx + 1] : ".");
if (preview && root !== resolve(here, "dist")) { console.error("--dir is limited to the build output: use --dir dist"); process.exit(1); }
const client = preview ? null : loadDefaultClient();
const port = Number(process.env.PORT) || 5173;
const host = process.env.HOST || "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const aliases = { "/app": "/app.html", "/member": "/member.html", "/kiosk": "/kiosk.html", "/tv": "/tv.html" };

// Only what the app needs is served (lower-cased allow-list): root *.html and css/, js/, assets/.
// clients/, scripts/, node_modules, package*.json, README, dotfiles and everything else answer 404.
// In preview mode the same rules apply inside each client folder (dist/<id>/).
const PUBLIC_DIRS = new Set(["css", "js", "assets"]);
const clientDirs = new Set(preview ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !PUBLIC_DIRS.has(d.name)).map((d) => d.name.toLowerCase()) : []);
function allowed(segs) {
  if (clientDirs.has(segs[0])) segs = segs.slice(1);
  if (segs.length === 0) return true; // directory index
  if (segs.length === 1) return /^[^/]+\.html$/.test(segs[0]);
  return PUBLIC_DIRS.has(segs[0]);
}
// Windows path tricks: trailing dot/space, ":" (streams, drive letters), "~" (8.3 short names), backslashes,
// device names; plus dotfiles and "." / ".." segments.
const badSegment = (seg) => seg.startsWith(".") || /[.\s]$/.test(seg) || /[:~\\]/.test(seg) || /^(con|conin\$|conout\$|clock\$|prn|aux|nul|com[\d¹²³]|lpt[\d¹²³])(\..*)?$/.test(seg);

const notFound = (res) => res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");

createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }).end(); return; }
    let path;
    if (req.url.startsWith("//") || req.url.startsWith("/\\") || req.url.includes("\\")) { res.writeHead(400).end(); return; }
    try { path = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
    if (path.includes("\0") || path.includes("\\")) { res.writeHead(400).end(); return; }
    if (!preview && Object.hasOwn(aliases, path)) path = aliases[path];
    let file = resolve(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    // Judge the path that will really be read (after decoding and resolving), not the raw request text.
    const segs = relative(root, file).toLowerCase().split(sep).filter(Boolean);
    if (path.toLowerCase().split("/").some((s) => s === "." || s === "..") || segs.some(badSegment) || !allowed(segs)) { notFound(res); return; }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      if (!path.endsWith("/")) { res.writeHead(301, { Location: new URL(req.url, "http://x").pathname + "/" }).end(); return; }
      file = join(file, "index.html");
      info = await stat(file).catch(() => null);
    }
    if (!info || !info.isFile()) { notFound(res); return; }
    let body = await readFile(file);
    const ext = extname(file).toLowerCase();
    if (!preview && ext === ".html") body = renderTemplate(body.toString("utf8"), client, relative(root, file));
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (e) {
    console.error(e.message);
    res.writeHead(500, { "Content-Type": "text/plain" }).end("Server error");
  }
}).listen(port, host, () => {
  console.log(preview ? `Previewing the build in ${args[dirIdx + 1]}/ at http://${host}:${port}/` : `${client.businessName} (${client.id}) running at http://${host}:${port}`);
});
