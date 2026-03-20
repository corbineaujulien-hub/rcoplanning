import jsPDF from 'jspdf';
import { BeamElement, TransportCategory, TRANSPORT_CATEGORIES, ProjectInfo } from '@/types/delivery';
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories, getTruckZones, getFactoryColor } from '@/utils/transportUtils';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TruckData {
  id: string;
  number: string;
  date: string;
  time: string;
  comment?: string;
  transporter?: string;
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

function getCatBorderColor(cat: TransportCategory): string {
  return cat === 'standard' ? '#22c55e' : cat === 'cat1' ? '#eab308' : cat === 'cat2' ? '#f97316' : '#ef4444';
}

function groupByType(els: BeamElement[]): Record<string, BeamElement[]> {
  const groups: Record<string, BeamElement[]> = {};
  els.forEach(el => {
    if (!groups[el.productType]) groups[el.productType] = [];
    groups[el.productType].push(el);
  });
  return groups;
}

function drawHeader(ctx: PdfContext, projectInfo: ProjectInfo, weekNumber: number, weekLabel: string) {
  const { pdf, margin, usableWidth } = ctx;

  if (ctx.logoData) {
    try {
      pdf.addImage(ctx.logoData, 'PNG', margin, ctx.y, 36, 12);
    } catch { /* ignore */ }
  }

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 58, 95);
  const titleText = projectInfo.siteName
    ? `${projectInfo.siteName} — RECTOR – Semaine ${weekNumber}`
    : `RECTOR – Semaine ${weekNumber}`;
  const titleW = pdf.getTextWidth(titleText);
  pdf.text(titleText, margin + (usableWidth - titleW) / 2, ctx.y + 8);

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  const dateStr = `Édité le ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`;
  pdf.text(dateStr, margin + usableWidth - pdf.getTextWidth(dateStr), ctx.y + 8);

  ctx.y += 13;

  pdf.setFontSize(7);
  const leftParts: string[] = [];
  if (projectInfo.otpNumber) leftParts.push(`OTP: ${projectInfo.otpNumber}`);
  if (projectInfo.siteName) leftParts.push(projectInfo.siteName);
  if (projectInfo.siteAddress) leftParts.push(projectInfo.siteAddress);
  if (projectInfo.clientName) leftParts.push(`Client: ${projectInfo.clientName}`);

  const rightParts: string[] = [];
  if (projectInfo.conductor) rightParts.push(`Conducteur: ${projectInfo.conductor}`);
  if (projectInfo.subcontractor) rightParts.push(`Poseur: ${projectInfo.subcontractor}`);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(50, 50, 50);
  const leftText = leftParts.join(' | ');
  pdf.text(leftText, margin, ctx.y + 3, { maxWidth: usableWidth * 0.6 });

  const rightText = rightParts.join(' | ');
  const rtW = pdf.getTextWidth(rightText);
  pdf.text(rightText, margin + usableWidth - rtW, ctx.y + 3);

  ctx.y += 6;

  pdf.setDrawColor(30, 58, 95);
  pdf.setLineWidth(0.4);
  pdf.line(margin, ctx.y, margin + usableWidth, ctx.y);
  ctx.y += 2;
}

function drawDayHeader(ctx: PdfContext, date: string, truckCount: number) {
  ensureSpace(ctx, 8);
  const { pdf, margin, usableWidth } = ctx;
  drawRoundedRect(pdf, margin, ctx.y, usableWidth, 6, 1, '#1e3a5f');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  const dayLabel = format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr });
  const capitalDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
  pdf.text(`${capitalDay} — ${truckCount} camion${truckCount > 1 ? 's' : ''}`, margin + 3, ctx.y + 4.2);
  ctx.y += 7.5;
}

function drawSummary(
  ctx: PdfContext,
  weekNumber: number,
  truckCount: number,
  totalProducts: number,
  weekProductCounts: Record<string, number>,
  weekWeight: number,
  totalSiteWeight: number,
  cumulativeWeight: number,
  cumulativeByType?: Record<string, number>,
  totalByType?: Record<string, number>
) {
  const productTypeCount = Object.keys(weekProductCounts).length;
  const cumulativeTypeCount = cumulativeByType ? Object.keys(cumulativeByType).length : 0;
  const maxSubLines = Math.max(productTypeCount, cumulativeTypeCount);
  const productSubHeight = maxSubLines * 3.5;
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

    if (i === 4 && cumulativeByType && totalByType) {
      let subY = colY + 13;
      pdf.setFontSize(5.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      Object.entries(cumulativeByType).forEach(([type, cumW]) => {
        const total = totalByType[type] || 0;
        const pct = total > 0 ? Math.round((cumW / total) * 100) : 0;
        pdf.text(`${type} : ${pct}%`, cx + 2, subY);
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
  cumulativeByType?: Record<string, number>;
  totalByType?: Record<string, number>;
  factorySuffix?: string;
}

function estimateTruckHeight(els: BeamElement[], hasComment: boolean, columnWidth: number, hasTransporter: boolean = false): number {
  const grouped = groupByType(els);
  let repereLineCount = 0;
  const availW = columnWidth - 5;
  Object.values(grouped).forEach(typeEls => {
    const perLine = Math.max(1, Math.floor(availW / 10));
    repereLineCount += Math.ceil(typeEls.length / perLine) || 1;
  });
  const typeHeaders = Object.keys(grouped).length;
  return 6 + 5 + (typeHeaders * 3 + repereLineCount * 4) + (hasComment ? 5.5 : 0) + (hasTransporter ? 5 : 0) + 3 + 3;
}

function drawTruckCard(ctx: PdfContext, truck: TruckData, els: BeamElement[], columnWidth: number, startX: number, startY: number): number {
  const { pdf } = ctx;
  const cat = getTransportCategory(els);
  const catInfo = TRANSPORT_CATEGORIES[cat];
  const weight = getTruckWeight(els);
  const maxLen = getTruckMaxLength(els);
  const factories = getTruckFactories(els);
  const zones = getTruckZones(els);
  const borderColor = getCatBorderColor(cat);

  const cardHeight = estimateTruckHeight(els, !!truck.comment?.trim(), columnWidth, !!truck.transporter?.trim());

  const cardX = startX;
  const cardW = columnWidth;
  const cardY = startY;
  const borderW = 1;

  drawRoundedRect(pdf, cardX, cardY, cardW, cardHeight, 1.5, '#ffffff', '#d1d5db');
  pdf.setFillColor(...hexToRgb(borderColor));
  pdf.rect(cardX, cardY + 0.8, borderW, cardHeight - 1.6, 'F');

  let x = cardX + borderW + 2;
  let y = cardY + 1.5;

  const numBadge = drawBadge(ctx, x, y, `${truck.number} — ${truck.time}`, '#1e3a5f', '#ffffff', 7);
  x += numBadge.w + 2;
  const catBadge = drawBadge(ctx, x, y, catInfo.label, borderColor, '#ffffff', 5.5);
  x += catBadge.w + 2;
  factories.forEach(f => {
    if (x + 10 > cardX + cardW - 2) { x = cardX + borderW + 2; y += numBadge.h + 0.5; }
    const fb = drawBadge(ctx, x, y, f, getFactoryColor(f), '#ffffff', 5.5);
    x += fb.w + 1.5;
  });
  if (zones.length > 0) {
    zones.forEach(z => {
      if (x + 10 > cardX + cardW - 2) { x = cardX + borderW + 2; y += numBadge.h + 0.5; }
      const zb = drawBadge(ctx, x, y, z, '#e2e8f0', '#334155', 5);
      x += zb.w + 1.5;
    });
  }
  y += numBadge.h + 1;

  x = cardX + borderW + 2;
  pdf.setFontSize(6);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Poids : ', x, y + 3.2);
  x += pdf.getTextWidth('Poids : ');
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  const weightVal = `${weight.toFixed(2)} t`;
  pdf.text(weightVal, x, y + 3.2);
  x += pdf.getTextWidth(weightVal) + 1.5;

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(180, 180, 180);
  pdf.text('|', x, y + 3.2);
  x += 2;

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Long. max : ', x, y + 3.2);
  x += pdf.getTextWidth('Long. max : ');
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  const lenVal = `${maxLen.toFixed(2)} m`;
  pdf.text(lenVal, x, y + 3.2);
  x += pdf.getTextWidth(lenVal) + 1.5;

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(180, 180, 180);
  pdf.text('|', x, y + 3.2);
  x += 2;

  const counts = els.reduce((acc: Record<string, number>, el) => { acc[el.productType] = (acc[el.productType] || 0) + 1; return acc; }, {});
  Object.entries(counts).forEach(([type, count]) => {
    if (x + 12 > cardX + cardW - 2) { x = cardX + borderW + 2; y += 4; }
    const cb = drawBadge(ctx, x, y + 0.5, `${count}× ${type}`, '#e2e8f0', '#334155', 5);
    x += cb.w + 1.5;
  });
  if (truck.transporter?.trim()) {
    if (x + 20 > cardX + cardW - 2) { x = cardX + borderW + 2; y += 4; }
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(180, 180, 180);
    pdf.text('|', x, y + 3.2);
    x += 2;
    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(249, 115, 22);
    pdf.text(truck.transporter.trim(), x, y + 3.2, { maxWidth: cardX + cardW - x - 2 });
  }
  y += 5;

  const grouped = groupByType(els);
  Object.entries(grouped).forEach(([type, typeEls]) => {
    x = cardX + borderW + 2;
    pdf.setFontSize(5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 58, 95);
    pdf.text(`${type}:`, x, y + 3);
    x += pdf.getTextWidth(`${type}:`) + 1.5;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 58, 95);
    typeEls.forEach(el => {
      const rw = pdf.getTextWidth(el.repere);
      if (x + rw + 3 > cardX + cardW - 2) {
        x = cardX + borderW + 2;
        y += 3.5;
      }
      drawRoundedRect(pdf, x, y + 0.5, rw + 2, 3, 0.8, '#dbeafe');
      pdf.setFontSize(5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 58, 95);
      pdf.text(el.repere, x + 1, y + 2.8);
      x += rw + 3;
    });
    y += 4;
  });


  if (truck.comment?.trim()) {
    x = cardX + borderW + 2;
    drawRoundedRect(pdf, x, y, cardW - borderW - 4, 4.5, 0.8, '#fffbeb', '#fde68a');
    pdf.setFontSize(5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(146, 64, 14);
    pdf.text(truck.comment.trim(), x + 1.5, y + 3, { maxWidth: cardW - borderW - 8 });
  }

  return cardY + cardHeight;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function drawDayBannerRecall(ctx: PdfContext, dayLabel: string) {
  const { pdf, margin, usableWidth } = ctx;
  drawRoundedRect(pdf, margin, ctx.y, usableWidth, 6, 1, '#e5e7eb');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(...hexToRgb('#6b7280'));
  pdf.text(`${dayLabel} — Rappel`, margin + 3, ctx.y + 4.2);
  ctx.y += 7.5;
}

function drawDayTrucks3Columns(
  ctx: PdfContext,
  dayTrucks: TruckData[],
  dayLabel: string,
  getTruckElements: (id: string) => BeamElement[],
  stats: { weekWeight: number; totalProducts: number; weekProductCounts: Record<string, number> }
) {
  const { margin, usableWidth } = ctx;
  const colGap = 4;
  const colW = (usableWidth - 2 * colGap) / 3;

  const lines = chunk(dayTrucks, 3);
  let isFirstRowOfDay = true;

  lines.forEach(line => {
    const rowHeight = Math.max(...line.map(truck => {
      const els = getTruckElements(truck.id);
      return estimateTruckHeight(els, !!truck.comment?.trim(), colW, !!truck.transporter?.trim());
    })) + 1;

    if (ctx.y + rowHeight > ctx.pageHeight - ctx.margin) {
      ctx.pdf.addPage();
      ctx.y = ctx.margin;
      if (!isFirstRowOfDay) {
        drawDayBannerRecall(ctx, dayLabel);
      }
    }

    line.forEach((truck, i) => {
      const x = margin + i * (colW + colGap);
      const els = getTruckElements(truck.id);
      drawTruckCard(ctx, truck, els, colW, x, ctx.y);

      stats.weekWeight += getTruckWeight(els);
      els.forEach(el => {
        stats.totalProducts++;
        stats.weekProductCounts[el.productType] = (stats.weekProductCounts[el.productType] || 0) + 1;
      });
    });

    ctx.y += rowHeight;
    isFirstRowOfDay = false;
  });

  ctx.y += 2;
}

function getNomChantier(projectInfo: ProjectInfo): string {
  return projectInfo.siteName
    ? projectInfo.siteName.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
    : 'CHANTIER';
}

export async function exportWeekPdf(data: WeekExportData) {
  const { weekNumber, year, trucks: weekTrucks, getTruckElements, projectInfo, totalSiteWeight, cumulativeWeight } = data;

  const logoData = await loadLogoAsBase64();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const ctx: PdfContext = {
    pdf,
    y: 8,
    pageWidth: 297,
    pageHeight: 210,
    margin: 8,
    usableWidth: 281,
    logoData,
  };

  drawHeader(ctx, projectInfo, weekNumber, `Semaine ${weekNumber}`);

  const grouped = new Map<string, TruckData[]>();
  weekTrucks.forEach(t => {
    if (!grouped.has(t.date)) grouped.set(t.date, []);
    grouped.get(t.date)!.push(t);
  });

  const stats = { weekWeight: 0, totalProducts: 0, weekProductCounts: {} as Record<string, number> };

  Array.from(grouped.entries()).forEach(([date, dayTrucks]) => {
    const colGap = 4;
    const colW = (ctx.usableWidth - 2 * colGap) / 3;
    const dayLabel = format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr });
    const capitalDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
    const firstLine = dayTrucks.slice(0, 3);
    const firstRowHeight = Math.max(...firstLine.map(t => {
      const els = getTruckElements(t.id);
      return estimateTruckHeight(els, !!t.comment?.trim(), colW, !!t.transporter?.trim());
    })) + 1;
    const dayBannerHeight = 7.5;
    if (ctx.y + dayBannerHeight + firstRowHeight > ctx.pageHeight - ctx.margin) {
      ctx.pdf.addPage();
      ctx.y = ctx.margin;
    }
    drawDayHeader(ctx, date, dayTrucks.length);
    drawDayTrucks3Columns(ctx, dayTrucks, capitalDay, getTruckElements, stats);
  });

  drawSummary(ctx, weekNumber, weekTrucks.length, stats.totalProducts, stats.weekProductCounts, stats.weekWeight, totalSiteWeight, cumulativeWeight, data.cumulativeByType, data.totalByType);

  const nomChantier = getNomChantier(projectInfo);
  const suffix = data.factorySuffix || '';
  pdf.save(`planning_${nomChantier}_S${String(weekNumber).padStart(2, '0')}_${year}${suffix}.pdf`);
}

export async function exportAllWeeksPdf(
  weeklyTabs: { weekNumber: number; year: number }[],
  allTrucks: TruckData[],
  getTruckElements: (id: string) => BeamElement[],
  projectInfo: ProjectInfo,
  totalSiteWeight: number,
  allTrucksCumulative: TruckData[],
  allElements?: BeamElement[]
) {
  const logoData = await loadLogoAsBase64();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const ctx: PdfContext = {
    pdf,
    y: 8,
    pageWidth: 297,
    pageHeight: 210,
    margin: 8,
    usableWidth: 281,
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

    drawHeader(ctx, projectInfo, w.weekNumber, `Semaine ${w.weekNumber}`);

    const grouped = new Map<string, TruckData[]>();
    weekTrucks.forEach(t => {
      if (!grouped.has(t.date)) grouped.set(t.date, []);
      grouped.get(t.date)!.push(t);
    });

    const stats = { weekWeight: 0, totalProducts: 0, weekProductCounts: {} as Record<string, number> };

    const cumulativeWeight = allTrucksCumulative
      .filter(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        return (y < w.year) || (y === w.year && wn <= w.weekNumber);
      })
      .reduce((sum, t) => sum + getTruckWeight(getTruckElements(t.id)), 0);

    Array.from(grouped.entries()).forEach(([date, dayTrucks]) => {
      const colGap = 4;
      const colW = (ctx.usableWidth - 2 * colGap) / 3;
      const dayLabel = format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr });
      const capitalDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
      const firstLine = dayTrucks.slice(0, 3);
      const firstRowHeight = Math.max(...firstLine.map(t => {
        const els = getTruckElements(t.id);
        return estimateTruckHeight(els, !!t.comment?.trim(), colW, !!t.transporter?.trim());
      })) + 1;
      const dayBannerHeight = 7.5;
      if (ctx.y + dayBannerHeight + firstRowHeight > ctx.pageHeight - ctx.margin) {
        ctx.pdf.addPage();
        ctx.y = ctx.margin;
      }
      drawDayHeader(ctx, date, dayTrucks.length);
      drawDayTrucks3Columns(ctx, dayTrucks, capitalDay, getTruckElements, stats);
    });

    // Compute cumulative by type for this week
    const cumByType: Record<string, number> = {};
    allTrucksCumulative
      .filter(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        return (y < w.year) || (y === w.year && wn <= w.weekNumber);
      })
      .forEach(t => {
        getTruckElements(t.id).forEach(el => {
          cumByType[el.productType] = (cumByType[el.productType] || 0) + el.weight;
        });
      });
    const totByType: Record<string, number> = {};
    if (allElements) {
      allElements.forEach(el => {
        totByType[el.productType] = (totByType[el.productType] || 0) + el.weight;
      });
    }

    drawSummary(ctx, w.weekNumber, weekTrucks.length, stats.totalProducts, stats.weekProductCounts, stats.weekWeight, totalSiteWeight, cumulativeWeight, cumByType, allElements ? totByType : undefined);
  });

  const nomChantier = getNomChantier(projectInfo);
  const lastYear = weeklyTabs[weeklyTabs.length - 1]?.year || new Date().getFullYear();
  pdf.save(`planning_${nomChantier}_complet_${lastYear}.pdf`);
}
