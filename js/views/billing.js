import { db, update, uid, today, iso, addDays, fullName, byId, money } from "../store.js";
import { esc, $$, badge, fmtDate, modal, field, toast, empty } from "../ui.js";

let tab = "invoices";
let statusFilter = "";
const TONE = { paid: "ok", due: "warn", failed: "danger" };

function invoiceForm() {
  const d = db();
  modal({
    title: "New invoice",
    submit: "Create invoice",
    body: `<div class="form-grid">
      ${field("Member", "studentId", "", { options: d.students.filter((s) => s.status !== "cancelled").sort((a, b) => a.first.localeCompare(b.first)).map((s) => [s.id, fullName(s)]), span: 2 })}
      ${field("Description", "description", "Private lesson", { required: true, span: 2 })}
      ${field("Amount", "amount", 80, { type: "number", min: 0, step: "0.01", required: true })}
      ${field("Due date", "due", iso(addDays(new Date(), 7)), { type: "date" })}
    </div>`,
    onSubmit(v) {
      update((d) => d.invoices.push({ id: uid("inv"), date: today(), status: "due", ...v }));
      toast("Invoice created");
    },
  });
}

function planForm(p) {
  const isNew = !p;
  modal({
    title: isNew ? "New membership plan" : "Edit plan",
    body: `<div class="form-grid">
      ${field("Plan name", "name", p?.name, { required: true, span: 2 })}
      ${field("Price", "price", p?.price ?? 150, { type: "number", min: 0, step: "0.01" })}
      ${field("Billing", "interval", p?.interval || "month", { options: [["month", "Monthly"], ["year", "Yearly"], ["pack", "Class pack"]] })}
    </div>`,
    danger: isNew ? null : { label: "Delete plan", action: () => update((d) => (d.plans = d.plans.filter((x) => x.id !== p.id))) },
    onSubmit(v) {
      update((d) => (isNew ? d.plans.push({ id: uid("pl"), ...v }) : Object.assign(d.plans.find((x) => x.id === p.id), v)));
      toast("Plan saved");
    },
  });
}

function expenseForm() {
  modal({
    title: "Log expense",
    body: `<div class="form-grid">
      ${field("Category", "category", "Equipment", { options: ["Rent", "Utilities", "Equipment", "Marketing", "Cleaning", "Insurance", "Software", "Other"] })}
      ${field("Amount", "amount", "", { type: "number", min: 0, step: "0.01", required: true })}
      ${field("Date", "date", today(), { type: "date" })}
      ${field("Note", "note", "")}
    </div>`,
    onSubmit(v) { update((d) => d.expenses.push({ id: uid("ex"), ...v })); toast("Expense logged"); },
  });
}

/** Creates this month's invoice for every active recurring member who doesn't have one yet. */
function runBilling() {
  const month = today().slice(0, 7);
  let created = 0;
  update((d) => {
    for (const s of d.students.filter((s) => s.status === "active")) {
      const p = d.plans.find((x) => x.id === s.planId);
      if (!p || p.interval !== "month") continue;
      if (d.invoices.some((i) => i.studentId === s.id && i.date.startsWith(month) && i.description === p.name)) continue;
      d.invoices.push({ id: uid("inv"), studentId: s.id, amount: p.price, date: today(), due: iso(addDays(new Date(), 7)), description: p.name, status: "due" });
      created++;
    }
  });
  toast(created ? `Created ${created} invoices for ${month}` : "Everyone is already billed this month");
}

function render() {
  const d = db();
  const month = today().slice(0, 7);
  const thisMonth = d.invoices.filter((i) => i.date.startsWith(month));
  const paid = thisMonth.filter((i) => i.status === "paid").reduce((a, i) => a + i.amount, 0);
  const due = d.invoices.filter((i) => i.status === "due").reduce((a, i) => a + i.amount, 0);
  const failed = d.invoices.filter((i) => i.status === "failed");
  const exp = d.expenses.filter((e) => e.date.startsWith(month)).reduce((a, e) => a + e.amount, 0);

  const invoices = d.invoices.filter((i) => !statusFilter || i.status === statusFilter).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 120);

  const body = {
    invoices: `<div class="toolbar"><div class="seg">${["", "due", "failed", "paid"].map((s) => `<button data-sf="${s}" class="${statusFilter === s ? "on" : ""}">${s || "All"}</button>`).join("")}</div>
      <span class="grow"></span><button class="btn btn-ghost" data-retry ${failed.length ? "" : "disabled"}>Retry ${failed.length} failed</button></div>
      <div class="card flush">${invoices.length ? `<table class="table"><thead><tr><th>Date</th><th>Member</th><th class="hide-sm">Description</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
      ${invoices.map((i) => `<tr><td>${fmtDate(i.date)}</td><td><a href="#/students/${i.studentId}">${esc(fullName(byId("students", i.studentId)))}</a></td><td class="hide-sm">${esc(i.description)}</td><td>${money(i.amount)}</td><td>${badge(i.status, TONE[i.status])}</td>
        <td class="right">${i.status !== "paid" ? `<button class="btn btn-sm" data-pay="${i.id}">Mark paid</button>` : `<button class="btn btn-sm btn-ghost" data-refund="${i.id}">Refund</button>`}</td></tr>`).join("")}
      </tbody></table>` : empty("No invoices.")}</div>`,
    plans: `<div class="toolbar"><span class="grow"></span><button class="btn btn-primary" data-new-plan>+ New plan</button></div>
      <div class="grid grid-3">${d.plans.map((p) => {
        const n = d.students.filter((s) => s.planId === p.id && s.status === "active").length;
        return `<button class="card plan-card" data-plan="${p.id}"><span class="eyebrow">${p.interval === "pack" ? "Class pack" : p.interval === "year" ? "Yearly" : "Monthly"}</span><h3>${esc(p.name)}</h3><p class="big">${money(p.price)}</p><p class="muted">${n} active member${n === 1 ? "" : "s"}</p></button>`;
      }).join("")}</div>`,
    expenses: `<div class="toolbar"><span class="grow"></span><button class="btn btn-primary" data-new-exp>+ Log expense</button></div>
      <div class="card flush"><table class="table"><thead><tr><th>Date</th><th>Category</th><th class="hide-sm">Note</th><th>Amount</th><th></th></tr></thead><tbody>
      ${[...d.expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.category)}</td><td class="hide-sm">${esc(e.note)}</td><td>${money(e.amount)}</td><td class="right"><button class="icon-btn" data-del-exp="${e.id}">✕</button></td></tr>`).join("")}
      </tbody></table></div>`,
  }[tab];

  return `
  <div class="page-head">
    <div><p class="eyebrow">Business</p><h1>Billing</h1></div>
    <div class="actions"><button class="btn btn-ghost" data-run>Run monthly billing</button><button class="btn btn-primary" data-new-inv>+ Invoice</button></div>
  </div>
  <section class="kpis">
    <div class="kpi"><span>Collected this month</span><strong>${money(paid)}</strong><small>${thisMonth.filter((i) => i.status === "paid").length} payments</small></div>
    <div class="kpi"><span>Outstanding</span><strong>${money(due)}</strong><small>${d.invoices.filter((i) => i.status === "due").length} open invoices</small></div>
    <div class="kpi"><span>Failed payments</span><strong>${failed.length}</strong><small>${money(failed.reduce((a, i) => a + i.amount, 0))} at risk</small></div>
    <div class="kpi"><span>Net this month</span><strong>${money(paid - exp)}</strong><small>${money(exp)} expenses</small></div>
  </section>
  <nav class="tabs">${[["invoices", "Invoices"], ["plans", "Membership plans"], ["expenses", "Expenses"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</nav>
  ${body}`;
}

export default {
  title: "Billing",
  render,
  mount(el) {
    const on = (sel, fn) => $$(sel, el).forEach((b) => (b.onclick = () => fn(b)));
    on("[data-tab]", (b) => { tab = b.dataset.tab; el.innerHTML = render(); this.mount(el); });
    on("[data-sf]", (b) => { statusFilter = b.dataset.sf; el.innerHTML = render(); this.mount(el); });
    on("[data-run]", runBilling);
    on("[data-new-inv]", invoiceForm);
    on("[data-new-plan]", () => planForm());
    on("[data-plan]", (b) => planForm(byId("plans", b.dataset.plan)));
    on("[data-new-exp]", expenseForm);
    on("[data-del-exp]", (b) => update((d) => (d.expenses = d.expenses.filter((e) => e.id !== b.dataset.delExp))));
    on("[data-pay]", (b) => { update((d) => (d.invoices.find((i) => i.id === b.dataset.pay).status = "paid")); toast("Payment recorded"); });
    on("[data-refund]", (b) => { if (confirm("Mark this invoice as refunded (due again)?")) update((d) => (d.invoices.find((i) => i.id === b.dataset.refund).status = "due")); });
    on("[data-retry]", () => {
      let ok = 0;
      update((d) => d.invoices.filter((i) => i.status === "failed").forEach((i) => { if (Math.random() < 0.6) { i.status = "paid"; ok++; } }));
      toast(`Retried — ${ok} recovered`, ok ? "ok" : "warn");
    });
  },
};
