import XLSXStyle from 'xlsx-js-style';
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

const THIN_BORDER_COLOR = 'D1D5DB';
const HEADER_FILL = '1E3A5F';
const HEADER_TEXT = 'FFFFFF';
const DAY_FILL = 'DBEAFE';
const ZONE_FILL = 'F9FAFB';
const ALT_FILL = 'F9FAFB';
const TOTAL_FILL = 'E5E7EB';
const SITE_HEADER_FILL = 'F3F4F6';

const thinBorder = {
  top: { style: 'thin', color: { rgb: THIN_BORDER_COLOR } },
  bottom: { style: 'thin', color: { rgb: THIN_BORDER_COLOR } },
  left: { style: 'thin', color: { rgb: THIN_BORDER_COLOR } },
  right: { style: 'thin', color: { rgb: THIN_BORDER_COLOR } },
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

interface BuildSheetArgs {
  trucks: Truck[];
  weekNumber: number;
  year: number;
  projectInfo: ProjectInfo;
  teamLabel?: string;
  getTruckElements: (truckId: string) => BeamElement[];
}

function buildSheet({ trucks, weekNumber, projectInfo, teamLabel, getTruckElements }: BuildSheetArgs) {
  // Determine if transporter column needed
  const showTransporter = trucks.some(t => !!t.transporter?.trim());
  const cols = showTransporter
    ? ['Date', 'Heure', 'Usine', 'Transporteur', 'Catégorie', 'Zone + Repères des produits', 'Poids (To)', 'Longueur max (ml)', 'Commentaires']
    : ['Date', 'Heure', 'Usine', 'Catégorie', 'Zone + Repères des produits', 'Poids (To)', 'Longueur max (ml)', 'Commentaires'];
  const nCols = cols.length;
  const lastColLetter = String.fromCharCode(64 + nCols); // up to H

  const aoa: any[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const styles: Record<string, any> = {};

  const setStyle = (r: number, c: number, st: any) => {
    const addr = XLSXStyle.utils.encode_cell({ r, c });
    styles[addr] = st;
  };

  // Row 1: title
  const siteName = (projectInfo.siteName || 'CHANTIER').toUpperCase();
  const title = `${siteName} - RECTOR - Semaine ${weekNumber}${teamLabel ? ' - ' + teamLabel : ''}`;
  aoa.push([title, ...Array(nCols - 1).fill('')]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } });
  setStyle(0, 0, {
    font: { bold: true, sz: 14, color: { rgb: '1E3A5F' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });

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
  aoa.push([headerText, ...Array(nCols - 1).fill('')]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } });
  setStyle(1, 0, {
    font: { sz: 10 },
    fill: { patternType: 'solid', fgColor: { rgb: SITE_HEADER_FILL } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: thinBorder,
  });

  // Row 3: empty separator
  aoa.push(Array(nCols).fill(''));

  // Row 4: column headers
  aoa.push(cols);
  for (let c = 0; c < nCols; c++) {
    setStyle(3, c, {
      font: { bold: true, sz: 10, color: { rgb: HEADER_TEXT } },
      fill: { patternType: 'solid', fgColor: { rgb: HEADER_FILL } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder,
    });
  }

  // Data rows
  const byDate = new Map<string, Truck[]>();
  trucks.forEach(t => {
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date)!.push(t);
  });
  const sortedDates = Array.from(byDate.keys()).sort();

  let r = aoa.length;
  let altFlag = false;

  sortedDates.forEach(date => {
    const dayTrucks = byDate.get(date)!.sort((a, b) => a.time.localeCompare(b.time));

    // Day row
    const dayLabel = formatDayFr(date);
    const row = Array(nCols).fill('');
    row[0] = dayLabel;
    row[1] = `${dayTrucks.length} camion${dayTrucks.length > 1 ? 's' : ''}`;
    aoa.push(row);
    for (let c = 0; c < nCols; c++) {
      setStyle(r, c, {
        font: { bold: true, sz: 11, color: { rgb: '1E3A5F' } },
        fill: { patternType: 'solid', fgColor: { rgb: DAY_FILL } },
        alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
        border: thinBorder,
      });
    }
    r++;

    let prevZoneKey: string | null = null;

    dayTrucks.forEach(t => {
      const els = getTruckElements(t.id);
      const zones = getTruckZones(els);
      const zoneKey = zones.join(' | ');

      if (zoneKey && zoneKey !== prevZoneKey) {
        // Compute group label = product types + zone, for all trucks in this day sharing the zone
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
        const label = types.length > 0 ? `${types.join(' + ')} ${zoneKey}` : zoneKey;
        const zoneRow = Array(nCols).fill('');
        zoneRow[0] = label;
        aoa.push(zoneRow);
        merges.push({ s: { r, c: 0 }, e: { r, c: nCols - 1 } });
        for (let c = 0; c < nCols; c++) {
          setStyle(r, c, {
            font: { italic: true, sz: 10, bold: true },
            fill: { patternType: 'solid', fgColor: { rgb: ZONE_FILL } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: thinBorder,
          });
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
      aoa.push(truckRow);

      const rowFill = altFlag ? ALT_FILL : 'FFFFFF';
      for (let c = 0; c < nCols; c++) {
        const isWeight = cols[c] === 'Poids (To)';
        const isLen = cols[c] === 'Longueur max (ml)';
        const isComment = cols[c] === 'Commentaires';
        setStyle(r, c, {
          font: { sz: 10, ...(isComment && comment ? { color: { rgb: 'DC2626' } } : {}) },
          fill: { patternType: 'solid', fgColor: { rgb: rowFill } },
          alignment: {
            horizontal: c === cols.indexOf('Zone + Repères des produits') || c === cols.indexOf('Commentaires') ? 'left' : 'center',
            vertical: 'center',
            wrapText: true,
          },
          border: thinBorder,
          ...(isWeight || isLen ? { numFmt: '0.00' } : {}),
        });
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
  const detailLines = Object.entries(counts).map(([k, v]) => `     ${v}x ${k}${v > 1 ? 's' : ''}`);
  const countsStr = [`${totalProducts} produits`, ...detailLines].join('\n');

  const totalRow: any[] = Array(nCols).fill('');
  totalRow[1] = `${totalTrucks} camion${totalTrucks > 1 ? 's' : ''}`;
  totalRow[cols.indexOf('Zone + Repères des produits')] = countsStr;
  totalRow[cols.indexOf('Poids (To)')] = Number(totalWeight.toFixed(2));
  aoa.push(totalRow);
  for (let c = 0; c < nCols; c++) {
    const isZoneCol = c === cols.indexOf('Zone + Repères des produits');
    setStyle(r, c, {
      font: { bold: true, sz: 10 },
      fill: { patternType: 'solid', fgColor: { rgb: TOTAL_FILL } },
      alignment: { horizontal: isZoneCol ? 'left' : 'center', vertical: 'center', wrapText: true },
      border: {
        ...thinBorder,
        top: { style: 'medium', color: { rgb: '1E3A5F' } },
      },
      ...(cols[c] === 'Poids (To)' ? { numFmt: '0.00 " To"' } : {}),
    });
  }
  // Auto-adjust total row height based on product detail lines
  const totalRowIdx = r;

  // Build sheet
  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  // Apply styles
  Object.entries(styles).forEach(([addr, st]) => {
    if (!ws[addr]) ws[addr] = { v: '', t: 's' };
    (ws[addr] as any).s = st;
  });

  // Merges
  ws['!merges'] = merges;

  // Column widths
  const widthMap: Record<string, number> = {
    'Date': 22,
    'Heure': 8,
    'Usine': 10,
    'Transporteur': 16,
    'Catégorie': 20,
    'Zone + Repères des produits': 36,
    'Poids (To)': 12,
    'Longueur max (ml)': 14,
    'Commentaires': 22,
  };
  ws['!cols'] = cols.map(c => ({ wch: widthMap[c] || 12 }));

  // Row heights
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 24 };
  ws['!rows'][1] = { hpt: 30 };
  ws['!rows'][3] = { hpt: 24 };
  // total row height = base + lines
  const detailCount = Object.keys(counts).length;
  ws['!rows'][totalRowIdx] = { hpt: Math.max(20, 16 * (1 + detailCount)) };

  return { ws, lastColLetter };
}

export interface ExportWeeklyArgs {
  selectedWeeks: { weekNumber: number; year: number }[];
  // trucks to include: pre-filtered (e.g. by displayed/filtered list)
  allowedTrucks: Truck[];
  // all trucks of project (used for global indexing if needed) — not strictly needed since allowedTrucks is enough
  getTruckElements: (truckId: string) => BeamElement[];
  projectInfo: ProjectInfo;
  teams: Team[];
  filenameSuffix?: string;
  // optional team label to append to filename (single-week export with team filter)
  teamLabelForFilename?: string;
  // mode: single week or all weeks
  mode: 'single' | 'all';
}

export function exportWeeklyExcelStyled(args: ExportWeeklyArgs) {
  const { selectedWeeks, allowedTrucks, getTruckElements, projectInfo, teams, filenameSuffix = '', teamLabelForFilename, mode } = args;

  const hasMultipleTeams = teams.length > 1;

  const wb = XLSXStyle.utils.book_new();

  const sortedWeeks = [...selectedWeeks].sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);

  sortedWeeks.forEach(w => {
    const weekTrucks = allowedTrucks
      .filter(t => {
        const d = parseISO(t.date);
        return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    if (weekTrucks.length === 0) return;

    // group by team if multi
    if (hasMultipleTeams) {
      // build team buckets in team sort order, plus "Sans équipe"
      const teamOrder = [...teams].sort((a, b) => a.sortOrder - b.sortOrder);
      const buckets: { id: string | null; name: string; trucks: Truck[] }[] = [];
      teamOrder.forEach(t => {
        const ts = weekTrucks.filter(tr => tr.teamId === t.id);
        if (ts.length) buckets.push({ id: t.id, name: t.name, trucks: ts });
      });
      const unassigned = weekTrucks.filter(tr => !tr.teamId);
      if (unassigned.length) buckets.push({ id: null, name: 'Sans équipe', trucks: unassigned });

      buckets.forEach(b => {
        const { ws } = buildSheet({
          trucks: b.trucks,
          weekNumber: w.weekNumber,
          year: w.year,
          projectInfo,
          teamLabel: b.name,
          getTruckElements,
        });
        const sheetName = sanitizeSheetName(`SEMAINE ${String(w.weekNumber).padStart(2, '0')} - ${b.name}`);
        XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);
      });
    } else {
      const { ws } = buildSheet({
        trucks: weekTrucks,
        weekNumber: w.weekNumber,
        year: w.year,
        projectInfo,
        getTruckElements,
      });
      const sheetName = sanitizeSheetName(`SEMAINE ${String(w.weekNumber).padStart(2, '0')}`);
      XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);
    }
  });

  // Filename
  const nomChantier = projectInfo.siteName ? sanitizeName(projectInfo.siteName) : 'CHANTIER';
  const lastYear = sortedWeeks[sortedWeeks.length - 1]?.year || new Date().getFullYear();
  const teamSuffix = teamLabelForFilename ? '_' + sanitizeName(teamLabelForFilename) : '';

  let filename: string;
  if (mode === 'single' && sortedWeeks.length === 1) {
    filename = `planning_${nomChantier}_S${String(sortedWeeks[0].weekNumber).padStart(2, '0')}_${sortedWeeks[0].year}${filenameSuffix}${teamSuffix}.xlsx`;
  } else {
    filename = `planning_${nomChantier}_complet_${lastYear}${filenameSuffix}${teamSuffix}.xlsx`;
  }

  XLSXStyle.writeFile(wb, filename);
}