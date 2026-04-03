import { useState, useMemo, useCallback } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories, getTruckZones, getProductCountsByType, getCategoryColorClass, getFactoryColor } from '@/utils/transportUtils';
import { TRANSPORT_CATEGORIES, BeamElement, HANDLING_MEANS_OPTIONS } from '@/types/delivery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Truck as TruckIcon, Weight, Ruler, Factory, Package, FileSpreadsheet, Download, MessageSquare, MapPin, X, Wrench } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { exportWeekPdf } from '@/utils/pdfExportUtils';

interface WeeklyPlanningTabProps {
  weekNumber: number;
  year: number;
  teamId?: string;
}

export default function WeeklyPlanningTab({ weekNumber, year, teamId }: WeeklyPlanningTabProps) {
  const { projectInfo, trucks, elements, getTruckElements, teams } = useDelivery();
  const [factoryFilter, setFactoryFilter] = useState<Set<string>>(new Set());
  const [transporterFilter, setTransporterFilter] = useState<Set<string>>(new Set());

  const weekTrucks = useMemo(() => {
    return trucks
      .filter(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        if (wn !== weekNumber || y !== year) return false;
        if (teamId !== undefined) return t.teamId === teamId;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [trucks, weekNumber, year, teamId]);

  // Factories available in this week's trucks
  const weekFactoryList = useMemo(() => {
    const facs = new Set<string>();
    weekTrucks.forEach(t => {
      getTruckFactories(getTruckElements(t.id)).forEach(f => facs.add(f));
    });
    return [...facs].sort();
  }, [weekTrucks, getTruckElements]);

  // Transporters available in this week's trucks
  const weekTransporterList = useMemo(() => {
    const transporters = new Set<string>();
    let hasEmpty = false;
    weekTrucks.forEach(t => {
      if (t.transporter?.trim()) transporters.add(t.transporter.trim());
      else hasEmpty = true;
    });
    return { list: [...transporters].sort(), hasEmpty };
  }, [weekTrucks]);

  // Filtered trucks based on factory and transporter filters
  const displayTrucks = useMemo(() => {
    let filtered = weekTrucks;
    if (factoryFilter.size > 0) {
      filtered = filtered.filter(t => {
        const facs = getTruckFactories(getTruckElements(t.id));
        return facs.some(f => factoryFilter.has(f));
      });
    }
    if (transporterFilter.size > 0) {
      filtered = filtered.filter(t => {
        const transporter = t.transporter?.trim() || '';
        if (transporter === '') return transporterFilter.has('__sans_transporteur__');
        return transporterFilter.has(transporter);
      });
    }
    return filtered;
  }, [weekTrucks, factoryFilter, transporterFilter, getTruckElements]);

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
    return displayTrucks.reduce((sum, t) => sum + getTruckWeight(getTruckElements(t.id)), 0);
  }, [displayTrucks, getTruckElements]);

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

  // Cumulative weight by product type (all weeks up to current)
  const cumulativeByType = useMemo(() => {
    const counts: Record<string, number> = {};
    trucks
      .filter(t => {
        const d = parseISO(t.date);
        const wn = parseInt(format(d, 'II'));
        const y = d.getFullYear();
        return (y < year) || (y === year && wn <= weekNumber);
      })
      .forEach(t => {
        getTruckElements(t.id).forEach(el => {
          counts[el.productType] = (counts[el.productType] || 0) + el.weight;
        });
      });
    return counts;
  }, [trucks, weekNumber, year, getTruckElements]);

  // Total weight by product type (all elements in DB)
  const totalByType = useMemo(() => {
    const counts: Record<string, number> = {};
    elements.forEach(el => {
      counts[el.productType] = (counts[el.productType] || 0) + el.weight;
    });
    return counts;
  }, [elements]);

  const weekProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    displayTrucks.forEach(t => {
      getTruckElements(t.id).forEach(el => {
        counts[el.productType] = (counts[el.productType] || 0) + 1;
      });
    });
    return counts;
  }, [displayTrucks, getTruckElements]);

  const totalProducts = Object.values(weekProductCounts).reduce((s, c) => s + c, 0);

  // Factory filter suffix for filenames
  const factorySuffix = useMemo(() => {
    if (factoryFilter.size === 0) return '';
    if (factoryFilter.size === 1) return `_${[...factoryFilter][0].replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '')}`;
    return '_MultiUsines';
  }, [factoryFilter]);

  // Transporter filter suffix for filenames
  const transporterSuffix = useMemo(() => {
    if (transporterFilter.size === 0) return '';
    const realTransporters = [...transporterFilter].filter(t => t !== '__sans_transporteur__');
    if (realTransporters.length === 1) return `_${realTransporters[0].replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '')}`;
    if (transporterFilter.size === 1 && transporterFilter.has('__sans_transporteur__')) return '_SansTransporteur';
    return '_MultiTransporteurs';
  }, [transporterFilter]);

  const combinedSuffix = `${factorySuffix}${transporterSuffix}`;

  const exportExcel = () => {
    const data = displayTrucks.map(t => {
      const els = getTruckElements(t.id);
      return {
        'Date': t.date,
        'Horaire': t.time,
        'N° Camion': t.number,
        'Transporteur': t.transporter?.trim() || '',
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
    XLSX.writeFile(wb, `planning_S${weekNumber}${combinedSuffix}.xlsx`);
  };

  const exportPdf = async () => {
    await exportWeekPdf({
      weekNumber,
      year,
      trucks: displayTrucks,
      getTruckElements,
      projectInfo,
      totalSiteWeight,
      cumulativeWeight,
      cumulativeByType,
      totalByType,
      factorySuffix: combinedSuffix,
    });
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
            <div className="flex gap-2 items-center">
              {weekFactoryList.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={factoryFilter.size > 0 ? 'default' : 'outline'} size="sm">
                      <Factory className="h-4 w-4 mr-1" /> {factoryFilter.size > 0 ? `Usine (${factoryFilter.size})` : 'Usine'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="end">
                    <div className="space-y-1">
                      {weekFactoryList.map(f => (
                        <label key={f} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                          <Checkbox checked={factoryFilter.has(f)} onCheckedChange={() => setFactoryFilter(prev => { const next = new Set(prev); next.has(f) ? next.delete(f) : next.add(f); return next; })} />
                          <span className="text-white text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: getFactoryColor(f) }}>{f}</span>
                        </label>
                      ))}
                    </div>
                    {factoryFilter.size > 0 && (
                      <Button variant="default" size="sm" className="w-full text-xs h-6 mt-2" onClick={() => setFactoryFilter(new Set())}>
                        <X className="h-3 w-3 mr-1" /> Réinitialiser
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              {(weekTransporterList.list.length > 0 || weekTransporterList.hasEmpty) && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={transporterFilter.size > 0 ? 'default' : 'outline'} size="sm">
                      <TruckIcon className="h-4 w-4 mr-1" /> {transporterFilter.size > 0 ? `Transporteur (${transporterFilter.size})` : 'Transporteur'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="end">
                    <div className="space-y-1">
                      {weekTransporterList.hasEmpty && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                          <Checkbox checked={transporterFilter.has('__sans_transporteur__')} onCheckedChange={() => setTransporterFilter(prev => { const next = new Set(prev); next.has('__sans_transporteur__') ? next.delete('__sans_transporteur__') : next.add('__sans_transporteur__'); return next; })} />
                          <span className="text-xs italic text-muted-foreground">Sans transporteur</span>
                        </label>
                      )}
                      {weekTransporterList.list.map(t => (
                        <label key={t} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                          <Checkbox checked={transporterFilter.has(t)} onCheckedChange={() => setTransporterFilter(prev => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; })} />
                          <span className="text-xs font-medium text-orange-500">{t}</span>
                        </label>
                      ))}
                    </div>
                    {transporterFilter.size > 0 && (
                      <Button variant="default" size="sm" className="w-full text-xs h-6 mt-2" onClick={() => setTransporterFilter(new Set())}>
                        <X className="h-3 w-3 mr-1" /> Réinitialiser
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf}>
                <Download className="h-4 w-4 mr-1" /> Export PDF
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
        const grouped = new Map<string, typeof displayTrucks>();
        displayTrucks.forEach(t => {
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
                const truckZones = getTruckZones(els);
                const counts = getProductCountsByType(els);

                return (
                  <Card key={truck.id} className={`border-l-4 ${getCategoryColorClass(cat).includes('standard') ? 'border-l-transport-standard' : getCategoryColorClass(cat).includes('cat1') ? 'border-l-transport-cat1' : getCategoryColorClass(cat).includes('cat2') ? 'border-l-transport-cat2' : 'border-l-transport-cat3'}`}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <TruckIcon className="h-5 w-5 text-accent" />
                          <span className="font-semibold text-lg">{truck.number}</span>
                          <span className="text-sm text-muted-foreground">— {truck.time}</span>
                          <span className={`${getCategoryColorClass(cat)} px-2 py-0.5 rounded text-xs font-medium`}>{catInfo.label}</span>
                          {truck.transporter?.trim() && (
                            <span className="text-sm font-medium text-orange-500">{truck.transporter}</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-1"><Factory className="h-4 w-4 text-muted-foreground" />{factories.length > 0 ? factories.map(f => <span key={f} className="text-white text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: getFactoryColor(f) }}>{f}</span>) : <span>—</span>}</div>
                        <div className="flex items-center gap-1"><Weight className="h-4 w-4 text-muted-foreground" /><span>{weight.toFixed(2)} t</span></div>
                        <div className="flex items-center gap-1"><Ruler className="h-4 w-4 text-muted-foreground" /><span>{maxLen.toFixed(2)} m</span></div>
                        <div className="flex items-center gap-1"><Package className="h-4 w-4 text-muted-foreground" /><span>{els.length} produits</span></div>
                      </div>

                      {truckZones.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          {truckZones.map(z => (
                            <span key={z} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">{z}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(counts).map(([type, count]) => (
                          <span key={type} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs">{count}× {type}</span>
                        ))}
                      </div>

                      {(() => {
                        const grouped: Record<string, typeof els> = {};
                        els.forEach(el => {
                          if (!grouped[el.productType]) grouped[el.productType] = [];
                          grouped[el.productType].push(el);
                        });
                        return Object.entries(grouped).map(([type, typeEls]) => (
                          <div key={type} className="space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">{type}</span>
                            <div className="flex flex-wrap gap-1">
                              {typeEls.map(el => (
                                <span key={el.id} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono">{el.repere}</span>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}


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

      {displayTrucks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune livraison planifiée pour cette semaine.
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      {displayTrucks.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-3">Récapitulatif semaine {weekNumber}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground">Camions livrés</p>
                <p className="text-xl font-bold">{displayTrucks.length}</p>
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
                <div className="mt-1 space-y-0.5">
                  {Object.entries(cumulativeByType).map(([type, cumWeight]) => {
                    const total = totalByType[type] || 0;
                    const pct = total > 0 ? Math.round((cumWeight / total) * 100) : 0;
                    return (
                      <p key={type} className="text-xs">{type} : {pct}%</p>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}