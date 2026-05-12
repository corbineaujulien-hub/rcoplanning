import { useState, useMemo } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { CONDUCTORS, SUBCONTRACTORS, Team, ForecastedTransport, FORECAST_TRANSPORT_CATEGORIES, ForecastTransportCategory } from '@/types/delivery';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Building2, User, Phone, MapPin, FileText, HardHat, Calendar, Users, Plus, Trash2, Pencil, Check, X, CalendarDays, Truck as TruckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GeneralInfoTab() {
  const {
    projectInfo, setProjectInfo, teams, addTeam, updateTeam, deleteTeam,
    forecastWeeks, toggleForecastWeek, setForecastWeeksBulk, clearForecastWeeks,
    setForecastedTransports,
  } = useDelivery();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const update = (field: string, value: string | boolean) => {
    setProjectInfo({ ...projectInfo, [field]: value });
  };

  const handleAddTeam = () => {
    const nextOrder = teams.length > 0 ? Math.max(...teams.map(t => t.sortOrder)) + 1 : 0;
    const newTeam: Team = {
      id: crypto.randomUUID(),
      projectId: '',
      name: `Équipe ${teams.length + 1}`,
      sortOrder: nextOrder,
    };
    addTeam(newTeam);
  };

  const startEditing = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingName(team.name);
  };

  const confirmEdit = () => {
    if (editingTeamId && editingName.trim()) {
      updateTeam(editingTeamId, { name: editingName.trim() });
    }
    setEditingTeamId(null);
    setEditingName('');
  };

  const cancelEdit = () => {
    setEditingTeamId(null);
    setEditingName('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-accent" />
            Informations du chantier
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="otp"><FileText className="inline h-4 w-4 mr-1" />N° OTP</Label>
            <Input id="otp" value={projectInfo.otpNumber} onChange={e => update('otpNumber', e.target.value)} placeholder="Ex: OTP-2025-001" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site">Nom du chantier</Label>
            <Input id="site" value={projectInfo.siteName} onChange={e => update('siteName', e.target.value)} placeholder="Ex: Résidence Les Jardins" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client">Nom du client</Label>
            <Input id="client" value={projectInfo.clientName} onChange={e => update('clientName', e.target.value)} placeholder="Ex: Bouygues Immobilier" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address"><MapPin className="inline h-4 w-4 mr-1" />Adresse du chantier</Label>
            <Input id="address" value={projectInfo.siteAddress} onChange={e => update('siteAddress', e.target.value)} placeholder="Ex: 12 rue de la Paix, 75001 Paris" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-accent" />
            Équipe
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Conducteur de travaux RECTOR</Label>
            <Select
              value={projectInfo.conductor ? projectInfo.conductor : '__unassigned__'}
              onValueChange={v => update('conductor', v === '__unassigned__' ? '' : v)}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner un conducteur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Conducteur de travaux à désigner</SelectItem>
                {CONDUCTORS.map(c => (
                  <SelectItem key={c.name} value={`${c.name} – ${c.phone}`}>
                    {c.name} – {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sous-traitant poseur</Label>
            <Select
              value={projectInfo.subcontractor ? projectInfo.subcontractor : '__unassigned__'}
              onValueChange={v => update('subcontractor', v === '__unassigned__' ? '' : v)}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner un sous-traitant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Poseur à désigner</SelectItem>
                {SUBCONTRACTORS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label><User className="inline h-4 w-4 mr-1" />Nom du contact poseur</Label>
            <Input value={projectInfo.contactName} onChange={e => update('contactName', e.target.value)} placeholder="Ex: Jean Dupont" />
          </div>
          <div className="space-y-2">
            <Label><Phone className="inline h-4 w-4 mr-1" />Téléphone du contact</Label>
            <Input value={projectInfo.contactPhone} onChange={e => update('contactPhone', e.target.value)} placeholder="Ex: 06 12 34 56 78" />
          </div>
        </CardContent>
      </Card>

      {/* Teams management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            Équipes de pose
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Gérez les équipes de pose alimentées par les livraisons. Chaque équipe dispose de sa propre composition de camions et planning hebdomadaire.
          </p>
          <div className="space-y-2">
            {teams.map(team => (
              <div key={team.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                {editingTeamId === team.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      className="h-8 text-sm flex-1"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') confirmEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={confirmEdit}>
                      <Check className="h-4 w-4 text-accent" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium flex-1">{team.name}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditing(team)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {teams.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteTeam(team.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleAddTeam} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Ajouter une équipe
          </Button>
        </CardContent>
      </Card>

      <ForecastWeeksCard
        selected={forecastWeeks.map(w => `${w.year}-${w.weekNumber}`)}
        onToggle={toggleForecastWeek}
        onSelectAll={setForecastWeeksBulk}
        onClear={clearForecastWeeks}
      />

      <ForecastedTransportsCard
        transports={projectInfo.forecastedTransports || []}
        onChange={setForecastedTransports}
      />

      {/* Discreet Saturday toggle */}
      <div className="flex items-center justify-end gap-3 px-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="show-sat" className="text-sm text-muted-foreground cursor-pointer">Afficher les samedis dans le calendrier</Label>
        <Switch
          id="show-sat"
          checked={projectInfo.showSaturdays || false}
          onCheckedChange={v => update('showSaturdays', v)}
        />
      </div>
    </div>
  );
}

// =================== Forecast Weeks Calendar ===================

function getISOWeekInfo(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function startOfISOWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

interface MonthRow {
  label: string;
  year: number;
  month: number;
  weeks: { year: number; weekNumber: number; key: string; split: boolean; dateRange: string; start: Date; end: Date }[];
}

function buildSlidingMonths(): MonthRow[] {
  const today = new Date();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  // Build all weeks from startOfISOWeek(startMonth) to end of month +11
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 12, 0); // last day of 12th month
  const weekCursor = startOfISOWeek(startMonth);

  const months: MonthRow[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({
      label: m.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase()),
      year: m.getFullYear(),
      month: m.getMonth(),
      weeks: [],
    });
  }

  const fmtDay = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  const cur = new Date(weekCursor);
  while (cur.getTime() <= endMonth.getTime()) {
    const wEnd = new Date(cur);
    wEnd.setDate(wEnd.getDate() + 6);
    // Determine majority month
    const counts: Record<string, { y: number; m: number; n: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(cur);
      d.setDate(d.getDate() + i);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!counts[k]) counts[k] = { y: d.getFullYear(), m: d.getMonth(), n: 0 };
      counts[k].n++;
    }
    const entries = Object.values(counts).sort((a, b) => b.n - a.n);
    const owner = entries[0];
    const split = entries.length > 1;
    const info = getISOWeekInfo(cur);
    const target = months.find(mm => mm.year === owner.y && mm.month === owner.m);
    if (target) {
      target.weeks.push({
        year: info.year,
        weekNumber: info.week,
        key: `${info.year}-${info.week}`,
        split,
        dateRange: `Du ${fmtDay(cur)} au ${fmtDay(wEnd)}`,
        start: new Date(cur),
        end: new Date(wEnd),
      });
    }
    cur.setDate(cur.getDate() + 7);
  }

  return months;
}

function ForecastWeeksCard({
  selected, onToggle, onSelectAll, onClear,
}: {
  selected: string[];
  onToggle: (year: number, weekNumber: number) => void;
  onSelectAll: (weeks: { year: number; weekNumber: number }[]) => void;
  onClear: () => void;
}) {
  const months = useMemo(() => buildSlidingMonths(), []);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const allWeeks = useMemo(() => {
    const list: { year: number; weekNumber: number }[] = [];
    months.forEach(m => m.weeks.forEach(w => list.push({ year: w.year, weekNumber: w.weekNumber })));
    return list;
  }, [months]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-accent" />
          Planning prévisionnel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Cochez les semaines d'intervention prévisionnelles. Ces données alimentent le planning de charge global.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onSelectAll(allWeeks)}>
            Tout sélectionner
          </Button>
          <Button variant="outline" size="sm" onClick={onClear}>
            Tout désélectionner
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {selectedSet.size} semaine{selectedSet.size > 1 ? 's' : ''} sélectionnée{selectedSet.size > 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-xs border-collapse">
            <tbody>
              {months.map(m => (
                <tr key={`${m.year}-${m.month}`} className="border-b last:border-0">
                  <td className="p-2 font-medium bg-muted/40 border-r whitespace-nowrap min-w-[140px]">
                    {m.label}
                  </td>
                  {m.weeks.map(w => {
                    const isSel = selectedSet.has(w.key);
                    return (
                      <td key={w.key} className={cn('p-1 text-center align-middle', w.split && 'border-l border-dashed border-muted-foreground/50')}>
                        <button
                          type="button"
                          onClick={() => onToggle(w.year, w.weekNumber)}
                          title={w.dateRange}
                          className={cn(
                            'w-12 h-9 rounded border text-[11px] font-medium transition-colors',
                            isSel
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted border-input',
                          )}
                        >
                          S{w.weekNumber}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// =================== Forecasted Transports ===================

function ForecastedTransportsCard({
  transports, onChange,
}: {
  transports: ForecastedTransport[];
  onChange: (t: ForecastedTransport[]) => void;
}) {
  const [draft, setDraft] = useState<ForecastedTransport[]>(transports);

  // Sync external -> draft when transports change
  useMemo(() => { setDraft(transports); }, [transports]);

  const update = (idx: number, patch: Partial<ForecastedTransport>) => {
    setDraft(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const commit = () => onChange(draft);

  const addRow = () => {
    const next = [...draft, { usine: '', standard: 0, cat1: 0, cat2: 0, cat3: 0, exceptional: 0 }];
    setDraft(next);
    onChange(next);
  };

  const removeRow = (idx: number) => {
    const next = draft.filter((_, i) => i !== idx);
    setDraft(next);
    onChange(next);
  };

  const rowTotal = (t: ForecastedTransport) =>
    (t.standard || 0) + (t.cat1 || 0) + (t.cat2 || 0) + (t.cat3 || 0) + (t.exceptional || 0);

  const colTotals: Record<ForecastTransportCategory, number> = {
    standard: 0, cat1: 0, cat2: 0, cat3: 0, exceptional: 0,
  };
  draft.forEach(t => FORECAST_TRANSPORT_CATEGORIES.forEach(c => { colTotals[c.key] += (t as any)[c.key] || 0; }));
  const grandTotal = Object.values(colTotals).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TruckIcon className="h-5 w-5 text-accent" />
          Transports prévisionnels
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Renseignez le nombre prévisionnel de camions par usine et par catégorie de transport.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Usine</th>
                {FORECAST_TRANSPORT_CATEGORIES.map(c => (
                  <th key={c.key} className="p-2 text-center font-medium">{c.label}</th>
                ))}
                <th className="p-2 text-center font-medium">Total</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {draft.length === 0 && (
                <tr>
                  <td colSpan={FORECAST_TRANSPORT_CATEGORIES.length + 3} className="p-3 text-center text-muted-foreground italic">
                    Aucune usine renseignée
                  </td>
                </tr>
              )}
              {draft.map((t, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="p-1">
                    <Input
                      value={t.usine}
                      onChange={e => update(idx, { usine: e.target.value })}
                      onBlur={commit}
                      placeholder="Ex : Usine Nord"
                      className="h-8 text-xs"
                    />
                  </td>
                  {FORECAST_TRANSPORT_CATEGORIES.map(c => (
                    <td key={c.key} className="p-1 text-center">
                      <Input
                        type="number"
                        min={0}
                        value={(t as any)[c.key] ?? 0}
                        onChange={e => update(idx, { [c.key]: Math.max(0, Number(e.target.value) || 0) } as any)}
                        onBlur={commit}
                        className="h-8 w-16 text-center text-xs mx-auto"
                      />
                    </td>
                  ))}
                  <td className="p-1 text-center font-semibold">{rowTotal(t)}</td>
                  <td className="p-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {draft.length > 0 && (
                <tr className="font-bold bg-muted/40">
                  <td className="p-2">Total général</td>
                  {FORECAST_TRANSPORT_CATEGORIES.map(c => (
                    <td key={c.key} className="p-2 text-center">{colTotals[c.key]}</td>
                  ))}
                  <td className="p-2 text-center">{grandTotal}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter une usine
        </Button>
      </CardContent>
    </Card>
  );
}
