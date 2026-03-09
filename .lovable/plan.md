

## Plan : Améliorations de l'onglet Compo Camion

### 1. Unicité des numéros de camion
- Dans `NewTruckModal`, passer la liste `trucks` en prop et vérifier si le numéro saisi existe déjà
- Afficher un message d'erreur inline et désactiver le bouton si doublon détecté

### 2. Récapitulatif en bas de l'onglet
- Ajouter une `Card` sous le calendrier avec un tableau récapitulatif :
  - Lignes = usines, Colonnes = catégories de transport (Standard, Cat I, II, III) + Total
  - Cellules = nombre de camions correspondants
- Calculé à partir de tous les `trucks` via `getTruckElements` / `getTransportCategory` / `getTruckFactories`

### 3. Horaire sur les étiquettes camion (vue Mois)
- Dans le rendu des badges camion en vue mois, ajouter `truck.time` à côté du numéro

### 4. Vue Semaine en grille horaire
- Remplacer la grille calendrier actuelle en vue semaine par une grille jour × créneaux horaires (6h–20h, pas de 1h)
- Lignes = tranches horaires, Colonnes = 7 jours de la semaine
- Les camions sont positionnés dans la cellule correspondant à leur jour et heure

### 5. Bouton supprimer camion dans TruckDetailModal
- Ajouter un bouton "Supprimer le camion" avec confirmation (`AlertDialog`)
- Appeler `deleteTruck(truck.id)` puis fermer la modale

### 6. Croix de suppression individuelle des repères dans TruckDetailModal
- Sur chaque repère affiché, ajouter un bouton `X` qui appelle `removeElementFromTruck(truck.id, el.id)`
- L'élément redevient disponible dans le panneau gauche

### 7. Modifier date et horaire du camion dans TruckDetailModal
- Rendre les champs date et horaire éditables (Input date + Input time)
- Appeler `updateTruck(truck.id, { date, time })` à la modification

### 8. Déplacement de camions (vue Mois)
- Rendre les badges camion `draggable` avec sélection multiple via checkbox
- Au drop sur un autre jour, appeler `updateTruck` pour changer la date des camions sélectionnés

### 9. Déplacement de camions (vue Semaine)
- Même logique de drag-and-drop mais sur la grille horaire
- Au drop, mettre à jour à la fois `date` et `time` du camion

### Fichiers modifiés
- `src/components/delivery/TruckCompositionTab.tsx` — grille horaire semaine, récap en bas, horaire sur badges, drag camions
- `src/components/delivery/TruckDetailModal.tsx` — suppression camion, suppression repères, édition date/heure
- `src/components/delivery/NewTruckModal.tsx` — vérification unicité numéro camion

