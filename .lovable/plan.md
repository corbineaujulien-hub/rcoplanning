

# Plan d'améliorations UI/UX multi-onglets

## 1. Onglet "Base de données" — Filtres améliorés

**Etat actuel** : Les boutons filtre changent déjà de couleur quand actifs (`text-primary` vs `text-muted-foreground` ligne 80). Il manque un bouton global "Réinitialiser les filtres".

**Modifications dans `DatabaseTab.tsx`** :
- Ajouter un bouton "Réinitialiser les filtres" visible uniquement quand au moins un filtre est actif, au-dessus ou à côté du tableau. Ce bouton remet `filters` à `{}`.
- Styliser ce bouton en couleur primaire quand des filtres sont actifs.

---

## 2. Onglet "Camion" — Filtres multi-select + reset coloré

**Etat actuel** : Les filtres Zone/Type/Usine/Statut sont des `Select` mono-valeur.

**Modifications dans `TruckCompositionTab.tsx`** :
- Remplacer les `Select` par des composants multi-select (Popover + Checkboxes, similaire au pattern `ColumnFilter` de DatabaseTab).
- Changer `filterZone`, `filterType`, `filterFactory` de `string` en `Set<string>`.
- Adapter le filtrage pour supporter les valeurs multiples.
- Colorer le bouton "Réinitialiser filtres" (ex: `variant="default"` au lieu de `"outline"`) quand au moins un filtre est actif.

---

## 3. TruckDetailModal — Numéro éditable + date JJ-MM-AAAA

**Modifications dans `TruckDetailModal.tsx`** :
- Ajouter un état `editNumber` et rendre le titre du camion éditable (icone crayon, comme pour date/heure).
- Appeler `updateTruck(truck.id, { number: editNumber })` à la sauvegarde.
- Formater l'affichage de la date en `dd-MM-yyyy` avec `format(parseISO(truck.date), 'dd-MM-yyyy')` au lieu d'afficher `truck.date` brut.

---

## 4. Vue Liste/Plans — Poids cumulé et transport en temps réel

**Modifications dans `TruckCompositionTab.tsx`** :
- Sous le compteur de sélection (`X sélectionné(s)`), ajouter un affichage dynamique calculé à partir de `selectedIds` :
  - Poids cumulé : `selectedElements.reduce(sum + weight)`
  - Longueur max des sélectionnés
  - Catégorie de transport résultante (via `getTransportCategory`)
- Afficher ces infos dans un bandeau compact (badges).

---

## 5. Vue Jour — Drag & drop inter-camions + édition inline

**Modifications dans `TruckCompositionTab.tsx`** (section vue jour, lignes 790-923) :

### Drag & drop de repères entre camions
- Modifier `onDragStart` pour les badges repères dans un camion : stocker `sourceTruckId` + `elementId` dans le dataTransfer.
- Sur le `onDrop` d'une carte camion, détecter si c'est un transfert inter-camion : `removeElementFromTruck(sourceTruckId, elId)` puis `addElementsToTruck(targetTruckId, [elId])`.

### Suppression du clic modal + édition inline
- Supprimer `onClick={() => setDetailTruck(truck)}` sur la carte camion (ligne 840).
- Remplacer l'en-tête statique par des champs éditables inline :
  - **Numéro** : `Input` texte compact
  - **Date** : `Input type="date"`
  - **Heure** : `Input type="time"`
  - **Commentaire** : `Textarea` compact
- Appeler `updateTruck()` au `onBlur` de chaque champ.

---

## 6. Vue Mois — Hauteur dynamique des cellules

**Modifications dans `TruckCompositionTab.tsx`** (section vue mois, lignes 715-745) :
- Remplacer `min-h-[80px]` par `min-h-[80px] h-auto` sur les cellules du calendrier.
- Cela permet aux cellules de grandir automatiquement quand le nombre de camions dépasse la hauteur initiale. Le grid CSS s'adapte naturellement car chaque ligne prend la hauteur de sa cellule la plus haute.

---

## Fichiers impactés

| Fichier | Modifications |
|---|---|
| `DatabaseTab.tsx` | Bouton reset global des filtres |
| `TruckCompositionTab.tsx` | Filtres multi-select, reset coloré, poids cumulé sélection, vue jour inline + D&D inter-camions, vue mois hauteur dynamique |
| `TruckDetailModal.tsx` | Numéro éditable, date format JJ-MM-AAAA |

