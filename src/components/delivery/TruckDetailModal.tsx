import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDelivery } from '@/context/DeliveryContext';
import { Truck, TRANSPORT_CATEGORIES } from '@/types/delivery';
import { getTransportCategory, getTruckWeight, getTruckMaxLength, getTruckFactories, getTruckZones, getProductCountsByType, getCategoryColorClass, getFactoryColor } from '@/utils/transportUtils';
import { Truck as TruckIcon, Weight, Ruler, Factory, Package, Trash2, X, Pencil, MessageSquare, Users, MapPin } from 'lucide-react';

interface TruckDetailModalProps {
  open: boolean;
  onClose: () => void;
  truck: Truck | null;
}

export default function TruckDetailModal({ open, onClose, truck }: TruckDetailModalProps) {
  const { getTruckElements, deleteTruck, removeElementFromTruck, updateTruck, teams, trucks } = useDelivery();
  const hasMultipleTeams = teams.length > 1;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editing, setEditing] = useState(false);
  const [editingNumber, setEditingNumber] = useState(false);
  const [editNumber, setEditNumber] = useState('');
  const [comment, setComment] = useState('');
  const [commentDirty, setCommentDirty] = useState(false);

  if (!truck) return null;

  // Always use latest truck data from context for real-time refresh
  const liveTruck = trucks.find(t => t.id === truck.id) || truck;

  const elements = getTruckElements(liveTruck.id);
  const isDuplicateNumber = editNumber.trim() !== '' && editNumber.trim().toLowerCase() !== liveTruck.number.toLowerCase() && trucks.some(t => t.id !== liveTruck.id && t.number.toLowerCase() === editNumber.trim().toLowerCase());
  const category = getTransportCategory(elements);
  const weight = getTruckWeight(elements);
  const maxLen = getTruckMaxLength(elements);
  const factories = getTruckFactories(elements);
  const truckZones = getTruckZones(elements);
  const counts = getProductCountsByType(elements);
  const catInfo = TRANSPORT_CATEGORIES[category];

  // Sync comment state when truck changes
  if (!commentDirty && comment !== (liveTruck.comment || '')) {
    setComment(liveTruck.comment || '');
  }

  const handleStartEdit = () => {
    setEditDate(liveTruck.date);
    setEditTime(liveTruck.time);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (editDate && editTime) {
      updateTruck(liveTruck.id, { date: editDate, time: editTime });
    }
    setEditing(false);
  };

  const handleStartEditNumber = () => {
    setEditNumber(liveTruck.number);
    setEditingNumber(true);
  };

  const handleSaveNumber = () => {
    if (editNumber.trim() && editNumber !== liveTruck.number && !isDuplicateNumber) {
      updateTruck(liveTruck.id, { number: editNumber.trim() });
    }
    setEditingNumber(false);
  };

  const handleDelete = () => {
    deleteTruck(liveTruck.id);
    setConfirmDelete(false);
    onClose();
  };

  const handleRemoveElement = (elementId: string) => {
    removeElementFromTruck(liveTruck.id, elementId);
  };

  const handleCommentBlur = () => {
    if (comment !== (liveTruck.comment || '')) {
      updateTruck(liveTruck.id, { comment });
    }
    setCommentDirty(false);
  };

  const handleClose = () => {
    // Save comment on close if dirty
    if (commentDirty && comment !== (liveTruck.comment || '')) {
      updateTruck(liveTruck.id, { comment });
    }
    setCommentDirty(false);
    setEditing(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && handleClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TruckIcon className="h-5 w-5 text-accent" />
              {editingNumber ? (
                <div className="flex items-center gap-1">
                  <span>Camion</span>
                  <div>
                    <Input value={editNumber} onChange={e => setEditNumber(e.target.value)} className={`h-7 w-24 text-sm ${isDuplicateNumber ? 'border-destructive' : ''}`} autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveNumber()} />
                    {isDuplicateNumber && <p className="text-xs text-destructive mt-0.5">Ce numéro existe déjà.</p>}
                  </div>
                  <Button size="sm" variant="default" className="h-6 text-xs px-2" onClick={handleSaveNumber} disabled={isDuplicateNumber}>OK</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditingNumber(false)}>Annuler</Button>
                </div>
              ) : (
                <span className="flex items-center gap-1">
                  Camion {liveTruck.number}
                  <button onClick={handleStartEditNumber} className="text-accent hover:text-accent/80"><Pencil className="h-3 w-3" /></button>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground flex items-center justify-between">
                  Date & horaire
                  {!editing && (
                    <button onClick={handleStartEdit} className="text-accent hover:text-accent/80">
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </p>
                {editing ? (
                  <div className="space-y-1 mt-1">
                    <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-7 text-xs" />
                    <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="h-7 text-xs" />
                    <div className="flex gap-1 mt-1">
                      <Button size="sm" variant="default" className="h-6 text-xs px-2" onClick={handleSaveEdit}>OK</Button>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditing(false)}>Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <p className="font-semibold">{format(parseISO(liveTruck.date), 'dd-MM-yyyy')} à {liveTruck.time}</p>
                )}
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground flex items-center gap-1"><Factory className="h-3 w-3" />Usine(s)</p>
                <div className="flex flex-wrap gap-1 mt-1">{factories.length > 0 ? factories.map(f => <span key={f} className="text-white text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: getFactoryColor(f) }}>{f}</span>) : <span className="font-semibold">—</span>}</div>
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

            {truckZones.length > 0 && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Zone(s)</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {truckZones.map(z => (
                    <span key={z} className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-0.5 rounded">{z}</span>
                  ))}
                </div>
              </div>
            )}

            {hasMultipleTeams && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Équipe :</span>
                <Select
                  value={liveTruck.teamId || teams[0]?.id || ''}
                  onValueChange={v => updateTruck(liveTruck.id, { teamId: v })}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              <div className="max-h-40 overflow-auto space-y-2">
                {Object.entries(
                  elements.reduce<Record<string, typeof elements>>((acc, el) => {
                    (acc[el.productType] = acc[el.productType] || []).push(el);
                    return acc;
                  }, {})
                ).map(([type, els]) => (
                  <div key={type}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{type}</p>
                    <div className="flex flex-wrap gap-1">
                      {els.map(el => (
                        <span key={el.id} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono flex items-center gap-1">
                          {el.repere}
                          <button
                            onClick={() => handleRemoveElement(el.id)}
                            className="hover:text-destructive transition-colors"
                            title="Retirer du camion"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment section */}
            <div>
              <Label className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                <MessageSquare className="h-3 w-3" /> Commentaire
              </Label>
              <Textarea
                value={comment}
                onChange={e => { setComment(e.target.value); setCommentDirty(true); }}
                onBlur={handleCommentBlur}
                placeholder="Ajouter un commentaire libre..."
                className="min-h-[60px] text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer le camion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le camion {liveTruck.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les repères seront libérés et pourront être affectés à d'autres camions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
