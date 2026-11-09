// Upload / view / delete dialogs for member documents — shared by the staff app and the member portal.
import { db, update, uid, today, iso, addDays, fullName, byId, DOC_TYPES } from "./store.js";
import { esc, $, modal, field, toast, fmtDate } from "./ui.js";
import { putFile, getFile, deleteFile, samplePreview, fmtSize, MAX_BYTES, ACCEPT } from "./files.js";

export function uploadDocument({ studentId, type = "Health certificate", by = "staff", students } = {}) {
  const pick = students || db().students.filter((s) => s.status !== "cancelled").sort((a, b) => a.first.localeCompare(b.first));
  const m = modal({
    title: "Upload document",
    submit: "Upload",
    body: `<div class="form-grid">
      ${studentId ? "" : field("Member", "studentId", "", { options: pick.map((s) => [s.id, fullName(s)]), span: 2 })}
      ${field("Document type", "type", type, { options: DOC_TYPES })}
      ${field("Valid until", "expires", type === "Health certificate" ? iso(addDays(new Date(), 365)) : "", { type: "date" })}
      <label class="field span-2"><span>File (PDF or photo, max 10 MB)</span><input type="file" name="file" accept="${ACCEPT}" required data-file /></label>
      <p class="muted small span-2" style="margin:0">Leave “Valid until” empty for documents that don't expire.</p>
    </div>`,
    onSubmit(v) {
      const file = $("[data-file]", m.el).files[0];
      if (!file) { toast("Choose a file first", "warn"); return false; }
      if (file.size > MAX_BYTES) { toast("File is larger than 10 MB", "warn"); return false; }
      const id = uid("doc");
      const sid = studentId || v.studentId;
      putFile(id, file).then(() => {
        update((d) => d.documents.push({ id, studentId: sid, type: v.type, name: file.name, uploaded: today(), expires: v.expires || "", size: file.size, mime: file.type, by }));
        toast(`${v.type} uploaded`);
      }).catch(() => toast("Couldn't save the file in this browser", "warn"));
    },
  });
  // Health certificates default to one year; other types default to no expiry.
  const typeSel = m.el.querySelector('[name="type"]'), exp = m.el.querySelector('[name="expires"]');
  typeSel.onchange = () => (exp.value = typeSel.value === "Health certificate" ? iso(addDays(new Date(), 365)) : "");
}

async function blobFor(doc) {
  if (doc.sample) return samplePreview(doc, fullName(byId("students", doc.studentId)));
  return getFile(doc.id);
}

export async function viewDocument(doc, { canDelete = true } = {}) {
  const blob = await blobFor(doc);
  const url = blob ? URL.createObjectURL(blob) : "";
  const isImg = blob && /^image\//.test(blob.type);
  const m = modal({
    title: doc.type,
    wide: true,
    body: `<p class="muted small" style="margin-top:0">${esc(fullName(byId("students", doc.studentId)))} · ${esc(doc.name)} · ${fmtSize(doc.size)} · uploaded ${fmtDate(doc.uploaded)}${doc.expires ? ` · valid until <b>${fmtDate(doc.expires)}</b>` : ""}</p>
      ${!blob ? `<p class="empty">The file isn't stored in this browser.</p>`
        : isImg ? `<img class="doc-preview" src="${url}" alt="${esc(doc.type)}"/>`
        : `<iframe class="doc-preview" src="${url}" title="${esc(doc.name)}"></iframe>`}
      ${blob ? `<p><a class="btn btn-ghost btn-sm" href="${url}" download="${esc(doc.sample ? doc.name.replace(/\.pdf$/, ".svg") : doc.name)}">Download</a></p>` : ""}`,
    danger: canDelete ? { label: "Delete document", confirm: "Delete this document permanently?", action: () => {
      update((d) => (d.documents = d.documents.filter((x) => x.id !== doc.id)));
      if (!doc.sample) deleteFile(doc.id);
      toast("Document deleted");
    } } : null,
  });
  // Release the object URL when the dialog closes.
  new MutationObserver((_, o) => { if (!m.el.isConnected) { URL.revokeObjectURL(url); o.disconnect(); } }).observe(document.body, { childList: true });
}

export const DOC_TONE = { valid: "ok", expiring: "warn", expired: "danger", none: "neutral" };
export const DOC_LABEL = { valid: "Valid", expiring: "Expiring soon", expired: "Expired", none: "Missing" };
