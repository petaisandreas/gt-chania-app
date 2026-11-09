import { db, update, uid, today, fullName, byId, money } from "../store.js";
import { esc, $, $$, badge, fmtDate, modal, field, toast } from "../ui.js";

let cart = [];
let tab = "pos";

function productForm(p) {
  const isNew = !p;
  modal({
    title: isNew ? "New product" : p.name,
    body: `<div class="form-grid">
      ${field("Name", "name", p?.name, { required: true, span: 2 })}
      ${field("SKU", "sku", p?.sku)}
      ${field("Category", "category", p?.category || "Apparel", { options: ["Gis", "Apparel", "Accessories", "Nutrition", "Other"] })}
      ${field("Price", "price", p?.price ?? 20, { type: "number", min: 0, step: "0.01" })}
      ${field("In stock", "stock", p?.stock ?? 10, { type: "number", min: 0 })}
      ${field("Low-stock alert at", "lowAt", p?.lowAt ?? 5, { type: "number", min: 0 })}
    </div>`,
    danger: isNew ? null : { label: "Delete", action: () => update((d) => (d.products = d.products.filter((x) => x.id !== p.id))) },
    onSubmit(v) {
      update((d) => (isNew ? d.products.push({ id: uid("pr"), ...v }) : Object.assign(d.products.find((x) => x.id === p.id), v)));
      toast("Product saved");
    },
  });
}

/** A scannable QR-like tile. Decorative: encodes the SKU deterministically into a grid pattern. */
function qr(text) {
  let h = 2166136261;
  const cells = [];
  for (let i = 0; i < 121; i++) { h ^= text.charCodeAt(i % text.length) + i; h = Math.imul(h, 16777619); cells.push((h >>> 7) & 1); }
  const finder = (x, y) => (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
  const rects = cells.map((c, i) => { const x = i % 11, y = Math.floor(i / 11); return (finder(x, y) || c) ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ""; }).join("");
  return `<svg viewBox="-1 -1 13 13" class="qr" aria-label="Code for ${esc(text)}"><rect x="-1" y="-1" width="13" height="13" fill="#fff"/><g fill="#16181c">${rects}</g></svg>`;
}

function render() {
  const d = db();
  const cartTotal = cart.reduce((a, c) => a + byId("products", c.id).price * c.qty, 0);
  const month = today().slice(0, 7);
  const monthSales = d.sales.filter((s) => s.date.startsWith(month));
  const low = d.products.filter((p) => p.stock <= p.lowAt);

  const body = tab === "pos" ? `
    <div class="grid grid-2-1">
      <div class="products">${d.products.map((p) => `<button class="product" data-add="${p.id}" ${p.stock ? "" : "disabled"}>
        <span class="eyebrow">${esc(p.category)}</span><b>${esc(p.name)}</b><span class="price">${money(p.price)}</span>
        <small class="${p.stock <= p.lowAt ? "warn-text" : "muted"}">${p.stock} in stock</small></button>`).join("")}</div>
      <aside class="card cart">
        <header class="card-head"><h2>Sale</h2>${cart.length ? `<button class="link" data-clear>Clear</button>` : ""}</header>
        ${cart.length ? `<ul class="list">${cart.map((c) => { const p = byId("products", c.id); return `<li class="row"><span class="grow">${esc(p.name)}<small>${money(p.price)} each</small></span>
          <span class="qty"><button data-dec="${c.id}">−</button>${c.qty}<button data-inc="${c.id}">+</button></span><b>${money(p.price * c.qty)}</b></li>`; }).join("")}</ul>` : `<p class="muted">Tap products to add them.</p>`}
        <div class="cart-total"><span>Total</span><b>${money(cartTotal)}</b></div>
        <label class="field"><span>Member (optional)</span><select data-buyer><option value="">Walk-in customer</option>${d.students.filter((s) => s.status === "active").sort((a, b) => a.first.localeCompare(b.first)).map((s) => `<option value="${s.id}">${esc(fullName(s))}</option>`).join("")}</select></label>
        <div class="seg full">${["Card", "Cash", "QR", "Charge account"].map((m, i) => `<button data-method="${m}" class="${i === 0 ? "on" : ""}">${m}</button>`).join("")}</div>
        <button class="btn btn-primary full mt" data-checkout ${cart.length ? "" : "disabled"}>Complete sale</button>
      </aside>
    </div>`
  : tab === "inventory" ? `
    <div class="toolbar"><span class="grow"></span><button class="btn btn-primary" data-new>+ Product</button></div>
    <div class="card flush"><table class="table"><thead><tr><th>Product</th><th class="hide-sm">SKU</th><th>Price</th><th>Stock</th><th class="hide-sm">Code</th><th></th></tr></thead><tbody>
    ${d.products.map((p) => `<tr><td><b>${esc(p.name)}</b><small class="muted block">${esc(p.category)}</small></td><td class="hide-sm">${esc(p.sku)}</td><td>${money(p.price)}</td>
      <td>${p.stock} ${p.stock <= p.lowAt ? badge("low", "danger") : ""}</td><td class="hide-sm">${qr(p.sku || p.id)}</td>
      <td class="right"><button class="btn btn-sm btn-ghost" data-restock="${p.id}">+10</button> <button class="btn btn-sm btn-ghost" data-edit="${p.id}">Edit</button></td></tr>`).join("")}
    </tbody></table></div>`
  : `<div class="card flush"><table class="table"><thead><tr><th>Date</th><th>Item</th><th>Qty</th><th class="hide-sm">Customer</th><th class="hide-sm">Method</th><th>Total</th></tr></thead><tbody>
    ${[...d.sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80).map((s) => `<tr><td>${fmtDate(s.date)}</td><td>${esc(byId("products", s.productId)?.name || "Removed product")}</td><td>${s.qty}</td>
      <td class="hide-sm">${s.studentId ? esc(fullName(byId("students", s.studentId))) : "Walk-in"}</td><td class="hide-sm">${esc(s.method)}</td><td>${money(s.total)}</td></tr>`).join("")}
    </tbody></table></div>`;

  return `
  <div class="page-head"><div><p class="eyebrow">Business</p><h1>Pro Shop</h1></div></div>
  <section class="kpis kpis-3">
    <div class="kpi"><span>Sales this month</span><strong>${money(monthSales.reduce((a, s) => a + s.total, 0))}</strong><small>${monthSales.length} transactions</small></div>
    <div class="kpi"><span>Inventory value</span><strong>${money(d.products.reduce((a, p) => a + p.price * p.stock, 0))}</strong><small>${d.products.reduce((a, p) => a + p.stock, 0)} units</small></div>
    <div class="kpi"><span>Low stock</span><strong>${low.length}</strong><small>${low.map((p) => esc(p.name)).slice(0, 2).join(", ") || "All good"}</small></div>
  </section>
  <nav class="tabs">${[["pos", "Point of sale"], ["inventory", "Inventory"], ["history", "Sales history"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</nav>
  ${body}`;
}

export default {
  title: "Pro Shop",
  render,
  mount(el) {
    const again = () => { el.innerHTML = render(); this.mount(el); };
    const on = (sel, fn) => $$(sel, el).forEach((b) => (b.onclick = () => fn(b)));
    let method = "Card";
    on("[data-tab]", (b) => { tab = b.dataset.tab; again(); });
    on("[data-add]", (b) => {
      const p = byId("products", b.dataset.add), c = cart.find((x) => x.id === p.id);
      if (c) c.qty = Math.min(p.stock, c.qty + 1); else cart.push({ id: p.id, qty: 1 });
      again();
    });
    on("[data-inc]", (b) => { const c = cart.find((x) => x.id === b.dataset.inc); c.qty = Math.min(byId("products", c.id).stock, c.qty + 1); again(); });
    on("[data-dec]", (b) => { const c = cart.find((x) => x.id === b.dataset.dec); c.qty--; cart = cart.filter((x) => x.qty > 0); again(); });
    on("[data-clear]", () => { cart = []; again(); });
    on("[data-method]", (b) => { method = b.dataset.method; $$("[data-method]", el).forEach((x) => x.classList.toggle("on", x === b)); });
    on("[data-checkout]", () => {
      const studentId = $("[data-buyer]", el).value || null;
      if (method === "Charge account" && !studentId) return toast("Pick a member to charge their account", "warn");
      const total = cart.reduce((a, c) => a + byId("products", c.id).price * c.qty, 0);
      update((d) => {
        for (const c of cart) {
          const p = d.products.find((x) => x.id === c.id);
          p.stock -= c.qty;
          d.sales.push({ id: uid("sl"), productId: p.id, qty: c.qty, total: p.price * c.qty, studentId, date: today(), method });
        }
        if (method === "Charge account") d.invoices.push({ id: uid("inv"), studentId, amount: total, date: today(), due: today(), description: "Pro shop purchase", status: "due" });
      });
      cart = [];
      toast(`Sale complete — ${money(total)}`);
    });
    on("[data-new]", () => productForm());
    on("[data-edit]", (b) => productForm(byId("products", b.dataset.edit)));
    on("[data-restock]", (b) => update((d) => (d.products.find((p) => p.id === b.dataset.restock).stock += 10)));
  },
};
