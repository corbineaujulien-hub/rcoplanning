

## Plan : Badge "Chargé → Camion N°" + Drag & drop en vue Jour

### 1. Afficher le numéro de camion sur les badges repères chargés

**Problème** : Quand un repère est chargé, le badge affiche juste "Chargé" sans indiquer dans quel camion.

**Solution** : Ajouter une fonction `getElementTruck(elementId): Truck | undefined` dans le contexte (ou en local) qui retrouve le camion contenant cet élément. Puis remplacer le texte "Chargé" par "Chargé · {truck.number}" sur les badges en mode Liste ET en mode Plans.

**Fichier** : `TruckCompositionTab.tsx`
- Créer un helper local : `const getElementTruck = (id: string) => trucks.find(t => t.elementIds.includes(id));`
- Ligne 494 (mode Liste) : remplacer `Chargé` par `Chargé · {getElementTruck(el.id)?.number}`
- Ligne 614 (mode Plans) : idem

### 2. Drag & drop de repères en vue Jour sur camions existants ou nouveau camion

**Problème** : En vue Jour, on ne peut pas glisser un repère directement sur un camion existant ni créer un nouveau camion par drag & drop.

**Solution** : Modifier la vue Jour (lignes 734-807) pour :
- Ajouter `onDragOver` et `onDrop` sur chaque `Card` de camion existant. Le drop sur un camion existant appelle directement `checkAlertsAndAssign(truck.id, selectedIds)` sans passer par le picker.
- Ajouter une zone de drop "Nouveau camion" en bas de la liste (un div dashed) qui ouvre `NewTruckModal` avec la date du jour.
- Quand il n'y a aucun camion, la zone existante reste et crée un nouveau camion (comportement actuel conservé).

**Fichier** : `TruckCompositionTab.tsx`
- Sur chaque `<Card>` de camion en vue jour : ajouter `onDragOver={onDragOver}`, `onDrop` qui récupère les `selectedIds` non assignés et appelle `checkAlertsAndAssign`, plus les handlers visuels `onDragEnter/onDragLeave`.
- Ajouter après la boucle des camions un div drop zone "＋ Glissez ici pour créer un nouveau camion" avec `onDrop` qui appelle `handleDrop(dateStr)` → ouvre le `NewTruckModal`.

### Fichiers modifiés
- `src/components/delivery/TruckCompositionTab.tsx`

