

## Plan : Dialogs adaptatifs, suppression détection, badges repères par type dans Compo Camion

### 1. Tous les dialogs adaptatifs (éviter le scroll)
Modifier le `DialogContent` de base (`src/components/ui/dialog.tsx`) pour ajouter par défaut des classes qui s'adaptent au contenu sans scroll forcé. Alternativement, modifier chaque dialog individuellement dans `DatabaseTab.tsx` :
- Dialog "Supprimer des plans" (ligne 1031) : remplacer `sm:max-w-md` par `sm:max-w-md w-fit`
- Dialog "Importer un plan PDF" (ligne 843) : garder `sm:max-w-4xl` mais retirer `max-h-[90vh] overflow-y-auto`, utiliser `w-fit`
- Dialog "Ajouter des éléments" (ligne 709) : ajouter `w-fit`
- Dialog "Doublons" (ligne 781) : remplacer `max-h-[80vh] overflow-auto` par `w-fit`
- Appliquer la même logique à tous les dialogs du fichier

### 2. Supprimer la fonctionnalité de détection de repères
Dans `DatabaseTab.tsx`, retirer du dialog PDF :
- Le canvas de sélection de zone (lignes 892-935) et les states associés (`searchArea`, `drawMode`, `isDrawing`, `drawStart`, `canvasRef`, `pdfContainerRef`)
- L'appel à l'edge function `extract-reperes` dans `handlePdfImport` (lignes 297-361) — remplacer par un simple import du plan sans détection IA
- Les résultats de détection (lignes 972-1006) et le state `pdfResult`
- Le bouton "Analyser et importer" devient simplement "Importer le plan"
- Le plan est créé avec `detectedReperes` vide (ou basé sur un simple matching local zones/types sans IA)

Conserver : sélection zones, types de produits, choix fichier, mode import (nouveau/écraser). Le plan stocké aura ses zones et types, et les repères seront déterminés dynamiquement par filtrage de la BDD (éléments dont zone et productType correspondent).

### 3. Compo Camion : badges repères groupés par type sous le plan
Dans `TruckCompositionTab.tsx`, quand un plan est sélectionné (lignes 424-490) :
- Garder le PDF en grand (`h-[50vh]`)
- Sous le PDF, afficher les repères associés (filtrés par zones et types du plan depuis la BDD) sous forme de **badges compacts groupés par type de produit**
- Chaque badge affiche : repère, poids (t), longueur (m)
- Les badges sont **sélectionnables** (checkbox ou clic) et **draggable** vers le calendrier
- Groupement : un titre par `productType`, puis les badges de ce type en flex-wrap
- Les badges assignés sont grisés avec mention "Chargé"
- Supprimer le bouton "Afficher/Masquer repères" et le state `showRepereList` — les badges sont toujours visibles sous le plan

### Fichiers modifiés
- `src/components/delivery/DatabaseTab.tsx` — dialogs adaptatifs, suppression détection IA, simplification import
- `src/components/delivery/TruckCompositionTab.tsx` — badges repères groupés par type, draggable

