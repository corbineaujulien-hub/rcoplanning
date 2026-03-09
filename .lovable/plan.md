

## Plan : Vérification des doublons à l'ajout manuel + Sous-totaux en haut

### 1. Vérification des doublons lors de l'ajout manuel

**Ajout d'un état** `duplicateDialogOpen` et `pendingElements` / `duplicates` pour gérer le flux de confirmation.

**Flux pour `handleAddManual` et `handlePaste`** :
1. Construire la liste des nouveaux éléments
2. Vérifier si leurs `repere` existent déjà dans `elements`
3. Si aucun doublon → ajout direct sans message
4. Si doublons détectés → ouvrir un `Dialog` affichant un tableau comparatif :
   - Pour chaque doublon : une ligne "Existant" et une ligne "Nouveau" avec toutes les colonnes (repère, zone, type, section, longueur, poids, usine)
   - Boutons : "Écraser les existants" (remplace via `updateElement`) / "Annuler" (ne rien faire)
   - Les éléments sans doublon sont ajoutés directement dans tous les cas

### 2. Sous-totaux déplacés en haut du tableau

- Retirer le `TableFooter` actuel (lignes 341-354)
- Ajouter un bandeau récapitulatif entre le `CardHeader` et le tableau, affichant :
  - Nombre d'éléments (filtrés / total si filtre actif)
  - Somme des longueurs (m)
  - Somme des poids (t)
- Style : une barre compacte avec des badges ou des `span` séparés, bien visible

### Fichier modifié
- `src/components/delivery/DatabaseTab.tsx`

