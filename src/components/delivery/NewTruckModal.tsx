import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck } from '@/types/delivery';

interface NewTruckModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (number: string, time: string) => void;
  date: string;
  trucks?: Truck[];
}

export default function NewTruckModal({ open, onClose, onConfirm, date, trucks = [] }: NewTruckModalProps) {
  const [number, setNumber] = useState('');
  const [time, setTime] = useState('08:00');

  const isDuplicate = useMemo(() => {
    if (!number.trim()) return false;
    return trucks.some(t => t.number.toLowerCase() === number.trim().toLowerCase());
  }, [number, trucks]);

  const handleConfirm = () => {
    if (!number.trim() || isDuplicate) return;
    onConfirm(number.trim(), time);
    setNumber('');
    setTime('08:00');
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau camion – {date}</DialogTitle>
        </DialogHeader>
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
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={!number.trim() || isDuplicate}>Créer le camion</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
