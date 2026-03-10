

## Plan : Dialogs adaptatifs, renommage plan, décalage camions, alerte même heure, filtres plan, masquer week-ends, jours fériés

### 1. Dialog "Supprimer plans" adaptatif
Dans `DatabaseTab.tsx` (ligne 829), le `DialogContent` utilise `w-fit` mais ça ne suffit pas. Remplacer par `sm:max-w-lg w-auto` et s'assurer qu'il n'y a pas de `max-h` ni `overflow` qui force le scroll. Si le nombre de plans est très grand, ajouter un `max-h-[70vh] overflow-y-auto` uniquement sur la liste interne (div ligne 844), pas sur le DialogContent.

### 2. Renommer le plan dans le dialog d'import PDF
Dans `DatabaseTab.tsx`, ajouter un state `pdfPlanName` (initialisé au nom du fichier quand il est sélectionné). Ajouter un champ `Input` "Nom du plan" après la sélection du fichier. Utiliser `pdfPlanName` au lieu de `pdfFile.name` dans `handlePdfImport` (ligne 297). Reset dans `resetPdfDialog`.

### 3. Bouton "Décaler" dans Compo Camion
Dans `TruckCompositionTab.tsx`, ajouter un bouton "Décaler" à côté de "Supprimer tout" (ligne 536). Ouvre un Dialog avec :
- Liste des camions avec checkboxes + bouton "Tout sélectionner"
- Choix du type de décalage : semaines / jours / heures (radio ou select)
- Input numérique pour la valeur (positif ou négatif)
- Bouton confirmer : pour chaque camion sélectionné, calculer la nouvelle date/heure avec `addWeeks`/`addDays`/`addHours` et appeler `updateTruck`

### 4. Alerte camion même jour + même heure
Dans `NewTruckModal.tsx`, ajouter une vérification : si un camion existe déjà à la même date ET même heure, afficher un message d'alerte avec 2 boutons :
- "Revenir en arrière" (annule)
- "Continuer" (crée le camion malgré le conflit)

Nouveau state `showTimeConflict`. Dans `handleConfirm`, vérifier `trucks.some(t => t.date === date && t.time === time)`. Si conflit, afficher l'alerte au lieu de confirmer directement.

### 5. Filtres repères dans mode Plans (Compo Camion)
Dans `TruckCompositionTab.tsx`, quand un plan est sélectionné (lignes 443-512), ajouter au-dessus des badges groupés :
- Input de recherche par nom de repère (`planFilterRepere`)
- Select pour filtrer par usine (`planFilterFactory`)
- Bouton "Réinitialiser filtres"
- Appliquer ces filtres sur `matchedElements` avant le groupement

### 6. Masquer samedis et dimanches dans les calendriers
- **Vue Mois** (ligne 543) : filtrer `calendarDays` pour exclure samedi (6) et dimanche (0). Passer le grid de `grid-cols-7` à `grid-cols-5`. Mettre à jour `dayNames` pour ne garder que Lun-Ven.
- **Vue Semaine** (ligne 573) : filtrer `weekDays` pour exclure sam/dim. Grid de `grid-cols-[60px_repeat(7,1fr)]` → `grid-cols-[60px_repeat(5,1fr)]`.
- Conditionner par un state `showSaturdays` (par défaut `false`). Si `true`, afficher aussi le samedi (6 colonnes).

### 7. Jours fériés grisés
Créer une liste de jours fériés français pour l'année courante (constante ou fonction utilitaire dans `transportUtils.ts` ou inline). Dans les vues Mois et Semaine, si le jour est férié, ajouter une classe `bg-muted opacity-60` et un tooltip ou indicateur visuel.

### 8. Bouton "Afficher samedis" dans Infos générales
Dans `GeneralInfoTab.tsx`, ajouter un state partagé (via `DeliveryContext` ou `projectInfo`). Ajouter un champ `showSaturdays: boolean` dans `ProjectInfo` (types/delivery.ts). Dans `GeneralInfoTab`, ajouter un petit Switch discret en bas de page. `TruckCompositionTab` lit cette valeur pour conditionner l'affichage du samedi.

### Fichiers modifiés
- `src/types/delivery.ts` — ajouter `showSaturdays` dans `ProjectInfo`
- `src/components/delivery/DatabaseTab.tsx` — dialog adaptatif, renommage plan
- `src/components/delivery/TruckCompositionTab.tsx` — décalage, filtres plans, masquer week-ends, jours fériés
- `src/components/delivery/NewTruckModal.tsx` — alerte même heure
- `src/components/delivery/GeneralInfoTab.tsx` — switch samedis

