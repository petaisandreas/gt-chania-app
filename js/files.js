// Uploaded document files live in IndexedDB (localStorage is too small for PDFs and photos).
// Metadata stays in the main store under `documents`.
import { esc } from "./ui.js";
import { KEYS } from "./store.js";

const DB = KEYS.filesDb, STORE = "files";
export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,image/heic";

let dbp;
function open() {
  return (dbp ||= new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result);
    t.onerror = () => rej(t.error);
  });
}

export const putFile = (id, blob) => tx("readwrite", (s) => s.put(blob, id));
export const getFile = (id) => tx("readonly", (s) => s.get(id));
export const deleteFile = (id) => tx("readwrite", (s) => s.delete(id));

/** Placeholder shown for seeded demo documents, which have no real file behind them. */
export function samplePreview(doc, ownerName) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 780"><rect width="600" height="780" fill="#fff"/>
    <rect x="40" y="40" width="520" height="700" fill="none" stroke="#e4572e" stroke-width="3"/>
    <text x="300" y="130" font-family="Arial" font-size="30" font-weight="bold" text-anchor="middle" fill="#16181c">${esc(doc.type.toUpperCase())}</text>
    <text x="300" y="175" font-family="Arial" font-size="16" text-anchor="middle" fill="#6f737b">Sample document — demo data</text>
    <text x="80" y="270" font-family="Arial" font-size="18" fill="#16181c">Name: ${esc(ownerName)}</text>
    <text x="80" y="310" font-family="Arial" font-size="18" fill="#16181c">Issued: ${esc(doc.uploaded)}</text>
    <text x="80" y="350" font-family="Arial" font-size="18" fill="#16181c">Valid until: ${esc(doc.expires || "No expiry")}</text>
    ${[420, 450, 480, 510].map((y) => `<rect x="80" y="${y}" width="${300 + (y % 7) * 20}" height="10" rx="5" fill="#e4e0d8"/>`).join("")}
    <line x1="340" y1="660" x2="520" y2="660" stroke="#16181c"/><text x="430" y="685" font-family="Arial" font-size="13" text-anchor="middle" fill="#6f737b">Signature</text></svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

export function fmtSize(n) {
  return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
}
