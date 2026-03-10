import { useState } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { CONDUCTORS, SUBCONTRACTORS, Team } from '@/types/delivery';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Building2, User, Phone, MapPin, FileText, HardHat, Calendar, Users, Plus, Trash2, Pencil, Check, X } from 'lucide-react';

export default function GeneralInfoTab() {
  const { projectInfo, setProjectInfo, teams, addTeam, updateTeam, deleteTeam } = useDelivery();
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
            <Select value={projectInfo.conductor} onValueChange={v => update('conductor', v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un conducteur" /></SelectTrigger>
              <SelectContent>
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
            <Select value={projectInfo.subcontractor} onValueChange={v => update('subcontractor', v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un sous-traitant" /></SelectTrigger>
              <SelectContent>
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
