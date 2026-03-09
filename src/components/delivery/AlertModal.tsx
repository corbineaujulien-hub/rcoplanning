import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { TransportCategory, TRANSPORT_CATEGORIES } from '@/types/delivery';
import { getCategoryColorClass } from '@/utils/transportUtils';

interface TransportAlertProps {
  open: boolean;
  category: TransportCategory;
  totalWeight: number;
  maxLength: number;
  onContinue: () => void;
  onCancel: () => void;
}

export function TransportAlertModal({ open, category, totalWeight, maxLength, onContinue, onCancel }: TransportAlertProps) {
  const info = TRANSPORT_CATEGORIES[category];
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Transport hors standard détecté
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span>Catégorie :</span>
            <span className={`${getCategoryColorClass(category)} px-2 py-1 rounded text-sm font-medium`}>{info.label}</span>
          </div>
          <p>Poids total : <strong>{totalWeight.toFixed(2)} t</strong></p>
          <p>Produit le plus long : <strong>{maxLength.toFixed(2)} m</strong></p>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Revenir en arrière</Button>
          <Button onClick={onContinue}>Continuer avec ce type de transport</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MultiSiteAlertProps {
  open: boolean;
  factories: string[];
  onContinue: () => void;
  onCancel: () => void;
}

export function MultiSiteAlertModal({ open, factories, onContinue, onCancel }: MultiSiteAlertProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-transport-cat1" />
            Chargement multi-sites détecté
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p>Les repères de ce camion proviennent de plusieurs usines :</p>
          <ul className="list-disc list-inside space-y-1">
            {factories.map(f => <li key={f} className="font-medium">{f}</li>)}
          </ul>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Revenir en arrière</Button>
          <Button onClick={onContinue}>Continuer avec un chargement multi-sites</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
