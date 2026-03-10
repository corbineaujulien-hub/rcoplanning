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
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories, getProductCountsByType, getFactoryColor } from '@/utils/transportUtils';
import { TRANSPORT_CATEGORIES, BeamElement } from '@/types/delivery';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

  const groupElementsByType = (els: BeamElement[]) => {
    const groups: Record<string, string[]> = {};
    els.forEach(el => {
      if (!groups[el.productType]) groups[el.productType] = [];
      groups[el.productType].push(el.repere);
    });
    return groups;
  };

  const exportAllWeeksPdf = async () => {
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

      if (idx > 0) allHtml += '<div style="page-break-before:always;height:0;"></div>';

      // Full header with all project info
      allHtml += `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:2px solid #1e3a5f;padding-bottom:8px;">
        <div>
          <h2 style="font-size:16px;color:#1e3a5f;margin:0 0 4px 0;">RECTOR – ${weekLabel}</h2>
          ${projectInfo.otpNumber ? `<p style="margin:1px 0;font-size:11px;"><strong>N° OTP :</strong> ${projectInfo.otpNumber}</p>` : ''}
          ${projectInfo.siteName ? `<p style="margin:1px 0;font-size:11px;"><strong>Chantier :</strong> ${projectInfo.siteName}</p>` : ''}
          ${projectInfo.siteAddress ? `<p style="margin:1px 0;font-size:11px;"><strong>Adresse :</strong> ${projectInfo.siteAddress}</p>` : ''}
          ${projectInfo.clientName ? `<p style="margin:1px 0;font-size:11px;"><strong>Client :</strong> ${projectInfo.clientName}</p>` : ''}
        </div>
        <div style="text-align:right;">
          <img src="/logo.png" style="height:40px;object-fit:contain;margin-bottom:4px;" onerror="this.style.display='none'" />
          ${projectInfo.conductor ? `<p style="margin:1px 0;font-size:11px;"><strong>Conducteur :</strong> ${projectInfo.conductor}</p>` : ''}
          ${projectInfo.subcontractor ? `<p style="margin:1px 0;font-size:11px;"><strong>Poseur :</strong> ${projectInfo.subcontractor}</p>` : ''}
          ${projectInfo.contactName ? `<p style="margin:1px 0;font-size:11px;"><strong>Contact :</strong> ${projectInfo.contactName}${projectInfo.contactPhone ? ` — ${projectInfo.contactPhone}` : ''}</p>` : ''}
        </div>
      </div>`;

      const grouped = new Map<string, typeof weekTrucks>();
      weekTrucks.forEach(t => {
        if (!grouped.has(t.date)) grouped.set(t.date, []);
        grouped.get(t.date)!.push(t);
      });

      Array.from(grouped.entries()).forEach(([date, dayTrucks]) => {
        allHtml += `<div style="background:#1e3a5f;color:white;padding:4px 10px;border-radius:4px;font-weight:600;font-size:11px;margin-top:8px;text-transform:capitalize;">${format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: fr })} — ${dayTrucks.length} camion${dayTrucks.length > 1 ? 's' : ''}</div>`;
        dayTrucks.forEach(truck => {
          const els = getTruckElements(truck.id);
          const cat = getTransportCategory(els);
          const catInfo = TRANSPORT_CATEGORIES[cat];
          const weight = getTruckWeight(els);
          const maxLen = getTruckMaxLength(els);
          const typeGroups = groupElementsByType(els);
          const factories = getTruckFactories(els);
          const borderColor = cat === 'standard' ? '#22c55e' : cat === 'cat1' ? '#eab308' : cat === 'cat2' ? '#f97316' : '#ef4444';

          allHtml += `<div style="border:1px solid #b0b8c4;border-left:4px solid ${borderColor};background:white;border-radius:6px;padding:12px 16px;margin:6px 0;box-shadow:0 1px 3px rgba(0,0,0,.1);">`;
          allHtml += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <div style="display:inline-flex;align-items:center;gap:4px;background:#1e3a5f;color:white;padding:6px 14px;border-radius:4px;font-size:13px;font-weight:700;line-height:1;">🚛 ${truck.number} — ${truck.time}</div>
              <span style="background:${borderColor};color:white;padding:6px 14px;border-radius:4px;font-size:11px;display:inline-flex;align-items:center;line-height:1;font-weight:600;">${catInfo.label}</span>
              ${factories.map(f => `<span style="background:${getFactoryColor(f)};color:white;padding:6px 14px;border-radius:4px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;line-height:1;">${f}</span>`).join('')}
            </div>
            <span style="font-size:11px;color:#666;">⚖️ ${weight.toFixed(2)}t · 📏 ${maxLen.toFixed(2)}m</span>
          </div>`;
          allHtml += `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">`;
          Object.entries(typeGroups).forEach(([type, reperes]) => {
            allHtml += `<span style="font-size:11px;font-weight:600;color:#1e3a5f;display:inline-flex;align-items:center;line-height:1;">${reperes.length}× ${type} :</span>`;
            reperes.forEach(r => {
              allHtml += `<span style="background:#dbeafe;color:#1e3a5f;padding:4px 8px;border-radius:3px;font-size:11px;font-family:monospace;font-weight:500;display:inline-flex;align-items:center;line-height:1;">${r}</span>`;
            });
          });
          allHtml += `</div>`;
          if (truck.comment?.trim()) {
            allHtml += `<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:4px;padding:3px 6px;margin-top:3px;font-size:10px;">💬 ${truck.comment}</div>`;
          }
          allHtml += `</div>`;
        });
      });
    });

    // Render to PDF via html2canvas + jsPDF
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = `<div id="pdf-all-content" style="width:1580px;font-family:Inter,system-ui,sans-serif;color:#1e293b;padding:16px;">${allHtml}</div>`;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container.querySelector('#pdf-all-content')!, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      const pdfWidth = 420;
      const pdfHeight = 297;
      const margin = 8;
      const usableWidth = pdfWidth - margin * 2;
      const usableHeight = pdfHeight - margin * 2;
      const contentHeight = (canvas.height / canvas.width) * usableWidth;
      const imgData = canvas.toDataURL('image/png');

      if (contentHeight <= usableHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, contentHeight);
      } else {
        const totalPages = Math.ceil(contentHeight / usableHeight);
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();
          const sourceY = (page * usableHeight / contentHeight) * canvas.height;
          const sourceH = Math.min((usableHeight / contentHeight) * canvas.height, canvas.height - sourceY);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sourceH;
          const ctx = sliceCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceH, 0, 0, canvas.width, sourceH);
          const sliceHeight = (sourceH / canvas.width) * usableWidth;
          pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, usableWidth, sliceHeight);
        }
      }

      pdf.save(`planning_toutes_semaines.pdf`);
    } finally {
      document.body.removeChild(container);
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