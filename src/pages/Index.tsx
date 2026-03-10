import { useMemo } from 'react';
import { DeliveryProvider, useDelivery } from '@/context/DeliveryContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import GeneralInfoTab from '@/components/delivery/GeneralInfoTab';
import DatabaseTab from '@/components/delivery/DatabaseTab';
import TruckCompositionTab from '@/components/delivery/TruckCompositionTab';
import WeeklyPlanningTab from '@/components/delivery/WeeklyPlanningTab';
import { Truck as TruckIcon, ClipboardList, Database, Calendar, FileSpreadsheet } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories, getProductCountsByType } from '@/utils/transportUtils';
import { TRANSPORT_CATEGORIES } from '@/types/delivery';
import * as XLSX from 'xlsx';

function DeliveryApp() {
  const { trucks, projectInfo, elements, getTruckElements } = useDelivery();

  const weeklyTabs = useMemo(() => {
    const weeks = new Map<string, { weekNumber: number; year: number }>();
    trucks.forEach(t => {
      const d = parseISO(t.date);
      const wn = parseInt(format(d, 'II'));
      const y = d.getFullYear();
      const key = `${y}-${wn}`;
      if (!weeks.has(key)) weeks.set(key, { weekNumber: wn, year: y });
    });
    return Array.from(weeks.values()).sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);
  }, [trucks]);

  const exportAllWeeksExcel = () => {
    const wb = XLSX.utils.book_new();
    weeklyTabs.forEach(w => {
      const weekTrucks = trucks
        .filter(t => {
          const d = parseISO(t.date);
          return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

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
          'Commentaire': t.comment || '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `S${String(w.weekNumber).padStart(2, '0')}`);
    });
    XLSX.writeFile(wb, `planning_toutes_semaines.xlsx`);
  };

  const exportAllWeeksPdf = () => {
    const totalSiteWeight = elements.reduce((s, e) => s + e.weight, 0);
    let allHtml = '';

    weeklyTabs.forEach((w, idx) => {
      const weekTrucks = trucks
        .filter(t => {
          const d = parseISO(t.date);
          return parseInt(format(d, 'II')) === w.weekNumber && d.getFullYear() === w.year;
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      if (weekTrucks.length === 0) return;

      const firstDate = parseISO(weekTrucks[0].date);
      const ws = startOfWeek(firstDate, { weekStartsOn: 1 });
      const we = endOfWeek(firstDate, { weekStartsOn: 1 });
      const weekLabel = `Semaine ${w.weekNumber} – du ${format(ws, 'dd/MM', { locale: fr })} au ${format(we, 'dd/MM/yyyy', { locale: fr })}`;

      if (idx > 0) allHtml += '<div style="page-break-before:always;"></div>';

      allHtml += `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:2px solid #1e3a5f;padding-bottom:10px;">
        <div><h2 style="font-size:18px;color:#1e3a5f;margin:0 0 4px 0;">RECTOR – ${weekLabel}</h2>
        ${projectInfo.siteName ? `<p style="margin:2px 0;font-size:12px;"><strong>Chantier :</strong> ${projectInfo.siteName} ${projectInfo.otpNumber ? `(OTP: ${projectInfo.otpNumber})` : ''}</p>` : ''}
        ${projectInfo.clientName ? `<p style="margin:2px 0;font-size:12px;"><strong>Client :</strong> ${projectInfo.clientName}</p>` : ''}
        </div>
        <img src="/logo.png" style="height:40px;object-fit:contain;" onerror="this.style.display='none'" />
      </div>`;

      const grouped = new Map<string, typeof weekTrucks>();
      weekTrucks.forEach(t => {
        if (!grouped.has(t.date)) grouped.set(t.date, []);
        grouped.get(t.date)!.push(t);
      });

      Array.from(grouped.entries()).forEach(([date, dayTrucks]) => {
        allHtml += `<div style="background:#1e3a5f;color:white;padding:6px 14px;border-radius:5px;font-weight:600;font-size:12px;margin-top:12px;text-transform:capitalize;">${format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr })} — ${dayTrucks.length} camion${dayTrucks.length > 1 ? 's' : ''}</div>`;
        dayTrucks.forEach(truck => {
          const els = getTruckElements(truck.id);
          const cat = getTransportCategory(els);
          const catInfo = TRANSPORT_CATEGORIES[cat];
          const weight = getTruckWeight(els);
          const maxLen = getTruckMaxLength(els);
          const factories = getTruckFactories(els);
          const counts = getProductCountsByType(els);
          const borderColor = cat === 'standard' ? '#22c55e' : cat === 'cat1' ? '#eab308' : cat === 'cat2' ? '#f97316' : '#ef4444';

          allHtml += `<div style="border-left:4px solid ${borderColor};background:white;border-radius:6px;padding:10px;margin:6px 0;box-shadow:0 1px 2px rgba(0,0,0,.08);">`;
          allHtml += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><strong style="font-size:14px;">${truck.number}</strong><span style="background:${borderColor};color:white;padding:2px 6px;border-radius:3px;font-size:10px;">${catInfo.label}</span><span style="color:#666;font-size:12px;">${truck.time}</span></div>`;
          allHtml += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:11px;margin-bottom:6px;"><span>🏭 ${factories.join(', ') || '—'}</span><span>⚖️ ${weight.toFixed(2)}t</span><span>📏 ${maxLen.toFixed(2)}m</span><span>📦 ${els.length} produits</span></div>`;
          allHtml += `<div style="display:flex;flex-wrap:wrap;gap:3px;">${els.map(el => `<span style="background:#dbeafe;color:#1e3a5f;padding:1px 5px;border-radius:3px;font-size:9px;font-family:monospace;">${el.repere}</span>`).join('')}</div>`;
          if (truck.comment?.trim()) {
            allHtml += `<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:4px;padding:6px;margin-top:6px;font-size:11px;">💬 ${truck.comment}</div>`;
          }
          allHtml += `</div>`;
        });
      });
    });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Planning toutes semaines</title>
      <style>@page{size:A3 landscape;margin:10mm;}body{font-family:Inter,system-ui,sans-serif;color:#1e293b;margin:0;padding:20px;font-size:12px;}</style>
    </head><body>${allHtml}</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => { printWindow.print(); };
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3 flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <TruckIcon className="h-7 w-7" />
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight">RECTOR – Planification des livraisons</h1>
            {projectInfo.siteName && <p className="text-xs text-primary-foreground/70">{projectInfo.siteName} {projectInfo.otpNumber && `(${projectInfo.otpNumber})`}</p>}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container py-4">
        <Tabs defaultValue="info">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1 mb-4">
            <TabsTrigger value="info" className="flex items-center gap-1 text-xs">
              <ClipboardList className="h-3.5 w-3.5" /> Infos générales
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-1 text-xs">
              <Database className="h-3.5 w-3.5" /> Base de données
            </TabsTrigger>
            <TabsTrigger value="composition" className="flex items-center gap-1 text-xs">
              <TruckIcon className="h-3.5 w-3.5" /> Compo camion
            </TabsTrigger>
            
            {weeklyTabs.map(w => (
              <TabsTrigger key={`${w.year}-${w.weekNumber}`} value={`week-${w.year}-${w.weekNumber}`} className="flex items-center gap-1 text-xs">
                <Calendar className="h-3.5 w-3.5" /> S.{String(w.weekNumber).padStart(2, '0')}
              </TabsTrigger>
            ))}

            {weeklyTabs.length > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exportAllWeeksExcel}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Tout Excel
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exportAllWeeksPdf}>
                  <Calendar className="h-3.5 w-3.5 mr-1" /> Tout PDF
                </Button>
              </div>
            )}
          </TabsList>

          <TabsContent value="info"><GeneralInfoTab /></TabsContent>
          <TabsContent value="database"><DatabaseTab /></TabsContent>
          <TabsContent value="composition"><TruckCompositionTab /></TabsContent>
          
          {weeklyTabs.map(w => (
            <TabsContent key={`${w.year}-${w.weekNumber}`} value={`week-${w.year}-${w.weekNumber}`}>
              <WeeklyPlanningTab weekNumber={w.weekNumber} year={w.year} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

export default function Index() {
  return (
    <DeliveryProvider>
      <DeliveryApp />
    </DeliveryProvider>
  );
}