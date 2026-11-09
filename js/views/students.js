import { db, update, uid, today, iso, fullName, byId, money, eligibility, lastSeen, promote, ADULT_BELTS, KID_BELTS, checkIn, classesOn, docStatus, groupsOf, monthlyFee, paymentStatus, markPaid } from "../store.js";
import { uploadDocument, viewDocument, DOC_TONE, DOC_LABEL } from "../docs-ui.js";
import { fmtSize } from "../files.js";
import { esc, $, $$, beltChip, badge, fmtDate, avatar, modal, field, toast, progress, empty } from "../ui.js";

let filter = { q: "", status: "active", pay: "", group: "all" };
const STATUS_TONE = { active: "ok", frozen: "info", cancelled: "neutral" };
export const PAY_TONE = { paid: "ok", due: "warn", overdue: "danger", inactive: "neutral" };
export const PAY_LABEL = { paid: "Paid", due: "Due soon", overdue: "Overdue", inactive: "—" };
const ordinal = (n) => n + (n % 10 > 3 || n % 10 === 0 || Math.floor(n / 10) === 1 ? "th" : ["th", "st", "nd", "rd"][n % 10]);

/** One-tap payment; members in several groups pick which group(s) this payment covers. */
export function payFlow(s) {
  const gs = groupsOf(s);
  if (gs.length <= 1) { markPaid(s.id); toast(`${s.first} marked paid for ${new Date().toLocaleString("en-US", { month: "long" })}`); return; }
  modal({
    title: `Payment — ${fullName(s)}`,
    submit: "Mark paid",
    body: `<p class="muted" style="margin-top:0">${esc(s.first)} is in ${gs.length} groups. Which does this payment cover?</p>
      ${gs.map((g) => `<label class="check pay-pick"><input type="checkbox" data-multi="1" name="groups" value="${g.id}" checked/> <span class="grow">${esc(g.name)}</span><b>${money(g.price)}</b></label>`).join("")}`,
    onSubmit({ groups = [] }) {
      if (!groups.length) { toast("Pick at least one group", "warn"); return false; }
      markPaid(s.id, groups); toast("Payment recorded");
    },
  });
}

function studentForm(s = {}) {
  const d = db();
  const belts = [...new Set([...ADULT_BELTS, ...KID_BELTS])];
  return `<div class="form-grid">
    ${field("First name", "first", s.first, { required: true })}
    ${field("Last name", "last", s.last, { required: true })}
    ${field("Email", "email", s.email, { type: "email" })}
    ${field("Phone", "phone", s.phone)}
    ${field("Program", "kid", s.kid ? "kid" : "adult", { options: [["adult", "Adult"], ["kid", "Kids"]] })}
    ${field("Membership plan", "planId", s.planId, { options: d.plans.map((p) => [p.id, `${p.name} — ${money(p.price)}/${p.interval}`]) })}
    ${field("Belt", "belt", s.belt || "White", { options: belts })}
    ${field("Stripes", "stripes", s.stripes ?? 0, { options: [0, 1, 2, 3, 4] })}
    ${field("Status", "status", s.status || "active", { options: ["active", "frozen", "cancelled"] })}
    ${field("Check-in PIN", "pin", s.pin || String(Math.floor(1000 + Math.random() * 9000)), { required: true })}
    ${field("Location", "location", s.location || d.academy.locations[0], { options: d.academy.locations })}
    ${field("Joined", "joined", s.joined || today(), { type: "date" })}
    <div class="field span-2"><span>Class groups</span><div class="group-picks">${d.groups.map((g) => `<label class="check"><input type="checkbox" data-multi="1" name="groupIds" value="${g.id}" ${(s.groupIds || []).includes(g.id) ? "checked" : ""}/> ${esc(g.name)} <small class="muted">${money(g.price)}/mo</small></label>`).join("")}</div></div>
    ${field("Notes", "notes", s.notes, { type: "textarea", span: 2 })}
    ${field("Liability waiver signed", "waiver", s.waiver, { type: "checkbox" })}
  </div>`;
}

export function openStudentForm(s) {
  const isNew = !s;
  modal({
    title: isNew ? "New member" : `Edit ${fullName(s)}`,
    body: studentForm(s),
    wide: true,
    submit: isNew ? "Add member" : "Save changes",
    danger: isNew ? null : { label: "Delete member", confirm: "Delete this member and their history?", action: () => {
      update((d) => { d.students = d.students.filter((x) => x.id !== s.id); d.attendance = d.attendance.filter((a) => a.studentId !== s.id); });
      location.hash = "#/students"; toast("Member deleted");
    } },
    onSubmit(v) {
      v.kid = v.kid === "kid";
      v.groupIds ||= [];
      if (!v.groupIds.length) { toast("Pick at least one class group", "warn"); return false; }
      v.stripes = Number(v.stripes);
      update((d) => {
        if (isNew) {
          const id = uid("s");
          d.students.push({ id, beltSince: today(), lastPromotion: today(), ...v });
          setTimeout(() => (location.hash = `#/students/${id}`));
        } else Object.assign(d.students.find((x) => x.id === s.id), v);
      });
      toast(isNew ? "Member added" : "Saved");
    },
  });
}

function list() {
  const d = db();
  const q = filter.q.toLowerCase();
  const group = d.groups.find((g) => g.id === filter.group);
  const inGroup = (st) => filter.group === "all" || (st.groupIds || []).includes(filter.group);
  const base = d.students.filter((st) => inGroup(st) && (!filter.status || st.status === filter.status));
  const withPay = base.map((st) => ({ st, pay: paymentStatus(st) }));
  const rows = withPay.filter(({ st, pay }) => (!filter.pay || pay === filter.pay) && (!q || `${st.first} ${st.last} ${st.email} ${st.phone}`.toLowerCase().includes(q)))
    .sort((a, b) => ["overdue", "due", "paid", "inactive"].indexOf(a.pay) - ["overdue", "due", "paid", "inactive"].indexOf(b.pay) || a.st.last.localeCompare(b.st.last));
  const payCount = (k) => withPay.filter((x) => x.pay === k).length;
  const groupStats = (gid) => {
    const ms = d.students.filter((st) => st.status === "active" && (gid === "all" || (st.groupIds || []).includes(gid)));
    return { n: ms.length, late: ms.filter((st) => paymentStatus(st) === "overdue").length, due: ms.filter((st) => paymentStatus(st) === "due").length };
  };
  const all = groupStats("all");
  const tab = (id, name, sub, st, color) => `<button class="gtab ${filter.group === id ? "on" : ""}" data-group="${id}" style="--g:${color}">
      <span class="gtab-name">${esc(name)}</span><span class="gtab-sub">${sub}</span>
      ${st.late ? `<span class="gtab-badge late" title="Overdue">${st.late}</span>` : st.due ? `<span class="gtab-badge" title="Due soon">${st.due}</span>` : ""}</button>`;
  const month = new Date().toLocaleString("en-US", { month: "long" });
  const late = payCount("overdue");
  const grace = ordinal(d.academy.graceDay || 10);

  return `
  <div class="page-head">
    <div><p class="eyebrow">Academy</p><h1>Members</h1></div>
    <div class="actions"><button class="btn btn-ghost" data-export>Export CSV</button><button class="btn btn-primary" data-new>+ New member</button></div>
  </div>
  <nav class="gtabs">
    ${tab("all", "All members", `${all.n} active`, all, "var(--ink)")}
    ${d.groups.map((g) => { const st = groupStats(g.id); return tab(g.id, g.name, `${st.n} · ${money(g.price)}/mo`, st, g.color); }).join("")}
  </nav>
  ${group ? `<section class="card group-head" style="--g:${group.color}">
    <span class="group-mark">${esc(group.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2))}</span>
    <div class="grow"><h2>${esc(group.name)}</h2><p class="muted">${groupStats(group.id).n} active members · ${money(group.price)} per month</p></div>
    <button class="btn btn-sm btn-ghost" data-edit-price>Edit price</button>
  </section>` : ""}
  ${late ? `<div class="banner banner-danger"><b>${late} member${late === 1 ? "" : "s"} overdue</b> for ${month}${group ? ` in ${esc(group.name)}` : ""} — payment was due by the ${grace}.</div>`
    : payCount("due") ? `<div class="banner banner-warn"><b>${payCount("due")} still to pay</b> for ${month} — grace period runs until the ${grace}.</div>`
    : base.length ? `<div class="banner banner-ok"><b>Everyone is paid up</b> for ${month}. 🎉</div>` : ""}
  <div class="toolbar">
    <input class="input" type="search" placeholder="Search name or phone…" value="${esc(filter.q)}" data-q />
    <div class="seg">${[["", "All"], ["paid", "Paid"], ["due", "Due soon"], ["overdue", "Overdue"]].map(([k, l]) => `<button data-pay="${k}" class="${filter.pay === k ? "on" : ""}">${l}${k ? ` <small>${payCount(k)}</small>` : ""}</button>`).join("")}</div>
    <select class="input" data-status>${[["active", "Active"], ["frozen", "Frozen"], ["cancelled", "Cancelled"], ["", "Any status"]].map(([k, l]) => `<option value="${k}" ${filter.status === k ? "selected" : ""}>${l}</option>`).join("")}</select>
  </div>
  <div class="card flush">
    ${rows.length ? `<table class="table">
      <thead><tr><th>Member</th><th class="hide-sm">Groups</th><th class="hide-sm">Rank</th><th>${esc(month)}</th><th></th></tr></thead>
      <tbody>${rows.map(({ st, pay }) => `<tr data-href="#/students/${st.id}">
          <td><span class="who">${avatar(fullName(st))}<span><b>${esc(fullName(st))}</b><small>${esc(st.phone || st.email)}</small></span></span></td>
          <td class="hide-sm">${groupsOf(st).map((g) => `<span class="gchip" style="--g:${g.color}">${esc(g.name)}</span>`).join(" ")}</td>
          <td class="hide-sm">${beltChip(st.belt, st.stripes)}</td>
          <td>${st.status === "active" ? badge(PAY_LABEL[pay], PAY_TONE[pay]) : badge(st.status, STATUS_TONE[st.status])}</td>
          <td class="right">${st.status === "active" && pay !== "paid" ? `<button class="btn btn-sm btn-primary" data-paid="${st.id}">Mark paid · ${money(monthlyFee(st))}</button>` : ""}</td></tr>`).join("")}</tbody></table>` : empty("No members match these filters.")}
  </div>`;
}

function editPrice(group) {
  modal({
    title: `Price — ${group.name}`,
    body: `<div class="form-grid">${field("Group name", "name", group.name, { required: true, span: 2 })}${field("Monthly price", "price", group.price, { type: "number", min: 0, step: "0.01" })}${field("Color", "color", group.color, { type: "color" })}</div>`,
    onSubmit(v) { update((d) => Object.assign(d.groups.find((g) => g.id === group.id), v)); toast("Group updated"); },
  });
}

function detail(id) {
  const d = db();
  const s = byId("students", id);
  if (!s) return empty("Member not found.");
  const e = eligibility(s);
  const plan = byId("plans", s.planId);
  const hist = d.attendance.filter((a) => a.studentId === id).sort((a, b) => b.date.localeCompare(a.date));
  const inv = d.invoices.filter((i) => i.studentId === id).sort((a, b) => b.date.localeCompare(a.date));
  const evs = d.events.filter((ev) => ev.registrations.includes(id));
  const docs = d.documents.filter((x) => x.studentId === id).sort((a, b) => b.uploaded.localeCompare(a.uploaded));
  // 12-week heat strip
  const weeks = Array.from({ length: 12 }, (_, w) => {
    const end = new Date(); end.setDate(end.getDate() - w * 7);
    const start = new Date(end); start.setDate(start.getDate() - 7);
    const n = hist.filter((a) => a.date > iso(start) && a.date <= iso(end)).length;
    return n;
  }).reverse();

  return `
  <a href="#/students" class="back">← Members</a>
  <div class="profile-head card">
    ${avatar(fullName(s))}
    <div class="grow">
      <h1>${esc(fullName(s))}</h1>
      <p class="muted">${groupsOf(s).map((g) => esc(g.name)).join(" + ") || (s.kid ? "Kids program" : "Adult program")} · Member since ${fmtDate(s.joined)} · PIN ${esc(s.pin)}</p>
      <div class="row gap">${beltChip(s.belt, s.stripes)} <b>${esc(s.belt)} belt</b>, ${s.stripes} stripe${s.stripes === 1 ? "" : "s"} ${badge(s.status, STATUS_TONE[s.status])} ${s.status === "active" ? badge(new Date().toLocaleString("en-US", { month: "long" }) + ": " + PAY_LABEL[paymentStatus(s)], PAY_TONE[paymentStatus(s)]) : ""} ${s.waiver ? badge("Waiver on file", "ok") : badge("Waiver missing", "warn")} ${(() => { const h = docStatus(s.id); return badge("Health cert: " + DOC_LABEL[h.status].toLowerCase(), DOC_TONE[h.status]); })()}</div>
    </div>
    <div class="actions col">
      ${s.status === "active" && paymentStatus(s) !== "paid" ? `<button class="btn btn-primary" data-paid="${s.id}">Mark paid · ${money(monthlyFee(s))}</button>` : ""}
      <button class="btn ${s.status === "active" && paymentStatus(s) !== "paid" ? "btn-ghost" : "btn-primary"}" data-checkin>Check in now</button>
      <button class="btn btn-ghost" data-edit>Edit</button>
    </div>
  </div>

  <div class="grid grid-3">
    <section class="card">
      <header class="card-head"><h2>Next promotion</h2></header>
      ${e.next ? `<p class="big">${esc(e.next)}</p>
        <p class="muted">${e.done} / ${e.needClasses} classes since last promotion</p>${progress(e.progress, e.eligible ? "ok" : "accent")}
        ${e.isBeltStep ? `<p class="muted small">${e.months} / ${e.minMonths} months at ${esc(s.belt)}</p>` : ""}
        <button class="btn ${e.eligible ? "btn-primary" : "btn-ghost"} mt" data-promote>${e.eligible ? "Promote" : "Promote anyway"}</button>` : `<p class="muted">Highest rank reached.</p>`}
    </section>
    <section class="card">
      <header class="card-head"><h2>Membership</h2></header>
      <p class="big">${esc(plan?.name || "No plan")}</p>
      <p class="muted">${plan ? `${money(plan.price)} / ${plan.interval}` : ""}</p>
      <dl class="dl"><dt>Email</dt><dd>${esc(s.email || "—")}</dd><dt>Phone</dt><dd>${esc(s.phone || "—")}</dd><dt>Location</dt><dd>${esc(s.location)}</dd></dl>
    </section>
    <section class="card">
      <header class="card-head"><h2>Training consistency</h2></header>
      <p class="big">${hist.length} <small class="muted">total classes</small></p>
      <div class="heat">${weeks.map((n) => `<span title="${n} classes" style="--l:${Math.min(1, n / 4)}"></span>`).join("")}</div>
      <p class="muted small">Last 12 weeks · last seen ${fmtDate(hist[0]?.date)}</p>
    </section>
  </div>

  <div class="grid grid-2">
    <section class="card flush">
      <header class="card-head pad"><h2>Attendance history</h2></header>
      ${hist.length ? `<table class="table"><tbody>${hist.slice(0, 15).map((a) => `<tr><td>${fmtDate(a.date)}</td><td>${esc(byId("classes", a.classId)?.name || "Class")}</td><td class="right"><button class="icon-btn" data-del-att="${a.id}" title="Remove">✕</button></td></tr>`).join("")}</tbody></table>` : empty("No classes yet.")}
    </section>
    <section class="card flush">
      <header class="card-head pad"><h2>Invoices</h2><a class="link" href="#/billing">Billing →</a></header>
      ${inv.length ? `<table class="table"><tbody>${inv.slice(0, 10).map((i) => `<tr><td>${fmtDate(i.date)}</td><td>${esc(i.description)}</td><td>${money(i.amount)}</td><td>${badge(i.status, i.status === "paid" ? "ok" : i.status === "due" ? "warn" : "danger")}</td></tr>`).join("")}</tbody></table>` : empty("No invoices.")}
    </section>
  </div>
  <section class="card flush">
    <header class="card-head pad"><h2>Documents</h2><button class="btn btn-sm btn-primary" data-doc-upload>+ Upload</button></header>
    ${docs.length ? `<table class="table"><tbody>${docs.map((x) => {
      const exp = x.expires && x.expires < today() ? badge("expired", "danger") : x.expires ? `<small>valid until ${fmtDate(x.expires)}</small>` : "<small>no expiry</small>";
      return `<tr class="clickable" data-doc="${x.id}"><td><b>${esc(x.type)}</b><small>${esc(x.name)} · ${fmtSize(x.size)}</small></td><td class="hide-sm">${fmtDate(x.uploaded)}</td><td class="right">${exp}</td></tr>`;
    }).join("")}</tbody></table>` : empty("No documents yet — upload a health certificate or waiver.")}
  </section>
  ${evs.length ? `<section class="card"><header class="card-head"><h2>Registered events</h2></header><ul class="list">${evs.map((ev) => `<li class="row"><span class="grow">${esc(ev.title)}</span>${fmtDate(ev.date)}</li>`).join("")}</ul></section>` : ""}
  ${s.notes ? `<section class="card"><header class="card-head"><h2>Notes</h2></header><p>${esc(s.notes)}</p></section>` : ""}`;
}

function downloadCSV() {
  const d = db();
  const head = ["First", "Last", "Email", "Phone", "Belt", "Stripes", "Status", "Plan", "Joined"];
  const rows = d.students.map((s) => [s.first, s.last, s.email, s.phone, s.belt, s.stripes, s.status, byId("plans", s.planId)?.name || "", s.joined]);
  const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "members.csv" });
  a.click(); URL.revokeObjectURL(a.href);
}

export default {
  title: "Members",
  render([id]) {
    if (id === "new") { setTimeout(() => { history.replaceState(null, "", "#/students"); openStudentForm(); }); return list(); }
    return id ? detail(id) : list();
  },
  mount(el, [id]) {
    if (id && id !== "new") {
      const s = byId("students", id);
      if (!s) return;
      $("[data-edit]", el).onclick = () => openStudentForm(s);
      $("[data-paid]", el) && ($("[data-paid]", el).onclick = () => payFlow(s));
      $("[data-doc-upload]", el).onclick = () => uploadDocument({ studentId: id });
      $$("[data-doc]", el).forEach((tr) => (tr.onclick = () => viewDocument(db().documents.find((x) => x.id === tr.dataset.doc))));
      $("[data-promote]", el) && ($("[data-promote]", el).onclick = () => { promote(id); toast(`${s.first} promoted! Oss 🥋`); });
      $("[data-checkin]", el).onclick = () => {
        const cls = classesOn(today());
        if (!cls.length) return toast("No classes today", "warn");
        modal({
          title: `Check in ${s.first}`, submit: "Check in",
          body: field("Class", "classId", cls[0].id, { options: cls.map((c) => [c.id, `${c.start} — ${c.name}`]) }),
          onSubmit: ({ classId }) => toast(checkIn(id, classId) ? "Checked in" : "Already checked in", "ok"),
        });
      };
      $$("[data-del-att]", el).forEach((b) => (b.onclick = () => update((d) => (d.attendance = d.attendance.filter((a) => a.id !== b.dataset.delAtt)))));
      return;
    }
    $("[data-new]", el).onclick = () => openStudentForm();
    $("[data-export]", el).onclick = downloadCSV;
    $("[data-status]", el).onchange = (e) => { filter.status = e.target.value; this.refresh(el); };
    $$("[data-pay]", el).forEach((b) => (b.onclick = () => { filter.pay = b.dataset.pay; this.refresh(el); }));
    $$("[data-group]", el).forEach((b) => (b.onclick = () => { filter.group = b.dataset.group; this.refresh(el); }));
    $("[data-edit-price]", el) && ($("[data-edit-price]", el).onclick = () => editPrice(db().groups.find((g) => g.id === filter.group)));
    const q = $("[data-q]", el);
    q.oninput = () => { filter.q = q.value; this.refresh(el, true); };
    $$("[data-paid]", el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); payFlow(byId("students", b.dataset.paid)); }));
    $$("tr[data-href]", el).forEach((tr) => (tr.onclick = () => (location.hash = tr.dataset.href)));
  },
  refresh(el, keepFocus) {
    el.innerHTML = list();
    this.mount(el, []);
    if (keepFocus) { const q = $("[data-q]", el); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  },
};
