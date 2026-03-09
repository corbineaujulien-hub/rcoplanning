

## Plan : Corrections et améliorations de l'onglet Compo Camion

### 1. Bug fix : produits non ajoutés au nouveau camion
Le problème est dans `handleNewTruckConfirm` (ligne 154-160) : `addTruck` met à jour le state via `setState`, mais `checkAlertsAndAssign` est appelé avec `setTimeout(50ms)` et cherche le camion dans `trucks` qui n'est pas encore mis à jour (closure sur l'ancien state). 
**Fix** : au lieu du `setTimeout`, ajouter directement les `elementIds` dans le truck à la création (`elementIds: pendingElementIds`) ou utiliser un `useEffect` qui détecte le nouveau camion et déclenche l'assignation.

### 2. Filtre type : afficher uniquement les types présents dans la base
Ligne 288-294 : remplacer `PRODUCT_TYPES` par une liste calculée dynamiquement depuis `elements` :
```
const productTypes = useMemo(() => [...new Set(elements.map(e => e.productType).filter(Boolean))], [elements]);
```

### 3. Badge noir pour camions vides
Dans `renderTruckBadge` (ligne 243) : si `els.length === 0`, appliquer une classe noire (`bg-gray-900 text-white`) au lieu de `getCategoryColorClass(cat)`.

### 4. Bouton "Supprimer toutes les compositions"
Ajouter un bouton destructif dans la barre d'actions au-dessus du calendrier. Au clic, ouvrir un `AlertDialog` de confirmation, puis appeler `deleteTruck` pour chaque camion (ou ajouter une méthode `deleteAllTrucks` au contexte).

### 5. Vue Semaine : conserver les horaires lors du déplacement
Dans `onDropOnDay` (ligne 195-210) : en vue semaine, quand on déplace des camions, ne pas changer `time` — ne mettre à jour que `date`. Retirer la logique `if (hour !== undefined) updates.time = ...` pour le drop de trucks en vue semaine, ou ne l'appliquer que si on drop sur une cellule horaire différente volontairement. Solution : ne pas passer `hour` pour les trucks droppés, seulement pour les éléments.

**Correction** : dans `onDropOnDay`, quand `type === 'trucks'`, ne mettre à jour que `{ date: dateStr }` sans toucher à `time`.

### 6. Champ commentaire dans TruckDetailModal
- Ajouter `comment?: string` au type `Truck` dans `delivery.ts`
- Dans `TruckDetailModal`, ajouter un `Textarea` pour saisir/modifier le commentaire
- Sauvegarder via `updateTruck(truck.id, { comment })` au blur ou via un bouton

### 7. Icône commentaire sur les badges (vues Mois et Semaine)
Dans `renderTruckBadge`, si `truck.comment` est non vide, afficher une petite icône `MessageSquare` (de lucide-react) à côté du numéro.

### Fichiers modifiés
- `src/types/delivery.ts` — ajout `comment?: string` sur `Truck`
- `src/components/delivery/TruckCompositionTab.tsx` — bug fix assignation, filtre type dynamique, badge noir, bouton supprimer tout, fix horaire semaine, icône commentaire
- `src/components/delivery/TruckDetailModal.tsx` — champ commentaire textarea
- `src/context/DeliveryContext.tsx` — ajout `deleteAllTrucks` (optionnel, on peut aussi boucler sur `deleteTruck`)

