// Data layer: a single JSON document in localStorage, seeded with demo data.
import client from "./client.js";

export { client };
const P = client.storagePrefix;
// Browser storage names, derived from the client (each client gets its own, so clients on one origin never share data).
export const KEYS = Object.freeze({ data: `${P}:v1`, member: `${P}:member`, theme: `${P}:theme`, tv: `${P}:tv`, filesDb: `${P}-files` });
const KEY = KEYS.data;

export const ADULT_BELTS = ["White", "Blue", "Purple", "Brown", "Black"];
export const KID_BELTS = ["White", "Grey", "Yellow", "Orange", "Green"];
export const BELT_COLORS = {
  White: "#f5f5f0", Grey: "#9aa0a6", Yellow: "#f2c230", Orange: "#ef7d22",
  Green: "#3c9a4b", Blue: "#2457c5", Purple: "#6c3fb5", Brown: "#7a4a24", Black: "#16181c",
};
export const LEVELS = ["Fundamentals", "All Levels", "Advanced", "No-Gi", "Kids", "Open Mat", "Competition"];
export const LEAD_STAGES = ["New", "Contacted", "Trial booked", "Trial done", "Won", "Lost"];
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const uid = (p = "id") => p + "_" + Math.random().toString(36).slice(2, 9);
export const iso = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const today = () => iso(new Date());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// --- seed -------------------------------------------------------------------
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function seed() {
  const r = rng(42);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const now = new Date();

  const staff = [
    { id: "st_1", name: client.owner.name, role: "Head Instructor", email: `${client.owner.name.split(/\s+/)[0].toLowerCase()}@${client.seed.staffEmailDomain}`, rate: 45, color: "#e4572e" },
    { id: "st_2", name: "Dana Kowalski", role: "Instructor", email: `dana@${client.seed.staffEmailDomain}`, rate: 35, color: "#2457c5" },
    { id: "st_3", name: "Marcus Lee", role: "Kids Coach", email: `marcus@${client.seed.staffEmailDomain}`, rate: 30, color: "#3c9a4b" },
    { id: "st_4", name: "Priya Nair", role: "Front Desk", email: `priya@${client.seed.staffEmailDomain}`, rate: 18, color: "#6c3fb5" },
  ];

  const plans = [
    { id: "pl_1", name: "Unlimited Adult", price: 179, interval: "month" },
    { id: "pl_2", name: "3x / Week", price: 139, interval: "month" },
    { id: "pl_3", name: "Kids Program", price: 119, interval: "month" },
    { id: "pl_4", name: "Annual Unlimited", price: 1790, interval: "year" },
    { id: "pl_5", name: "10-Class Pack", price: 180, interval: "pack" },
  ];

  const classes = [];
  const addClass = (name, days, start, dur, instructorId, level, capacity = 30) =>
    days.forEach((day) => classes.push({ id: uid("cl"), name, day, start, duration: dur, instructorId, level, capacity, location: client.seed.location }));
  addClass("Morning Fundamentals", [1, 3, 5], "06:30", 60, "st_2", "Fundamentals", 24);
  addClass("Lunch All Levels", [1, 2, 3, 4, 5], "12:00", 60, "st_1", "All Levels", 30);
  addClass("Kids Little Grapplers", [1, 3], "16:30", 45, "st_3", "Kids", 20);
  addClass("Kids Juniors", [2, 4], "16:30", 60, "st_3", "Kids", 20);
  addClass("Evening Fundamentals", [1, 2, 3, 4], "18:00", 60, "st_2", "Fundamentals", 30);
  addClass("Advanced Gi", [1, 3], "19:15", 75, "st_1", "Advanced", 30);
  addClass("No-Gi", [2, 4], "19:15", 75, "st_1", "No-Gi", 30);
  addClass("Competition Team", [5], "18:00", 90, "st_1", "Competition", 20);
  addClass("Saturday Open Mat", [6], "10:00", 120, "st_2", "Open Mat", 40);

  const first = ["Liam", "Ava", "Noah", "Mia", "Lucas", "Sofia", "Ethan", "Isla", "Mateo", "Zoe", "Kai", "Nora", "Leo", "Chloe", "Owen", "Maya", "Eli", "Ruby", "Jack", "Lena", "Hugo", "Iris", "Theo", "Ana", "Ezra", "Jade", "Felix", "Hana", "Omar", "Tara", "Diego", "Yuki", "Sam", "Elena", "Ivan", "Nia"];
  const last = ["Santos", "Nguyen", "Okafor", "Silva", "Müller", "Rossi", "Kim", "Haddad", "Costa", "Walsh", "Ibrahim", "Petrov", "Lopez", "Tanaka", "Brennan", "Fischer", "Reyes", "Novak"];
  const students = [];
  for (let i = 0; i < 48; i++) {
    const kid = i % 6 === 0;
    const belts = kid ? KID_BELTS : ADULT_BELTS;
    const beltIdx = kid ? Math.floor(r() * 4) : Math.min(4, Math.floor(r() * r() * 5.5));
    const joined = addDays(now, -Math.floor(30 + r() * 1400));
    const beltSince = addDays(now, -Math.floor(20 + r() * 400));
    const status = r() < 0.85 ? "active" : r() < 0.5 ? "frozen" : "cancelled";
    const fn = first[i % first.length], ln = pick(last);
    students.push({
      id: "s_" + (i + 1),
      first: fn, last: ln,
      email: `${fn}.${ln}`.toLowerCase().replace(/[^a-z.]/g, "") + "@example.com",
      phone: "555-" + String(1000 + Math.floor(r() * 8999)),
      kid,
      belt: belts[beltIdx],
      stripes: Math.floor(r() * 5),
      beltSince: iso(beltSince),
      lastPromotion: iso(addDays(beltSince, Math.floor(r() * 15))),
      joined: iso(joined),
      status,
      planId: kid ? "pl_3" : pick(["pl_1", "pl_1", "pl_2", "pl_4", "pl_5"]),
      waiver: r() < 0.9,
      pin: String(1000 + i * 37).slice(-4),
      notes: "",
      location: client.seed.location,
    });
  }

  // Attendance for the last 120 days
  const attendance = [];
  for (let d = 120; d >= 1; d--) {
    const date = addDays(now, -d);
    const dayClasses = classes.filter((c) => c.day === date.getDay());
    for (const c of dayClasses) {
      const pool = students.filter((s) => s.status === "active" && (c.level === "Kids") === s.kid);
      const n = Math.floor(pool.length * (0.15 + r() * 0.25));
      const used = new Set();
      for (let k = 0; k < n; k++) {
        const s = pick(pool);
        if (used.has(s.id)) continue;
        used.add(s.id);
        attendance.push({ id: uid("at"), studentId: s.id, classId: c.id, date: iso(date) });
      }
    }
  }

  // Invoices for the last 6 months
  const invoices = [];
  for (let m = 5; m >= 0; m--) {
    const date = new Date(now.getFullYear(), now.getMonth() - m, 1);
    for (const s of students) {
      if (s.status === "cancelled" && m < 2) continue;
      if (s.status === "frozen" && m < 1) continue;
      const plan = plans.find((p) => p.id === s.planId);
      if (plan.interval === "year" && m !== 3) continue;
      if (plan.interval === "pack" && r() < 0.6) continue;
      const roll = r();
      invoices.push({
        id: uid("inv"), studentId: s.id, amount: plan.price, date: iso(date), due: iso(addDays(date, 7)),
        description: plan.name, status: m > 0 ? (roll < 0.97 ? "paid" : "failed") : roll < 0.7 ? "paid" : roll < 0.92 ? "due" : "failed",
      });
    }
  }

  const expenses = [];
  for (let m = 5; m >= 0; m--) {
    const date = iso(new Date(now.getFullYear(), now.getMonth() - m, 2));
    expenses.push({ id: uid("ex"), category: "Rent", amount: 4200, date, note: "Facility lease" });
    expenses.push({ id: uid("ex"), category: "Utilities", amount: 380 + Math.round(r() * 120), date, note: "" });
    expenses.push({ id: uid("ex"), category: "Cleaning", amount: 260, date, note: "Mat sanitation" });
    expenses.push({ id: uid("ex"), category: "Marketing", amount: 300 + Math.round(r() * 400), date, note: "Local ads" });
  }

  const sources = ["Website form", "Instagram", "Google", "Referral", "Walk-in", "Facebook"];
  const leadNames = ["Carlos Mendez", "Hannah Brooks", "Tyler Wu", "Fatima Zahra", "Ben Carter", "Olivia Grant", "Jonas Berg", "Lucy Park", "Andre Dias", "Emily Shaw", "Ryan Patel", "Grace Liu", "Victor Hale", "Sara Lind"];
  const leads = leadNames.map((name, i) => ({
    id: uid("ld"), name,
    email: name.toLowerCase().replace(" ", ".") + "@example.com",
    phone: "555-" + String(2000 + i * 113),
    source: pick(sources),
    stage: LEAD_STAGES[Math.floor(r() * LEAD_STAGES.length)],
    interest: pick(["Adult Gi", "No-Gi", "Kids Program", "Self-defense", "Competition"]),
    created: iso(addDays(now, -Math.floor(r() * 60))),
    trialDate: "",
    notes: "",
  }));

  const automations = [
    { id: uid("au"), name: "New lead welcome", trigger: "Lead created", enabled: true, steps: [
      { delay: 0, channel: "Email", text: "Welcome! Here's how to book your free trial class." },
      { delay: 2, channel: "SMS", text: "Still curious about Jiu-Jitsu? Reply to grab a trial spot." },
      { delay: 7, channel: "Email", text: "What to expect in your first class (and what to bring)." } ] },
    { id: uid("au"), name: "Trial follow-up", trigger: "Trial class attended", enabled: true, steps: [
      { delay: 0, channel: "Email", text: "Great rolling with you today — here's a special first-month offer." },
      { delay: 3, channel: "SMS", text: "Your intro offer expires soon. Want us to hold your spot?" } ] },
    { id: uid("au"), name: "First class milestone", trigger: "First check-in", enabled: false, steps: [
      { delay: 0, channel: "Email", text: "You did it! Tips for your first month on the mats." } ] },
    { id: uid("au"), name: "We miss you", trigger: "No check-in for 14 days", enabled: true, steps: [
      { delay: 0, channel: "Email", text: "The mats miss you! Here's this week's schedule." } ] },
  ];

  const rankRules = {
    White: { classesPerStripe: 25, minMonths: 12 },
    Blue: { classesPerStripe: 40, minMonths: 24 },
    Purple: { classesPerStripe: 45, minMonths: 18 },
    Brown: { classesPerStripe: 50, minMonths: 12 },
    Black: { classesPerStripe: 80, minMonths: 36 },
    Grey: { classesPerStripe: 20, minMonths: 8 },
    Yellow: { classesPerStripe: 20, minMonths: 8 },
    Orange: { classesPerStripe: 20, minMonths: 8 },
    Green: { classesPerStripe: 20, minMonths: 8 },
  };

  const t = (belt, category, name, video = "") => ({ id: uid("tq"), belt, category, name, video, description: "" });
  const techniques = [
    t("White", "Escapes", "Upa (bridge & roll) from mount"), t("White", "Escapes", "Elbow-knee escape from mount"),
    t("White", "Guard", "Closed guard posture control"), t("White", "Submissions", "Cross collar choke from mount"),
    t("White", "Submissions", "Armbar from closed guard"), t("White", "Passing", "Knee cut pass"),
    t("White", "Takedowns", "Double leg"), t("White", "Sweeps", "Scissor sweep"),
    t("Blue", "Guard", "De La Riva entries"), t("Blue", "Sweeps", "Hip bump to kimura"),
    t("Blue", "Submissions", "Triangle from closed guard"), t("Blue", "Passing", "Toreando pass"),
    t("Blue", "Back", "Seatbelt & hooks retention"), t("Purple", "Guard", "Spider-lasso system"),
    t("Purple", "Submissions", "Bow and arrow choke"), t("Purple", "Leg locks", "Straight ankle lock mechanics"),
    t("Brown", "Leg locks", "Inside heel hook (No-Gi)"), t("Brown", "Passing", "Pressure passing chains"),
  ];
  const lessonPlans = [
    { id: uid("lp"), title: "Week 1 — Mount survival", week: 1, techniqueIds: [techniques[0].id, techniques[1].id, techniques[3].id] },
    { id: uid("lp"), title: "Week 2 — Closed guard attacks", week: 2, techniqueIds: [techniques[2].id, techniques[4].id, techniques[7].id] },
    { id: uid("lp"), title: "Week 3 — Standing & passing", week: 3, techniqueIds: [techniques[6].id, techniques[5].id] },
  ];

  const products = [
    { id: uid("pr"), name: `${client.appName} Gi — White`, sku: "GI-W", category: "Gis", price: 149, stock: 12, lowAt: 5 },
    { id: uid("pr"), name: `${client.appName} Gi — Blue`, sku: "GI-B", category: "Gis", price: 149, stock: 4, lowAt: 5 },
    { id: uid("pr"), name: "Rash Guard (ranked)", sku: "RG-R", category: "Apparel", price: 55, stock: 22, lowAt: 8 },
    { id: uid("pr"), name: "Academy T-Shirt", sku: "TS-01", category: "Apparel", price: 28, stock: 40, lowAt: 10 },
    { id: uid("pr"), name: "Mouthguard", sku: "MG-01", category: "Accessories", price: 15, stock: 3, lowAt: 6 },
    { id: uid("pr"), name: "Belt (any color)", sku: "BLT", category: "Accessories", price: 25, stock: 30, lowAt: 8 },
    { id: uid("pr"), name: "Electrolyte Drink", sku: "DR-01", category: "Nutrition", price: 3.5, stock: 48, lowAt: 12 },
    { id: uid("pr"), name: "Protein Bar", sku: "PB-01", category: "Nutrition", price: 3, stock: 9, lowAt: 12 },
  ];
  const sales = [];
  for (let i = 0; i < 40; i++) {
    const p = pick(products), qty = 1 + Math.floor(r() * 2);
    sales.push({ id: uid("sl"), productId: p.id, qty, total: p.price * qty, studentId: pick(students).id, date: iso(addDays(now, -Math.floor(r() * 90))), method: pick(["Card", "Cash", "QR"]) });
  }

  const events = [
    { id: uid("ev"), title: "Guest Seminar: Guard Retention", type: "Seminar", date: iso(addDays(now, 12)), time: "13:00", price: 60, capacity: 40, registrations: students.slice(0, 14).map((s) => s.id) },
    { id: uid("ev"), title: "Quarterly Belt Test", type: "Belt test", date: iso(addDays(now, 26)), time: "11:00", price: 0, capacity: 30, registrations: students.slice(5, 16).map((s) => s.id) },
    { id: uid("ev"), title: "Regional Open — Team Registration", type: "Competition", date: iso(addDays(now, 40)), time: "08:00", price: 90, capacity: 25, registrations: students.slice(20, 27).map((s) => s.id) },
  ];

  return {
    academy: { name: client.businessName, owner: client.owner.name, currency: client.locale.currency, locations: [client.seed.location], email: client.contact.email, instagram: client.contact.instagram },
    staff, plans, classes, students, attendance, bookings: [], invoices, expenses, leads, automations,
    rankRules, techniques, lessonPlans, products, sales, events, messages: [],
    documents: sampleDocuments(students),
  };
}

// --- class groups & monthly payment status ----------------------------------------
// Members belong to one or more groups (each with its own monthly price). Every month a
// member is "paid" once a paid invoice exists for that month; before the grace day they're
// "due", after it "overdue".
function defaultGroups() {
  return [
    { id: "gr_little", name: "Little Grapplers 4–6", price: 45, color: "#3c9a4b" },
    { id: "gr_kids", name: "Kids 7–11", price: 55, color: "#ef7d22" },
    { id: "gr_teens", name: "Teens 12–15", price: 60, color: "#2457c5" },
    { id: "gr_adults", name: "Adults", price: 70, color: "#16181c" },
    { id: "gr_private", name: "Private lessons", price: 120, color: "#6c3fb5" },
  ];
}
function assignGroups(d) {
  const r = rng(11);
  for (const s of d.students) {
    if (s.groupIds) continue;
    if (s.kid) s.groupIds = [["gr_little", "gr_kids", "gr_teens"][Math.floor(r() * 3)]];
    else s.groupIds = r() < 0.15 ? ["gr_adults", "gr_private"] : ["gr_adults"];
  }
}

export const DOC_TYPES = ["Health certificate", "Liability waiver", "Parental consent", "ID / Passport", "Insurance", "Competition license", "Other"];
// Document types that must be renewed; members without a valid one are flagged.
export const REQUIRED_DOCS = ["Health certificate"];

/** Demo metadata only — sample docs have no uploaded file and render as a generated placeholder. */
function sampleDocuments(students) {
  const r = rng(7);
  const now = new Date();
  const docs = [];
  for (const s of students) {
    if (s.status === "cancelled") continue;
    const roll = r();
    if (roll < 0.8) {
      // Issued 2–13 months ago, valid 12 months → some expired, some expiring soon.
      const issued = addDays(now, -Math.floor(60 + r() * 330));
      docs.push({ id: uid("doc"), studentId: s.id, type: "Health certificate", name: `health-certificate-${s.first.toLowerCase()}.pdf`,
        uploaded: iso(issued), expires: iso(addDays(issued, 365)), size: 180000 + Math.floor(r() * 90000), mime: "application/pdf", sample: true, by: "staff" });
    }
    if (s.waiver) docs.push({ id: uid("doc"), studentId: s.id, type: s.kid ? "Parental consent" : "Liability waiver", name: `waiver-${s.last.toLowerCase()}.pdf`,
      uploaded: s.joined, expires: "", size: 95000, mime: "application/pdf", sample: true, by: "staff" });
  }
  return docs;
}

/** valid | expiring (≤30 days) | expired | none — for a member's required document of `type`. */
export function docStatus(studentId, type = "Health certificate") {
  const docs = state.documents.filter((d) => d.studentId === studentId && d.type === type).sort((a, b) => (b.expires || "9999").localeCompare(a.expires || "9999"));
  const doc = docs[0];
  if (!doc) return { status: "none", doc: null };
  if (!doc.expires) return { status: "valid", doc };
  const t = today();
  if (doc.expires < t) return { status: "expired", doc };
  if (doc.expires <= iso(addDays(new Date(), 30))) return { status: "expiring", doc };
  return { status: "valid", doc };
}

// --- store ------------------------------------------------------------------
let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {}
  return migrate(seed());
}
// Bring data saved by older versions up to the current shape.
function migrate(s) {
  s.documents ||= sampleDocuments(s.students);
  s.bookings ||= [];
  s.groups ||= defaultGroups();
  s.academy.graceDay ||= 10;
  assignGroups(s);
  return s;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export const db = () => state;

// The academy owner as saved in the data (editable in Settings), falling back to the client's configured owner.
export const ownerName = () => state.academy.owner || client.owner.name;
export const ownerShort = () => (ownerName() === client.owner.name ? client.owner.short : ownerName().trim().split(/\s+/)[0]);
export const ownerInitials = () => {
  const name = ownerName();
  if (name === client.owner.name) return client.owner.initials;
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || "").slice(0, 2)) || client.owner.initials).toUpperCase();
};
export function update(fn) {
  fn(state);
  persist();
  listeners.forEach((l) => l(state));
}
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export function resetDemo() { state = seed(); persist(); listeners.forEach((l) => l(state)); }
persist();

// Re-sync when another tab (e.g. the kiosk) writes.
window.addEventListener("storage", (e) => {
  if (e.key === KEY && e.newValue) { state = JSON.parse(e.newValue); listeners.forEach((l) => l(state)); }
});

// --- derived helpers ----------------------------------------------------------
export const byId = (list, id) => state[list].find((x) => x.id === id);
export const fullName = (s) => (s ? `${s.first} ${s.last}` : "—");
export const money = (n) => new Intl.NumberFormat(client.locale.numberLocale, { style: "currency", currency: state.academy.currency || client.locale.currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n || 0);

export function classesSince(studentId, since) {
  return state.attendance.filter((a) => a.studentId === studentId && a.date >= since).length;
}
export function monthsBetween(a, b = new Date()) {
  const d1 = new Date(a), d2 = new Date(b);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) - (d2.getDate() < d1.getDate() ? 1 : 0);
}

/** Promotion eligibility: next stripe needs N classes since last promotion; a new belt also needs minimum months at belt. */
export function eligibility(s) {
  const rule = state.rankRules[s.belt] || { classesPerStripe: 30, minMonths: 12 };
  const done = classesSince(s.id, s.lastPromotion);
  const belts = s.kid ? KID_BELTS : ADULT_BELTS;
  const isBeltStep = s.stripes >= 4;
  const top = belts.indexOf(s.belt) === belts.length - 1;
  const months = monthsBetween(s.beltSince);
  const needClasses = rule.classesPerStripe;
  const classOk = done >= needClasses;
  const timeOk = !isBeltStep || months >= rule.minMonths;
  const next = isBeltStep ? (top ? null : belts[belts.indexOf(s.belt) + 1]) : `${s.belt} · ${s.stripes + 1} stripe${s.stripes ? "s" : ""}`;
  return { done, needClasses, months, minMonths: rule.minMonths, isBeltStep, next, eligible: !!next && classOk && timeOk, progress: Math.min(1, done / needClasses) };
}

export function lastSeen(studentId) {
  let max = "";
  for (const a of state.attendance) if (a.studentId === studentId && a.date > max) max = a.date;
  return max;
}

export const groupsOf = (s) => (s.groupIds || []).map((id) => state.groups.find((g) => g.id === id)).filter(Boolean);
export const monthlyFee = (s) => groupsOf(s).reduce((a, g) => a + g.price, 0);
export const thisMonth = () => today().slice(0, 7);

/** paid | due | overdue | inactive — this month's payment state for a member. */
export function paymentStatus(s, month = thisMonth()) {
  if (s.status !== "active") return "inactive";
  const inv = state.invoices.filter((i) => i.studentId === s.id && i.date.startsWith(month) && i.monthly);
  if (inv.length && inv.every((i) => i.status === "paid")) return "paid";
  // Older invoices created from membership plans count too (but not shop or event charges).
  if (!inv.length && state.invoices.some((i) => i.studentId === s.id && i.date.startsWith(month) && i.status === "paid" && state.plans.some((p) => p.name === i.description))) return "paid";
  return new Date().getDate() <= (state.academy.graceDay || 10) ? "due" : "overdue";
}

/** Records this month's payment for a member's group(s): pays any open monthly invoices, or creates a paid one. */
export function markPaid(studentId, groupIds) {
  update((d) => {
    const s = d.students.find((x) => x.id === studentId);
    const month = thisMonth();
    const open = d.invoices.filter((i) => i.studentId === s.id && i.date.startsWith(month) && i.monthly && i.status !== "paid");
    if (open.length) { open.forEach((i) => (i.status = "paid")); return; }
    for (const gid of groupIds || s.groupIds || []) {
      const g = d.groups.find((x) => x.id === gid);
      if (g) d.invoices.push({ id: uid("inv"), studentId: s.id, amount: g.price, date: today(), due: today(), description: `${g.name} — ${new Date().toLocaleString("en-US", { month: "long" })}`, status: "paid", monthly: true, groupId: g.id });
    }
  });
}

export function promote(studentId) {
  update((d) => {
    const s = d.students.find((x) => x.id === studentId);
    const belts = s.kid ? KID_BELTS : ADULT_BELTS;
    if (s.stripes >= 4) {
      const i = belts.indexOf(s.belt);
      if (i < belts.length - 1) { s.belt = belts[i + 1]; s.stripes = 0; s.beltSince = today(); }
    } else s.stripes += 1;
    s.lastPromotion = today();
  });
}

export function checkIn(studentId, classId, date = today()) {
  if (state.attendance.some((a) => a.studentId === studentId && a.classId === classId && a.date === date)) return false;
  update((d) => d.attendance.push({ id: uid("at"), studentId, classId, date }));
  return true;
}

export function classesOn(date) {
  const day = new Date(date + "T12:00").getDay();
  return state.classes.filter((c) => c.day === day).sort((a, b) => a.start.localeCompare(b.start));
}
