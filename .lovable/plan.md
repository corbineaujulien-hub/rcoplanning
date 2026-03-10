

## Plan : Filtre repère, vue Journée, suppression Planning général, distinction visuelle semaines

### 1. Filtre recherche par repère (Compo Camion)
Dans le panneau gauche de `TruckCompositionTab.tsx`, ajouter un `Input` de recherche textuelle au-dessus des filtres Select existants. Filtrer `filteredElements` sur `el.repere` en comparaison insensible à la casse. Ajouter un state `filterRepere`.

### 2. Vue Journée (Compo Camion)
- Ajouter `'day'` au type `viewMode` (`'month' | 'week' | 'day'`).
- Ajouter un bouton "Jour" dans la barre de navigation, et des fonctions de navigation jour par jour (`addDays`/`subDays`).
- Rendu : liste verticale des camions du jour sélectionné. Chaque camion affiche son numéro, horaire, poids, et la **liste détaillée des repères** avec leur type de produit (comme dans `WeeklyPlanningTab` mais pour un seul jour).

### 3. Suppression de l'onglet Planning général
- Supprimer le `TabsTrigger` et `TabsContent` pour `"planning"` dans `Index.tsx`.
- Supprimer l'import de `GeneralPlanningTab`.
- Le fichier `GeneralPlanningTab.tsx` peut être conservé mais ne sera plus référencé.

### 4. Meilleure distinction visuelle des journées (onglets Semaine)
Dans `WeeklyPlanningTab.tsx`, grouper les camions par date et afficher un **en-tête de jour** visible (bandeau coloré avec le nom du jour et la date) avant chaque groupe. Alterner les couleurs de fond des groupes de jour pour distinguer visuellement les journées.

### Fichiers modifiés
- `src/components/delivery/TruckCompositionTab.tsx` — filtre repère + vue Journée
- `src/pages/Index.tsx` — retrait onglet Planning général
- `src/components/delivery/WeeklyPlanningTab.tsx` — regroupement visuel par jour

