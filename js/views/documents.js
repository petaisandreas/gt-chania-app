import { db, fullName, byId, docStatus, REQUIRED_DOCS, DOC_TYPES } from "../store.js";
import { esc, $, $$, badge, fmtDate, avatar, empty } from "../ui.js";
import { uploadDocument, viewDocument, DOC_TONE, DOC_LABEL } from "../docs-ui.js";
import { fmtSize } from "../files.js";

let tab = "compliance";
let statusFilter = "attention";
let typeFilter = "";
let q = "";

function render() {
  const d = db();
  const active = d.students.filter((s) => s.status === "active");
  const req = REQUIRED_DOCS[0];
  const rows = active.map((s) => ({ s, ...docStatus(s.id, req) }));
  const count = (st) => rows.filter((r) => r.status === st).length;
  const ql = q.toLowerCase();

  const shown = rows.filter((r) =>
    (statusFilter === "all" || (statusFilter === "attention" ? r.status !== "valid" : r.status === statusFilter)) &&
    (!ql || fullName(r.s).toLowerCase().includes(ql))
  ).sort((a, b) => ["expired", "none", "expiring", "valid"].indexOf(a.status) - ["expired", "none", "expiring", "valid"].indexOf(b.status) || (a.doc?.expires || "").localeCompare(b.doc?.expires || ""));

  const docs = d.documents.filter((x) => (!typeFilter || x.type === typeFilter) && (!ql || fullName(byId("students", x.studentId)).toLowerCase().includes(ql) || x.name.toLowerCase().includes(ql)))
    .sort((a, b) => b.uploaded.localeCompare(a.uploaded));

  const body = tab === "compliance" ? `
    <div class="toolbar">
      <div class="seg">${[["attention", "Needs action", count("expired") + count("none") + count("expiring")], ["expired", "Expired", count("expired")], ["expiring", "Expiring", count("expiring")], ["none", "Missing", count("none")], ["valid", "Valid", count("valid")], ["all", "All", rows.length]]
        .map(([k, l, n]) => `<button data-sf="${k}" class="${statusFilter === k ? "on" : ""}">${l} <small>${n}</small></button>`).join("")}</div>
      <input class="input" type="search" placeholder="Search members…" value="${esc(q)}" data-q />
    </div>
    <div class="card flush">${shown.length ? `<table class="table"><thead><tr><th>Member</th><th>${esc(req)}</th><th class="hide-sm">Valid until</th><th></th></tr></thead><tbody>
      ${shown.map(({ s, status, doc }) => `<tr>
        <td><a class="who" href="#/students/${s.id}">${avatar(fullName(s))}<span><b>${esc(fullName(s))}</b><small>${esc(s.phone)}</small></span></a></td>
        <td>${badge(DOC_LABEL[status], DOC_TONE[status])}</td>
        <td class="hide-sm">${doc?.expires ? fmtDate(doc.expires) : "—"}</td>
        <td class="right">${doc ? `<button class="btn btn-sm btn-ghost" data-view="${doc.id}">View</button> ` : ""}<button class="btn btn-sm ${status === "valid" ? "btn-ghost" : "btn-primary"}" data-upload="${s.id}">${status === "none" ? "Upload" : "Renew"}</button></td></tr>`).join("")}
      </tbody></table>` : empty("Everyone's paperwork is in order. 🎉")}</div>`
  : `
    <div class="toolbar">
      <select class="input" data-type><option value="">All types</option>${DOC_TYPES.map((t) => `<option ${typeFilter === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <input class="input" type="search" placeholder="Search name or file…" value="${esc(q)}" data-q />
    </div>
    <div class="card flush">${docs.length ? `<table class="table"><thead><tr><th>Document</th><th>Member</th><th class="hide-sm">Uploaded</th><th class="hide-sm">Expires</th><th class="hide-sm">Size</th></tr></thead><tbody>
      ${docs.map((x) => `<tr data-view="${x.id}" class="clickable"><td><b>${esc(x.type)}</b><small>${esc(x.name)}${x.by === "member" ? " · uploaded by member" : ""}</small></td>
        <td>${esc(fullName(byId("students", x.studentId)))}</td><td class="hide-sm">${fmtDate(x.uploaded)}</td>
        <td class="hide-sm">${x.expires ? fmtDate(x.expires) : "—"}</td><td class="hide-sm">${fmtSize(x.size)}</td></tr>`).join("")}
      </tbody></table>` : empty("No documents match.")}</div>`;

  return `
  <div class="page-head">
    <div><p class="eyebrow">Academy</p><h1>Documents</h1><p class="muted">Health certificates, waivers and other paperwork for every member.</p></div>
    <div class="actions"><button class="btn btn-primary" data-new>+ Upload document</button></div>
  </div>
  <section class="kpis">
    <div class="kpi"><span>Valid ${esc(req.toLowerCase())}s</span><strong>${count("valid")}</strong><small>of ${rows.length} active members</small></div>
    <div class="kpi"><span>Expiring in 30 days</span><strong>${count("expiring")}</strong></div>
    <div class="kpi"><span>Expired</span><strong>${count("expired")}</strong></div>
    <div class="kpi"><span>Missing</span><strong>${count("none")}</strong></div>
  </section>
  <nav class="tabs">${[["compliance", "Health certificates"], ["all", "All documents"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</nav>
  ${body}`;
}

export default {
  title: "Documents",
  render,
  mount(el) {
    const again = (focus) => { el.innerHTML = render(); this.mount(el); if (focus) { const i = $("[data-q]", el); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
    const on = (sel, fn) => $$(sel, el).forEach((b) => (b.onclick = () => fn(b)));
    on("[data-tab]", (b) => { tab = b.dataset.tab; again(); });
    on("[data-sf]", (b) => { statusFilter = b.dataset.sf; again(); });
    on("[data-new]", () => uploadDocument());
    on("[data-upload]", (b) => uploadDocument({ studentId: b.dataset.upload }));
    on("[data-view]", (b) => viewDocument(db().documents.find((x) => x.id === b.dataset.view)));
    const qi = $("[data-q]", el);
    qi.oninput = () => { q = qi.value; again(true); };
    const t = $("[data-type]", el);
    if (t) t.onchange = () => { typeFilter = t.value; again(); };
  },
};
