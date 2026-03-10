import { useMemo, useCallback } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories, getProductCountsByType, getCategoryColorClass } from '@/utils/transportUtils';
import { TRANSPORT_CATEGORIES, BeamElement } from '@/types/delivery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck as TruckIcon, Weight, Ruler, Factory, Package, FileSpreadsheet, Download, MessageSquare } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface WeeklyPlanningTabProps {
  weekNumber: number;
  year: number;
}

export default function WeeklyPlanningTab({ weekNumber, year }: WeeklyPlanningTabProps) {
  const { projectInfo, trucks, elements, getTruckElements } = useDelivery();

  const weekTrucks = useMemo(() => {
    return trucks
      .filter(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        return wn === weekNumber && y === year;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [trucks, weekNumber, year]);

  const weekStart = useMemo(() => {
    if (weekTrucks.length === 0) return null;
    const firstDate = parseISO(weekTrucks[0].date);
    return startOfWeek(firstDate, { weekStartsOn: 1 });
  }, [weekTrucks]);

  const weekEnd = useMemo(() => {
    if (!weekStart) return null;
    return endOfWeek(weekStart, { weekStartsOn: 1 });
  }, [weekStart]);

  const totalSiteWeight = useMemo(() => elements.reduce((s, e) => s + e.weight, 0), [elements]);
  const weekWeight = useMemo(() => {
    return weekTrucks.reduce((sum, t) => sum + getTruckWeight(getTruckElements(t.id)), 0);
  }, [weekTrucks, getTruckElements]);

  const cumulativeWeight = useMemo(() => {
    const allWeeksBefore = trucks
      .filter(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        return (y < year) || (y === year && wn <= weekNumber);
      });
    return allWeeksBefore.reduce((sum, t) => sum + getTruckWeight(getTruckElements(t.id)), 0);
  }, [trucks, weekNumber, year, getTruckElements]);

  const weekProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    weekTrucks.forEach(t => {
      getTruckElements(t.id).forEach(el => {
        counts[el.productType] = (counts[el.productType] || 0) + 1;
      });
    });
    return counts;
  }, [weekTrucks, getTruckElements]);

  const totalProducts = Object.values(weekProductCounts).reduce((s, c) => s + c, 0);

  const exportExcel = () => {
    const data = weekTrucks.map(t => {
      const els = getTruckElements(t.id);
      return {
        'Date': t.date,
        'Horaire': t.time,
        'N° Camion': t.number,
        'Usine': getTruckFactories(els).join(', '),
        'Poids (t)': getTruckWeight(els).toFixed(2),
        'Plus long (m)': getTruckMaxLength(els).toFixed(2),
        'Catégorie': TRANSPORT_CATEGORIES[getTransportCategory(els)].label,
        'Nb produits': els.length,
        'Repères': els.map(e => e.repere).join(', '),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `S${weekNumber}`);
    XLSX.writeFile(wb, `planning_S${weekNumber}.xlsx`);
  };

  const groupElementsByType = useCallback((els: BeamElement[]) => {
    const groups: Record<string, string[]> = {};
    els.forEach(el => {
      if (!groups[el.productType]) groups[el.productType] = [];
      groups[el.productType].push(el.repere);
    });
    return groups;
  }, []);

  const exportPdf = async () => {
    const weekLabel = weekStart && weekEnd
      ? `Semaine ${weekNumber} – du ${format(weekStart, 'dd/MM', { locale: fr })} au ${format(weekEnd, 'dd/MM/yyyy', { locale: fr })}`
      : `Semaine ${weekNumber}`;

    // Group trucks by day
    const grouped = new Map<string, typeof weekTrucks>();
    weekTrucks.forEach(t => {
      if (!grouped.has(t.date)) grouped.set(t.date, []);
      grouped.get(t.date)!.push(t);
    });

    let trucksHtml = '';
    Array.from(grouped.entries()).forEach(([date, dayTrucks]) => {
      trucksHtml += `<div style="background:#1e3a5f;color:white;padding:4px 10px;border-radius:4px;font-weight:600;font-size:11px;margin-top:8px;text-transform:capitalize;">${format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr })} — ${dayTrucks.length} camion${dayTrucks.length > 1 ? 's' : ''}</div>`;
      dayTrucks.forEach(truck => {
        const els = getTruckElements(truck.id);
        const cat = getTransportCategory(els);
        const catInfo = TRANSPORT_CATEGORIES[cat];
        const weight = getTruckWeight(els);
        const maxLen = getTruckMaxLength(els);
        const typeGroups = groupElementsByType(els);
        const borderColor = cat === 'standard' ? '#22c55e' : cat === 'cat1' ? '#eab308' : cat === 'cat2' ? '#f97316' : '#ef4444';

        trucksHtml += `<div style="border-left:3px solid ${borderColor};background:white;border-radius:4px;padding:4px 8px;margin:4px 0;box-shadow:0 1px 2px rgba(0,0,0,.08);">`;
        // Header: time + number left, category right
        trucksHtml += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <strong style="font-size:12px;">${truck.time}</strong>
            <strong style="font-size:12px;">${truck.number}</strong>
            <span style="background:${borderColor};color:white;padding:1px 6px;border-radius:3px;font-size:9px;">${catInfo.label}</span>
          </div>
          <span style="font-size:10px;color:#666;">⚖️ ${weight.toFixed(2)}t · 📏 ${maxLen.toFixed(2)}m</span>
        </div>`;
        // Repères grouped by type - larger font
        trucksHtml += `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;">`;
        Object.entries(typeGroups).forEach(([type, reperes]) => {
          trucksHtml += `<span style="font-size:11px;font-weight:600;color:#1e3a5f;">${reperes.length}× ${type} :</span>`;
          reperes.forEach(r => {
            trucksHtml += `<span style="background:#dbeafe;color:#1e3a5f;padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace;font-weight:500;">${r}</span>`;
          });
        });
        trucksHtml += `</div>`;
        if (truck.comment?.trim()) {
          trucksHtml += `<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:4px;padding:3px 6px;margin-top:3px;font-size:10px;">💬 ${truck.comment}</div>`;
        }
        trucksHtml += `</div>`;
      });
    });

    const recapHtml = `
      <div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:6px;padding:8px;background:white;">
        <h3 style="font-weight:600;margin-bottom:6px;font-size:12px;">Récapitulatif semaine ${weekNumber}</h3>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-size:11px;">
          <div style="background:#f1f5f9;border-radius:6px;padding:6px;"><div style="color:#64748b;font-size:9px;">Camions</div><div style="font-size:16px;font-weight:700;">${weekTrucks.length}</div></div>
          <div style="background:#f1f5f9;border-radius:6px;padding:6px;"><div style="color:#64748b;font-size:9px;">Produits</div><div style="font-size:16px;font-weight:700;">${totalProducts}</div>${Object.entries(weekProductCounts).map(([type, count]) => `<div style="font-size:9px;">${count}× ${type}</div>`).join('')}</div>
          <div style="background:#f1f5f9;border-radius:6px;padding:6px;"><div style="color:#64748b;font-size:9px;">Tonnage</div><div style="font-size:16px;font-weight:700;">${weekWeight.toFixed(2)} t</div></div>
          <div style="background:#f1f5f9;border-radius:6px;padding:6px;"><div style="color:#64748b;font-size:9px;">Avancement hebdo</div><div style="font-size:16px;font-weight:700;">${totalSiteWeight > 0 ? ((weekWeight / totalSiteWeight) * 100).toFixed(1) : 0} %</div></div>
          <div style="background:#f1f5f9;border-radius:6px;padding:6px;"><div style="color:#64748b;font-size:9px;">Avancement cumulé</div><div style="font-size:16px;font-weight:700;">${totalSiteWeight > 0 ? ((cumulativeWeight / totalSiteWeight) * 100).toFixed(1) : 0} %</div></div>
        </div>
      </div>`;

    // Build full HTML
    const html = `<div id="pdf-content" style="width:1580px;font-family:Inter,system-ui,sans-serif;color:#1e293b;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:2px solid #1e3a5f;padding-bottom:8px;">
        <div>
          <h1 style="font-size:16px;color:#1e3a5f;margin:0 0 4px 0;">RECTOR – ${weekLabel}</h1>
          ${projectInfo.siteName ? `<p style="margin:1px 0;font-size:11px;"><strong>Chantier :</strong> ${projectInfo.siteName} ${projectInfo.otpNumber ? `(OTP: ${projectInfo.otpNumber})` : ''}</p>` : ''}
          ${projectInfo.clientName ? `<p style="margin:1px 0;font-size:11px;"><strong>Client :</strong> ${projectInfo.clientName}</p>` : ''}
          ${projectInfo.siteAddress ? `<p style="margin:1px 0;font-size:11px;"><strong>Adresse :</strong> ${projectInfo.siteAddress}</p>` : ''}
        </div>
        <div style="text-align:right;">
          <img src="/logo.png" style="height:40px;object-fit:contain;" onerror="this.style.display='none'" />
          ${projectInfo.conductor ? `<p style="margin:1px 0;font-size:10px;"><strong>Conducteur :</strong> ${projectInfo.conductor}</p>` : ''}
          ${projectInfo.subcontractor ? `<p style="margin:1px 0;font-size:10px;"><strong>Poseur :</strong> ${projectInfo.subcontractor}</p>` : ''}
          ${projectInfo.contactName ? `<p style="margin:1px 0;font-size:10px;"><strong>Contact :</strong> ${projectInfo.contactName} ${projectInfo.contactPhone || ''}</p>` : ''}
        </div>
      </div>
      ${trucksHtml}
      ${recapHtml}
    </div>`;

    // Create off-screen container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container.querySelector('#pdf-content')!, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // A3 landscape: 420mm × 297mm
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      const pdfWidth = 420;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (canvas.height / canvas.width) * contentWidth;
      const finalHeight = Math.min(contentHeight, pdfHeight - margin * 2);

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, finalHeight);
      pdf.save(`planning_S${weekNumber}_${year}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>
              Semaine {weekNumber}
              {weekStart && weekEnd && ` – du ${format(weekStart, 'dd/MM', { locale: fr })} au ${format(weekEnd, 'dd/MM/yyyy', { locale: fr })}`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf}>
                <Calendar className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {projectInfo.siteName && <p><strong>Chantier :</strong> {projectInfo.siteName} (OTP: {projectInfo.otpNumber})</p>}
          {projectInfo.clientName && <p><strong>Client :</strong> {projectInfo.clientName}</p>}
          {projectInfo.siteAddress && <p><strong>Adresse :</strong> {projectInfo.siteAddress}</p>}
          {projectInfo.conductor && <p><strong>Conducteur :</strong> {projectInfo.conductor}</p>}
          {projectInfo.subcontractor && <p><strong>Poseur :</strong> {projectInfo.subcontractor}</p>}
        </CardContent>
      </Card>

      {/* Truck blocks grouped by day */}
      {(() => {
        const grouped = new Map<string, typeof weekTrucks>();
        weekTrucks.forEach(t => {
          const key = t.date;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(t);
        });
        const dayColors = ['bg-primary/5', 'bg-accent/5'];
        let dayIndex = 0;
        return Array.from(grouped.entries()).map(([date, dayTrucks]) => {
          const bgClass = dayColors[dayIndex % dayColors.length];
          dayIndex++;
          return (
            <div key={date} className={`rounded-lg ${bgClass} p-3 space-y-3`}>
              <div className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-semibold text-sm capitalize">
                {format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr })} — {dayTrucks.length} camion{dayTrucks.length > 1 ? 's' : ''}
              </div>
              {dayTrucks.map(truck => {
                const els = getTruckElements(truck.id);
                const cat = getTransportCategory(els);
                const catInfo = TRANSPORT_CATEGORIES[cat];
                const weight = getTruckWeight(els);
                const maxLen = getTruckMaxLength(els);
                const factories = getTruckFactories(els);
                const counts = getProductCountsByType(els);

                return (
                  <Card key={truck.id} className={`border-l-4 ${getCategoryColorClass(cat).includes('standard') ? 'border-l-transport-standard' : getCategoryColorClass(cat).includes('cat1') ? 'border-l-transport-cat1' : getCategoryColorClass(cat).includes('cat2') ? 'border-l-transport-cat2' : 'border-l-transport-cat3'}`}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <TruckIcon className="h-5 w-5 text-accent" />
                          <span className="font-semibold text-lg">{truck.number}</span>
                          <span className={`${getCategoryColorClass(cat)} px-2 py-0.5 rounded text-xs font-medium`}>{catInfo.label}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{truck.time}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-1"><Factory className="h-4 w-4 text-muted-foreground" /><span>{factories.join(', ') || '—'}</span></div>
                        <div className="flex items-center gap-1"><Weight className="h-4 w-4 text-muted-foreground" /><span>{weight.toFixed(2)} t</span></div>
                        <div className="flex items-center gap-1"><Ruler className="h-4 w-4 text-muted-foreground" /><span>{maxLen.toFixed(2)} m</span></div>
                        <div className="flex items-center gap-1"><Package className="h-4 w-4 text-muted-foreground" /><span>{els.length} produits</span></div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {Object.entries(counts).map(([type, count]) => (
                          <span key={type} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">{count}× {type}</span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {els.map(el => (
                          <span key={el.id} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono">{el.repere}</span>
                        ))}
                      </div>

                      {truck.comment?.trim() && (
                        <div className="flex items-start gap-1.5 text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-md p-2">
                          <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>{truck.comment}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        });
      })()}

      {weekTrucks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune livraison planifiée pour cette semaine.
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      {weekTrucks.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-3">Récapitulatif semaine {weekNumber}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Camions livrés</p>
                <p className="text-xl font-bold">{weekTrucks.length}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Produits livrés</p>
                <p className="text-xl font-bold">{totalProducts}</p>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(weekProductCounts).map(([type, count]) => (
                    <p key={type} className="text-xs">{count}× {type}</p>
                  ))}
                </div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Tonnage semaine</p>
                <p className="text-xl font-bold">{weekWeight.toFixed(2)} t</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Avancement hebdo</p>
                <p className="text-xl font-bold">{totalSiteWeight > 0 ? ((weekWeight / totalSiteWeight) * 100).toFixed(1) : 0} %</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Avancement cumulé</p>
                <p className="text-xl font-bold">{totalSiteWeight > 0 ? ((cumulativeWeight / totalSiteWeight) * 100).toFixed(1) : 0} %</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}