

## Plan : Fix du déplacement horaire d'un camion seul en vue Semaine

### Problème identifié
Ligne 449 de `TruckCompositionTab.tsx`, dans la grille horaire de la vue Semaine, le `onDrop` appelle `onDropOnDay(e, dateStr)` **sans passer le paramètre `hour`**. La logique dans `onDropOnDay` (lignes 224-226) vérifie `hour !== undefined` pour mettre à jour l'heure, mais comme `hour` n'est jamais transmis, l'heure ne change jamais.

### Correction
Dans la boucle de rendu des cellules de la grille semaine (ligne 449), passer `hour` en troisième argument :
```
onDrop={e => onDropOnDay(e, dateStr, hour)}
```

### Fichier modifié
- `src/components/delivery/TruckCompositionTab.tsx` — une seule ligne à corriger

