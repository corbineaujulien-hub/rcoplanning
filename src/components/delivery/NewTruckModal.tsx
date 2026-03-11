import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck } from '@/types/delivery';
import { AlertTriangle } from 'lucide-react';

interface NewTruckModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (number: string, time: string) => void;
  date: string;
  trucks?: Truck[];
  /** Only trucks from the same team, used for time conflict detection */
  teamTrucks?: Truck[];
}

export default function NewTruckModal({ open, onClose, onConfirm, date, trucks = [], teamTrucks }: NewTruckModalProps) {
  // Compute next auto-increment number
  const nextNumber = useMemo(() => {
    if (trucks.length === 0) return '1';
    const nums = trucks.map(t => {
      const n = parseInt(t.number, 10);
      return isNaN(n) ? 0 : n;
    });
    return String(Math.max(...nums) + 1);
  }, [trucks]);

  const [number, setNumber] = useState('');
  const [time, setTime] = useState('08:00');
  const [showTimeConflict, setShowTimeConflict] = useState(false);

  // Pre-fill number when modal opens
  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) {
    setNumber(nextNumber);
    setLastOpen(true);
  }
  if (!open && lastOpen) {
    setLastOpen(false);
  }

  const isDuplicate = useMemo(() => {
    if (!number.trim()) return false;
    return trucks.some(t => t.number.toLowerCase() === number.trim().toLowerCase());
  }, [number, trucks]);

  const handleConfirm = () => {
    if (!number.trim() || isDuplicate) return;
    // Check for time conflict within same team only
    const conflictPool = teamTrucks ?? trucks;
    const hasConflict = conflictPool.some(t => t.date === date && t.time === time);
    if (hasConflict && !showTimeConflict) {
      setShowTimeConflict(true);
      return;
    }
    doConfirm();
  };

  const doConfirm = () => {
    onConfirm(number.trim(), time);
    setTime('08:00');
    setShowTimeConflict(false);
  };

  const handleClose = () => {
    setShowTimeConflict(false);
    setNumber('');
    setTime('08:00');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau camion – {date}</DialogTitle>
        </DialogHeader>

        {showTimeConflict ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Conflit d'horaire détecté</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Un ou plusieurs camions sont déjà programmés le {date} à {time}.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTimeConflict(false)}>Revenir en arrière</Button>
              <Button onClick={doConfirm}>Continuer avec plusieurs camions à la même heure</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Numéro de camion</Label>
                <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="Ex: CAM-001" autoFocus />
                {isDuplicate && (
                  <p className="text-sm text-destructive">Ce numéro de camion existe déjà.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Horaire de livraison</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              <Button onClick={handleConfirm} disabled={!number.trim() || isDuplicate}>Créer le camion</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
