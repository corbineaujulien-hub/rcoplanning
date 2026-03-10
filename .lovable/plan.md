

## Plan : Améliorations DatabaseTab et TruckCompositionTab

### 1. Bouton "Supprimer plans" dans DatabaseTab
- Ajouter un bouton "Supprimer plans" à côté des boutons existants (ligne ~494)
- Ouvrir un Dialog avec la liste des plans importés, chaque plan avec une checkbox
- Bouton "Supprimer tous les plans" en haut du dialog
- Bouton de confirmation pour supprimer les plans sélectionnés
- Nouveau state: `deletePlansDialogOpen`, `selectedPlanIdsToDelete`

### 2. Réorganiser le dialog PDF : zones/types AVANT le fichier
- Déplacer les blocs "Zones concernées" (lignes 865-893) et "Types de produits" (lignes 880-893) **avant** le bloc "Fichier PDF" (lignes 819-828)

### 3. Corriger le canvas de sélection de zone
Le canvas couvre tout l'iframe PDF y compris les contrôles natifs du viewer (zoom, rotation, scrollbar). Le canvas intercepte tous les événements souris.
- **Solution** : Ne pas superposer le canvas sur toute l'iframe. Ajouter un **bouton toggle "Dessiner zone"** qui active/désactive le canvas. Par défaut le canvas est masqué (`pointer-events-none` / `display:none`), l'utilisateur peut naviguer librement dans le PDF. Quand il clique sur "Dessiner zone", le canvas apparait avec `cursor-crosshair` et intercepte les clics. Une fois le rectangle dessiné, le canvas repasse en `pointer-events-none` pour permettre à nouveau l'interaction avec le PDF.

### 4. Repères trouvés = repères de la BDD (pas du PDF)
Dans `handlePdfImport` (lignes 319-326), les listes `found` et `notFound` contiennent les repères bruts du PDF (ex: "DBF-A003"). Modifier pour que `found` contienne les repères de la BDD matchés (ex: "A003") :
```
const foundDbReperes = filteredEls
  .filter(el => detectedReperes.some(r => r.toLowerCase().includes(el.repere.toLowerCase())))
  .map(el => el.repere);
const notFoundPdfReperes = detectedReperes
  .filter(r => !filteredEls.some(el => r.toLowerCase().includes(el.repere.toLowerCase())));
```

### 5. Compo Camion : pas de liste de repères, sélection sur le plan
Quand un plan est sélectionné (lignes 423-499), supprimer la liste des repères affichée sous le PDF. Le PDF s'affiche en grand seul. Les repères sont sélectionnables directement depuis le PDF viewer natif (l'utilisateur peut voir les repères sur le plan). Ajouter en dessous du PDF uniquement :
- Le bouton retour
- Le nom du plan
- Un compteur "X sélectionné(s)" avec la checkbox tout sélectionner
- Les repères sélectionnés sous forme de badges compacts (pas la liste complète)

En pratique, comme on ne peut pas rendre les repères cliquables *dans* le PDF natif (iframe), on garde une liste compacte mais **réduite** (collapse) par défaut, avec un bouton "Afficher les repères" pour déplier si besoin. Le PDF prend toute la place.

### Fichiers modifiés
- `src/components/delivery/DatabaseTab.tsx`
- `src/components/delivery/TruckCompositionTab.tsx`

