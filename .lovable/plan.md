

## Plan : Centrage badges, saut de page intelligent, couleurs usines

### Problèmes identifiés

1. **Centrage vertical des badges** : Les `<span>` utilisent `line-height:1.4` mais pas de `display:flex;align-items:center;justify-content:center;` — html2canvas ne centre pas correctement le texte dans les spans inline.

2. **Vignettes coupées entre 2 pages** : Le code actuel découpe le canvas à intervalles fixes (`usableHeight`), sans tenir compte des limites logiques des vignettes. Il faut capturer chaque section (en-tête jour + vignette camion, récapitulatif) individuellement et les placer page par page.

3. **Couleurs usines identiques** : "DSR" et "CSB" ne sont pas dans `FACTORY_COLORS` → elles tombent sur le fallback gris `#6b7280`. Il faut les ajouter avec des couleurs distinctes.

---

### 1. Ajouter DSR et CSB à la palette (`transportUtils.ts`)

Ajouter dans `FACTORY_COLORS` :
```
'DSR': '#0284c7',    // sky-600
'CSB': '#9333ea',    // purple-600
```

### 2. Corriger le centrage des badges (WeeklyPlanningTab + Index)

Remplacer tous les badges `<span>` par des `<div style="display:inline-flex;align-items:center;justify-content:center;...">` pour garantir le centrage vertical avec html2canvas. Appliquer sur : badge camion, badge catégorie, badges usine, badges repères.

### 3. Saut de page intelligent — ne pas couper les vignettes

Refactorer la génération PDF dans les deux fichiers. Au lieu de rendre tout le HTML en un seul canvas puis découper :

- Attribuer `data-pdf-section` à chaque bloc logique (en-tête semaine, en-tête jour, chaque vignette camion, récapitulatif)
- Après insertion dans le DOM, itérer sur chaque `[data-pdf-section]`
- Pour chaque section : capturer avec `html2canvas`, calculer sa hauteur en mm
- Si la section ne tient pas dans l'espace restant sur la page courante → ajouter une nouvelle page
- Placer l'image de la section sur la page courante et avancer le curseur Y

Cette approche garantit qu'aucune vignette ni récapitulatif ne sera coupé.

### Fichiers modifiés
- `src/utils/transportUtils.ts` — ajout DSR, CSB
- `src/components/delivery/WeeklyPlanningTab.tsx` — badges + saut de page intelligent
- `src/pages/Index.tsx` — idem pour exportAllWeeksPdf

