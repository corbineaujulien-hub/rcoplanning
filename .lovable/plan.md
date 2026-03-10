

## Plan : Corrections export PDF individuel + "Tout PDF"

### 1. Export PDF individuel (`WeeklyPlanningTab.tsx` — `exportPdf()`)

**En-tête complet** : L'en-tête actuel (lignes 166-179) manque les champs conducteur, poseur et contact. Ajouter toutes les infos manquantes dans la colonne de droite :
- N° OTP, Nom du chantier, Adresse chantier, Client (colonne gauche — déjà partiellement là)
- Conducteur de travaux, Sous-traitant poseur, Contact poseur + téléphone (colonne droite)

**Contour des vignettes** : Ajouter `border:1px solid #d1d5db;` sur chaque div de camion (ligne 126) pour bien distinguer chaque vignette.

**Supprimer la contrainte de hauteur max** : Ligne 206, supprimer `Math.min(contentHeight, pdfHeight - margin * 2)`. À la place, si le contenu dépasse une page A3, créer des pages supplémentaires en découpant l'image canvas en tranches de la hauteur d'une page A3 et en ajoutant `pdf.addPage()` pour chaque tranche.

### 2. Export "Tout PDF" (`Index.tsx` — `exportAllWeeksPdf()`)

Appliquer les mêmes modifications :
- **En-tête complet** par semaine (lignes 83-89) : ajouter adresse, conducteur, poseur, contact
- **Contour des vignettes** (ligne 109) : ajouter `border:1px solid #d1d5db;`
- **Repères groupés par type** au lieu de la grille 4 colonnes (ligne 111-112) : remplacer par le même format que `exportPdf` avec `typeGroups`
- **Horaire à gauche** (ligne 110) : déplacer `truck.time` à côté du numéro de camion
- **Conversion en jsPDF + html2canvas** au lieu de `window.open/print` : générer un PDF multi-pages téléchargeable directement

### Fichiers modifiés
- `src/components/delivery/WeeklyPlanningTab.tsx` — en-tête complet, bordure vignettes, multi-pages
- `src/pages/Index.tsx` — mêmes corrections + conversion jsPDF

