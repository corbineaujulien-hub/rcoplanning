import { useState } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { CONDUCTORS, SUBCONTRACTORS, Team, TRANSPORT_CATEGORIES, TransportCategory, ForecastSlot, ForecastedTruck } from '@/types/delivery';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Building2, User, Phone, MapPin, FileText, HardHat, Calendar, Users, Plus, Trash2, Pencil, Check, X, CalendarDays } from 'lucide-react';

export default function GeneralInfoTab() {
  const { projectInfo, setProjectInfo, teams, addTeam, updateTeam, deleteTeam, forecastSlots, addForecastSlot, updateForecastSlot, deleteForecastSlot, elements } = useDelivery();
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

      <ForecastSlotsCard
        slots={forecastSlots}
        onAdd={addForecastSlot}
        onUpdate={updateForecastSlot}
        onDelete={deleteForecastSlot}
        knownUsines={Array.from(new Set(elements.map(e => e.factory).filter(Boolean))).sort()}
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

// --- Forecast slots sub-component ---
const CATS: TransportCategory[] = ['standard', 'cat1', 'cat2', 'cat3'];

interface ForecastSlotsCardProps {
  slots: ForecastSlot[];
  onAdd: (slot: ForecastSlot) => void;
  onUpdate: (id: string, updates: Partial<ForecastSlot>) => void;
  onDelete: (id: string) => void;
  knownUsines: string[];
}

function ForecastSlotsCard({ slots, onAdd, onUpdate, onDelete, knownUsines }: ForecastSlotsCardProps) {
  const handleAdd = () => {
    const today = new Date().toISOString().slice(0, 10);
    const slot: ForecastSlot = {
      id: crypto.randomUUID(),
      projectId: '',
      dateStart: today,
      dateEnd: today,
      forecastedTrucks: [],
    };
    onAdd(slot);
  };

  const sorted = [...slots].sort((a, b) => a.dateStart.localeCompare(b.dateStart));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-accent" />
          Planning prévisionnel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Renseignez les créneaux d'intervention prévisionnels et le nombre de camions prévus par usine et catégorie de transport. Ces données alimentent le planning de charge global.
        </p>
        {sorted.length === 0 && (
          <div className="text-sm text-muted-foreground italic text-center py-4 border border-dashed rounded-md">
            Aucun créneau prévisionnel pour le moment.
          </div>
        )}
        {sorted.map(slot => (
          <ForecastSlotEditor
            key={slot.id}
            slot={slot}
            knownUsines={knownUsines}
            onUpdate={(u) => onUpdate(slot.id, u)}
            onDelete={() => onDelete(slot.id)}
          />
        ))}
        <Button variant="outline" size="sm" onClick={handleAdd} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Ajouter un créneau
        </Button>
      </CardContent>
    </Card>
  );
}

interface ForecastSlotEditorProps {
  slot: ForecastSlot;
  knownUsines: string[];
  onUpdate: (updates: Partial<ForecastSlot>) => void;
  onDelete: () => void;
}

function ForecastSlotEditor({ slot, knownUsines, onUpdate, onDelete }: ForecastSlotEditorProps) {
  const [newUsine, setNewUsine] = useState('');

  const usinesInSlot = Array.from(new Set(slot.forecastedTrucks.map(t => t.usine)));

  const setCount = (usine: string, category: TransportCategory, count: number) => {
    const others = slot.forecastedTrucks.filter(t => !(t.usine === usine && t.category === category));
    const next: ForecastedTruck[] = count > 0
      ? [...others, { usine, category, count }]
      : others;
    onUpdate({ forecastedTrucks: next });
  };

  const getCount = (usine: string, category: TransportCategory) =>
    slot.forecastedTrucks.find(t => t.usine === usine && t.category === category)?.count ?? 0;

  const addUsine = () => {
    const name = newUsine.trim();
    if (!name || usinesInSlot.includes(name)) return;
    onUpdate({ forecastedTrucks: [...slot.forecastedTrucks, { usine: name, category: 'standard', count: 0 }] });
    setNewUsine('');
  };

  const removeUsine = (usine: string) => {
    onUpdate({ forecastedTrucks: slot.forecastedTrucks.filter(t => t.usine !== usine) });
  };

  return (
    <div className="border rounded-md p-3 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Du</Label>
          <Input
            type="date"
            value={slot.dateStart}
            onChange={e => onUpdate({ dateStart: e.target.value })}
            className="h-8 w-[150px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">au</Label>
          <Input
            type="date"
            value={slot.dateEnd}
            onChange={e => onUpdate({ dateEnd: e.target.value })}
            className="h-8 w-[150px]"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {usinesInSlot.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left p-1 font-medium">Usine</th>
                {CATS.map(c => (
                  <th key={c} className="p-1 text-center font-medium">{TRANSPORT_CATEGORIES[c].label}</th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {usinesInSlot.map(usine => (
                <tr key={usine} className="border-b last:border-0">
                  <td className="p-1 font-medium">{usine}</td>
                  {CATS.map(c => (
                    <td key={c} className="p-1 text-center">
                      <Input
                        type="number"
                        min={0}
                        value={getCount(usine, c)}
                        onChange={e => setCount(usine, c, Math.max(0, Number(e.target.value) || 0))}
                        className="h-7 w-16 text-center text-xs mx-auto"
                      />
                    </td>
                  ))}
                  <td className="p-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeUsine(usine)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          list={`usines-${slot.id}`}
          value={newUsine}
          onChange={e => setNewUsine(e.target.value)}
          placeholder="Nom de l'usine"
          className="h-8 text-sm flex-1"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUsine(); } }}
        />
        <datalist id={`usines-${slot.id}`}>
          {knownUsines.map(u => <option key={u} value={u} />)}
        </datalist>
        <Button variant="outline" size="sm" onClick={addUsine} disabled={!newUsine.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Usine
        </Button>
      </div>
    </div>
  );
}
