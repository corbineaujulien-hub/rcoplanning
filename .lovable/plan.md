

## Plan : Refonte export PDF hebdomadaire

### Modifications dans `WeeklyPlanningTab.tsx` — fonction `exportPdf()`

**1. Enregistrement direct en PDF (sans fenêtre d'impression)**
Le navigateur ne permet pas de générer un PDF natif sans `window.print()`. Solution : utiliser une bibliothèque. Cependant, aucune lib PDF n'est installée. Alternative pragmatique : garder `window.open()` mais forcer le dialogue d'impression en mode "Enregistrer en PDF" via CSS `@media print` — c'est la seule option côté navigateur pur. On peut améliorer l'UX en ajoutant un message indiquant de choisir "Enregistrer en PDF" comme destination d'impression, ou bien installer `html2pdf.js` / `jspdf` + `html2canvas` pour générer un vrai fichier `.pdf` téléchargeable directement.

→ **Installer `html2canvas` + `jspdf`** pour générer un blob PDF et déclencher un téléchargement automatique sans passer par l'impression.

**2. Refonte du contenu HTML du PDF**

- **En-tête complet** : toutes les infos chantier (nom, OTP, client, adresse, conducteur, poseur, contact) + logo + semaine/dates — déjà partiellement présent, s'assurer que tous les champs sont affichés.

- **Vignettes compactes** : réduire padding/margin/font-size pour tenir sur une page A3 paysage. Passer le padding de `12px` à `6px`, font-size réduit.

- **Horaire à gauche** : déplacer `truck.time` à côté du `truck.number` dans le flex de gauche (au lieu de le mettre à droite).

- **Repères groupés par type en gros** : remplacer la ligne poids/longueur/usine par les repères organisés par type de produit en police plus grande. Supprimer la grille 4 colonnes (poids, longueur, usine, nb produits) et la remplacer par les groupes de types avec repères inline.

- **Commentaires visibles** : garder le style amber existant.

**3. Téléchargement direct**
Avec `html2canvas` + `jspdf` :
- Créer un div temporaire hors écran avec le HTML
- Capturer avec `html2canvas`
- Convertir en PDF A3 paysage avec `jspdf`
- Déclencher `saveAs` / `link.click()` pour télécharger

### Fichiers modifiés
- `src/components/delivery/WeeklyPlanningTab.tsx` — refonte `exportPdf()`
- Installer `jspdf` et `html2canvas`

