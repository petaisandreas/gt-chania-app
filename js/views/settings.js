import { db, update, uid, resetDemo, money, client } from "../store.js";
import { esc, $, $$, field, readForm, toast } from "../ui.js";

export default {
  title: "Settings",
  render() {
    const a = db().academy;
    return `
    <div class="page-head"><div><p class="eyebrow">System</p><h1>Settings</h1></div></div>
    <div class="grid grid-2">
      <form class="card" data-academy>
        <header class="card-head"><h2>Academy profile</h2></header>
        <div class="form-grid">
          ${field("Academy name", "name", a.name, { required: true, span: 2 })}
          ${field("Owner", "owner", a.owner)}
          ${field("Contact email", "email", a.email, { type: "email" })}
          ${field("Currency", "currency", a.currency, { options: [...new Set(["USD", "EUR", "GBP", "AUD", "CAD", "BRL", client.locale.currency])] })}
        </div>
        <button class="btn btn-primary mt">Save profile</button>
      </form>
      <form class="card" data-pay-rules>
        <header class="card-head"><h2>Monthly payments</h2></header>
        <p class="muted">Members show as <b>due soon</b> until this day of the month, then <b>overdue</b>.</p>
        <div class="form-grid">${field("Grace period ends on day", "graceDay", a.graceDay || 10, { type: "number", min: 1, step: 1 })}</div>
        <button class="btn btn-primary mt">Save</button>
      </form>
      <section class="card">
        <header class="card-head"><h2>Class groups</h2><button class="btn btn-sm btn-ghost" data-add-group>+ Add group</button></header>
        <ul class="list">${db().groups.map((g) => `<li class="row"><span class="dot" style="background:${esc(g.color)}"></span><span class="grow">${esc(g.name)}</span><span class="muted">${money(g.price)}/mo · ${db().students.filter((s) => s.status === "active" && (s.groupIds || []).includes(g.id)).length} members</span>${db().students.some((s) => (s.groupIds || []).includes(g.id)) ? "" : `<button class="icon-btn" data-rm-group="${g.id}" title="Remove">✕</button>`}</li>`).join("")}</ul>
        <p class="muted small">Edit a group's name or price from its tab on the Members page.</p>
      </section>
      <section class="card">
        <header class="card-head"><h2>Locations</h2></header>
        <ul class="list">${a.locations.map((l, i) => `<li class="row"><span class="grow">${esc(l)}</span>${a.locations.length > 1 ? `<button class="icon-btn" data-rm-loc="${i}">✕</button>` : ""}</li>`).join("")}</ul>
        <form class="row gap mt" data-loc><input class="input grow" name="loc" placeholder="New location name" required/><button class="btn">Add</button></form>
      </section>
      <section class="card">
        <header class="card-head"><h2>Front desk kiosk</h2></header>
        <p class="muted">Open the kiosk on a tablet at the entrance. Members check in with their 4-digit PIN or by tapping their name.</p>
        <a class="btn btn-ghost" href="kiosk.html" target="_blank">Launch kiosk ↗</a>
      </section>
      <section class="card">
        <header class="card-head"><h2>Mat TV</h2></header>
        <p class="muted">Open on the gym TV (press F for full screen). Shows the round timer and everyone checked in to the current class, live.</p>
        <a class="btn btn-ghost" href="tv.html" target="_blank">Launch Mat TV ↗</a>
      </section>
      <section class="card">
        <header class="card-head"><h2>Data</h2></header>
        <p class="muted">All data is stored in this browser. Export a backup or reset to the demo academy.</p>
        <div class="row gap"><button class="btn btn-ghost" data-backup>Download backup</button><label class="btn btn-ghost">Restore<input type="file" accept="application/json" data-restore hidden/></label><button class="btn btn-danger-ghost" data-reset>Reset demo data</button></div>
      </section>
    </div>`;
  },
  mount(el) {
    $("[data-academy]", el).onsubmit = (e) => { e.preventDefault(); const v = readForm(e.target); update((d) => Object.assign(d.academy, v)); toast("Profile saved"); };
    $("[data-pay-rules]", el).onsubmit = (e) => { e.preventDefault(); const v = readForm(e.target); update((d) => (d.academy.graceDay = Math.min(28, Math.max(1, v.graceDay || 10)))); toast("Saved"); };
    $("[data-add-group]", el).onclick = () => {
      const name = prompt("Group name (e.g. Women's class)");
      if (!name) return;
      const price = Number(prompt("Monthly price", "60")) || 0;
      update((d) => d.groups.push({ id: uid("gr"), name: name.trim(), price, color: "#2457c5" }));
    };
    $$("[data-rm-group]", el).forEach((b) => (b.onclick = () => update((d) => (d.groups = d.groups.filter((g) => g.id !== b.dataset.rmGroup)))));
    $("[data-loc]", el).onsubmit = (e) => { e.preventDefault(); const v = readForm(e.target); update((d) => d.academy.locations.push(v.loc)); };
    $$("[data-rm-loc]", el).forEach((b) => (b.onclick = () => update((d) => d.academy.locations.splice(Number(b.dataset.rmLoc), 1))));
    $("[data-reset]", el).onclick = () => { if (confirm("Replace all data with the demo academy?")) { resetDemo(); toast("Demo data restored"); } };
    $("[data-backup]", el).onclick = () => {
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(db(), null, 2)], { type: "application/json" })), download: `${client.id}-backup.json` });
      a.click(); URL.revokeObjectURL(a.href);
    };
    $("[data-restore]", el).onchange = async (e) => {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!data.students || !data.academy) throw new Error();
        update((d) => { Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, data); });
        toast("Backup restored");
      } catch { toast(`That file isn't a ${client.appName} backup`, "warn"); }
    };
  },
};
