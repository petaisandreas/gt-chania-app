// Logo SVGs come from client folders and are treated as untrusted: only an allow-list of shapes
// and attributes survives, and fills/scripts/handlers/links are dropped. Two modes: the default (monochrome mark,
// every fill dropped) and "hexFill" (full-colour override logo: the only extra attribute kept is fill="#rrggbb").
const ELEMENTS = {
  svg: ["viewBox"],
  g: ["transform"],
  path: ["d"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  polygon: ["points"],
};
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const VALUE_RE = /^[0-9A-Za-z .,+\-()]*$/; // numbers, path commands, transform functions only
const NUM = String.raw`-?\d*\.?\d+(?:e[-+]?\d+)?`;

/** Returns { viewBox:[minX,minY,w,h], inner } where inner is the sanitised shape markup. Throws on bad input. */
export function sanitizeLogo(src, label = "logo.svg", { hexFill = false } = {}) {
  let s = String(src).replace(/^﻿/, "");
  if (s.length > 20_000) throw new Error(`${label}: file is too large (limit 20 KB); simplify the logo`);
  if (/<!DOCTYPE|<!ENTITY|<\?(?!xml)/i.test(s)) throw new Error(`${label}: DOCTYPE/ENTITY/processing instructions are not allowed`);
  s = s.replace(/<\?xml[^>]*\?>/i, "").replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|foreignObject|title|desc|metadata|defs)\b[\s\S]*?<\/\1\s*>/gi, "");
  let viewBox = null, inner = "", depth = 0;
  const tagRe = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[^\s=<>\/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g;
  for (const m of s.matchAll(tagRe)) {
    const [, closing, rawName, rawAttrs, selfClose] = m;
    const name = rawName.toLowerCase();
    if (!Object.hasOwn(ELEMENTS, name)) continue;
    if (name === "svg") {
      if (closing) continue;
      const vb = /\sviewBox\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(rawAttrs);
      const nums = vb && (vb[1] ?? vb[2]).trim().split(/[\s,]+/).map(Number);
      if (!nums || nums.length !== 4 || nums.some((n) => !Number.isFinite(n)) || nums[2] <= 0 || nums[3] <= 0) throw new Error(`${label}: the <svg> needs a numeric viewBox like "0 0 100 100"`);
      if (Math.abs(nums[2] - nums[3]) > 1e-6) throw new Error(`${label}: viewBox must be square (got ${nums[2]}x${nums[3]})`);
      viewBox = nums;
      continue;
    }
    if (closing) {
      if (name === "g") { if (depth === 0) throw new Error(`${label}: closing </g> without a matching <g>`); depth--; inner += "</g>"; }
      continue;
    }
    const attrs = [];
    for (const a of rawAttrs.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const key = a[1], val = (a[2] ?? a[3]).trim();
      if (hexFill && key === "fill" && HEX_RE.test(val)) { attrs.push(`fill="${val.toLowerCase()}"`); continue; }
      if (!ELEMENTS[name].includes(key)) continue; // drops fill, style, on*, href, class, id, ...
      if (!VALUE_RE.test(val)) throw new Error(`${label}: attribute ${key} on <${name}> has unsupported characters`);
      attrs.push(`${key}="${val}"`);
    }
    if (name === "g") { inner += `<g${attrs.length ? " " + attrs.join(" ") : ""}>`; if (selfClose) inner += "</g>"; else depth++; continue; }
    inner += `<${name}${attrs.length ? " " + attrs.join(" ") : ""}/>`;
  }
  if (!viewBox) throw new Error(`${label}: no <svg viewBox> found`);
  if (depth !== 0) throw new Error(`${label}: unbalanced <g> elements`);
  if (!/<(path|rect|circle|polygon)\b/.test(inner)) throw new Error(`${label}: no drawable shapes (path, rect, circle, polygon) found`);
  return { viewBox, inner };
}

const n = (x) => String(Math.round(x * 1000) / 1000);

/** Full-colour override logo (sanitised with hexFill) as a standalone SVG file. */
export function overrideLogoSvg({ viewBox, inner }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.map(n).join(" ")}">${inner}</svg>\n`;
}

/** Logo placed inside a 100x100 square at `pad` fraction of padding on every side, filled with `fg`. */
function placed({ viewBox, inner }, fg, pad) {
  const [mx, my, size] = viewBox;
  const k = (100 * (1 - 2 * pad)) / size, off = 100 * pad;
  const shift = mx || my ? ` translate(${n(-mx)} ${n(-my)})` : "";
  return `<g fill="${fg}" transform="translate(${n(off)} ${n(off)}) scale(${n(k)})${shift}">${inner}</g>`;
}

/** Square tile (bg + logo) as an SVG string; `radius` rounds the corners (favicon), 0 is full-bleed (PWA icons). */
export function tileSvg(logo, bg, fg, { pad, radius = 0, size = 100 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100"${radius ? ` rx="${radius}"` : ""} fill="${bg}"/>${placed(logo, fg, pad)}</svg>`;
}
