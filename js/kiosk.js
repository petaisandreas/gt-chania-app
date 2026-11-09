// Front-desk tablet kiosk: PIN keypad or name search → pick a class → checked in.
import { db, subscribe, today, classesOn, checkIn, fullName, byId, eligibility } from "./store.js";
import { esc, $, fmtTime, beltChip } from "./ui.js";

let pin = "";
let selectedClass = null;

function currentClass() {
  const cls = classesOn(today());
  const now = new Date().toTimeString().slice(0, 5);
  // The next class that hasn't ended yet, else the last one of the day.
  return cls.find((c) => {
    const [h, m] = c.start.split(":").map(Number);
    const end = new Date(); end.setHours(h, m + c.duration);
    return end.toTimeString().slice(0, 5) > now;
  }) || cls[cls.length - 1];
}

function renderClasses() {
  const d = db();
  const cls = classesOn(today());
  if (!selectedClass || !cls.some((c) => c.id === selectedClass)) selectedClass = currentClass()?.id || null;
  $("#k-academy").textContent = d.academy.name;
  $("#k-classes").innerHTML = cls.length ? cls.map((c) => {
    const n = d.attendance.filter((a) => a.classId === c.id && a.date === today()).length;
    return `<button class="k-class ${c.id === selectedClass ? "on" : ""}" data-cls="${c.id}">
      <span class="time">${fmtTime(c.start)}</span><span class="grow"><b>${esc(c.name)}</b><small>${esc(byId("staff", c.instructorId)?.name || "")} · ${esc(c.level)}</small></span><span class="count">${n}/${c.capacity}</span></button>`;
  }).join("") : `<p class="muted">No classes today — enjoy the rest day.</p>`;
  document.querySelectorAll("[data-cls]").forEach((b) => (b.onclick = () => { selectedClass = b.dataset.cls; renderClasses(); }));
}

function renderPin() {
  [...$("#pin").children].forEach((s, i) => s.classList.toggle("on", i < pin.length));
}

function success(s) {
  const c = byId("classes", selectedClass);
  const added = checkIn(s.id, selectedClass);
  const e = eligibility(s);
  const o = $("#k-overlay");
  o.innerHTML = `<div class="k-card">
    <div class="k-check">${added ? "✓" : "↺"}</div>
    <h2>${added ? "Oss" : "Already in"}, ${esc(s.first)}!</h2>
    <p>${esc(c.name)} · ${fmtTime(c.start)}</p>
    <div class="row gap center">${beltChip(s.belt, s.stripes)} <span>${e.next ? `${e.done}/${e.needClasses} classes toward ${esc(e.next)}` : "Black belt — respect."}</span></div>
    ${s.waiver ? "" : `<p class="warn-text">Please see the front desk to sign your waiver.</p>`}
  </div>`;
  o.hidden = false;
  setTimeout(() => (o.hidden = true), 3200);
}

function fail(msg) {
  const o = $("#k-overlay");
  o.innerHTML = `<div class="k-card"><div class="k-check bad">!</div><h2>${esc(msg)}</h2><p class="muted">Try again or ask the front desk.</p></div>`;
  o.hidden = false;
  setTimeout(() => (o.hidden = true), 2200);
}

function tryPin() {
  const s = db().students.find((x) => x.pin === pin && x.status !== "cancelled");
  pin = ""; renderPin();
  if (!selectedClass) return fail("No class to check into");
  if (!s) return fail("PIN not recognized");
  if (s.status === "frozen") return fail("Membership is frozen");
  success(s);
}

$("#keypad").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map((k) => `<button data-k="${k}">${k}</button>`).join("");
$("#keypad").onclick = (e) => {
  const k = e.target.dataset.k;
  if (k == null) return;
  if (k === "⌫") pin = pin.slice(0, -1);
  else if (k === "✓") { if (pin.length === 4) tryPin(); return; }
  else if (pin.length < 4) pin += k;
  renderPin();
  if (pin.length === 4) setTimeout(tryPin, 150);
};
document.addEventListener("keydown", (e) => {
  if (document.activeElement === $("#k-search")) return;
  if (/^\d$/.test(e.key) && pin.length < 4) { pin += e.key; renderPin(); if (pin.length === 4) setTimeout(tryPin, 150); }
  if (e.key === "Backspace") { pin = pin.slice(0, -1); renderPin(); }
});

const search = $("#k-search");
search.oninput = () => {
  const q = search.value.trim().toLowerCase();
  const hits = q.length < 2 ? [] : db().students.filter((s) => s.status === "active" && fullName(s).toLowerCase().includes(q)).slice(0, 6);
  $("#k-matches").innerHTML = hits.map((s) => `<button data-sid="${s.id}">${beltChip(s.belt, s.stripes)} ${esc(fullName(s))}</button>`).join("");
  document.querySelectorAll("[data-sid]").forEach((b) => (b.onclick = () => {
    search.value = ""; $("#k-matches").innerHTML = "";
    if (!selectedClass) return fail("No class to check into");
    success(byId("students", b.dataset.sid));
  }));
};

function tick() { $("#k-clock").textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
setInterval(tick, 10000); tick();
subscribe(renderClasses);
renderClasses();
