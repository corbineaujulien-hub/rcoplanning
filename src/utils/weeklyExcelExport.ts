import ExcelJS from 'exceljs';
import { parseISO, format } from 'date-fns';
import { BeamElement, ProjectInfo, Team, Truck, TRANSPORT_CATEGORIES } from '@/types/delivery';
import {
  getEffectiveCategory,
  getTruckFactories,
  getTruckWeight,
  getTruckZones,
  getProductCountsByType,
  getTruckMaxLength,
} from './transportUtils';

const THIN_BORDER_COLOR = 'FFD1D5DB';
const HEADER_FILL = 'FF1E3A5F';
const HEADER_TEXT = 'FFFFFFFF';
const DAY_FILL = 'FFDBEAFE';
const ZONE_FILL = 'FFF9FAFB';
const ALT_FILL = 'FFF9FAFB';
const TOTAL_FILL = 'FFE5E7EB';
const SITE_HEADER_FILL = 'FFF3F4F6';
const NAVY = 'FF1E3A5F';
const RED = 'FFDC2626';
const DARK = 'FF1F2937';

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: THIN_BORDER_COLOR } },
  bottom: { style: 'thin' as const, color: { argb: THIN_BORDER_COLOR } },
  left: { style: 'thin' as const, color: { argb: THIN_BORDER_COLOR } },
  right: { style: 'thin' as const, color: { argb: THIN_BORDER_COLOR } },
};

function formatDayFr(dateStr: string): string {
  const d = parseISO(dateStr);
  const s = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sanitizeName(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

function sanitizeSheetName(s: string): string {
  return s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => {
        const s = String(r.result || '');
        const i = s.indexOf(',');
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface BuildSheetArgs {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  trucks: Truck[];
  weekNumber: number;
  year: number;
  projectInfo: ProjectInfo;
  teamLabel?: string;
  getTruckElements: (truckId: string) => BeamElement[];
  logoImageId: number | null;
}

function buildSheet({ workbook, sheetName, trucks, weekNumber, projectInfo, teamLabel, getTruckElements, logoImageId }: BuildSheetArgs) {
  const showTransporter = trucks.some(t => !!t.transporter?.trim());
  const cols = showTransporter
    ? ['Date', 'Heure', 'Usine', 'Transporteur', 'Catégorie', 'Zone + Repères des produits', 'Poids (To)', 'Longueur max (ml)', 'Commentaires']
    : ['Date', 'Heure', 'Usine', 'Catégorie', 'Zone + Repères des produits', 'Poids (To)', 'Longueur max (ml)', 'Commentaires'];
  const nCols = cols.length;

  const ws = workbook.addWorksheet(sheetName);

  const widthMap: Record<string, number> = {
    'Date': 22,
    'Heure': 10,
    'Usine': 10,
    'Transporteur': 16,
    'Catégorie': 20,
    'Zone + Repères des produits': 36,
    'Poids (To)': 12,
    'Longueur max (ml)': 14,
    'Commentaires': 22,
  };
  ws.columns = cols.map(c => ({ width: widthMap[c] || 12 }));

  // Row 1: title (cols C..end if logo present)
  const siteName = (projectInfo.siteName || 'CHANTIER').toUpperCase();
  const title = `${siteName} - RECTOR - Semaine ${weekNumber}${teamLabel ? ' - ' + teamLabel : ''}`;
  const titleStartCol = logoImageId !== null ? 3 : 1;
  ws.getCell(1, titleStartCol).value = title;
  if (titleStartCol < nCols) ws.mergeCells(1, titleStartCol, 1, nCols);
  {
    const c = ws.getCell(1, titleStartCol);
    c.font = { bold: true, size: 14, color: { argb: NAVY } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Row 2: site header
  const leftParts: string[] = [];
  if (projectInfo.otpNumber) leftParts.push(`OTP: ${projectInfo.otpNumber}`);
  if (projectInfo.siteName) leftParts.push(projectInfo.siteName);
  if (projectInfo.siteAddress) leftParts.push(projectInfo.siteAddress);
  if (projectInfo.clientName) leftParts.push(`Client: ${projectInfo.clientName}`);
  const rightParts: string[] = [];
  if (projectInfo.conductor) {
    rightParts.push(`Conducteur: ${projectInfo.conductor}${projectInfo.contactPhone ? ' – ' + projectInfo.contactPhone : ''}`);
  }
  if (projectInfo.subcontractor) rightParts.push(`Poseur: ${projectInfo.subcontractor}`);
  const headerText = [leftParts.join(' | '), rightParts.join(' | ')].filter(Boolean).join('     ');
  ws.getCell(2, titleStartCol).value = headerText;
  if (titleStartCol < nCols) ws.mergeCells(2, titleStartCol, 2, nCols);
  for (let c = titleStartCol; c <= nCols; c++) {
    const cc = ws.getCell(2, c);
    cc.font = { size: 10 };
    cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SITE_HEADER_FILL } } as any;
    cc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cc.border = thinBorder;
  }

  // Row 4: column headers (full width)
  for (let c = 0; c < nCols; c++) {
    const cell = ws.getCell(4, c + 1);
    cell.value = cols[c];
    cell.font = { bold: true, size: 10, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } } as any;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  }

  // Insert Rector logo at A1:B3
  if (logoImageId !== null) {
    ws.addImage(logoImageId, {
      tl: { col: 0, row: 0 } as any,
      br: { col: 2, row: 3 } as any,
      editAs: 'oneCell',
    });
  }

  const byDate = new Map<string, Truck[]>();
  trucks.forEach(t => {
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date)!.push(t);
  });
  const sortedDates = Array.from(byDate.keys()).sort();

  let r = 5;
  let altFlag = false;

  sortedDates.forEach(date => {
    const dayTrucks = byDate.get(date)!.sort((a, b) => a.time.localeCompare(b.time));
    const dayLabel = formatDayFr(date);
    ws.getCell(r, 1).value = dayLabel;
    ws.getCell(r, 2).value = `${dayTrucks.length} camion${dayTrucks.length > 1 ? 's' : ''}`;
    for (let c = 0; c < nCols; c++) {
      const cc = ws.getCell(r, c + 1);
      cc.font = { bold: true, size: 11, color: { argb: NAVY } };
      cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DAY_FILL } } as any;
      cc.alignment = { horizontal: c === 0 ? 'left' : 'center', vertical: 'middle' };
      cc.border = thinBorder;
    }
    r++;

    let prevZoneKey: string | null = null;

    dayTrucks.forEach(t => {
      const els = getTruckElements(t.id);
      const zones = getTruckZones(els);
      const zoneKey = zones.join(' | ');

      if (zoneKey && zoneKey !== prevZoneKey) {
        const groupTrucks = dayTrucks.filter(dt => {
          const dEls = getTruckElements(dt.id);
          return getTruckZones(dEls).join(' | ') === zoneKey;
        });
        const typeSet = new Set<string>();
        groupTrucks.forEach(gt => {
          getTruckElements(gt.id).forEach(e => {
            if (e.productType) typeSet.add(e.productType.toUpperCase());
          });
        });
        const types = Array.from(typeSet);
        const typeLabel = types.length > 0 ? types.join(' + ') : '';
        const cell = ws.getCell(r, 1);
        if (typeLabel) {
          cell.value = {
            richText: [
              { text: `${typeLabel} `, font: { bold: true, italic: true, size: 10, color: { argb: DARK } } },
              { text: zoneKey, font: { bold: true, italic: true, size: 10, color: { argb: RED } } },
            ],
          } as any;
        } else {
          cell.value = zoneKey;
        }
        ws.mergeCells(r, 1, r, nCols);
        for (let c = 0; c < nCols; c++) {
          const cc = ws.getCell(r, c + 1);
          if (c !== 0) cc.font = { italic: true, bold: true, size: 10 };
          cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZONE_FILL } } as any;
          cc.alignment = { horizontal: 'center', vertical: 'middle' };
          cc.border = thinBorder;
        }
        r++;
        prevZoneKey = zoneKey;
      }

      const cat = getEffectiveCategory(t, els);
      const usine = getTruckFactories(els).join(', ');
      const reperes = els.map(e => e.repere).join(', ');
      const weight = getTruckWeight(els);
      const maxLen = getTruckMaxLength(els);
      const transporter = t.transporter?.trim() || '';
      const comment = t.comment?.trim() || '';

      const truckRow: any[] = showTransporter
        ? ['', t.time, usine, transporter, TRANSPORT_CATEGORIES[cat].label, reperes, Number(weight.toFixed(2)), Number(maxLen.toFixed(2)), comment]
        : ['', t.time, usine, TRANSPORT_CATEGORIES[cat].label, reperes, Number(weight.toFixed(2)), Number(maxLen.toFixed(2)), comment];
      for (let c = 0; c < nCols; c++) ws.getCell(r, c + 1).value = truckRow[c];

      const rowFill = altFlag ? ALT_FILL : 'FFFFFFFF';
      for (let c = 0; c < nCols; c++) {
        const isWeight = cols[c] === 'Poids (To)';
        const isLen = cols[c] === 'Longueur max (ml)';
        const isComment = cols[c] === 'Commentaires';
        const cc = ws.getCell(r, c + 1);
        cc.font = { size: 10, ...(isComment && comment ? { color: { argb: RED } } : {}) };
        cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } } as any;
        cc.alignment = {
          horizontal: c === cols.indexOf('Zone + Repères des produits') || c === cols.indexOf('Commentaires') ? 'left' : 'center',
          vertical: 'middle',
          wrapText: true,
        };
        cc.border = thinBorder;
        if (isWeight || isLen) cc.numFmt = '0.00';
      }
      altFlag = !altFlag;
      r++;
    });
  });

  // Total row
  const totalTrucks = trucks.length;
  let totalWeight = 0;
  const counts: Record<string, number> = {};
  trucks.forEach(t => {
    const els = getTruckElements(t.id);
    totalWeight += getTruckWeight(els);
    const c = getProductCountsByType(els);
    Object.entries(c).forEach(([k, v]) => {
      counts[k] = (counts[k] || 0) + v;
    });
  });
  const totalProducts = Object.values(counts).reduce((a, b) => a + b, 0);
  const detailLines = Object.entries(counts).map(([k, v]) => `     ${v}x ${k}`);
  const countsStr = [`${totalProducts} produits`, ...detailLines].join('\n');

  const zoneColIdx = cols.indexOf('Zone + Repères des produits');
  const weightColIdx = cols.indexOf('Poids (To)');
  ws.getCell(r, 2).value = `${totalTrucks} camion${totalTrucks > 1 ? 's' : ''}`;
  ws.getCell(r, zoneColIdx + 1).value = countsStr;
  ws.getCell(r, weightColIdx + 1).value = Number(totalWeight.toFixed(2));
  for (let c = 0; c < nCols; c++) {
    const isZoneCol = c === zoneColIdx;
    const cc = ws.getCell(r, c + 1);
    cc.font = { bold: true, size: 10 };
    cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } } as any;
    cc.alignment = { horizontal: isZoneCol ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cc.border = {
      ...thinBorder,
      top: { style: 'medium', color: { argb: NAVY } },
    };
    if (cols[c] === 'Poids (To)') cc.numFmt = '0.00 " To"';
  }

  ws.getRow(1).height = 24;
  ws.getRow(2).height = 30;
  ws.getRow(3).height = 8;
  ws.getRow(4).height = 24;
  const detailCount = Object.keys(counts).length;
  ws.getRow(r).height = Math.max(20, 16 * (1 + detailCount));
}

export interface ExportWeeklyArgs {
  selectedWeeks: { weekNumber: number; year: number }[];
  allowedTrucks: Truck[];
  getTruckElements: (truckId: string) => BeamElement[];
  projectInfo: ProjectInfo;
  teams: Team[];
  filenameSuffix?: string;
  teamLabelForFilename?: string;
  mode: 'single' | 'all';
}

export async function exportWeeklyExcelStyled(args: ExportWeeklyArgs) {
  const { selectedWeeks, allowedTrucks, getTruckElements, projectInfo, teams, filenameSuffix = '', teamLabelForFilename, mode } = args;

  const hasMultipleTeams = teams.length > 1;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RECTOR';
  workbook.created = new Date();

  const logoBase64 = await loadLogoBase64();
  const logoImageId = logoBase64
    ? workbook.addImage({ base64: logoBase64, extension: 'png' })
    : null;

  const sortedWeeks = [...selectedWeeks].sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);

  sortedWeeks.forEach(w => {
    const weekTrucks = allowedTrucks
      .filter(t => {
        const d = parseISO(t.date);
        return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    if (weekTrucks.length === 0) return;

    if (hasMultipleTeams) {
      const teamOrder = [...teams].sort((a, b) => a.sortOrder - b.sortOrder);
      const buckets: { id: string | null; name: string; trucks: Truck[] }[] = [];
      teamOrder.forEach(t => {
        const ts = weekTrucks.filter(tr => tr.teamId === t.id);
        if (ts.length) buckets.push({ id: t.id, name: t.name, trucks: ts });
      });
      const unassigned = weekTrucks.filter(tr => !tr.teamId);
      if (unassigned.length) buckets.push({ id: null, name: 'Sans équipe', trucks: unassigned });

      buckets.forEach(b => {
        const sheetName = sanitizeSheetName(`SEMAINE ${String(w.weekNumber).padStart(2, '0')} - ${b.name}`);
        buildSheet({
          workbook,
          sheetName,
          trucks: b.trucks,
          weekNumber: w.weekNumber,
          year: w.year,
          projectInfo,
          teamLabel: b.name,
          getTruckElements,
          logoImageId,
        });
      });
    } else {
      const sheetName = sanitizeSheetName(`SEMAINE ${String(w.weekNumber).padStart(2, '0')}`);
      buildSheet({
        workbook,
        sheetName,
        trucks: weekTrucks,
        weekNumber: w.weekNumber,
        year: w.year,
        projectInfo,
        getTruckElements,
        logoImageId,
      });
    }
  });

  const nomChantier = projectInfo.siteName ? sanitizeName(projectInfo.siteName) : 'CHANTIER';
  const lastYear = sortedWeeks[sortedWeeks.length - 1]?.year || new Date().getFullYear();
  const teamSuffix = teamLabelForFilename ? '_' + sanitizeName(teamLabelForFilename) : '';

  let filename: string;
  if (mode === 'single' && sortedWeeks.length === 1) {
    filename = `planning_${nomChantier}_S${String(sortedWeeks[0].weekNumber).padStart(2, '0')}_${sortedWeeks[0].year}${filenameSuffix}${teamSuffix}.xlsx`;
  } else {
    filename = `planning_${nomChantier}_complet_${lastYear}${filenameSuffix}${teamSuffix}.xlsx`;
  }

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
