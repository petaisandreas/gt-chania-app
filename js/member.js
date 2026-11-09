// Member portal: students sign in with email + PIN to book classes, track belt progress, pay invoices and shop.
import { db, update, subscribe, uid, today, iso, addDays, byId, money, eligibility, classesOn, DAYS, docStatus, client, KEYS } from "./store.js";
import { uploadDocument, viewDocument, DOC_LABEL } from "./docs-ui.js";
import { esc, $, $$, beltChip, badge, fmtDate, fmtTime, progress, toast, empty } from "./ui.js";

const SESSION = KEYS.member;
const TABS = [["home", "Home", "⌂"], ["classes", "Classes", "▦"], ["progress", "Progress", "▬"], ["pay", "Billing", "$"], ["shop", "Shop", "▣"]];
let tab = "home";
let shopCat = "";

const root = $("#root");
const getSession = () => { try { return localStorage.getItem(SESSION); } catch { return null; } };
const setSession = (id) => { try { id ? localStorage.setItem(SESSION, id) : localStorage.removeItem(SESSION); } catch {} };
const me = () => byId("students", getSession());

// --- login ----------------------------------------------------------------------
function login() {
  const demo = db().students.find((s) => s.status === "active" && !s.kid && s.waiver);
  return `<div class="m-login">
    <div class="brand"><img src="assets/logo.png" alt="" width="44" height="44" /><span>${esc(client.wordmark.main)}<b>${esc(client.wordmark.accent)}</b></span></div>
    <h1>Member sign in</h1>
    <p class="muted">${esc(db().academy.name)}</p>
    <form id="login" class="m-card" novalidate>
      <label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" required /></label>
      <label class="field"><span>4-digit PIN</span><input name="pin" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" autocomplete="current-password" required /></label>
      <button class="btn btn-primary btn-lg full">Sign in</button>
      <p class="m-error" id="login-err" hidden>Email and PIN don't match an active membership.</p>
    </form>
    ${demo ? `<p class="m-hint">Demo account: <b>${esc(demo.email)}</b> · PIN <b>${esc(demo.pin)}</b><br/><button class="link" data-demo>Fill it in for me</button></p>` : ""}
    <a class="link" href="index.html">← Back to site</a>
  </div>`;
}

function mountLogin() {
  const f = $("#login");
  $("[data-demo]")?.addEventListener("click", () => {
    const demo = db().students.find((s) => s.status === "active" && !s.kid && s.waiver);
    f.email.value = demo.email; f.pin.value = demo.pin;
  });
  f.onsubmit = (e) => {
    e.preventDefault();
    if (!f.checkValidity()) return f.reportValidity();
    const s = db().students.find((x) => x.email.toLowerCase() === f.email.value.trim().toLowerCase() && x.pin === f.pin.value && x.status !== "cancelled");
    if (!s) { $("#login-err").hidden = false; return; }
    setSession(s.id); tab = "home"; render();
  };
}

// --- helpers --------------------------------------------------------------------
function myClasses(s) {
  return (c) => (c.level === "Kids") === s.kid;
}
function upcoming(s, days = 7) {
  const out = [];
  const now = new Date().toTimeString().slice(0, 5);
  for (let i = 0; i < days; i++) {
    const date = iso(addDays(new Date(), i));
    for (const c of classesOn(date).filter(myClasses(s))) {
      if (i === 0 && c.start <= now) continue;
      out.push({ c, date });
    }
  }
  return out;
}
const isBooked = (sid, cid, date) => db().bookings.some((b) => b.studentId === sid && b.classId === cid && b.date === date);
const bookedCount = (cid, date) => db().bookings.filter((b) => b.classId === cid && b.date === date).length;
function streakWeeks(sid) {
  const dates = new Set(db().attendance.filter((a) => a.studentId === sid).map((a) => a.date));
  let n = 0;
  for (let w = 0; w < 52; w++) {
    let hit = false;
    for (let d = 0; d < 7; d++) if (dates.has(iso(addDays(new Date(), -(w * 7 + d))))) { hit = true; break; }
    if (!hit) { if (w === 0) continue; break; }
    n++;
  }
  return n;
}

// --- tabs -----------------------------------------------------------------------
function home(s) {
  const d = db();
  const e = eligibility(s);
  const mine = d.bookings.filter((b) => b.studentId === s.id && b.date >= today()).sort((a, b) => (a.date + byId("classes", a.classId)?.start).localeCompare(b.date + byId("classes", b.classId)?.start));
  const next = mine[0];
  const month = today().slice(0, 7);
  const thisMonth = d.attendance.filter((a) => a.studentId === s.id && a.date.startsWith(month)).length;
  const owed = d.invoices.filter((i) => i.studentId === s.id && i.status !== "paid");
  const evs = d.events.filter((ev) => ev.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
  return `
  <section class="m-hero">
    <p class="eyebrow">Oss,</p><h1>${esc(s.first)}</h1>
    <div class="m-belt">${beltChip(s.belt, s.stripes)}<span><b>${esc(s.belt)} belt</b> · ${s.stripes} stripe${s.stripes === 1 ? "" : "s"}</span></div>
    ${e.next ? `<div class="m-next"><div class="row"><span class="grow">Next: <b>${esc(e.next)}</b></span><b>${e.done}/${e.needClasses}</b></div>${progress(e.progress, e.eligible ? "ok" : "accent")}
      <small>${e.eligible ? "You've hit the requirements — your coach will be in touch 🥋" : `${Math.max(0, e.needClasses - e.done)} more classes to go${e.isBeltStep ? ` · ${e.months}/${e.minMonths} months at belt` : ""}`}</small></div>` : `<p>Black belt. Respect. 🙏</p>`}
  </section>
  ${owed.length ? `<button class="m-alert" data-go="pay"><b>${owed.length} unpaid invoice${owed.length > 1 ? "s" : ""}</b><span>${money(owed.reduce((a, i) => a + i.amount, 0))} · Tap to pay</span></button>` : ""}
  ${(() => { const h = docStatus(s.id); return h.status === "valid" ? "" : `<button class="m-alert ${h.status === "expiring" ? "warn" : ""}" data-upload-hc><b>Health certificate ${DOC_LABEL[h.status].toLowerCase()}</b><span>${h.doc?.expires ? (h.status === "expired" ? "Expired " : "Expires ") + fmtDate(h.doc.expires) + " · " : ""}Tap to upload a new one</span></button>`; })()}
  ${s.waiver ? "" : `<div class="m-alert warn"><b>Waiver needed</b><span>Please sign at the front desk before your next class.</span></div>`}
  <div class="m-stats">
    <div><strong>${thisMonth}</strong><span>classes this month</span></div>
    <div><strong>${streakWeeks(s.id)}</strong><span>week streak</span></div>
    <div><strong>${d.attendance.filter((a) => a.studentId === s.id).length}</strong><span>total classes</span></div>
  </div>
  <h2 class="m-title">Your next class</h2>
  ${next ? (() => { const c = byId("classes", next.classId); return `<div class="m-card m-class"><div class="date-tile"><b>${new Date(next.date + "T12:00").getDate()}</b>${DAYS[new Date(next.date + "T12:00").getDay()]}</div>
    <div class="grow"><b>${esc(c.name)}</b><small>${fmtTime(c.start)} · ${esc(byId("staff", c.instructorId)?.name || "")}</small></div>
    <button class="btn btn-sm btn-ghost" data-cancel="${next.id}">Cancel</button></div>`; })()
    : `<button class="m-card m-empty" data-go="classes">No classes booked — <b>find a class →</b></button>`}
  ${evs.length ? `<h2 class="m-title">Events</h2>${evs.map((ev) => {
    const reg = ev.registrations.includes(s.id), full = ev.registrations.length >= ev.capacity;
    return `<div class="m-card m-class"><div class="date-tile"><b>${new Date(ev.date + "T12:00").getDate()}</b>${new Date(ev.date + "T12:00").toLocaleString("en-US", { month: "short" })}</div>
      <div class="grow"><b>${esc(ev.title)}</b><small>${esc(ev.type)} · ${ev.price ? money(ev.price) : "Free"} · ${ev.capacity - ev.registrations.length} spots left</small></div>
      ${reg ? `<button class="btn btn-sm btn-ghost" data-unreg="${ev.id}">Registered ✓</button>` : `<button class="btn btn-sm btn-primary" data-reg="${ev.id}" ${full ? "disabled" : ""}>${full ? "Full" : "Join"}</button>`}</div>`;
  }).join("")}` : ""}`;
}

function classes(s) {
  const list = upcoming(s);
  const byDate = {};
  list.forEach((x) => (byDate[x.date] ||= []).push(x));
  return `<h1 class="m-h1">Book a class</h1><p class="muted">Next 7 days · reserve your spot on the mat</p>
  ${Object.keys(byDate).length ? Object.entries(byDate).map(([date, items]) => `
    <h2 class="m-title">${date === today() ? "Today" : date === iso(addDays(new Date(), 1)) ? "Tomorrow" : fmtDate(date, { weekday: "long", month: "short", day: "numeric" })}</h2>
    ${items.map(({ c, date }) => {
      const booked = isBooked(s.id, c.id, date), n = bookedCount(c.id, date), full = n >= c.capacity;
      return `<div class="m-card m-class"><span class="time">${fmtTime(c.start)}</span>
        <div class="grow"><b>${esc(c.name)}</b><small>${esc(c.level)} · ${esc(byId("staff", c.instructorId)?.name.split(" ")[0] || "")} · ${c.duration} min</small><small>${c.capacity - n} of ${c.capacity} spots left</small></div>
        ${booked ? `<button class="btn btn-sm m-booked" data-unbook="${c.id}|${date}">Booked ✓</button>` : `<button class="btn btn-sm btn-primary" data-book="${c.id}|${date}" ${full ? "disabled" : ""}>${full ? "Full" : "Book"}</button>`}</div>`;
    }).join("")}`).join("") : empty("No classes in the next 7 days.")}`;
}

function progressTab(s) {
  const d = db();
  const hist = d.attendance.filter((a) => a.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const weeks = Array.from({ length: 16 }, (_, w) => {
    const end = addDays(new Date(), -w * 7), start = addDays(end, -7);
    return hist.filter((a) => a.date > iso(start) && a.date <= iso(end)).length;
  }).reverse();
  const techs = d.techniques.filter((t) => t.belt === (s.kid ? "White" : s.belt));
  const e = eligibility(s);
  return `<h1 class="m-h1">My progress</h1>
  <div class="m-card">
    <div class="row">${beltChip(s.belt, s.stripes)}<b class="grow">${esc(s.belt)} · ${s.stripes} stripe${s.stripes === 1 ? "" : "s"}</b><small class="muted">since ${fmtDate(s.beltSince, { month: "short", year: "numeric" })}</small></div>
    ${e.next ? `${progress(e.progress, e.eligible ? "ok" : "accent")}<small class="muted">${e.done} of ${e.needClasses} classes toward ${esc(e.next)}</small>` : ""}
  </div>
  <h2 class="m-title">Last 16 weeks</h2>
  <div class="m-card"><div class="heat m-heat">${weeks.map((n) => `<span title="${n} classes" style="--l:${Math.min(1, n / 4)}"></span>`).join("")}</div>
    <small class="muted">Each square is a week. Darker = more mat time.</small></div>
  <h2 class="m-title">${esc(s.kid ? "White" : s.belt)} belt curriculum</h2>
  ${techs.length ? `<div class="m-card flush"><ul class="list m-list">${techs.map((t) => `<li class="row"><span class="grow">${esc(t.name)}<small>${esc(t.category)}</small></span>${t.video ? `<a class="btn btn-sm btn-ghost" href="${esc(t.video)}" target="_blank" rel="noopener">▶ Video</a>` : ""}</li>`).join("")}</ul></div>` : empty("Your coach hasn't added techniques for this belt yet.")}
  <h2 class="m-title">My documents</h2>
  <div class="m-card flush"><ul class="list m-list">${d.documents.filter((x) => x.studentId === s.id).map((x) => `<li class="row"><button class="row-link" data-doc="${x.id}"><span class="grow">${esc(x.type)}<small>${x.expires ? (x.expires < today() ? "Expired " : "Valid until ") + fmtDate(x.expires) : "No expiry"}</small></span><span class="muted">View</span></button></li>`).join("") || `<li class="row muted">No documents on file</li>`}</ul></div>
  <button class="btn btn-ghost full" data-upload-doc>+ Upload a document</button>
  <h2 class="m-title">Recent classes</h2>
  ${hist.length ? `<div class="m-card flush"><ul class="list m-list">${hist.slice(0, 12).map((a) => `<li class="row"><span class="grow">${esc(byId("classes", a.classId)?.name || "Class")}</span><small class="muted">${fmtDate(a.date, { month: "short", day: "numeric" })}</small></li>`).join("")}</ul></div>` : empty("No classes yet — time to hit the mats!")}`;
}

function pay(s) {
  const d = db();
  const plan = byId("plans", s.planId);
  const inv = d.invoices.filter((i) => i.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const owed = inv.filter((i) => i.status !== "paid");
  return `<h1 class="m-h1">Billing</h1>
  <div class="m-card m-plan"><span class="eyebrow">Your membership</span><b>${esc(plan?.name || "No plan")}</b>
    <span>${plan ? `${money(plan.price)} / ${plan.interval === "pack" ? "pack" : plan.interval}` : ""}</span>${badge(s.status, s.status === "active" ? "ok" : "info")}</div>
  ${owed.length ? `<h2 class="m-title">Due now</h2>${owed.map((i) => `<div class="m-card m-class"><div class="grow"><b>${esc(i.description)}</b><small>Due ${fmtDate(i.due)}${i.status === "failed" ? " · last payment failed" : ""}</small></div>
    <b>${money(i.amount)}</b><button class="btn btn-sm btn-primary" data-pay="${i.id}">Pay</button></div>`).join("")}` : `<div class="m-card m-ok">✓ You're all paid up</div>`}
  <h2 class="m-title">History</h2>
  <div class="m-card flush"><ul class="list m-list">${inv.filter((i) => i.status === "paid").slice(0, 12).map((i) => `<li class="row"><span class="grow">${esc(i.description)}<small>${fmtDate(i.date)}</small></span><b>${money(i.amount)}</b></li>`).join("") || `<li class="row muted">No payments yet</li>`}</ul></div>`;
}

function shop() {
  const d = db();
  const cats = [...new Set(d.products.map((p) => p.category))];
  const items = d.products.filter((p) => !shopCat || p.category === shopCat);
  return `<h1 class="m-h1">Pro shop</h1><p class="muted">Purchases are added to your account and paid with your next invoice.</p>
  <div class="m-chips"><button data-cat="" class="${shopCat ? "" : "on"}">All</button>${cats.map((c) => `<button data-cat="${esc(c)}" class="${shopCat === c ? "on" : ""}">${esc(c)}</button>`).join("")}</div>
  <div class="m-products">${items.map((p) => `<div class="m-card m-product"><span class="eyebrow">${esc(p.category)}</span><b>${esc(p.name)}</b>
    <span class="price">${money(p.price)}</span>${p.stock ? `<button class="btn btn-sm btn-primary full" data-buy="${p.id}">Buy</button>` : `<button class="btn btn-sm full" disabled>Sold out</button>`}</div>`).join("")}</div>`;
}

// --- shell ----------------------------------------------------------------------
function render() {
  const s = me();
  if (!s) { setSession(null); root.innerHTML = login(); mountLogin(); document.title = `Sign in · ${client.appName}`; return; }
  const body = { home, classes, progress: progressTab, pay, shop }[tab](s);
  const owed = db().invoices.filter((i) => i.studentId === s.id && i.status !== "paid").length;
  const scroll = window.scrollY;
  root.innerHTML = `
    <header class="m-top"><div class="brand"><img src="assets/logo.png" alt="" width="30" height="30" /><span>${esc(client.wordmark.main)}<b>${esc(client.wordmark.accent)}</b></span></div>
      <button class="m-me" data-menu aria-label="Account">${esc(s.first[0])}${esc(s.last[0] || "")}</button></header>
    <main class="m-main">${body}</main>
    <nav class="m-tabs">${TABS.map(([k, l, i]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}"><span>${i}${k === "pay" && owed ? `<i class="m-dot"></i>` : ""}</span>${l}</button>`).join("")}</nav>`;
  document.title = `${TABS.find((t) => t[0] === tab)[1]} · ${client.appName}`;
  window.scrollTo(0, scroll);
  mount(s);
}

function mount(s) {
  const on = (sel, fn) => $$(sel, root).forEach((b) => (b.onclick = () => fn(b)));
  on("[data-tab]", (b) => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); });
  on("[data-go]", (b) => { tab = b.dataset.go; render(); window.scrollTo(0, 0); });
  on("[data-menu]", () => { if (confirm(`Signed in as ${s.first} ${s.last}.\n\nSign out?`)) { setSession(null); render(); } });
  on("[data-book]", (b) => {
    const [classId, date] = b.dataset.book.split("|");
    const c = byId("classes", classId);
    if (bookedCount(classId, date) >= c.capacity) return toast("Class is full", "warn");
    update((d) => d.bookings.push({ id: uid("bk"), studentId: s.id, classId, date }));
    toast(`Booked ${c.name} · ${fmtTime(c.start)}`);
  });
  on("[data-unbook]", (b) => {
    const [classId, date] = b.dataset.unbook.split("|");
    update((d) => (d.bookings = d.bookings.filter((x) => !(x.studentId === s.id && x.classId === classId && x.date === date))));
    toast("Booking cancelled", "warn");
  });
  on("[data-cancel]", (b) => { update((d) => (d.bookings = d.bookings.filter((x) => x.id !== b.dataset.cancel))); toast("Booking cancelled", "warn"); });
  on("[data-reg]", (b) => update((d) => {
    const ev = d.events.find((x) => x.id === b.dataset.reg);
    if (ev.registrations.length >= ev.capacity || ev.registrations.includes(s.id)) return;
    ev.registrations.push(s.id);
    if (ev.price > 0) d.invoices.push({ id: uid("inv"), studentId: s.id, amount: ev.price, date: today(), due: ev.date, description: ev.title, status: "due" });
    toast(`You're in: ${ev.title}`);
  }));
  on("[data-unreg]", (b) => {
    if (!confirm("Cancel your registration?")) return;
    update((d) => {
      const ev = d.events.find((x) => x.id === b.dataset.unreg);
      ev.registrations = ev.registrations.filter((id) => id !== s.id);
      d.invoices = d.invoices.filter((i) => !(i.studentId === s.id && i.description === ev.title && i.status !== "paid"));
    });
  });
  on("[data-pay]", (b) => {
    const i = db().invoices.find((x) => x.id === b.dataset.pay);
    // Demo only: a production build would hand off to a payment provider here.
    if (!confirm(`Pay ${money(i.amount)} for "${i.description}" with the card on file?\n\n(Demo — no real charge.)`)) return;
    update((d) => (d.invoices.find((x) => x.id === i.id).status = "paid"));
    toast("Payment received — thank you!");
  });
  on("[data-upload-hc]", () => uploadDocument({ studentId: s.id, by: "member" }));
  on("[data-upload-doc]", () => uploadDocument({ studentId: s.id, by: "member" }));
  on("[data-doc]", (b) => viewDocument(db().documents.find((x) => x.id === b.dataset.doc), { canDelete: false }));
  on("[data-cat]", (b) => { shopCat = b.dataset.cat; render(); });
  on("[data-buy]", (b) => {
    const p = byId("products", b.dataset.buy);
    if (!confirm(`Buy ${p.name} for ${money(p.price)}? It'll be added to your account.`)) return;
    update((d) => {
      const prod = d.products.find((x) => x.id === p.id);
      if (prod.stock < 1) return;
      prod.stock--;
      d.sales.push({ id: uid("sl"), productId: p.id, qty: 1, total: p.price, studentId: s.id, date: today(), method: "Member app" });
      d.invoices.push({ id: uid("inv"), studentId: s.id, amount: p.price, date: today(), due: today(), description: p.name, status: "due" });
    });
    toast("Added to your account — pick it up at the front desk");
  });
}

subscribe(render);
render();
