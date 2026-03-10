

## Plan : Badges en mode Liste, export PDF/Excel amélioré, commentaires colorés, logo entreprise

### 1. Mode "Liste" dans Compo Camion : badges groupés par type (comme mode Plans)
Dans `TruckCompositionTab.tsx`, transformer le mode "Liste" (lignes 460-489) pour remplacer la liste verticale par des **badges compacts groupés par type de produit** identiques au mode Plans. Le layout devient :
- **Panneau gauche** : filtres Zone, Type, Usine, Statut restent à gauche dans le CardHeader
- **Recherche repère** : déplacée au-dessus des badges (comme en mode Plans)
- **Badges** : utiliser `groupByType(filteredElements)` puis afficher chaque groupe avec titre + badges flex-wrap avec repère, poids, longueur, sélectionnables et draggable
- Le checkbox "Tout sélectionner" + compteur reste au-dessus des badges

### 2. Export PDF amélioré pour onglets Semaine
Dans `WeeklyPlanningTab.tsx`, améliorer `window.print()` :
- Créer une fonction `exportPdf()` qui génère une div HTML temporaire contenant :
  - En-tête avec infos chantier (nom, OTP, client, adresse, conducteur, poseur) + logo si disponible + numéro de semaine + dates
  - Contenu des camions groupés par jour (similaire au visuel actuel)
  - Récapitulatif
- Utiliser `@media print` dans le CSS ou générer via `window.open()` avec un formatage A3 paysage (`@page { size: A3 landscape }`)

### 3. Commentaires plus visibles
Dans `WeeklyPlanningTab.tsx` (ligne 179-184) et la vue Jour de `TruckCompositionTab.tsx` (ligne 782-787) :
- Remplacer `bg-muted text-muted-foreground` par `bg-amber-50 text-amber-800 border border-amber-200` (jaune/orangé pour attirer l'oeil)

### 4. Nombre de camions dans le récap hebdomadaire
Dans `WeeklyPlanningTab.tsx` (lignes 206-229), ajouter un bloc supplémentaire dans la grille du récapitulatif :
- "Camions livrés" avec `weekTrucks.length` en valeur

### 5. Bouton export toutes les semaines
Dans `Index.tsx`, ajouter un bouton "Exporter toutes les semaines" à côté des onglets S.XX (ou dans un endroit accessible). Ce bouton :
- Génère un fichier Excel avec un onglet par semaine (via XLSX)
- Ou génère un PDF multi-pages (un par semaine)
- Peut être placé directement dans la zone des onglets ou comme un bouton global

### 6. Logo entreprise
Oui, c'est possible. L'utilisateur peut envoyer le fichier PNG qui sera stocké dans `/public/` (ex: `/public/logo.png`). Le logo sera affiché :
- Dans le header de l'app (`Index.tsx` ligne 31, à côté de l'icône camion)
- Dans les exports PDF/Excel en en-tête
- Dans les onglets Semaine en en-tête de carte

Demander à l'utilisateur d'envoyer le fichier PNG.

### Fichiers modifiés
- `src/components/delivery/TruckCompositionTab.tsx` — badges groupés en mode Liste, commentaires colorés
- `src/components/delivery/WeeklyPlanningTab.tsx` — export PDF amélioré, commentaires colorés, nb camions dans récap, export toutes semaines
- `src/pages/Index.tsx` — bouton export global, logo dans header
- `src/index.css` — styles d'impression A3

