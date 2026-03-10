import { useDelivery } from '@/context/DeliveryContext';
import { CONDUCTORS, SUBCONTRACTORS } from '@/types/delivery';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Building2, User, Phone, MapPin, FileText, HardHat, Calendar } from 'lucide-react';

export default function GeneralInfoTab() {
  const { projectInfo, setProjectInfo } = useDelivery();

  const update = (field: string, value: string | boolean) => {
    setProjectInfo({ ...projectInfo, [field]: value });
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
