import { db, update, uid, today, fullName, money } from "../store.js";
import { esc, $$, modal, field, toast, fmtDate, badge, progress, empty } from "../ui.js";

const TONE = { Seminar: "info", "Belt test": "ok", Competition: "danger", Social: "neutral" };

function eventForm(e) {
  const isNew = !e;
  modal({
    title: isNew ? "New event" : e.title,
    body: `<div class="form-grid">
      ${field("Title", "title", e?.title, { required: true, span: 2 })}
      ${field("Type", "type", e?.type || "Seminar", { options: ["Seminar", "Belt test", "Competition", "Social"] })}
      ${field("Date", "date", e?.date || today(), { type: "date", required: true })}
      ${field("Start time", "time", e?.time || "12:00", { type: "time" })}
      ${field("Price", "price", e?.price ?? 0, { type: "number", min: 0, step: "0.01" })}
      ${field("Capacity", "capacity", e?.capacity ?? 30, { type: "number", min: 1 })}
    </div>`,
    danger: isNew ? null : { label: "Delete event", action: () => update((d) => (d.events = d.events.filter((x) => x.id !== e.id))) },
    onSubmit(v) {
      update((d) => (isNew ? d.events.push({ id: uid("ev"), registrations: [], ...v }) : Object.assign(d.events.find((x) => x.id === e.id), v)));
      toast("Event saved");
    },
  });
}

function registrations(e) {
  const d = db();
  const people = d.students.filter((s) => s.status === "active").sort((a, b) => a.first.localeCompare(b.first));
  modal({
    title: `Registrations — ${e.title}`,
    wide: true,
    submit: "Save registrations",
    body: `<p class="muted">${e.registrations.length}/${e.capacity} registered · ${money(e.price)} per person</p>
      <div class="check-grid">${people.map((s) => `<label class="check"><input type="checkbox" data-multi="1" name="ids" value="${s.id}" ${e.registrations.includes(s.id) ? "checked" : ""}/> ${esc(fullName(s))}</label>`).join("")}</div>`,
    onSubmit({ ids = [] }) {
      if (ids.length > e.capacity) { toast(`Over capacity (${ids.length}/${e.capacity})`, "warn"); return false; }
      update((d) => {
        const ev = d.events.find((x) => x.id === e.id);
        const added = ids.filter((id) => !ev.registrations.includes(id));
        if (ev.price > 0) added.forEach((sid) => d.invoices.push({ id: uid("inv"), studentId: sid, amount: ev.price, date: today(), due: ev.date, description: ev.title, status: "due" }));
        ev.registrations = ids;
      });
      toast("Registrations updated");
    },
  });
}

export default {
  title: "Events",
  render() {
    const d = db();
    const t = today();
    const up = d.events.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date));
    const past = d.events.filter((e) => e.date < t).sort((a, b) => b.date.localeCompare(a.date));
    const card = (e) => `<section class="card event">
      <div class="date-tile big"><b>${new Date(e.date + "T12:00").getDate()}</b>${new Date(e.date + "T12:00").toLocaleString("en-US", { month: "short" })}</div>
      <div class="grow"><div class="row gap">${badge(e.type, TONE[e.type])}<small class="muted">${fmtDate(e.date, { weekday: "short", month: "short", day: "numeric" })} · ${esc(e.time || "")}</small></div>
        <h3>${esc(e.title)}</h3><p class="muted">${e.price ? money(e.price) : "Free"} · ${e.registrations.length}/${e.capacity} registered</p>${progress(e.registrations.length / e.capacity)}</div>
      <div class="actions col"><button class="btn btn-sm btn-primary" data-reg="${e.id}">Registrations</button><button class="btn btn-sm btn-ghost" data-edit="${e.id}">Edit</button></div></section>`;
    return `
    <div class="page-head"><div><p class="eyebrow">Academy</p><h1>Events</h1><p class="muted">Seminars, belt tests and competitions.</p></div>
      <div class="actions"><button class="btn btn-primary" data-new>+ New event</button></div></div>
    <h2 class="section-title">Upcoming</h2>${up.map(card).join("") || empty("No upcoming events.")}
    ${past.length ? `<h2 class="section-title">Past</h2>${past.map(card).join("")}` : ""}`;
  },
  mount(el) {
    const ev = (id) => db().events.find((e) => e.id === id);
    $$("[data-new]", el).forEach((b) => (b.onclick = () => eventForm()));
    $$("[data-edit]", el).forEach((b) => (b.onclick = () => eventForm(ev(b.dataset.edit))));
    $$("[data-reg]", el).forEach((b) => (b.onclick = () => registrations(ev(b.dataset.reg))));
  },
};
