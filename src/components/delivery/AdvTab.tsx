import { useMemo, useState } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { useAdv } from '@/hooks/useAdv';
import { parseISO } from 'date-fns';
import {
  DEMARCHE_LABELS, DEMARCHE_OPTIONS, CAUTION_STATUSES,
  calculateAdvScore, getScoreHexColor, getStatusDotClass,
  formatDateTimeFR, AdvDemarcheKey,
} from '@/utils/adv';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, History as HistoryIcon, ClipboardCheck } from 'lucide-react';

export default function AdvTab() {
  const { projectId, trucks } = useDelivery();
  const { projectInfo } = useDelivery();

  const startDate = useMemo(() => {
    if (trucks.length === 0) return null;
    const dates = trucks.map(t => t.date).filter(Boolean).sort();
    return dates[0] ? parseISO(dates[0]) : null;
  }, [trucks]);

  const supplyOnly = !!projectInfo.supplyOnly;
  const {
    adv, cautions, historique, loading,
    updateDemarche, updateCommentaire, addCaution, updateCaution, deleteCaution,
  } = useAdv(projectId, supplyOnly, startDate);

  const [commentLocal, setCommentLocal] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (loading || !adv) {
    return <div className="text-muted-foreground p-6">Chargement de la fiche ADV…</div>;
  }

  const score = calculateAdvScore(adv, cautions);
  const scoreColor = getScoreHexColor(score);

  const demarcheKeys: AdvDemarcheKey[] = ['compte_client', 'garantie_sfac', 'contrat_client', 'caution_rg', 'contrat_st', 'dast'];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Score de préparation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${score}%`, backgroundColor: scoreColor }} />
            </div>
            <span className="font-bold text-lg w-16 text-right" style={{ color: scoreColor }}>{score}%</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Commentaire général</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={commentLocal ?? adv.commentaire}
            onChange={(e) => setCommentLocal(e.target.value)}
            onBlur={() => {
              if (commentLocal !== null && commentLocal !== adv.commentaire) {
                updateCommentaire(commentLocal);
              }
              setCommentLocal(null);
            }}
            rows={3}
            className="min-h-[72px]"
            placeholder="Notes générales sur l'avancement ADV de ce chantier…"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-accent" />
            Démarches administratives
          </CardTitle>
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <HistoryIcon className="h-4 w-4 mr-2" />
                Historique
              </Button>
            </DialogTrigger>
            <DialogContent className="w-fit max-w-3xl">
              <DialogHeader>
                <DialogTitle>Historique des modifications ADV</DialogTitle>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-1 text-sm">
                {historique.length === 0 && (
                  <p className="text-muted-foreground">Aucune modification enregistrée.</p>
                )}
                {historique.map(h => (
                  <div key={h.id} className="border-b py-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="font-medium tabular-nums whitespace-nowrap">{formatDateTimeFR(h.date)}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{h.user_email || 'inconnu'}</span>
                    <span className="flex-1 min-w-[200px]">{h.description}</span>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {demarcheKeys.map(key => {
            const value = adv[key];
            return (
              <div key={key} className="grid grid-cols-[1fr_auto_220px] items-center gap-3 py-1.5 border-b last:border-b-0">
                <div className="font-medium text-sm">{DEMARCHE_LABELS[key]}</div>
                <span className={`h-3 w-3 rounded-full ${getStatusDotClass(value)}`} />
                <Select value={value} onValueChange={(v) => updateDemarche(key, v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMARCHE_OPTIONS[key].map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Cautions supplémentaires</CardTitle>
          <Button size="sm" variant="outline" onClick={addCaution}>
            <Plus className="h-4 w-4 mr-2" /> Ajouter une caution
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {cautions.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune caution supplémentaire.</p>
          )}
          {cautions.map(c => (
            <div key={c.id} className="grid grid-cols-[1fr_auto_220px_auto] items-center gap-3 py-1.5">
              <Input
                value={c.nom}
                onChange={(e) => updateCaution(c.id, { nom: e.target.value })}
                placeholder="Nom de la caution"
                className="h-8 text-sm"
              />
              <span className={`h-3 w-3 rounded-full ${getStatusDotClass(c.statut)}`} />
              <Select value={c.statut} onValueChange={(v) => updateCaution(c.id, { statut: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAUTION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => deleteCaution(c.id)} title="Supprimer">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}