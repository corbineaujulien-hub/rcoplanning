import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HardDriveDownload, Package, Download, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BUCKET = 'sauvegardes-rco';
const KEEP = 10;

interface BackupEntry {
  name: string;
  createdAt: string | null;
  size: number | null;
  totalProjects: number | null;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function BackupsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [backups, setBackups] = useState<BackupEntry[]>([]);

  const refreshBackupList = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list('', { limit: KEEP, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;

      const zips = (data ?? []).filter(f => f.name.endsWith('.zip'));
      const entries: BackupEntry[] = await Promise.all(
        zips.map(async file => {
          let totalProjects: number | null = null;
          try {
            const { data: meta } = await supabase.storage.from(BUCKET).download(`meta/${file.name}.json`);
            if (meta) totalProjects = JSON.parse(await meta.text())?.total_projects ?? null;
          } catch {
            /* métadonnées optionnelles */
          }
          return {
            name: file.name,
            createdAt: file.created_at ?? null,
            size: (file.metadata as any)?.size ?? null,
            totalProjects,
          };
        }),
      );
      setBackups(entries);
    } catch (err: any) {
      toast.error('Impossible de lister les sauvegardes : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refreshBackupList();
  }, [open, refreshBackupList]);

  const downloadBackup = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(fileName, 3600);
      if (error || !data?.signedUrl) throw error ?? new Error('Lien indisponible');
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error('Téléchargement impossible : ' + err.message);
    }
  };

  const triggerManualBackup = async () => {
    setRunning(true);
    const t = toast.loading('Sauvegarde en cours...');
    try {
      const { data, error } = await supabase.functions.invoke('weekly-backup', {
        body: { manual: true },
      });
      if (error) throw error;
      if (data && (data as any).ok === false) throw new Error((data as any).error);
      toast.success('Sauvegarde générée et stockée avec succès !', { id: t });
      await refreshBackupList();
    } catch (err: any) {
      toast.error('Erreur de sauvegarde : ' + err.message, { id: t });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-fit max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDriveDownload className="h-5 w-5 text-accent" />
            Sauvegardes RCO Planning
          </DialogTitle>
          <DialogDescription>Sauvegarde automatique : tous les lundis à 2h du matin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button onClick={triggerManualBackup} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDriveDownload className="h-4 w-4 mr-2" />}
              Déclencher une sauvegarde maintenant
            </Button>
            <Button variant="outline" size="icon" onClick={refreshBackupList} disabled={loading || running} aria-label="Rafraîchir">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Sauvegardes disponibles :</div>
            {loading && backups.length === 0 && (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            )}
            {!loading && backups.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune sauvegarde pour le moment.</p>
            )}
            {backups.map(b => (
              <div key={b.name} className="flex items-center gap-4 rounded-md border p-3">
                <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm whitespace-nowrap">{b.name}</div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {b.createdAt ? new Date(b.createdAt).toLocaleDateString('fr-FR') : '—'}
                    {b.totalProjects != null ? ` — ${b.totalProjects} chantiers` : ''}
                    {` — ${formatFileSize(b.size)}`}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => downloadBackup(b.name)}>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">(Conserve les {KEEP} dernières sauvegardes)</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
