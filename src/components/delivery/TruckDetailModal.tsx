import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDelivery } from '@/context/DeliveryContext';
import { Truck, TRANSPORT_CATEGORIES } from '@/types/delivery';
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories, getProductCountsByType, getCategoryColorClass } from '@/utils/transportUtils';
import { Truck as TruckIcon, Weight, Ruler, Factory, Package } from 'lucide-react';

interface TruckDetailModalProps {
  open: boolean;
  onClose: () => void;
  truck: Truck | null;
}

export default function TruckDetailModal({ open, onClose, truck }: TruckDetailModalProps) {
  const { getTruckElements } = useDelivery();

  if (!truck) return null;

  const elements = getTruckElements(truck.id);
  const category = getTransportCategory(elements);
  const weight = getTruckWeight(elements);
  const maxLen = getTruckMaxLength(elements);
  const factories = getTruckFactories(elements);
  const counts = getProductCountsByType(elements);
  const catInfo = TRANSPORT_CATEGORIES[category];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TruckIcon className="h-5 w-5 text-accent" />
            Camion {truck.number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Date & horaire</p>
              <p className="font-semibold">{truck.date} à {truck.time}</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Factory className="h-3 w-3" />Usine(s)</p>
              <p className="font-semibold">{factories.join(', ') || '—'}</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Weight className="h-3 w-3" />Poids total</p>
              <p className="font-semibold">{weight.toFixed(2)} t</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Ruler className="h-3 w-3" />Plus long produit</p>
              <p className="font-semibold">{maxLen.toFixed(2)} m</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Catégorie :</span>
            <span className={`${getCategoryColorClass(category)} px-2 py-1 rounded text-sm font-medium`}>{catInfo.label}</span>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1"><Package className="h-3 w-3" />Produits ({elements.length})</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(counts).map(([type, count]) => (
                <span key={type} className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">
                  {count}× {type}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Repères</p>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-auto">
              {elements.map(el => (
                <span key={el.id} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono">
                  {el.repere}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
