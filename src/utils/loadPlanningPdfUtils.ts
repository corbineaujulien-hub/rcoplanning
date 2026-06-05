import jsPDF from 'jspdf';
import { ISOWeek, getPoseurColor } from './loadPlanningUtils';

interface ProjectComputedLite {
  project: { id: string; site_name: string | null; otp_number: string | null };
  poseur: string;
  conductor: string;
  color?: string;
  isSupplyOnly?: boolean;
  weeks: Record<string, { count: number; source: 'real' | 'forecast' | 'mixed' | 'none' }>;
}

interface ExportArgs {
  weeks: ISOWeek[];
  projects: ProjectComputedLite[];
  loadByCdt: { key: string; perWeek: Record<string, number> }[];
  loadByPoseur: { key: string; perWeek: Record<string, number> }[];
  loadByUsine: { key: string; perWeek: Record<string, number> }[];
  periodStart: string;
  periodEnd: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [128, 128, 128];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function colorToRgb(c: string): [number, number, number] {
  if (c.startsWith('#')) return hexToRgb(c);
  return hslToRgb(c);
}
function hslToRgb(hsl: string): [number, number, number] {
  // accept "hsl(H S% L%)"
  const m = hsl.match(/hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*\)/);
  if (!m) return [128, 128, 128];
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

export async function exportLoadPlanningPdf(args: ExportArgs) {
  const { weeks, projects, loadByCdt, loadByPoseur, loadByUsine, periodStart, periodEnd } = args;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Planning de charge — ${periodStart} → ${periodEnd}`, margin, 10);

  const colW = Math.max(6, Math.min(12, (pageW - margin * 2 - 80) / weeks.length));
  const labelW = 80;
  let y = 14;

  const drawTable = (
    title: string,
    rows: { key: string; perWeek: Record<string, number> }[],
    colorByKey?: (k: string) => string,
    _ceil = false,
  ) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, margin, y);
    y += 3;
    doc.setFontSize(6);
    // header
    doc.text('', margin + 2, y + 3);
    weeks.forEach((w, i) => {
      doc.text(w.label, margin + labelW + i * colW + colW / 2, y + 3, { align: 'center' });
    });
    doc.text('Total', margin + labelW + weeks.length * colW + colW / 2, y + 3, { align: 'center' });
    y += 4;
    doc.setFont('helvetica', 'normal');
    rows.forEach(r => {
      if (y > pageH - 10) { doc.addPage(); y = 10; }
      if (colorByKey) {
        const [r1, g1, b1] = hslToRgb(colorByKey(r.key));
        doc.setFillColor(r1, g1, b1);
        doc.rect(margin, y - 2, 2, 2.5, 'F');
      }
      doc.text(r.key.slice(0, 28), margin + 3, y);
      let total = 0;
      weeks.forEach((w, i) => {
        const v = r.perWeek[w.key] || 0;
        total += v;
        if (v) doc.text(String(Math.ceil(v)), margin + labelW + i * colW + colW / 2, y, { align: 'center' });
      });
      if (total) {
        doc.setFont('helvetica', 'bold');
        doc.text(String(Math.ceil(total)), margin + labelW + weeks.length * colW + colW / 2, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
      }
      y += 3.2;
    });
    y += 2;
  };

  drawTable('Charge / Conducteur de travaux', loadByCdt);
  drawTable('Charge / Poseur', loadByPoseur, k => getPoseurColor(k));
  drawTable('Charge / Usine', loadByUsine, undefined, true);

  // Gantt
  if (y > pageH - 30) { doc.addPage(); y = 10; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Planning Gantt', margin, y);
  y += 4;
  doc.setFontSize(6);
  doc.text('Chantier', margin, y);
  weeks.forEach((w, i) => doc.text(w.label, margin + labelW + i * colW + colW / 2, y, { align: 'center' }));
  doc.text('Total', margin + labelW + weeks.length * colW + colW / 2, y, { align: 'center' });
  y += 2;
  projects.forEach(cp => {
    if (y > pageH - 6) { doc.addPage(); y = 10; }
    doc.setFont('helvetica', 'normal');
    doc.text((cp.project.site_name || cp.project.otp_number || '').slice(0, 32), margin, y + 2);
    const [r, g, b] = colorToRgb(cp.color || getPoseurColor(cp.poseur));
    let total = 0;
    weeks.forEach((w, i) => {
      const cell = cp.weeks[w.key];
      if (!cell || cell.count === 0) return;
      total += cell.count;
      const x = margin + labelW + i * colW;
      const isForecast = cell.source === 'forecast';
      doc.setFillColor(r, g, b);
      if (isForecast) doc.setFillColor(Math.min(r + 60, 255), Math.min(g + 60, 255), Math.min(b + 60, 255));
      doc.rect(x + 0.3, y, colW - 0.6, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(String(Math.ceil(cell.count)), x + colW / 2, y + 2, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    });
    if (total) {
      doc.setFont('helvetica', 'bold');
      doc.text(String(Math.ceil(total)), margin + labelW + weeks.length * colW + colW / 2, y + 2, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    }
    y += 4;
  });

  // Legend
  if (y > pageH - 15) { doc.addPage(); y = 10; }
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Légende poseurs :', margin, y);
  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const poseurs = Array.from(new Set(projects.map(p => p.poseur))).sort();
  let lx = margin;
  poseurs.forEach(p => {
    const [r, g, b] = hslToRgb(getPoseurColor(p));
    doc.setFillColor(r, g, b);
    doc.rect(lx, y - 2, 2.5, 2.5, 'F');
    doc.text(p, lx + 3.5, y);
    lx += doc.getTextWidth(p) + 10;
    if (lx > pageW - 30) { lx = margin; y += 4; }
  });

  doc.save(`planning_charge_${periodStart}_${periodEnd}.pdf`);
}