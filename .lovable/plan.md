## Planning de Charge — Plan d'implémentation

Fonctionnalité majeure : nouvelle page de planning de charge annuel avec données réelles + prévisionnelles, vues Gantt/Calendrier, exports PDF/Excel, et édition inline.

### 1. Base de données (migration Supabase)

Nouvelle table `forecast_slots` :
- `id` uuid PK
- `project_id` uuid (référence projet, pas de FK)
- `date_start` date
- `date_end` date
- `forecasted_trucks` jsonb (tableau `{usine, category, count}`)
- `created_at` timestamptz
- RLS : mêmes policies que `trucks` (authenticated + anon CRUD pour cohérence avec l'existant)

### 2. Types & Context

**`src/types/delivery.ts`** :
- `ForecastSlot { id, projectId, dateStart, dateEnd, forecastedTrucks: ForecastedTruck[] }`
- `ForecastedTruck { usine: string, category: TransportCategory, count: number }`
- Liste `USINES` (ex: `['Usine Nord', 'Usine Sud']` — à confirmer ou rendre libre saisie)

**`src/context/DeliveryContext.tsx`** :
- Charger `forecastSlots` du projet courant
- Méthodes `addForecastSlot`, `updateForecastSlot`, `deleteForecastSlot` (persist Supabase)

### 3. Onglet Infos générales — section "Planning prévisionnel"

`src/components/delivery/GeneralInfoTab.tsx` :
- Nouvelle Card "Planning prévisionnel"
- Liste des créneaux avec :
  - 2 date pickers (début / fin)
  - Tableau éditable : lignes = usines, colonnes = catégories, cellules = nb camions
  - Bouton suppression
- Bouton "+ Ajouter un créneau"

### 4. Page Planning de charge

**Routing** : nouvelle route `/planning-charge` dans `src/App.tsx` (protégée).

**Bouton d'accès** : `src/pages/Home.tsx` — bouton dans le bandeau supérieur "Planning de charge" → `navigate('/planning-charge')`.

**Nouveau fichier** `src/pages/LoadPlanning.tsx` (page plein écran) qui :
- Charge tous les projets non archivés + leurs trucks + forecast_slots en parallèle (paginations 1000)
- Calcule par projet/semaine/usine/catégorie le nombre de camions selon les 3 cas (A: réel, B: mix, C: prévisionnel)
- Détermine "planifié à 100%" via heuristique : `forecast_slots` couverts par des trucks réels (ou flag explicite — on prendra : si aucun forecast slot OU forecast slot dont la période contient des trucks réels → réel sinon prévisionnel).

**Structure UI** :
- Bandeau : titre + date range (`react-day-picker`) + toggle Gantt/Calendrier + boutons exports + retour
- 3 blocs de charge agrégés (CDT / Poseur / Usine × semaines)
- Vue Gantt (table HTML : chantiers × semaines, barres colorées poseur, hachures pour prévisionnel)
- Vue Calendrier (mois par mois, pastilles)
- Filtres : CDT / Poseur / Usine / Statut + reset

**Composants découpés** :
- `src/components/load-planning/LoadPlanningHeader.tsx`
- `src/components/load-planning/LoadSummary.tsx` (3 blocs)
- `src/components/load-planning/GanttView.tsx`
- `src/components/load-planning/CalendarView.tsx`
- `src/components/load-planning/LoadPlanningFilters.tsx`
- `src/utils/loadPlanningUtils.ts` (calculs semaines, agrégations, palette couleurs)

### 5. Couleurs poseurs

Dans `loadPlanningUtils.ts` : palette de 12 couleurs HSL contrastées + mapping fixe par nom de poseur (hash déterministe). "Poseur à désigner" → `hsl(220 9% 64%)` (gris).

### 6. Édition inline (Gantt)

- Double-clic CDT → `<Select>` inline → update `projects.conductor` via context
- Double-clic poseur → `<Select>` inline → update `projects.subcontractor`
- Double-clic cellule prévisionnelle → mini-formulaire popover (dates + matrice usine×catégorie) → update `forecast_slots`
- Sauvegarde au blur

### 7. Exports

**PDF** (`src/utils/loadPlanningPdfUtils.ts`) : jsPDF format A3 paysage, 3 blocs en haut + Gantt + légende.

**Excel** (`src/utils/loadPlanningExcelUtils.ts`) : `xlsx` lib, 4 onglets (Gantt, Charge CDT, Charge Poseur, Charge Usine).

### Détails techniques

- Chargement multi-projets : utiliser `supabase.from('trucks').select('*').in('project_id', projectIds)` paginé par 1000.
- Catégorie effective : `truck.forcedCategory ?? computed` (réutiliser `getTransportCategory` existant).
- Semaines ISO via `date-fns/getISOWeek` + `getISOWeekYear`.
- Génération des créneaux de semaines pour la période sélectionnée.
- Pour cas B : pour chaque semaine d'un forecast_slot, si au moins un truck réel existe dans cette semaine pour ce projet → réel sinon prévisionnel.

### Hors-scope (à confirmer)

- Liste fixe des usines : je propose de saisir librement le nom d'usine dans les créneaux (champ texte) ou de réutiliser les usines détectées dans `beam_elements.factory`. → **Choix retenu** : on agrège dynamiquement les usines depuis `beam_elements.factory` pour les données réelles, et on laisse la saisie libre côté prévisionnel (datalist des usines connues).
- Statut "Archivés" : déjà présent via `projects.archived`.

### Fichiers créés/modifiés (résumé)

Créés :
- `supabase/migrations/<ts>_forecast_slots.sql`
- `src/pages/LoadPlanning.tsx`
- `src/components/load-planning/*` (5 composants)
- `src/utils/loadPlanningUtils.ts`
- `src/utils/loadPlanningPdfUtils.ts`
- `src/utils/loadPlanningExcelUtils.ts`

Modifiés :
- `src/App.tsx` (route)
- `src/pages/Home.tsx` (bouton)
- `src/types/delivery.ts` (types ForecastSlot)
- `src/context/DeliveryContext.tsx` (CRUD forecast_slots)
- `src/components/delivery/GeneralInfoTab.tsx` (section Planning prévisionnel)

Souhaitez-vous que je procède avec ce plan ? Quelques points à valider :
1. Les noms d'usines : saisie libre (avec autocomplete depuis les usines déjà connues) ou liste fixe à définir ?
2. Format PDF préféré : A3 paysage (large, plus lisible) ou A4 paysage (plus standard) ?
3. La détection "100% planifié" : se baser sur la présence de camions réels dans chaque créneau prévisionnel, ou ajouter un flag manuel sur le projet ?