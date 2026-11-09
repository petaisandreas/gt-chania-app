import { db, update, fullName, eligibility, promote, ADULT_BELTS, KID_BELTS, BELT_COLORS, iso, addDays } from "../store.js";
import { esc, $$, beltChip, progress, toast, badge, modal, empty } from "../ui.js";

let tab = "eligibility";

function rulesForm() {
  const d = db();
  const belts = [...new Set([...ADULT_BELTS, ...KID_BELTS])];
  modal({
    title: "Promotion requirements",
    wide: true,
    body: `<p class="muted">A stripe requires the class count since the last promotion. A new belt additionally requires the minimum time at the current belt.</p>
      <table class="table"><thead><tr><th>Belt</th><th>Classes per stripe</th><th>Min. months at belt</th></tr></thead><tbody>
      ${belts.map((b) => `<tr><td>${beltChip(b, 0)} ${b}</td><td><input class="input" type="number" min="1" name="${b}_c" value="${d.rankRules[b]?.classesPerStripe ?? 30}"/></td><td><input class="input" type="number" min="0" name="${b}_m" value="${d.rankRules[b]?.minMonths ?? 12}"/></td></tr>`).join("")}
      </tbody></table>`,
    onSubmit(v) {
      update((d) => belts.forEach((b) => (d.rankRules[b] = { classesPerStripe: v[`${b}_c`] || 1, minMonths: v[`${b}_m`] || 0 })));
      toast("Requirements updated");
    },
  });
}

function render() {
  const d = db();
  const active = d.students.filter((s) => s.status === "active");
  const rows = active.map((s) => ({ s, e: eligibility(s) })).filter((r) => r.e.next).sort((a, b) => b.e.eligible - a.e.eligible || b.e.progress - a.e.progress);
  const since = iso(addDays(new Date(), -30));
  const board = active.map((s) => ({ s, n: d.attendance.filter((a) => a.studentId === s.id && a.date >= since).length })).sort((a, b) => b.n - a.n).slice(0, 10);
  const dist = (belts, kid) => belts.map((b) => ({ b, n: active.filter((s) => s.kid === kid && s.belt === b).length }));

  const body = {
    eligibility: rows.length ? `<div class="card flush"><table class="table"><thead><tr><th>Member</th><th>Current</th><th>Next</th><th>Progress</th><th></th></tr></thead><tbody>
      ${rows.map(({ s, e }) => `<tr><td><a href="#/students/${s.id}"><b>${esc(fullName(s))}</b></a></td><td>${beltChip(s.belt, s.stripes)}</td>
        <td>${esc(e.next)}${e.isBeltStep ? `<small class="muted block">${e.months}/${e.minMonths} months</small>` : ""}</td>
        <td class="w-progress">${progress(e.progress, e.eligible ? "ok" : "accent")}<small class="muted">${e.done}/${e.needClasses} classes</small></td>
        <td class="right">${e.eligible ? `<button class="btn btn-sm btn-primary" data-promote="${s.id}">Promote</button>` : badge("in progress", "neutral")}</td></tr>`).join("")}
      </tbody></table></div>` : empty("No active members."),
    leaderboard: `<div class="grid grid-2"><section class="card"><header class="card-head"><h2>Most mat time — last 30 days</h2></header>
      <ol class="leader">${board.map(({ s, n }, i) => `<li><span class="rank-no">${i + 1}</span><a class="grow" href="#/students/${s.id}">${esc(fullName(s))}</a>${beltChip(s.belt, s.stripes)}<b>${n}</b></li>`).join("")}</ol></section>
      <section class="card"><header class="card-head"><h2>Belt distribution</h2></header>
      <h4>Adults</h4><div class="dist">${dist(ADULT_BELTS, false).map(({ b, n }) => `<div><span style="height:${Math.max(4, n * 6)}px;background:${BELT_COLORS[b]}"></span><small>${b}<br/><b>${n}</b></small></div>`).join("")}</div>
      <h4 class="mt">Kids</h4><div class="dist">${dist(KID_BELTS, true).map(({ b, n }) => `<div><span style="height:${Math.max(4, n * 6)}px;background:${BELT_COLORS[b]}"></span><small>${b}<br/><b>${n}</b></small></div>`).join("")}</div></section></div>`,
  }[tab];

  return `
  <div class="page-head">
    <div><p class="eyebrow">Academy</p><h1>Belts & Progress</h1></div>
    <div class="actions"><button class="btn btn-ghost" data-rules>Requirements</button></div>
  </div>
  <section class="kpis kpis-3">
    <div class="kpi"><span>Eligible now</span><strong>${rows.filter((r) => r.e.eligible).length}</strong></div>
    <div class="kpi"><span>Promoted in last 30 days</span><strong>${active.filter((s) => s.lastPromotion >= since).length}</strong></div>
    <div class="kpi"><span>Black belts</span><strong>${active.filter((s) => s.belt === "Black").length}</strong></div>
  </section>
  <nav class="tabs">${[["eligibility", "Promotion queue"], ["leaderboard", "Leaderboard"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</nav>
  ${body}`;
}

export default {
  title: "Belts",
  render,
  mount(el) {
    $$("[data-tab]", el).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; el.innerHTML = render(); this.mount(el); }));
    $$("[data-rules]", el).forEach((b) => (b.onclick = rulesForm));
    $$("[data-promote]", el).forEach((b) => (b.onclick = () => { promote(b.dataset.promote); toast("Promoted! Oss 🥋"); }));
  },
};
