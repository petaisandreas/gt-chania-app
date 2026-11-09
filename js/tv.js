// Gym TV: big round timer + live list of who is checked in to the current class.
import { db, subscribe, today, classesOn, byId, fullName, KEYS } from "./store.js";
import { esc, $, $$, beltChip, fmtTime, modal, field } from "./ui.js";

// --- settings (per device) ------------------------------------------------------
const PRESETS = [
  { name: "Rolling", work: 300, rest: 60, rounds: 6 },
  { name: "Competition", work: 360, rest: 60, rounds: 3 },
  { name: "Drilling", work: 180, rest: 30, rounds: 8 },
  { name: "Kids", work: 120, rest: 60, rounds: 5 },
  { name: "Positional", work: 60, rest: 15, rounds: 10 },
];
const KEY = KEYS.tv;
let cfg = { ...PRESETS[0], warn: 30, prep: 10, sound: true };
try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };

// --- timer state ----------------------------------------------------------------
// phase: idle | prep | work | rest | done. `endsAt` is a performance.now() deadline while running.
let phase = "idle", round = 1, remaining = cfg.work * 1000, endsAt = 0, running = false, warned = false;

const fmt = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const phaseLength = (p) => (p === "work" ? cfg.work : p === "rest" ? cfg.rest : p === "prep" ? cfg.prep : cfg.work) * 1000;

// --- sound ----------------------------------------------------------------------
let ctx;
function beep(times = 1, dur = 0.18, freq = 880) {
  if (!cfg.sound) return;
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < times; i++) {
    const t = ctx.currentTime + i * (dur + 0.12);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
}

function enter(p) {
  phase = p; warned = false;
  remaining = phaseLength(p);
  endsAt = performance.now() + remaining;
  if (p === "work") beep(1, 0.6, 990);          // go
  if (p === "rest") beep(3, 0.3, 660);          // time
  if (p === "done") { beep(3, 0.5, 520); running = false; }
}

function next() {
  if (phase === "prep") return enter("work");
  if (phase === "work") return round >= cfg.rounds ? enter("done") : enter(cfg.rest ? "rest" : (round++, "work"));
  if (phase === "rest") { round++; return enter("work"); }
}

function toggle() {
  ctx?.resume?.();
  if (phase === "done") reset();
  if (phase === "idle") { running = true; return enter(cfg.prep ? "prep" : "work"); }
  running = !running;
  if (running) endsAt = performance.now() + remaining;
}

function reset() { phase = "idle"; round = 1; running = false; remaining = cfg.work * 1000; warned = false; }
function skip() { if (phase === "idle") return toggle(); if (phase !== "done") { if (!running) running = true; next(); } }

function tick() {
  if (running && phase !== "done") {
    remaining = endsAt - performance.now();
    if (phase === "work" && !warned && cfg.warn && remaining <= cfg.warn * 1000 && cfg.work > cfg.warn) { warned = true; beep(2, 0.12, 1200); }
    if (phase === "prep" && remaining <= 3000 && Math.ceil(remaining / 1000) !== tick.lastSec) { tick.lastSec = Math.ceil(remaining / 1000); if (tick.lastSec > 0) beep(1, 0.08, 700); }
    if (remaining <= 0) next();
  }
  paintTimer();
}

function paintTimer() {
  const t = $("#timer");
  const shown = phase === "idle" ? "idle" : phase === "work" && remaining <= cfg.warn * 1000 && cfg.work > cfg.warn ? "warn" : phase;
  t.dataset.phase = shown;
  t.classList.toggle("paused", !running && phase !== "idle" && phase !== "done");
  $("#t-phase").textContent = { idle: "Ready", prep: "Get ready", work: "Fight", warn: "Last 30", rest: "Rest", done: "Done — Oss!" }[shown] + (!running && phase !== "idle" && phase !== "done" ? " · paused" : "");
  $("#t-time").textContent = phase === "done" ? "0:00" : fmt(remaining);
  $("#t-round").textContent = phase === "prep" ? `${cfg.rounds} × ${fmt(cfg.work * 1000)} · ${fmt(cfg.rest * 1000)} rest` : `Round ${Math.min(round, cfg.rounds)} of ${cfg.rounds}`;
  $("#t-bar").style.width = phase === "idle" ? "0%" : `${100 - (remaining / phaseLength(phase)) * 100}%`;
  $("#t-toggle").textContent = running ? "❚❚" : "▶";
  $("#t-sound").textContent = cfg.sound ? "🔔" : "🔕";
}

function renderPresets() {
  $("#t-presets").innerHTML = PRESETS.map((p, i) => `<button data-preset="${i}" class="${p.work === cfg.work && p.rest === cfg.rest && p.rounds === cfg.rounds ? "on" : ""}">${p.name}<small>${fmt(p.work * 1000)} × ${p.rounds}</small></button>`).join("");
  $$("[data-preset]").forEach((b) => (b.onclick = () => { Object.assign(cfg, PRESETS[b.dataset.preset]); save(); reset(); renderPresets(); paintTimer(); }));
}

function settings() {
  modal({
    title: "Custom timer",
    submit: "Apply",
    body: `<div class="form-grid">
      ${field("Round length (seconds)", "work", cfg.work, { type: "number", min: 10, step: 10 })}
      ${field("Rest (seconds, 0 = none)", "rest", cfg.rest, { type: "number", min: 0, step: 5 })}
      ${field("Rounds", "rounds", cfg.rounds, { type: "number", min: 1 })}
      ${field("Warning before end (seconds)", "warn", cfg.warn, { type: "number", min: 0 })}
      ${field("Get-ready countdown (seconds)", "prep", cfg.prep, { type: "number", min: 0 })}
    </div>`,
    onSubmit(v) { Object.assign(cfg, { work: v.work || 60, rest: v.rest ?? 0, rounds: v.rounds || 1, warn: v.warn ?? 0, prep: v.prep ?? 0 }); save(); reset(); renderPresets(); },
  });
}

$$("[data-act]").forEach((b) => (b.onclick = () => ({
  toggle, reset, skip, settings,
  sound: () => { cfg.sound = !cfg.sound; save(); },
  fullscreen: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()),
})[b.dataset.act](), paintTimer()));

document.addEventListener("keydown", (e) => {
  if (document.querySelector(".modal-wrap")) return;
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); toggle(); }
  else if (k === "r") reset();
  else if (k === "n") skip();
  else if (k === "f") $('[data-act="fullscreen"]').click();
  else if (k === "m") { cfg.sound = !cfg.sound; save(); }
  paintTimer();
});

// Hide controls after a few idle seconds so the TV shows only the clock.
let idleT;
const wake = () => { document.body.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => running && document.body.classList.add("idle"), 4000); };
["mousemove", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, wake));

// --- who's on the mat -----------------------------------------------------------
const nowHHMM = () => new Date().toTimeString().slice(0, 5);
const endOf = (c) => { const [h, m] = c.start.split(":").map(Number); const t = h * 60 + m + c.duration; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

/** The class running now; otherwise one starting within 30 minutes (members arrive early). */
function currentClass() {
  const cls = classesOn(today()), now = nowHHMM();
  const soon = new Date(Date.now() + 30 * 60000).toTimeString().slice(0, 5);
  return cls.find((c) => c.start <= now && now < endOf(c)) || cls.find((c) => c.start > now && c.start <= soon) || null;
}

let seen = null;
function renderMat() {
  const d = db();
  $("#tv-academy").textContent = d.academy.name;
  const c = currentClass();
  const t = today();
  const later = classesOn(t).filter((x) => x.start > nowHHMM());
  if (c) {
    const coach = byId("staff", c.instructorId);
    const live = c.start <= nowHHMM();
    $("#tv-class").innerHTML = `<span class="live ${live ? "" : "soon"}">${live ? "Live" : "Starting soon"}</span><b>${esc(c.name)}</b><small>${fmtTime(c.start)}–${fmtTime(endOf(c))} · ${esc(coach?.name || "")}</small>`;
  } else {
    $("#tv-class").innerHTML = later[0] ? `<span class="live soon">Next</span><b>${esc(later[0].name)}</b><small>${fmtTime(later[0].start)}</small>` : `<small>No more classes today</small>`;
  }
  const att = c ? d.attendance.filter((a) => a.classId === c.id && a.date === t) : [];
  const people = att.map((a) => byId("students", a.studentId)).filter(Boolean);
  $("#mat-count").textContent = people.length;
  $("#mat-sub").textContent = c ? `${people.length} of ${c.capacity} spots · check in at the kiosk` : `${d.attendance.filter((a) => a.date === t).length} check-ins today`;
  $("#mat-list").innerHTML = people.length
    ? people.slice().reverse().map((s) => `<div class="mat-person">${beltChip(s.belt, s.stripes)}<span>${esc(fullName(s))}</span></div>`).join("")
    : `<p class="mat-empty">${c ? "Waiting for the first check-in…" : "The mats are open soon."}</p>`;

  // Flash newly checked-in members across the TV.
  const ids = new Set(att.map((a) => a.id));
  if (seen) {
    const fresh = att.filter((a) => !seen.has(a.id)).map((a) => byId("students", a.studentId)).filter(Boolean);
    if (fresh.length) flash(fresh[fresh.length - 1]);
  }
  seen = ids;
}

function flash(s) {
  const f = $("#tv-flash");
  f.innerHTML = `${beltChip(s.belt, s.stripes)}<b>Oss, ${esc(s.first)}!</b>`;
  f.hidden = false;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => (f.hidden = true), 3500);
}

function clock() {
  $("#tv-clock").textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  renderMat();
}

subscribe(renderMat);
setInterval(clock, 15000);
clock();
renderPresets();
// A steady interval (not requestAnimationFrame) keeps time and beeps going even if the tab is in the background.
setInterval(tick, 100);
tick();
