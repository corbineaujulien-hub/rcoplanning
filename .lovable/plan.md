

## Plan : Ajout usines colorées + correction centrage des badges PDF

### Modifications identiques dans `WeeklyPlanningTab.tsx` (exportPdf) et `Index.tsx` (exportAllWeeksPdf)

**1. Ajout des usines avec couleurs spécifiques**

Définir une palette de couleurs fixes pour les usines (ex: `{ 'BRIVE': '#2563eb', 'COULOUNIEIX': '#059669', 'PERIGUEUX': '#d97706', 'LIMOGES': '#7c3aed', ... }`) avec un fallback gris pour les usines non listées.

Dans chaque vignette camion, après la ligne horaire/numéro/catégorie, ajouter les badges usine :
```html
<span style="background:#2563eb;color:white;padding:2px 8px;border-radius:3px;
  font-size:11px;font-weight:600;display:inline-flex;align-items:center;
  line-height:1.4;">BRIVE</span>
```

Utiliser `getTruckFactories(els)` pour récupérer la liste, puis mapper chaque usine à sa couleur.

**2. Correction du centrage des badges (catégorie + repères)**

Le problème vient du `padding:1px 6px` trop serré verticalement et de l'absence de `display:inline-flex;align-items:center;line-height`. Corriger :

- **Badge catégorie** : remplacer `padding:1px 6px;font-size:9px` par `padding:3px 8px;font-size:10px;display:inline-flex;align-items:center;line-height:1.2;`
- **Badges repères** : remplacer `padding:1px 5px;font-size:11px` par `padding:3px 6px;font-size:11px;display:inline-flex;align-items:center;line-height:1.2;`
- **Labels type** : ajouter `display:inline-flex;align-items:center;line-height:1.2;` au span du type produit

### Fichiers modifiés
- `src/components/delivery/WeeklyPlanningTab.tsx` — exportPdf()
- `src/pages/Index.tsx` — exportAllWeeksPdf()

