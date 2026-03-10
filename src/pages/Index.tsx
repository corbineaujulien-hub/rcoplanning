import { useMemo, useState } from 'react';
import { DeliveryProvider, useDelivery } from '@/context/DeliveryContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GeneralInfoTab from '@/components/delivery/GeneralInfoTab';
import DatabaseTab from '@/components/delivery/DatabaseTab';
import TruckCompositionTab from '@/components/delivery/TruckCompositionTab';
import WeeklyPlanningTab from '@/components/delivery/WeeklyPlanningTab';
import { Truck as TruckIcon, ClipboardList, Database, CalendarDays, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function DeliveryApp() {
  const { trucks, projectInfo } = useDelivery();

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-3 flex items-center gap-3">
          <TruckIcon className="h-7 w-7" />
          <div>
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
            <TabsTrigger value="planning" className="flex items-center gap-1 text-xs">
              <CalendarDays className="h-3.5 w-3.5" /> Planning général
            </TabsTrigger>
            {weeklyTabs.map(w => (
              <TabsTrigger key={`${w.year}-${w.weekNumber}`} value={`week-${w.year}-${w.weekNumber}`} className="flex items-center gap-1 text-xs">
                <Calendar className="h-3.5 w-3.5" /> S.{String(w.weekNumber).padStart(2, '0')}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="info"><GeneralInfoTab /></TabsContent>
          <TabsContent value="database"><DatabaseTab /></TabsContent>
          <TabsContent value="composition"><TruckCompositionTab /></TabsContent>
          <TabsContent value="planning"><GeneralPlanningTab /></TabsContent>
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
