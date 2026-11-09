import { db, update, uid, ADULT_BELTS } from "../store.js";
import { esc, $$, beltChip, modal, field, toast, empty } from "../ui.js";

let belt = "White";
let tab = "library";
const CATEGORIES = ["Takedowns", "Guard", "Sweeps", "Passing", "Escapes", "Back", "Submissions", "Leg locks", "Self-defense"];

function techniqueForm(t) {
  const isNew = !t;
  modal({
    title: isNew ? "Add technique" : t.name,
    body: `<div class="form-grid">
      ${field("Technique name", "name", t?.name, { required: true, span: 2 })}
      ${field("Belt level", "belt", t?.belt || belt, { options: ADULT_BELTS })}
      ${field("Category", "category", t?.category || "Guard", { options: CATEGORIES })}
      ${field("Video URL", "video", t?.video, { type: "url", span: 2, placeholder: "https://…" })}
      ${field("Key details", "description", t?.description, { type: "textarea", span: 2 })}
    </div>`,
    danger: isNew ? null : { label: "Delete", action: () => update((d) => { d.techniques = d.techniques.filter((x) => x.id !== t.id); d.lessonPlans.forEach((p) => (p.techniqueIds = p.techniqueIds.filter((i) => i !== t.id))); }) },
    onSubmit(v) {
      update((d) => (isNew ? d.techniques.push({ id: uid("tq"), ...v }) : Object.assign(d.techniques.find((x) => x.id === t.id), v)));
      toast("Technique saved");
    },
  });
}

function planForm(p) {
  const d = db();
  const isNew = !p;
  modal({
    title: isNew ? "New lesson plan" : p.title,
    wide: true,
    body: `<div class="form-grid">
      ${field("Title", "title", p?.title, { required: true })}
      ${field("Week #", "week", p?.week ?? d.lessonPlans.length + 1, { type: "number", min: 1 })}
    </div>
    <h4 class="mt">Techniques</h4>
    <div class="check-grid">${d.techniques.map((t) => `<label class="check"><input type="checkbox" data-multi="1" name="techniqueIds" value="${t.id}" ${p?.techniqueIds.includes(t.id) ? "checked" : ""}/> ${esc(t.name)} <small class="muted">${esc(t.belt)}</small></label>`).join("")}</div>`,
    danger: isNew ? null : { label: "Delete plan", action: () => update((d) => (d.lessonPlans = d.lessonPlans.filter((x) => x.id !== p.id))) },
    onSubmit(v) {
      v.techniqueIds ||= [];
      update((d) => (isNew ? d.lessonPlans.push({ id: uid("lp"), ...v }) : Object.assign(d.lessonPlans.find((x) => x.id === p.id), v)));
      toast("Lesson plan saved");
    },
  });
}

function render() {
  const d = db();
  const list = d.techniques.filter((t) => t.belt === belt);
  const grouped = CATEGORIES.map((c) => [c, list.filter((t) => t.category === c)]).filter(([, l]) => l.length);
  const tech = (id) => d.techniques.find((t) => t.id === id);

  const body = tab === "library" ? `
    <div class="toolbar"><div class="seg">${ADULT_BELTS.map((b) => `<button data-belt="${b}" class="${belt === b ? "on" : ""}">${beltChip(b, 0)} ${b}</button>`).join("")}</div>
      <span class="grow"></span><button class="btn btn-primary" data-new>+ Technique</button></div>
    ${grouped.length ? `<div class="grid grid-3">${grouped.map(([c, l]) => `<section class="card"><header class="card-head"><h2>${c}</h2><span class="muted">${l.length}</span></header>
      <ul class="list">${l.map((t) => `<li><button class="row-link" data-tech="${t.id}"><span class="grow">${esc(t.name)}</span>${t.video ? `<span title="Has video">▶</span>` : ""}</button></li>`).join("")}</ul></section>`).join("")}</div>`
      : empty(`No ${belt} belt techniques yet — add the first one.`)}`
  : `<div class="toolbar"><p class="muted grow">Sequence techniques into weekly lesson plans so every coach teaches the same syllabus.</p><button class="btn btn-primary" data-new-plan>+ Lesson plan</button></div>
    <div class="flow">${[...d.lessonPlans].sort((a, b) => a.week - b.week).map((p) => `<button class="card flow-card" data-plan="${p.id}">
      <span class="eyebrow">Week ${p.week}</span><h3>${esc(p.title)}</h3>
      <ol>${p.techniqueIds.map(tech).filter(Boolean).map((t) => `<li>${esc(t.name)} <small class="muted">${esc(t.category)}</small></li>`).join("")}</ol></button>`).join("") || empty("No lesson plans yet.")}</div>`;

  return `
  <div class="page-head"><div><p class="eyebrow">Academy</p><h1>Curriculum</h1></div></div>
  <nav class="tabs">${[["library", "Technique library"], ["plans", "Lesson plans"]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</nav>
  ${body}`;
}

export default {
  title: "Curriculum",
  render,
  mount(el) {
    const again = () => { el.innerHTML = render(); this.mount(el); };
    $$("[data-tab]", el).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; again(); }));
    $$("[data-belt]", el).forEach((b) => (b.onclick = () => { belt = b.dataset.belt; again(); }));
    $$("[data-new]", el).forEach((b) => (b.onclick = () => techniqueForm()));
    $$("[data-tech]", el).forEach((b) => (b.onclick = () => techniqueForm(db().techniques.find((t) => t.id === b.dataset.tech))));
    $$("[data-new-plan]", el).forEach((b) => (b.onclick = () => planForm()));
    $$("[data-plan]", el).forEach((b) => (b.onclick = () => planForm(db().lessonPlans.find((p) => p.id === b.dataset.plan))));
  },
};
