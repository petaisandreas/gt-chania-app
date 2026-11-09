// Small UI toolkit: escaping, modals, toasts, form reading, charts.
import { BELT_COLORS } from "./store.js";

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export function initials(name) {
  return esc(name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase());
}

export function avatar(name, color = "var(--accent)") {
  return `<span class="avatar" style="--av:${color}">${initials(name)}</span>`;
}

export function beltChip(belt, stripes = 0) {
  const c = BELT_COLORS[belt] || "#ccc";
  const bar = belt === "Black" ? "#c8102e" : "#16181c";
  const s = Array.from({ length: 4 }, (_, i) => `<i class="${i < stripes ? "on" : ""}"></i>`).join("");
  return `<span class="belt" title="${esc(belt)} belt, ${stripes} stripe(s)"><span class="belt-body" style="background:${c}"></span><span class="belt-bar" style="background:${bar}">${s}</span></span>`;
}

export function badge(text, tone = "neutral") {
  return `<span class="badge badge-${tone}">${esc(text)}</span>`;
}

export function fmtDate(d, opts = { month: "short", day: "numeric", year: "numeric" }) {
  if (!d) return "—";
  return new Date(d + (d.length === 10 ? "T12:00" : "")).toLocaleDateString("en-US", opts);
}

export function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// --- toasts -------------------------------------------------------------------
export function toast(msg, tone = "ok") {
  let host = $("#toasts");
  if (!host) { host = document.createElement("div"); host.id = "toasts"; document.body.append(host); }
  const t = document.createElement("div");
  t.className = `toast toast-${tone}`;
  t.textContent = msg;
  host.append(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3000);
}

// --- modal --------------------------------------------------------------------
/** Opens a modal. `body` is HTML; `onSubmit(data, form)` returning false keeps it open. */
export function modal({ title, body, submit = "Save", onSubmit, wide = false, danger }) {
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `
    <form class="modal ${wide ? "modal-wide" : ""}" novalidate>
      <header><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></header>
      <div class="modal-body">${body}</div>
      <footer>
        ${danger ? `<button type="button" class="btn btn-danger-ghost" data-danger>${esc(danger.label)}</button>` : ""}
        <span class="grow"></span>
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        ${onSubmit ? `<button type="submit" class="btn btn-primary">${esc(submit)}</button>` : ""}
      </footer>
    </form>`;
  const close = () => { wrap.classList.add("out"); setTimeout(() => wrap.remove(), 150); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("mousedown", (e) => e.target === wrap && close());
  $$("[data-close]", wrap).forEach((b) => b.addEventListener("click", close));
  if (danger) $("[data-danger]", wrap).addEventListener("click", () => { if (confirm(danger.confirm || "Are you sure?")) { danger.action(); close(); } });
  const form = $("form", wrap);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (onSubmit(readForm(form), form) !== false) close();
  });
  document.body.append(wrap);
  setTimeout(() => $("input,select,textarea", wrap)?.focus(), 30);
  return { el: wrap, close };
}

export function readForm(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") {
      if (el.dataset.multi) (data[el.name] ||= []), el.checked && data[el.name].push(el.value);
      else data[el.name] = el.checked;
    } else if (el.type === "number") data[el.name] = el.value === "" ? null : Number(el.value);
    else data[el.name] = el.value.trim();
  }
  return data;
}

/** Field helper: field("Name", "first", value, {type, required, options}) */
export function field(label, name, value = "", o = {}) {
  const req = o.required ? "required" : "";
  let input;
  if (o.options) {
    input = `<select name="${name}" ${req}>${o.options
      .map((op) => { const [v, l] = Array.isArray(op) ? op : [op, op]; return `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`; })
      .join("")}</select>`;
  } else if (o.type === "textarea") {
    input = `<textarea name="${name}" rows="${o.rows || 3}" ${req}>${esc(value)}</textarea>`;
  } else if (o.type === "checkbox") {
    return `<label class="check"><input type="checkbox" name="${name}" ${value ? "checked" : ""}/> ${esc(label)}</label>`;
  } else {
    input = `<input name="${name}" type="${o.type || "text"}" value="${esc(value)}" ${req} ${o.step ? `step="${o.step}"` : ""} ${o.min != null ? `min="${o.min}"` : ""} ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ""}/>`;
  }
  return `<label class="field ${o.span ? "span-" + o.span : ""}"><span>${esc(label)}</span>${input}</label>`;
}

// --- charts -------------------------------------------------------------------
/** Vertical bar chart. data: [{label, value}] */
export function barChart(data, { height = 180, format = (v) => v, color = "var(--accent)" } = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const bars = data.map((d) => `<div class="bar" title="${esc(d.label)}: ${esc(format(d.value))}">
      <span class="bar-val">${esc(format(d.value))}</span>
      <span class="bar-fill" style="height:${Math.max(1, (d.value / max) * 100)}%;background:${d.color || color}"></span>
      <span class="bar-label">${esc(d.label)}</span></div>`).join("");
  return `<div class="bars" style="height:${height}px" role="img">${bars}</div>`;
}

/** Sparkline-style area chart. values: number[] */
export function areaChart(values, { height = 120 } = {}) {
  const max = Math.max(1, ...values), n = values.length - 1 || 1;
  const pts = values.map((v, i) => `${(i / n) * 100},${height - 8 - (v / max) * (height - 16)}`);
  return `<svg class="chart" viewBox="0 0 100 ${height}" preserveAspectRatio="none" style="height:${height}px">
    <polygon points="0,${height} ${pts.join(" ")} 100,${height}" fill="var(--accent-soft)"/>
    <polyline points="${pts.join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

export function progress(frac, tone = "accent") {
  return `<span class="progress progress-${tone}"><span style="width:${Math.round(frac * 100)}%"></span></span>`;
}

export function empty(text) {
  return `<div class="empty">${esc(text)}</div>`;
}
