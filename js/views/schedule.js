import { db, update, uid, today, iso, addDays, fullName, byId, checkIn, LEVELS, DAYS } from "../store.js";
import { esc, $, $$, fmtTime, fmtDate, modal, field, toast, beltChip, badge, avatar, empty } from "../ui.js";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const LEVEL_TONE = { Fundamentals: "#2457c5", "All Levels": "#e4572e", Advanced: "#16181c", "No-Gi": "#6c3fb5", Kids: "#3c9a4b", "Open Mat": "#9aa0a6", Competition: "#c8102e" };
let weekOffset = 0;

function weekDates() {
  const now = addDays(new Date(), weekOffset * 7);
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  return ORDER.map((_, i) => iso(addDays(monday, i)));
}

export function openClassForm(c) {
  const d = db();
  const isNew = !c;
  modal({
    title: isNew ? "New class" : "Edit class",
    submit: isNew ? "Add class" : "Save",
    body: `<div class="form-grid">
      ${field("Class name", "name", c?.name, { required: true, span: 2 })}
      ${field("Day", "day", c?.day ?? 1, { options: ORDER.map((i) => [i, DAYS[i]]) })}
      ${field("Start time", "start", c?.start || "18:00", { type: "time", required: true })}
      ${field("Duration (min)", "duration", c?.duration || 60, { type: "number", min: 15, step: 15 })}
      ${field("Capacity", "capacity", c?.capacity || 30, { type: "number", min: 1 })}
      ${field("Instructor", "instructorId", c?.instructorId, { options: d.staff.map((s) => [s.id, s.name]) })}
      ${field("Level", "level", c?.level || "All Levels", { options: LEVELS })}
      ${field("Location", "location", c?.location || d.academy.locations[0], { options: d.academy.locations })}
    </div>`,
    danger: isNew ? null : { label: "Delete class", action: () => { update((d) => (d.classes = d.classes.filter((x) => x.id !== c.id))); location.hash = "#/schedule"; toast("Class removed"); } },
    onSubmit(v) {
      v.day = Number(v.day);
      update((d) => (isNew ? d.classes.push({ id: uid("cl"), ...v }) : Object.assign(d.classes.find((x) => x.id === c.id), v)));
      toast(isNew ? "Class added" : "Saved");
    },
  });
}

function week() {
  const d = db();
  const dates = weekDates();
  const t = today();
  const loc = d.academy.locations;
  return `
  <div class="page-head">
    <div><p class="eyebrow">Academy</p><h1>Schedule</h1></div>
    <div class="actions"><button class="btn btn-primary" data-new>+ New class</button></div>
  </div>
  <div class="toolbar">
    <div class="seg"><button data-wk="-1">‹</button><button data-wk="0" class="${weekOffset === 0 ? "on" : ""}">This week</button><button data-wk="1">›</button></div>
    <span class="muted">${fmtDate(dates[0], { month: "short", day: "numeric" })} – ${fmtDate(dates[6], { month: "short", day: "numeric", year: "numeric" })}</span>
    <span class="grow"></span>
    <div class="legend">${Object.entries(LEVEL_TONE).map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}</div>
  </div>
  <div class="week">
    ${dates.map((date) => {
      const day = new Date(date + "T12:00").getDay();
      const cls = d.classes.filter((c) => c.day === day).sort((a, b) => a.start.localeCompare(b.start));
      return `<div class="week-col ${date === t ? "is-today" : ""}">
        <div class="week-day"><b>${DAYS[day]}</b><span>${new Date(date + "T12:00").getDate()}</span></div>
        ${cls.map((c) => {
          const n = d.attendance.filter((a) => a.classId === c.id && a.date === date).length;
          const booked = d.bookings.filter((b) => b.classId === c.id && b.date === date).length;
          return `<a class="class-block" style="--lv:${LEVEL_TONE[c.level] || "#888"}" href="#/schedule/class/${c.id}/${date}">
            <span class="cb-time">${fmtTime(c.start)} · ${c.duration}m</span>
            <b>${esc(c.name)}</b>
            <span class="cb-meta">${esc(byId("staff", c.instructorId)?.name.split(" ")[0] || "")}${loc.length > 1 ? " · " + esc(c.location) : ""}</span>
            <span class="cb-count">${date <= t ? `${n} in` : `${booked} booked`} / ${c.capacity}</span>
          </a>`;
        }).join("") || `<div class="muted small pad">Rest day</div>`}
      </div>`;
    }).join("")}
  </div>`;
}

function roster(classId, date) {
  const d = db();
  const c = byId("classes", classId);
  if (!c) return empty("Class not found.");
  const present = new Set(d.attendance.filter((a) => a.classId === classId && a.date === date).map((a) => a.studentId));
  const booked = new Set(d.bookings.filter((b) => b.classId === classId && b.date === date).map((b) => b.studentId));
  const pool = d.students.filter((s) => s.status === "active" && (c.level === "Kids" ? s.kid : !s.kid))
    .sort((a, b) => (present.has(b.id) - present.has(a.id)) || (booked.has(b.id) - booked.has(a.id)) || a.first.localeCompare(b.first));
  const future = date > today();
  return `
  <a href="#/schedule" class="back">← Schedule</a>
  <div class="page-head">
    <div><p class="eyebrow">${fmtDate(date, { weekday: "long", month: "long", day: "numeric" })} · ${fmtTime(c.start)}</p><h1>${esc(c.name)}</h1>
      <p class="muted">${esc(byId("staff", c.instructorId)?.name || "")} · ${esc(c.level)} · ${esc(c.location)}</p></div>
    <div class="actions"><button class="btn btn-ghost" data-edit>Edit class</button></div>
  </div>
  <div class="kpis kpis-3">
    <div class="kpi"><span>${future ? "Booked" : "Checked in"}</span><strong>${future ? booked.size : present.size}</strong><small>of ${c.capacity} spots</small></div>
    <div class="kpi"><span>Reservations</span><strong>${booked.size}</strong><small>${[...booked].filter((id) => !present.has(id)).length} not yet arrived</small></div>
    <div class="kpi"><span>Mat fill</span><strong>${Math.round(((future ? booked.size : present.size) / c.capacity) * 100)}%</strong><small>capacity used</small></div>
  </div>
  <div class="toolbar"><input class="input" type="search" placeholder="Filter roster…" data-filter /><span class="muted small">${future ? "Tap to reserve a spot" : "Tap to mark present"}</span></div>
  <div class="roster">
    ${pool.map((s) => {
      const on = future ? booked.has(s.id) : present.has(s.id);
      return `<button class="roster-item ${on ? "on" : ""}" data-sid="${s.id}" data-name="${esc(fullName(s).toLowerCase())}">
        ${avatar(fullName(s))}<span class="grow"><b>${esc(fullName(s))}</b>${beltChip(s.belt, s.stripes)}</span>
        ${!future && booked.has(s.id) ? badge("booked", "info") : ""}<span class="tick">${on ? "✓" : ""}</span></button>`;
    }).join("")}
  </div>`;
}

export default {
  title: "Schedule",
  render([mode, id, date]) {
    return mode === "class" ? roster(id, date || today()) : week();
  },
  mount(el, [mode, id, date = today()]) {
    if (mode === "class") {
      const c = byId("classes", id);
      if (!c) return;
      $("[data-edit]", el).onclick = () => openClassForm(c);
      const future = date > today();
      $$("[data-sid]", el).forEach((b) => (b.onclick = () => {
        const sid = b.dataset.sid;
        update((d) => {
          const list = future ? d.bookings : d.attendance;
          const i = list.findIndex((a) => a.studentId === sid && a.classId === id && a.date === date);
          if (i >= 0) list.splice(i, 1);
          else if (future) list.push({ id: uid("bk"), studentId: sid, classId: id, date });
        });
        if (!future && !b.classList.contains("on")) checkIn(sid, id, date);
      }));
      const f = $("[data-filter]", el);
      f.oninput = () => $$("[data-sid]", el).forEach((b) => (b.hidden = !b.dataset.name.includes(f.value.toLowerCase())));
      return;
    }
    $("[data-new]", el).onclick = () => openClassForm();
    $$("[data-wk]", el).forEach((b) => (b.onclick = () => {
      const v = Number(b.dataset.wk);
      weekOffset = v === 0 ? 0 : weekOffset + v;
      el.innerHTML = week(); this.mount(el, []);
    }));
  },
};
