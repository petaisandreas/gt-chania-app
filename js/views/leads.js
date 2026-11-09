import { db, update, uid, today, LEAD_STAGES } from "../store.js";
import { esc, $, $$, badge, fmtDate, modal, field, toast } from "../ui.js";

let tab = "pipeline";
const SOURCES = ["Website form", "Instagram", "Google", "Referral", "Walk-in", "Facebook"];

function leadForm(l) {
  const isNew = !l;
  modal({
    title: isNew ? "New lead" : l.name,
    submit: isNew ? "Add lead" : "Save",
    body: `<div class="form-grid">
      ${field("Full name", "name", l?.name, { required: true, span: 2 })}
      ${field("Email", "email", l?.email, { type: "email" })}
      ${field("Phone", "phone", l?.phone)}
      ${field("Source", "source", l?.source || "Walk-in", { options: SOURCES })}
      ${field("Interested in", "interest", l?.interest || "Adult Gi", { options: ["Adult Gi", "No-Gi", "Kids Program", "Self-defense", "Competition"] })}
      ${field("Stage", "stage", l?.stage || "New", { options: LEAD_STAGES })}
      ${field("Trial class date", "trialDate", l?.trialDate, { type: "date" })}
      ${field("Notes", "notes", l?.notes, { type: "textarea", span: 2 })}
    </div>`,
    danger: isNew ? null : { label: "Delete lead", action: () => update((d) => (d.leads = d.leads.filter((x) => x.id !== l.id))) },
    onSubmit(v) {
      if (v.trialDate && v.stage === "New") v.stage = "Trial booked";
      update((d) => (isNew ? d.leads.push({ id: uid("ld"), created: today(), ...v }) : Object.assign(d.leads.find((x) => x.id === l.id), v)));
      toast(isNew ? "Lead added — welcome sequence queued" : "Saved");
    },
  });
}

function convert(l) {
  const [first, ...rest] = l.name.split(" ");
  const id = uid("s");
  update((d) => {
    d.students.push({
      id, first, last: rest.join(" ") || "-", email: l.email, phone: l.phone, kid: l.interest === "Kids Program",
      belt: "White", stripes: 0, beltSince: today(), lastPromotion: today(), joined: today(), status: "active",
      planId: l.interest === "Kids Program" ? d.plans.find((p) => p.name.includes("Kids"))?.id || d.plans[0].id : d.plans[0].id,
      waiver: false, pin: String(Math.floor(1000 + Math.random() * 9000)), notes: `Converted from lead (${l.source}).`, location: d.academy.locations[0],
    });
    d.leads.find((x) => x.id === l.id).stage = "Won";
  });
  toast(`${first} is now a member! 🥋`);
  location.hash = `#/students/${id}`;
}

function automationForm(a) {
  const isNew = !a;
  const steps = a?.steps || [{ delay: 0, channel: "Email", text: "" }];
  const stepRow = (s, i) => `<div class="step-row" data-step>
    <label class="field"><span>Day</span><input type="number" min="0" name="delay_${i}" value="${s.delay}"/></label>
    <label class="field"><span>Channel</span><select name="channel_${i}">${["Email", "SMS", "Push"].map((c) => `<option ${c === s.channel ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    <label class="field grow"><span>Message</span><input name="text_${i}" value="${esc(s.text)}" required/></label></div>`;
  const m = modal({
    title: isNew ? "New automation" : "Edit automation",
    wide: true,
    body: `<div class="form-grid">
      ${field("Name", "name", a?.name, { required: true })}
      ${field("Trigger", "trigger", a?.trigger || "Lead created", { options: ["Lead created", "Trial class booked", "Trial class attended", "Membership started", "First check-in", "No check-in for 14 days", "Payment failed", "Belt promotion"] })}
    </div>
    <h4 class="mt">Steps</h4><div data-steps>${steps.map(stepRow).join("")}</div>
    <button type="button" class="btn btn-ghost btn-sm" data-add-step>+ Add step</button>`,
    danger: isNew ? null : { label: "Delete", action: () => update((d) => (d.automations = d.automations.filter((x) => x.id !== a.id))) },
    onSubmit(v) {
      const n = $$("[data-step]", m.el).length;
      const out = { name: v.name, trigger: v.trigger, steps: Array.from({ length: n }, (_, i) => ({ delay: v[`delay_${i}`] || 0, channel: v[`channel_${i}`], text: v[`text_${i}`] })) };
      update((d) => (isNew ? d.automations.push({ id: uid("au"), enabled: true, ...out }) : Object.assign(d.automations.find((x) => x.id === a.id), out)));
      toast("Automation saved");
    },
  });
  $("[data-add-step]", m.el).onclick = () => {
    const wrap = $("[data-steps]", m.el);
    wrap.insertAdjacentHTML("beforeend", stepRow({ delay: 3, channel: "Email", text: "" }, $$("[data-step]", wrap).length));
  };
}

function render() {
  const d = db();
  const won = d.leads.filter((l) => l.stage === "Won").length;
  const closed = d.leads.filter((l) => ["Won", "Lost"].includes(l.stage)).length;
  const origin = location.origin;

  const body = {
    pipeline: `<div class="kanban">${LEAD_STAGES.map((st) => {
      const ls = d.leads.filter((l) => l.stage === st).sort((a, b) => b.created.localeCompare(a.created));
      return `<div class="lane" data-lane="${st}"><div class="lane-head"><b>${st}</b><span>${ls.length}</span></div>
        ${ls.map((l) => `<div class="lead-card" draggable="true" data-lead="${l.id}">
          <b>${esc(l.name)}</b><small>${esc(l.interest)} · ${esc(l.source)}</small>
          <small class="muted">${l.trialDate ? "Trial " + fmtDate(l.trialDate, { month: "short", day: "numeric" }) : "Added " + fmtDate(l.created, { month: "short", day: "numeric" })}</small>
          ${!["Won", "Lost"].includes(st) ? `<div class="lead-actions"><button class="btn btn-sm" data-convert="${l.id}">Convert</button><button class="btn btn-sm btn-ghost" data-next="${l.id}">Advance →</button></div>` : ""}
        </div>`).join("")}</div>`;
    }).join("")}</div>`,
    automations: `<div class="toolbar"><p class="muted grow">Sequences run automatically when their trigger fires. Toggle them on or off any time.</p><button class="btn btn-primary" data-new-auto>+ New automation</button></div>
      <div class="grid grid-2">${d.automations.map((a) => `<section class="card">
        <header class="card-head"><div><h2>${esc(a.name)}</h2><small class="muted">When: ${esc(a.trigger)}</small></div>
          <label class="switch"><input type="checkbox" data-toggle="${a.id}" ${a.enabled ? "checked" : ""}/><span></span></label></header>
        <ol class="timeline">${a.steps.map((s) => `<li><span class="tl-day">Day ${s.delay}</span>${badge(s.channel, s.channel === "SMS" ? "info" : "neutral")} ${esc(s.text)}</li>`).join("")}</ol>
        <button class="btn btn-ghost btn-sm" data-edit-auto="${a.id}">Edit sequence</button></section>`).join("")}</div>`,
    capture: `<div class="grid grid-2">
      <section class="card"><header class="card-head"><h2>Website lead form</h2></header>
        <p class="muted">Paste this snippet into your academy website. Submissions land in the <b>New</b> column of your pipeline.</p>
        <pre class="code">&lt;iframe src="${esc(origin)}/index.html#trial" width="100%" height="560" style="border:0"&gt;&lt;/iframe&gt;</pre>
        <button class="btn btn-ghost btn-sm" data-copy>Copy snippet</button></section>
      <section class="card"><header class="card-head"><h2>Referral program</h2></header>
        <p class="muted">Members share their personal link; each signup is tagged as a referral so you can reward them.</p>
        <div class="kpis kpis-2"><div class="kpi"><span>Referral leads</span><strong>${d.leads.filter((l) => l.source === "Referral").length}</strong></div>
        <div class="kpi"><span>Referrals won</span><strong>${d.leads.filter((l) => l.source === "Referral" && l.stage === "Won").length}</strong></div></div></section>
    </div>`,
  }[tab];

  return `
  <div class="page-head">
    <div><p class="eyebrow">Business</p><h1>Leads & Automations</h1></div>
    <div class="actions"><button class="btn btn-primary" data-new>+ New lead</button></div>
  </div>
  <section class="kpis">
    <div class="kpi"><span>Open leads</span><strong>${d.leads.length - closed}</strong></div>
    <div class="kpi"><span>Trials booked</span><strong>${d.leads.filter((l) => l.stage === "Trial booked").length}</strong></div>
    <div class="kpi"><span>Conversion rate</span><strong>${closed ? Math.round((won / closed) * 100) : 0}%</strong><small>${won} won of ${closed} closed</small></div>
    <div class="kpi"><span>Active automations</span><strong>${d.automations.filter((a) => a.enabled).length}</strong></div>
  </section>
  <nav class="tabs">${[["pipeline", "Pipeline"], ["automations", "Automations"], ["capture", "Lead capture"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</nav>
  ${body}`;
}

export default {
  title: "Leads",
  render,
  mount(el) {
    const on = (sel, fn) => $$(sel, el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); fn(b); }));
    const lead = (id) => db().leads.find((l) => l.id === id);
    on("[data-tab]", (b) => { tab = b.dataset.tab; el.innerHTML = render(); this.mount(el); });
    on("[data-new]", () => leadForm());
    on("[data-lead]", (b) => leadForm(lead(b.dataset.lead)));
    on("[data-convert]", (b) => convert(lead(b.dataset.convert)));
    on("[data-next]", (b) => update((d) => { const l = d.leads.find((x) => x.id === b.dataset.next); l.stage = LEAD_STAGES[Math.min(LEAD_STAGES.indexOf(l.stage) + 1, 3)]; }));
    on("[data-new-auto]", () => automationForm());
    on("[data-edit-auto]", (b) => automationForm(db().automations.find((a) => a.id === b.dataset.editAuto)));
    on("[data-copy]", () => { navigator.clipboard?.writeText($("pre.code", el).textContent); toast("Snippet copied"); });
    $$("[data-toggle]", el).forEach((c) => (c.onchange = () => update((d) => (d.automations.find((a) => a.id === c.dataset.toggle).enabled = c.checked))));
    // Drag & drop between lanes.
    $$("[data-lead]", el).forEach((card) => (card.ondragstart = (e) => e.dataTransfer.setData("text/plain", card.dataset.lead)));
    $$("[data-lane]", el).forEach((lane) => {
      lane.ondragover = (e) => { e.preventDefault(); lane.classList.add("drop"); };
      lane.ondragleave = () => lane.classList.remove("drop");
      lane.ondrop = (e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); update((d) => (d.leads.find((l) => l.id === id).stage = lane.dataset.lane)); };
    });
  },
};
