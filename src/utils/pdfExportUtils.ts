import jsPDF from 'jspdf';
import { BeamElement, TransportCategory, TRANSPORT_CATEGORIES, ProjectInfo } from '@/types/delivery';
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories, getFactoryColor } from '@/utils/transportUtils';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TruckData {
  id: string;
  number: string;
  date: string;
  time: string;
  comment?: string;
}

interface PdfContext {
  pdf: jsPDF;
  y: number;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  usableWidth: number;
  logoData: string | null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function ensureSpace(ctx: PdfContext, needed: number): void {
  if (ctx.y + needed > ctx.pageHeight - ctx.margin) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
  }
}

function drawRoundedRect(pdf: jsPDF, x: number, y: number, w: number, h: number, r: number, fillColor?: string, strokeColor?: string) {
  if (fillColor) {
    pdf.setFillColor(...hexToRgb(fillColor));
  }
  if (strokeColor) {
    pdf.setDrawColor(...hexToRgb(strokeColor));
    pdf.setLineWidth(0.3);
  }
  const mode = fillColor && strokeColor ? 'FD' : fillColor ? 'F' : 'S';
  pdf.roundedRect(x, y, w, h, r, r, mode);
}

function drawBadge(ctx: PdfContext, x: number, y: number, text: string, bg: string, textColor: string = '#ffffff', fontSize: number = 7): { w: number; h: number } {
  const { pdf } = ctx;
  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', 'bold');
  const tw = pdf.getTextWidth(text);
  const padX = 3;
  const padY = 2;
  const w = tw + padX * 2;
  const h = fontSize * 0.4 + padY * 2;
  drawRoundedRect(pdf, x, y, w, h, 1.5, bg);
  pdf.setTextColor(...hexToRgb(textColor));
  pdf.text(text, x + padX, y + padY + fontSize * 0.3);
  return { w, h };
}

function drawHeader(ctx: PdfContext, projectInfo: ProjectInfo, title: string) {
  const { pdf, margin, usableWidth } = ctx;
  
  // Centered logo
  if (ctx.logoData) {
    try {
      const logoW = 40;
      const logoH = 14;
      const logoX = margin + (usableWidth - logoW) / 2;
      pdf.addImage(ctx.logoData, 'PNG', logoX, ctx.y, logoW, logoH);
      ctx.y += logoH + 2;
    } catch { /* ignore logo errors */ }
  }

  // Title
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 58, 95);
  pdf.text(`RECTOR – ${title}`, margin, ctx.y + 5);
  ctx.y += 9;

  // Project info - left column
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(50, 50, 50);
  const infoLines: string[] = [];
  if (projectInfo.otpNumber) infoLines.push(`N° OTP : ${projectInfo.otpNumber}`);
  if (projectInfo.siteName) infoLines.push(`Chantier : ${projectInfo.siteName}`);
  if (projectInfo.siteAddress) infoLines.push(`Adresse : ${projectInfo.siteAddress}`);
  if (projectInfo.clientName) infoLines.push(`Client : ${projectInfo.clientName}`);

  const rightInfo: string[] = [];
  if (projectInfo.conductor) rightInfo.push(`Conducteur : ${projectInfo.conductor}`);
  if (projectInfo.subcontractor) rightInfo.push(`Poseur : ${projectInfo.subcontractor}`);
  if (projectInfo.contactName) rightInfo.push(`Contact : ${projectInfo.contactName}${projectInfo.contactPhone ? ` — ${projectInfo.contactPhone}` : ''}`);

  const maxLines = Math.max(infoLines.length, rightInfo.length);
  for (let i = 0; i < maxLines; i++) {
    if (infoLines[i]) {
      pdf.setFont('helvetica', 'bold');
      const label = infoLines[i].split(' : ')[0] + ' : ';
      const value = infoLines[i].split(' : ').slice(1).join(' : ');
      pdf.text(label, margin, ctx.y + 4);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, margin + pdf.getTextWidth(label), ctx.y + 4);
    }
    if (rightInfo[i]) {
      pdf.setFont('helvetica', 'bold');
      const label = rightInfo[i].split(' : ')[0] + ' : ';
      const value = rightInfo[i].split(' : ').slice(1).join(' : ');
      const rightX = margin + usableWidth - pdf.getTextWidth(label + value);
      pdf.text(label, rightX, ctx.y + 4);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, rightX + pdf.getTextWidth(label), ctx.y + 4);
    }
    ctx.y += 4;
  }

  // Separator line
  ctx.y += 2;
  pdf.setDrawColor(30, 58, 95);
  pdf.setLineWidth(0.5);
  pdf.line(margin, ctx.y, margin + usableWidth, ctx.y);
  ctx.y += 4;
}

function drawDayHeader(ctx: PdfContext, date: string, truckCount: number) {
  ensureSpace(ctx, 10);
  const { pdf, margin, usableWidth } = ctx;
  drawRoundedRect(pdf, margin, ctx.y, usableWidth, 7, 1.5, '#1e3a5f');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  const dayLabel = format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr });
  const capitalDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
  pdf.text(`${capitalDay} — ${truckCount} camion${truckCount > 1 ? 's' : ''}`, margin + 4, ctx.y + 4.8);
  ctx.y += 9;
}

function getCatBorderColor(cat: TransportCategory): string {
  return cat === 'standard' ? '#22c55e' : cat === 'cat1' ? '#eab308' : cat === 'cat2' ? '#f97316' : '#ef4444';
}

function estimateTruckHeight(els: BeamElement[], hasComment: boolean): number {
  const grouped = groupByType(els);
  const typeCount = Object.keys(grouped).length;
  let repereLines = 0;
  Object.values(grouped).forEach(reperes => {
    repereLines += Math.ceil(reperes.length / 18) + 1;
  });
  // Header + info icons line + count badges + type groups + comment
  return 12 + 6 + typeCount * 4 + repereLines * 4 + (hasComment ? 8 : 0) + 4;
}

function groupByType(els: BeamElement[]): Record<string, BeamElement[]> {
  const groups: Record<string, BeamElement[]> = {};
  els.forEach(el => {
    if (!groups[el.productType]) groups[el.productType] = [];
    groups[el.productType].push(el);
  });
  return groups;
}

function drawInfoItem(pdf: jsPDF, x: number, y: number, label: string, value: string, fontSize: number = 8): number {
  pdf.setFontSize(fontSize);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text(label, x, y);
  const labelW = pdf.getTextWidth(label);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text(value, x + labelW + 1, y);
  return labelW + 1 + pdf.getTextWidth(value) + 5;
}

function drawTruckCard(ctx: PdfContext, truck: TruckData, els: BeamElement[]) {
  const { pdf, margin, usableWidth } = ctx;
  const cat = getTransportCategory(els);
  const catInfo = TRANSPORT_CATEGORIES[cat];
  const weight = getTruckWeight(els);
  const maxLen = getTruckMaxLength(els);
  const factories = getTruckFactories(els);
  const borderColor = getCatBorderColor(cat);

  const cardHeight = estimateTruckHeight(els, !!truck.comment?.trim());
  ensureSpace(ctx, cardHeight);

  const cardX = margin;
  const cardW = usableWidth;
  const cardY = ctx.y;
  const borderW = 1.5;

  // Card background & border
  drawRoundedRect(pdf, cardX, cardY, cardW, cardHeight, 2, '#ffffff', '#c8d0da');
  // Left color border
  pdf.setFillColor(...hexToRgb(borderColor));
  pdf.rect(cardX, cardY + 1, borderW, cardHeight - 2, 'F');

  let x = cardX + borderW + 3;
  let y = cardY + 3;

  // Truck number + time badge
  const numBadge = drawBadge(ctx, x, y, `${truck.number} — ${truck.time}`, '#1e3a5f', '#ffffff', 9);
  x += numBadge.w + 3;

  // Category badge
  const catBadge = drawBadge(ctx, x, y, catInfo.label, borderColor, '#ffffff', 7);
  x += catBadge.w + 3;

  // Factory badges
  factories.forEach(f => {
    const fBadge = drawBadge(ctx, x, y, f, getFactoryColor(f), '#ffffff', 7);
    x += fBadge.w + 2;
  });

  // Info items on the same line, right after factory badges
  x += 4;
  const infoY = y + numBadge.h * 0.55;
  x += drawInfoItem(pdf, x, infoY, 'Poids :', `${weight.toFixed(2)} t`, 8);
  x += drawInfoItem(pdf, x, infoY, 'Long. max :', `${maxLen.toFixed(2)} m`, 8);
  drawInfoItem(pdf, x, infoY, 'Produits :', `${els.length}`, 8);

  y += numBadge.h + 3;

  // Info line: product counts badges
  x = cardX + borderW + 3;
  const counts = els.reduce((acc: Record<string, number>, el) => { acc[el.productType] = (acc[el.productType] || 0) + 1; return acc; }, {});
  Object.entries(counts).forEach(([type, count]) => {
    const countBadge = drawBadge(ctx, x, y, `${count}× ${type}`, '#e2e8f0', '#334155', 6);
    x += countBadge.w + 2;
  });
  y += 6;

  // Repères grouped by type
  const grouped = groupByType(els);
  Object.entries(grouped).forEach(([type, typeEls]) => {
    x = cardX + borderW + 3;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 58, 95);
    pdf.text(type, x, y + 3);
    y += 4;

    x = cardX + borderW + 3;
    typeEls.forEach(el => {
      const bw = drawBadge(ctx, x, y, el.repere, '#dbeafe', '#1e3a5f', 6);
      x += bw.w + 1.5;
      if (x > cardX + cardW - 10) {
        x = cardX + borderW + 3;
        y += bw.h + 1;
      }
    });
    y += 5;
  });

  // Comment
  if (truck.comment?.trim()) {
    drawRoundedRect(pdf, cardX + borderW + 3, y, cardW - borderW - 6, 6, 1, '#fffbeb', '#fde68a');
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(146, 64, 14);
    pdf.text(truck.comment.trim(), cardX + borderW + 5, y + 4, { maxWidth: cardW - borderW - 12 });
    y += 8;
  }

  ctx.y = cardY + cardHeight + 2;
}

function drawSummary(
  ctx: PdfContext,
  weekNumber: number,
  truckCount: number,
  totalProducts: number,
  weekProductCounts: Record<string, number>,
  weekWeight: number,
  totalSiteWeight: number,
  cumulativeWeight: number
) {
  // Compute needed height based on product type count
  const productTypeCount = Object.keys(weekProductCounts).length;
  const productSubHeight = productTypeCount * 3.5;
  const boxH = Math.max(14, 12 + productSubHeight);
  const totalH = 8 + boxH + 4;

  ensureSpace(ctx, totalH);
  const { pdf, margin, usableWidth } = ctx;

  drawRoundedRect(pdf, margin, ctx.y, usableWidth, totalH, 2, '#ffffff', '#e2e8f0');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 58, 95);
  pdf.text(`Récapitulatif semaine ${weekNumber}`, margin + 4, ctx.y + 5);

  const colW = (usableWidth - 8) / 5;
  const colY = ctx.y + 8;
  const labels = ['Camions livrés', 'Produits livrés', 'Tonnage semaine', 'Avancement hebdo', 'Avancement cumulé'];
  const values = [
    `${truckCount}`,
    `${totalProducts}`,
    `${weekWeight.toFixed(2)} t`,
    `${totalSiteWeight > 0 ? ((weekWeight / totalSiteWeight) * 100).toFixed(1) : '0'} %`,
    `${totalSiteWeight > 0 ? ((cumulativeWeight / totalSiteWeight) * 100).toFixed(1) : '0'} %`,
  ];

  labels.forEach((label, i) => {
    const cx = margin + 4 + i * colW;
    drawRoundedRect(pdf, cx, colY, colW - 2, boxH, 1.5, '#f1f5f9');
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, cx + 2, colY + 4);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text(values[i], cx + 2, colY + 10);

    // Sub-details for "Produits livrés"
    if (i === 1) {
      let subY = colY + 13;
      pdf.setFontSize(5.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      Object.entries(weekProductCounts).forEach(([type, count]) => {
        pdf.text(`${count}× ${type}`, cx + 2, subY);
        subY += 3.5;
      });
    }
  });

  ctx.y += totalH + 2;
}

async function loadLogoAsBase64(): Promise<string | null> {
  try {
    const response = await fetch('/logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface WeekExportData {
  weekNumber: number;
  year: number;
  trucks: TruckData[];
  getTruckElements: (id: string) => BeamElement[];
  projectInfo: ProjectInfo;
  totalSiteWeight: number;
  cumulativeWeight: number;
}

export async function exportWeekPdf(data: WeekExportData) {
  const { weekNumber, year, trucks: weekTrucks, getTruckElements, projectInfo, totalSiteWeight, cumulativeWeight } = data;

  const logoData = await loadLogoAsBase64();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  const ctx: PdfContext = {
    pdf,
    y: 10,
    pageWidth: 420,
    pageHeight: 297,
    margin: 10,
    usableWidth: 400,
    logoData,
  };

  // Compute week label
  let weekLabel = `Semaine ${weekNumber}`;
  if (weekTrucks.length > 0) {
    const firstDate = parseISO(weekTrucks[0].date);
    const ws = startOfWeek(firstDate, { weekStartsOn: 1 });
    const we = endOfWeek(firstDate, { weekStartsOn: 1 });
    weekLabel = `Semaine ${weekNumber} – du ${format(ws, 'dd/MM', { locale: fr })} au ${format(we, 'dd/MM/yyyy', { locale: fr })}`;
  }

  drawHeader(ctx, projectInfo, weekLabel);

  // Group trucks by day
  const grouped = new Map<string, TruckData[]>();
  weekTrucks.forEach(t => {
    if (!grouped.has(t.date)) grouped.set(t.date, []);
    grouped.get(t.date)!.push(t);
  });

  let weekWeight = 0;
  let totalProducts = 0;
  const weekProductCounts: Record<string, number> = {};

  Array.from(grouped.entries()).forEach(([date, dayTrucks]) => {
    drawDayHeader(ctx, date, dayTrucks.length);
    dayTrucks.forEach(truck => {
      const els = getTruckElements(truck.id);
      drawTruckCard(ctx, truck, els);
      weekWeight += getTruckWeight(els);
      els.forEach(el => {
        totalProducts++;
        weekProductCounts[el.productType] = (weekProductCounts[el.productType] || 0) + 1;
      });
    });
  });

  drawSummary(ctx, weekNumber, weekTrucks.length, totalProducts, weekProductCounts, weekWeight, totalSiteWeight, cumulativeWeight);

  pdf.save(`planning_S${weekNumber}_${year}.pdf`);
}

export async function exportAllWeeksPdf(
  weeklyTabs: { weekNumber: number; year: number }[],
  allTrucks: TruckData[],
  getTruckElements: (id: string) => BeamElement[],
  projectInfo: ProjectInfo,
  totalSiteWeight: number,
  allTrucksCumulative: TruckData[]
) {
  const logoData = await loadLogoAsBase64();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  const ctx: PdfContext = {
    pdf,
    y: 10,
    pageWidth: 420,
    pageHeight: 297,
    margin: 10,
    usableWidth: 400,
    logoData,
  };

  weeklyTabs.forEach((w, idx) => {
    const weekTrucks = allTrucks
      .filter(t => {
        const d = parseISO(t.date);
        return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    if (weekTrucks.length === 0) return;

    if (idx > 0) {
      ctx.pdf.addPage();
      ctx.y = ctx.margin;
    }

    const firstDate = parseISO(weekTrucks[0].date);
    const ws = startOfWeek(firstDate, { weekStartsOn: 1 });
    const we = endOfWeek(firstDate, { weekStartsOn: 1 });
    const weekLabel = `Semaine ${w.weekNumber} – du ${format(ws, 'dd/MM', { locale: fr })} au ${format(we, 'dd/MM/yyyy', { locale: fr })}`;

    drawHeader(ctx, projectInfo, weekLabel);

    const grouped = new Map<string, TruckData[]>();
    weekTrucks.forEach(t => {
      if (!grouped.has(t.date)) grouped.set(t.date, []);
      grouped.get(t.date)!.push(t);
    });

    let weekWeight = 0;
    let totalProducts = 0;
    const weekProductCounts: Record<string, number> = {};

    // Cumulative weight up to this week
    const cumulativeWeight = allTrucksCumulative
      .filter(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        return (y < w.year) || (y === w.year && wn <= w.weekNumber);
      })
      .reduce((sum, t) => sum + getTruckWeight(getTruckElements(t.id)), 0);

    Array.from(grouped.entries()).forEach(([date, dayTrucks]) => {
      drawDayHeader(ctx, date, dayTrucks.length);
      dayTrucks.forEach(truck => {
        const els = getTruckElements(truck.id);
        drawTruckCard(ctx, truck, els);
        weekWeight += getTruckWeight(els);
        els.forEach(el => {
          totalProducts++;
          weekProductCounts[el.productType] = (weekProductCounts[el.productType] || 0) + 1;
        });
      });
    });

    drawSummary(ctx, w.weekNumber, weekTrucks.length, totalProducts, weekProductCounts, weekWeight, totalSiteWeight, cumulativeWeight);
  });

  pdf.save(`planning_toutes_semaines.pdf`);
}
