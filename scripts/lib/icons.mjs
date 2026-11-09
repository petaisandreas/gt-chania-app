// Brand assets for one client: assets/logo.svg (page logo + favicon) and the PNG app icons (sharp renders SVG -> PNG).
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { assertRegular, ClientError } from "./client.mjs";
import { sanitizeLogo, overrideLogoSvg, tileSvg } from "./svg.mjs";

export const ICON_FILES = ["icon-192.png", "icon-512.png", "icon-apple.png"];
const SIZES = { "192": 192, "512": 512, apple: 180 };
const MASKABLE_PAD = 0.18; // keeps the mark inside the maskable safe zone

export function loadLogo(client) {
  return sanitizeLogo(readFileSync(join(client.dir, "logo.svg"), "utf8"), `clients/${client.id}/logo.svg`);
}

/** Writes assets/logo.svg: the coloured tile shown next to the wordmark and used as favicon (text only, no sharp needed). */
export function writeSvgAssets(client, assetsDir) {
  mkdirSync(assetsDir, { recursive: true });
  const override = join(client.dir, "icons", "logo.svg");
  if (existsSync(override)) {
    assertRegular(override, `clients/${client.id}/icons/logo.svg`);
    const full = sanitizeLogo(readFileSync(override, "utf8"), `clients/${client.id}/icons/logo.svg`, { hexFill: true });
    writeFileSync(join(assetsDir, "logo.svg"), overrideLogoSvg(full));
    return;
  }
  const { bg, fg } = client.theme.logo;
  const svg = tileSvg(loadLogo(client), bg, fg, { pad: 0.16, radius: 25 }).replace(/ width="100" height="100"/, "");
  writeFileSync(join(assetsDir, "logo.svg"), svg + "\n");
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function checkPng(file, label) {
  assertRegular(file, label);
  const head = readFileSync(file).subarray(0, 8);
  if (!head.equals(PNG_SIGNATURE)) throw new ClientError(`${label} is not a PNG image.`);
}

/** Writes the three PNG icons. clients/<id>/icons/<name>.png overrides win over generated ones. */
export async function writePngIcons(client, assetsDir) {
  mkdirSync(assetsDir, { recursive: true });
  const logo = loadLogo(client);
  let sharp;
  const needsRender = ICON_FILES.some((f) => !existsSync(join(client.dir, "icons", f)));
  if (needsRender) {
    try { sharp = (await import("sharp")).default; }
    catch { throw new Error("The 'sharp' package is not installed. Run `npm install` first."); }
  }
  const made = { generated: [], overridden: [] };
  const { bg, fg } = client.theme.logo;
  for (const [key, px] of Object.entries(SIZES)) {
    const name = `icon-${key}.png`;
    const override = join(client.dir, "icons", name);
    if (existsSync(override)) { checkPng(override, `clients/${client.id}/icons/${name}`); copyFileSync(override, join(assetsDir, name)); made.overridden.push(name); continue; }
    const svg = tileSvg(logo, bg, fg, { pad: MASKABLE_PAD, size: px });
    await sharp(Buffer.from(svg), { density: 300 }).resize(px, px).png().toFile(join(assetsDir, name));
    made.generated.push(name);
  }
  return made;
}
