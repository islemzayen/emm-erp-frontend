// src/lib/attestationDocument.ts
// "ATTESTATION DE TRAVAIL" generator — reproduces the official EMM blank template
// (US-Letter): logo top-left, place + date right-aligned, centered bold-italic title,
// justified body with the filled-in values in bold, and the signatory's signature block.
// Returns a PDF Blob to upload to Documents.

export interface AttestationEmployee {
  name: string;
  position?: string;
  cin?: string;
  joinedDate?: string;
  // accepted but unused by this template (kept for caller compatibility):
  department?: string;
  matricule?: string;
  salary?: number;
  role?: string;
}

export interface AttestationCompany {
  representative?: string; // signatory name; defaults to "Mohamed Moalla"
  place?: string;          // city of issue; defaults to "Sfax"
}

export interface AttestationOptions {
  employee: AttestationEmployee;
  company?: AttestationCompany;
  signatory?: string;
  place?: string;
}

type Run = { t: string; b?: boolean; glue?: boolean };

// Stack-safe base64 of /logo.png (returns null if missing)
async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return "data:image/png;base64," + btoa(bin);
  } catch {
    return null;
  }
}

function dmy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())} / ${p(d.getMonth() + 1)} / ${d.getFullYear()}`;
}
function dotted(n: number): string {
  return "…".repeat(n);
}

// Justified rich-text paragraph with inline bold runs.
function drawRich(
  doc: any,
  runs: Run[],
  x: number,
  yBaseline: number,
  maxWidth: number,
  o: { size: number; lineH: number; indent?: number; justify?: boolean }
): number {
  const indent = o.indent || 0;
  const justify = o.justify !== false;
  doc.setFontSize(o.size);

  const words: { t: string; b: boolean; glue: boolean }[] = [];
  for (const r of runs) {
    const toks = String(r.t).split(/\s+/).filter(Boolean);
    toks.forEach((t, i) => words.push({ t, b: !!r.b, glue: i === 0 && !!r.glue }));
  }
  const wordWidth = (w: { t: string; b: boolean }) => {
    doc.setFont("helvetica", w.b ? "bold" : "normal");
    return doc.getTextWidth(w.t);
  };
  doc.setFont("helvetica", "normal");
  const sw = doc.getTextWidth(" ");

  const lines: { t: string; b: boolean; glue: boolean }[][] = [];
  let cur: { t: string; b: boolean; glue: boolean }[] = [];
  let curW = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const ww = wordWidth(w);
    const gap = cur.length > 0 && !w.glue ? sw : 0;
    const lineAvail = maxWidth - (lines.length === 0 ? indent : 0);
    if (cur.length > 0 && curW + gap + ww > lineAvail) { lines.push(cur); cur = [w]; curW = ww; }
    else { curW += gap + ww; cur.push(w); }
  }
  if (cur.length) lines.push(cur);

  let y = yBaseline;
  lines.forEach((ln, li) => {
    const isLast = li === lines.length - 1;
    const lineIndent = li === 0 ? indent : 0;
    let natural = 0, nGaps = 0;
    ln.forEach((w, wi) => { if (wi > 0 && !w.glue) { natural += sw; nGaps++; } natural += wordWidth(w); });
    let gap = sw;
    if (justify && !isLast && nGaps > 0) gap = sw + (maxWidth - lineIndent - natural) / nGaps;
    let cx = x + lineIndent;
    ln.forEach((w, wi) => {
      if (wi > 0 && !w.glue) cx += gap;
      doc.setFont("helvetica", w.b ? "bold" : "normal");
      doc.text(w.t, cx, y);
      cx += wordWidth(w);
    });
    y += o.lineH;
  });
  return y;
}

export async function generateAttestation(
  opts: AttestationOptions
): Promise<{ blob: Blob; fileName: string }> {
  const { default: jsPDF } = await import("jspdf");

  const emp = opts.employee || ({} as AttestationEmployee);
  const co = opts.company || {};
  const signer = (opts.signatory || co.representative || "Mohamed Moalla").trim();
  const place = (opts.place || co.place || "Sfax").trim();
  const dateObj = new Date();
  const joined = emp.joinedDate ? new Date(emp.joinedDate) : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = 215.9, M = 25.4, contentW = W - 2 * M;

  // Logo top-left (aspect preserved within ~43.7 x 29.1 box)
  const logo = await loadLogo();
  if (logo) {
    try {
      const pr = doc.getImageProperties(logo);
      const boxW = 43.7, boxH = 29.1;
      let w = boxW, h = (pr.height / pr.width) * w;
      if (h > boxH) { h = boxH; w = (pr.width / pr.height) * h; }
      doc.addImage(logo, "PNG", 27.5, 20.1, w, h, undefined, "FAST");
    } catch {}
  }

  // Place + date (right aligned)
  doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(0);
  doc.text(`${place}, le ${dmy(dateObj)}`, W - M, 70, { align: "right" });

  // Title
  doc.setFont("helvetica", "bolditalic").setFontSize(18);
  doc.text("ATTESTATION DE TRAVAIL", W / 2, 89, { align: "center" });

  // Body
  const name = (emp.name || "").trim() || dotted(20);
  const cin = (emp.cin || "").trim() || dotted(8);
  const position = (emp.position || "").trim() || dotted(12);
  const hire = joined ? dmy(joined) : dotted(10);

  const runs: Run[] = [
    { t: `Je soussigné ${signer}, atteste par la présente que ` },
    { t: "Mme / Mr ", b: true },
    { t: name + ",", b: true },
    { t: " titulaire de la Carte d'Identité Nationale n° " },
    { t: cin, b: true },
    { t: " occupe le poste de " },
    { t: position, b: true },
    { t: " au sein de mon entreprise et ce à partir du " },
    { t: hire, b: true },
    { t: ".", glue: true },
  ];
  let y = drawRich(doc, runs, M, 106, contentW, { size: 12, lineH: 6.35, indent: 8.5, justify: true });

  // Second paragraph
  y += 9;
  drawRich(
    doc,
    [{ t: "Cette attestation est délivrée à l'intéressé(e) pour lui servir et valoir ce que de droit." }],
    M, y, contentW, { size: 12, lineH: 6.35, indent: 8.5, justify: true }
  );

  // Signature block (right)
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(0);
  doc.text("Signature et cachet", W - M, 163, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(signer.toUpperCase(), W - M, 178, { align: "right" });

  const safe = (emp.name || "employee").replace(/[^a-z0-9]+/gi, "_");
  const stamp = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, "0")}${String(dateObj.getDate()).padStart(2, "0")}`;
  return { blob: doc.output("blob"), fileName: `Attestation_${safe}_${stamp}.pdf` };
}