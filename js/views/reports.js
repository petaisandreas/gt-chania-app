import { db, iso, addDays, money, DAYS } from "../store.js";
import { esc, barChart, areaChart } from "../ui.js";

export default {
  title: "Reports",
  render() {
    const d = db();
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => { const x = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return iso(x).slice(0, 7); });
    const label = (m) => new Date(m + "-15").toLocaleString("en-US", { month: "short" });
    const rev = months.map((m) => d.invoices.filter((i) => i.status === "paid" && i.date.startsWith(m)).reduce((a, i) => a + i.amount, 0) + d.sales.filter((s) => s.date.startsWith(m)).reduce((a, s) => a + s.total, 0));
    const exp = months.map((m) => d.expenses.filter((e) => e.date.startsWith(m)).reduce((a, e) => a + e.amount, 0));
    const profit = rev.map((r, i) => r - exp[i]);

    // Retention: members active at start of each month that still attended in that month.
    const retention = months.map((m) => {
      const base = d.students.filter((s) => s.joined.slice(0, 7) < m && s.status !== "cancelled");
      const seen = new Set(d.attendance.filter((a) => a.date.startsWith(m)).map((a) => a.studentId));
      return base.length ? Math.round((base.filter((s) => seen.has(s.id)).length / base.length) * 100) : 0;
    });

    const since = iso(addDays(now, -28));
    const recent = d.attendance.filter((a) => a.date >= since);
    const byClass = d.classes.map((c) => ({ c, n: recent.filter((a) => a.classId === c.id).length }));
    const merged = {};
    byClass.forEach(({ c, n }) => { merged[c.name] = (merged[c.name] || 0) + n; });
    const topClasses = Object.entries(merged).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const byDay = [1, 2, 3, 4, 5, 6, 0].map((day) => ({ label: DAYS[day], value: recent.filter((a) => new Date(a.date + "T12:00").getDay() === day).length }));
    const weekly = Array.from({ length: 16 }, (_, w) => { const from = iso(addDays(now, -(16 - w) * 7)), to = iso(addDays(now, -(15 - w) * 7)); return d.attendance.filter((a) => a.date >= from && a.date < to).length; });

    const sources = {};
    d.leads.forEach((l) => { sources[l.source] ||= { all: 0, won: 0 }; sources[l.source].all++; if (l.stage === "Won") sources[l.source].won++; });
    const planMix = d.plans.map((p) => ({ p, n: d.students.filter((s) => s.planId === p.id && s.status === "active").length }));

    const atRisk = d.students.filter((s) => s.status === "active").map((s) => {
      let last = ""; for (const a of d.attendance) if (a.studentId === s.id && a.date > last) last = a.date;
      return { s, last };
    }).filter((x) => !x.last || x.last < iso(addDays(now, -14))).slice(0, 8);

    return `
    <div class="page-head"><div><p class="eyebrow">Business</p><h1>Reports</h1></div><div class="actions"><button class="btn btn-ghost" onclick="print()">Print</button></div></div>
    <section class="kpis">
      <div class="kpi"><span>6-month revenue</span><strong>${money(rev.reduce((a, b) => a + b, 0))}</strong></div>
      <div class="kpi"><span>6-month profit</span><strong>${money(profit.reduce((a, b) => a + b, 0))}</strong></div>
      <div class="kpi"><span>Avg. monthly retention</span><strong>${Math.round(retention.reduce((a, b) => a + b, 0) / retention.length)}%</strong></div>
      <div class="kpi"><span>Check-ins (28 days)</span><strong>${recent.length}</strong></div>
    </section>
    <div class="grid grid-2">
      <section class="card"><header class="card-head"><h2>Revenue by month</h2><small class="muted">Memberships + shop</small></header>${barChart(months.map((m, i) => ({ label: label(m), value: rev[i] })), { format: money })}</section>
      <section class="card"><header class="card-head"><h2>Profit by month</h2><small class="muted">After expenses</small></header>${barChart(months.map((m, i) => ({ label: label(m), value: Math.max(0, profit[i]), color: "var(--ok)" })), { format: money })}</section>
      <section class="card"><header class="card-head"><h2>Weekly check-ins — 16 weeks</h2></header>${areaChart(weekly, { height: 160 })}</section>
      <section class="card"><header class="card-head"><h2>Busiest days</h2><small class="muted">Last 28 days</small></header>${barChart(byDay, { color: "var(--info)" })}</section>
      <section class="card"><header class="card-head"><h2>Retention</h2><small class="muted">% of members who trained that month</small></header>${barChart(months.map((m, i) => ({ label: label(m), value: retention[i] })), { format: (v) => v + "%", color: "var(--accent-2)" })}</section>
      <section class="card flush"><header class="card-head pad"><h2>Most attended classes</h2></header>
        <table class="table"><tbody>${topClasses.map(([n, c]) => `<tr><td>${esc(n)}</td><td class="right"><b>${c}</b> check-ins</td></tr>`).join("")}</tbody></table></section>
      <section class="card flush"><header class="card-head pad"><h2>Lead sources</h2></header>
        <table class="table"><thead><tr><th>Source</th><th>Leads</th><th>Won</th><th>Rate</th></tr></thead><tbody>${Object.entries(sources).sort((a, b) => b[1].all - a[1].all).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.all}</td><td>${v.won}</td><td>${Math.round((v.won / v.all) * 100)}%</td></tr>`).join("")}</tbody></table></section>
      <section class="card flush"><header class="card-head pad"><h2>Membership mix</h2></header>
        <table class="table"><tbody>${planMix.map(({ p, n }) => `<tr><td>${esc(p.name)}</td><td>${n} members</td><td class="right">${money(p.price)}/${p.interval}</td></tr>`).join("")}</tbody></table></section>
      <section class="card flush"><header class="card-head pad"><h2>At-risk members</h2><small class="muted">No check-in for 14+ days</small></header>
        <table class="table"><tbody>${atRisk.map(({ s, last }) => `<tr><td><a href="#/students/${s.id}">${esc(s.first)} ${esc(s.last)}</a></td><td class="right muted">${last ? "last seen " + last : "never trained"}</td></tr>`).join("") || `<tr><td class="muted">Nobody at risk 🎉</td></tr>`}</tbody></table></section>
      <section class="card flush"><header class="card-head pad"><h2>Expenses by category</h2><small class="muted">6 months</small></header>
        <table class="table"><tbody>${Object.entries(d.expenses.reduce((acc, e) => ((acc[e.category] = (acc[e.category] || 0) + e.amount), acc), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="right">${money(v)}</td></tr>`).join("")}</tbody></table></section>
    </div>`;
  },
};
