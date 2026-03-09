

## Plan : Améliorations de l'onglet Base de données

### 1. Bouton "Supprimer la base"
- Ajouter un bouton destructif "Supprimer la base" dans la barre d'actions
- Au clic, ouvrir un `AlertDialog` demandant confirmation avant de vider tous les éléments via `setElements([])`

### 2. Import Excel avec choix Écraser / Mettre à jour
- Au clic sur "Importer Excel", ouvrir un `Dialog` proposant 2 options :
  - **Écraser** : remplace entièrement `elements` par les données importées
  - **Mettre à jour** : pour chaque ligne importée, si un repère existe déjà → mise à jour de ses champs ; sinon → ajout comme nouvelle ligne
- Le matching se fait sur le champ `repere`

### 3. Correction de l'import Excel (repères et poids)
- Élargir les alias de colonnes pour le mapping : ajouter `Repere`, `N° Repère`, `N°repère`, `Repère`, `repère`, `REPERE`, etc.
- Pour le poids : ajouter `Poids (t)`, `POIDS`, `poids (tonnes)`, `Poids(t)`, etc.
- Utiliser `{ raw: false }` dans `sheet_to_json` et forcer la conversion texte pour `repere` avec `String()`, et numérique pour `weight` avec `parseFloat()`
- Traiter les cas où la valeur est `undefined` ou chaîne vide

### 4. Bouton "Ajouter ligne manuellement"
- Renommer le bouton en "Ajouter ligne manuellement"
- Au clic, ouvrir un `Dialog` avec un formulaire contenant tous les champs (repère, zone, type produit, section, longueur, poids, usine)
- Ajouter dans ce dialog un `textarea` pour coller des lignes Excel (tab-separated) : parsing automatique et ajout de plusieurs lignes d'un coup

### 5. Filtres par colonne + sous-totaux
- Ajouter un état de filtre par colonne (zone, type produit, section, usine)
- Afficher un `Popover` ou `DropdownMenu` sur chaque en-tête de colonne avec les valeurs uniques comme options de filtre (multi-sélection)
- Filtrer les `elements` affichés selon les filtres actifs
- Ajouter une ligne de sous-totaux en pied de tableau :
  - **Repère** : nombre d'éléments filtrés
  - **Longueur** : somme des longueurs filtrées
  - **Poids** : somme des poids filtrés

### Fichiers modifiés
- `src/components/delivery/DatabaseTab.tsx` — refonte majeure (filtres, dialogs, import amélioré, sous-totaux)
- Aucun nouveau fichier nécessaire (on utilise les composants UI existants : Dialog, AlertDialog, Popover, etc.)

