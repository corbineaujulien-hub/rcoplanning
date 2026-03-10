

## Plan : Tri par type de produit + suppression repères en vue Jour

### 1. TruckDetailModal — Repères groupés par type de produit

**Fichier** : `src/components/delivery/TruckDetailModal.tsx` (lignes 147-162)

Actuellement les repères sont listés à plat. Remplacer par un groupement par `productType` :
- Grouper `elements` par `el.productType`
- Pour chaque type, afficher un sous-titre (ex: `Poutre BP IC`) puis les badges repères en dessous
- Conserver le bouton X existant sur chaque repère

### 2. Vue Jour — Repères groupés par type, sans le type à côté du repère, avec croix de suppression

**Fichier** : `src/components/delivery/TruckCompositionTab.tsx` (lignes 810-819)

Actuellement : liste à plat avec `{el.repere} ({el.productType})`.

Remplacer par :
- Grouper `els` par `productType` via `Object.groupBy` ou reduce
- Pour chaque type, afficher le nom du type en label puis les repères sans le `(productType)`
- Ajouter un bouton `<X>` sur chaque repère qui appelle `removeElementFromTruck(truck.id, el.id)` avec `e.stopPropagation()` pour éviter d'ouvrir le détail

### Fichiers modifiés
- `src/components/delivery/TruckDetailModal.tsx`
- `src/components/delivery/TruckCompositionTab.tsx`

