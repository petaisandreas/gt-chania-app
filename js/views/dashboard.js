import { db, today, iso, addDays, money, fullName, byId, eligibility, classesOn, DAYS, docStatus, paymentStatus, ownerShort } from "../store.js";
import { esc, barChart, beltChip, fmtTime, avatar, badge, progress } from "../ui.js";

export default {
  title: "Dashboard",
  render() {
    const d = db();
    const t = today();
    const active = d.students.filter((s) => s.status === "active");
    const monthStart = t.slice(0, 7);
    const mrr = active.reduce((sum, s) => {
      const p = d.plans.find((x) => x.id === s.planId);
      return sum + (p ? (p.interval === "year" ? p.price / 12 : p.interval === "pack" ? 0 : p.price) : 0);
    }, 0);
    const collected = d.invoices.filter((i) => i.date.startsWith(monthStart) && i.status === "paid").reduce((a, i) => a + i.amount, 0);
    const outstanding = d.invoices.filter((i) => i.status !== "paid");
    const weekAgo = iso(addDays(new Date(), -7));
    const weekCheckins = d.attendance.filter((a) => a.date >= weekAgo).length;
    const openLeads = d.leads.filter((l) => !["Won", "Lost"].includes(l.stage));

    // last 14 days attendance
    const days = Array.from({ length: 14 }, (_, i) => iso(addDays(new Date(), i - 13)));
    const att = days.map((day) => ({ label: DAYS[new Date(day + "T12:00").getDay()][0], value: d.attendance.filter((a) => a.date === day).length }));

    const todays = classesOn(t);
    const eligible = active.map((s) => [s, eligibility(s)]).filter(([, e]) => e.eligible).slice(0, 6);
    const lowStock = d.products.filter((p) => p.stock <= p.lowAt);
    const upcoming = d.events.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

    return `
    <div class="page-head">
      <div><p class="eyebrow">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p><h1>Oss, ${esc(ownerShort())}.</h1></div>
      <div class="actions"><a class="btn btn-ghost" href="tv.html" target="_blank">Mat TV ↗</a><a class="btn btn-ghost" href="kiosk.html" target="_blank">Open kiosk ↗</a><a class="btn btn-primary" href="#/students/new">+ New member</a></div>
    </div>

    <section class="kpis">
      <div class="kpi"><span>Active members</span><strong>${active.length}</strong><small>${d.students.filter((s) => s.status === "frozen").length} frozen</small></div>
      <div class="kpi"><span>Monthly recurring</span><strong>${money(Math.round(mrr))}</strong><small>${money(collected)} collected this month</small></div>
      <div class="kpi"><span>Check-ins (7 days)</span><strong>${weekCheckins}</strong><small>${(weekCheckins / Math.max(1, active.length)).toFixed(1)} per member</small></div>
      <div class="kpi"><span>Open leads</span><strong>${openLeads.length}</strong><small>${d.leads.filter((l) => l.stage === "Trial booked").length} trials booked</small></div>
    </section>

    <div class="grid grid-2-1">
      <section class="card">
        <header class="card-head"><h2>Mat time — last 14 days</h2><a href="#/reports" class="link">Reports →</a></header>
        ${barChart(att, { height: 200 })}
      </section>
      <section class="card">
        <header class="card-head"><h2>Today on the mats</h2><a href="#/schedule" class="link">Schedule →</a></header>
        ${todays.length ? `<ul class="list">${todays.map((c) => {
          const n = d.attendance.filter((a) => a.classId === c.id && a.date === t).length;
          const coach = byId("staff", c.instructorId);
          return `<li><a href="#/schedule/class/${c.id}/${t}" class="row-link"><span class="time">${fmtTime(c.start)}</span><span class="grow"><b>${esc(c.name)}</b><small>${esc(coach?.name || "")} · ${esc(c.level)}</small></span><span class="count">${n}/${c.capacity}</span></a></li>`;
        }).join("")}</ul>` : `<p class="muted">No classes scheduled today.</p>`}
      </section>
    </div>

    <section class="card">
      <header class="card-head"><h2>${new Date().toLocaleString("en-US", { month: "long" })} payments</h2><a href="#/students" class="link">Members →</a></header>
      ${(() => {
        const st = active.map((s) => paymentStatus(s));
        const n = (k) => st.filter((x) => x === k).length;
        const pct = (k) => (active.length ? (n(k) / active.length) * 100 : 0);
        return `<div class="paybar"><span class="ok" style="width:${pct("paid")}%"></span><span class="warn" style="width:${pct("due")}%"></span><span class="danger" style="width:${pct("overdue")}%"></span></div>
        <div class="paylegend"><span><i class="ok"></i>${n("paid")} paid</span><span><i class="warn"></i>${n("due")} due soon</span><span><i class="danger"></i>${n("overdue")} overdue</span></div>
        <div class="group-grid">${d.groups.map((g) => {
          const ms = active.filter((s) => (s.groupIds || []).includes(g.id));
          const paid = ms.filter((s) => paymentStatus(s) === "paid").length, late = ms.filter((s) => paymentStatus(s) === "overdue").length;
          return `<div class="group-mini" style="--g:${g.color}"><b>${esc(g.name)}</b><small>${paid}/${ms.length} paid${late ? ` · <em>${late} overdue</em>` : ""}</small>${progress(ms.length ? paid / ms.length : 0, "ok")}</div>`;
        }).join("")}</div>`;
      })()}
    </section>

    <div class="grid grid-3">
      <section class="card">
        <header class="card-head"><h2>Ready for promotion</h2><a href="#/ranks" class="link">All →</a></header>
        ${eligible.length ? `<ul class="list">${eligible.map(([s, e]) => `<li class="row"><a href="#/students/${s.id}" class="grow">${esc(fullName(s))}<small>${esc(e.next)}</small></a>${beltChip(s.belt, s.stripes)}</li>`).join("")}</ul>` : `<p class="muted">Nobody is eligible yet.</p>`}
      </section>
      <section class="card">
        <header class="card-head"><h2>Needs attention</h2><a href="#/billing" class="link">Billing →</a></header>
        <ul class="list">
          <li class="row"><span class="grow">Unpaid / failed invoices</span>${badge(outstanding.length, outstanding.length ? "warn" : "ok")}</li>
          <li class="row"><a class="grow" href="#/documents">Health certificates to renew</a>${(() => { const n = active.filter((s) => docStatus(s.id).status !== "valid").length; return badge(n, n ? "danger" : "ok"); })()}</li>
          <li class="row"><span class="grow">Missing waivers</span>${badge(active.filter((s) => !s.waiver).length, "warn")}</li>
          <li class="row"><span class="grow">Low-stock products</span>${badge(lowStock.length, lowStock.length ? "danger" : "ok")}</li>
          <li class="row"><span class="grow">New leads to contact</span>${badge(d.leads.filter((l) => l.stage === "New").length, "info")}</li>
        </ul>
      </section>
      <section class="card">
        <header class="card-head"><h2>Coming up</h2><a href="#/events" class="link">Events →</a></header>
        ${upcoming.length ? `<ul class="list">${upcoming.map((e) => `<li class="row"><span class="date-tile"><b>${new Date(e.date + "T12:00").getDate()}</b>${new Date(e.date + "T12:00").toLocaleString("en-US", { month: "short" })}</span><span class="grow"><b>${esc(e.title)}</b><small>${esc(e.type)} · ${e.registrations.length}/${e.capacity}</small>${progress(e.registrations.length / e.capacity)}</span></li>`).join("")}</ul>` : `<p class="muted">No upcoming events.</p>`}
      </section>
    </div>

    <section class="card">
      <header class="card-head"><h2>Recent check-ins</h2></header>
      <div class="chips">${d.attendance.slice(-12).reverse().map((a) => {
        const s = byId("students", a.studentId), c = byId("classes", a.classId);
        return s ? `<a class="chip" href="#/students/${s.id}">${avatar(fullName(s))}<span>${esc(s.first)}<small>${esc(c?.name || "")}</small></span></a>` : "";
      }).join("")}</div>
    </section>`;
  },
};
