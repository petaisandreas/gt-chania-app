import { db, update, uid, iso, addDays, money, DAYS } from "../store.js";
import { esc, $$, avatar, modal, field, toast, fmtTime, fmtDate } from "../ui.js";

let periodDays = 14;

function staffForm(s) {
  const isNew = !s;
  modal({
    title: isNew ? "Add staff member" : s.name,
    body: `<div class="form-grid">
      ${field("Full name", "name", s?.name, { required: true, span: 2 })}
      ${field("Role", "role", s?.role || "Instructor", { options: ["Head Instructor", "Instructor", "Kids Coach", "Assistant", "Front Desk", "Manager"] })}
      ${field("Email", "email", s?.email, { type: "email" })}
      ${field("Pay per class taught", "rate", s?.rate ?? 30, { type: "number", min: 0, step: "0.01" })}
      ${field("Color", "color", s?.color || "#e4572e", { type: "color" })}
    </div>`,
    danger: isNew ? null : { label: "Remove", action: () => update((d) => (d.staff = d.staff.filter((x) => x.id !== s.id))) },
    onSubmit(v) {
      update((d) => (isNew ? d.staff.push({ id: uid("st"), ...v }) : Object.assign(d.staff.find((x) => x.id === s.id), v)));
      toast("Saved");
    },
  });
}

/** Classes an instructor actually ran in the period: a scheduled class counts when at least one student checked in. */
function taught(staffId, from, to) {
  const d = db();
  const mine = new Set(d.classes.filter((c) => c.instructorId === staffId).map((c) => c.id));
  const sessions = new Map();
  for (const a of d.attendance) {
    if (!mine.has(a.classId) || a.date < from || a.date > to) continue;
    const k = a.classId + a.date;
    sessions.set(k, (sessions.get(k) || 0) + 1);
  }
  const counts = [...sessions.values()];
  return { sessions: counts.length, students: counts.reduce((a, b) => a + b, 0) };
}

function render() {
  const d = db();
  const to = iso(addDays(new Date(), -1));
  const from = iso(addDays(new Date(), -periodDays));
  const rows = d.staff.map((s) => {
    const t = taught(s.id, from, to);
    const cls = d.classes.filter((c) => c.instructorId === s.id);
    const hours = cls.reduce((a, c) => a + c.duration, 0) / 60;
    return { s, ...t, pay: t.sessions * s.rate, avg: t.sessions ? t.students / t.sessions : 0, weekly: cls, hours };
  });
  const total = rows.reduce((a, r) => a + r.pay, 0);

  return `
  <div class="page-head">
    <div><p class="eyebrow">Business</p><h1>Staff & Payroll</h1></div>
    <div class="actions"><button class="btn btn-primary" data-new>+ Add staff</button></div>
  </div>
  <div class="toolbar">
    <div class="seg">${[7, 14, 30].map((n) => `<button data-p="${n}" class="${periodDays === n ? "on" : ""}">${n} days</button>`).join("")}</div>
    <span class="muted">Pay period ${fmtDate(from, { month: "short", day: "numeric" })} – ${fmtDate(to, { month: "short", day: "numeric" })}</span>
    <span class="grow"></span><b>Total payroll: ${money(total)}</b>
  </div>
  <div class="card flush">
    <table class="table"><thead><tr><th>Team member</th><th>Rate</th><th>Classes run</th><th class="hide-sm">Avg. mat size</th><th class="hide-sm">Weekly hours</th><th>Payout</th></tr></thead><tbody>
    ${rows.map((r) => `<tr data-staff="${r.s.id}"><td><span class="who">${avatar(r.s.name, r.s.color)}<span><b>${esc(r.s.name)}</b><small>${esc(r.s.role)}</small></span></span></td>
      <td>${money(r.s.rate)}/class</td><td>${r.sessions}</td><td class="hide-sm">${r.avg.toFixed(1)} students</td><td class="hide-sm">${r.hours.toFixed(1)} h</td><td><b>${money(r.pay)}</b></td></tr>`).join("")}
    </tbody></table>
  </div>
  <div class="grid grid-2">
    ${rows.filter((r) => r.weekly.length).map((r) => `<section class="card"><header class="card-head"><h2>${esc(r.s.name.split(" ")[0])}'s week</h2><span class="dot" style="background:${esc(r.s.color)}"></span></header>
      <ul class="list">${r.weekly.sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7) || a.start.localeCompare(b.start)).map((c) => `<li class="row"><span class="time">${DAYS[c.day]} ${fmtTime(c.start)}</span><span class="grow">${esc(c.name)}</span><small class="muted">${c.duration}m</small></li>`).join("")}</ul></section>`).join("")}
  </div>`;
}

export default {
  title: "Staff",
  render,
  mount(el) {
    $$("[data-new]", el).forEach((b) => (b.onclick = () => staffForm()));
    $$("[data-staff]", el).forEach((tr) => (tr.onclick = () => staffForm(db().staff.find((s) => s.id === tr.dataset.staff))));
    $$("[data-p]", el).forEach((b) => (b.onclick = () => { periodDays = Number(b.dataset.p); el.innerHTML = render(); this.mount(el); }));
  },
};
