

## Plan : Corrections vignettes PDF — numéro camion, badges, usines

### Modifications identiques dans `WeeklyPlanningTab.tsx` (exportPdf) et `Index.tsx` (exportAllWeeksPdf)

**1. Augmenter la hauteur des vignettes et corriger les badges**

Le problème de centrage vient du padding trop serré. Corrections :
- Vignette : passer de `padding:6px 10px` a `padding:8px 12px`
- Badges catégorie et usine : `padding:4px 10px;font-size:11px;line-height:1;height:auto;`
- Badges repères : `padding:4px 8px;font-size:11px;line-height:1;`
- Supprimer `margin-bottom:4px` sur la ligne header pour laisser respirer

**2. Numéro de camion avec icone camion + heure a droite du numero**

Remplacer les deux `<strong>` separees (time + number) par un bloc distinctif :
```html
<div style="display:inline-flex;align-items:center;gap:4px;background:#1e3a5f;color:white;padding:4px 10px;border-radius:4px;font-size:13px;font-weight:700;">
  🚛 {truck.number} — {truck.time}
</div>
```
L'emoji camion sert de logo simple. Le numero est en premier, l'heure apres un tiret.

**3. Couleurs usines — deja implementees via `getFactoryColor()`**

Le code appelle deja `getFactoryColor(f)` qui retourne des couleurs differentes par usine. Le probleme probable : les noms d'usine dans les donnees ne correspondent pas exactement aux cles en majuscules du dictionnaire. Ajouter un `.toUpperCase().trim()` sur le nom avant lookup (deja fait dans `getFactoryColor`). Verifier aussi que chaque badge usine utilise bien `getFactoryColor(f)` et non une couleur fixe — c'est le cas dans le code actuel. Le probleme pourrait etre que toutes les usines tombent sur le fallback gris. Solution : logger les noms ou elargir la palette. Pour robustesse, ajouter des variantes courantes (ex: `'BRIVE LA GAILLARDE': '#2563eb'`).

### Fichiers modifies
- `src/components/delivery/WeeklyPlanningTab.tsx` — vignette export PDF
- `src/pages/Index.tsx` — vignette export "Tout PDF"
- `src/utils/transportUtils.ts` — elargir palette couleurs usines

