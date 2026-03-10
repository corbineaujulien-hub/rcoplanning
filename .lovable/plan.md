

## Plan : Matching sous-chaîne, zone de recherche interactive, dialog adaptatif, plan en grand

### 1. Dialog PDF adaptatif (`DatabaseTab.tsx`)
- Remplacer `sm:max-w-lg max-h-[85vh] overflow-auto` par `sm:max-w-3xl max-h-[90vh] overflow-y-auto` sur le `DialogContent` (ligne 709)

### 2. Matching par sous-chaîne (`DatabaseTab.tsx` + `TruckCompositionTab.tsx`)
Le croisement actuel fait une comparaison exacte (lignes 307-309 de DatabaseTab, ligne 430 de TruckCompositionTab). Modifier pour que :
- Un repère de la BDD (ex: "A003") est considéré trouvé si **contenu dans** un repère détecté du PDF (ex: "DBF-A003"), insensible à la casse
- Logique : `detectedReperes.filter(rep => filteredEls.some(el => rep.toLowerCase().includes(el.repere.toLowerCase())))`
- Même correction dans TruckCompositionTab pour le matching des plans (ligne 430 et 467)

### 3. Zone de recherche interactive sur le PDF
Plutôt qu'un simple champ texte, permettre à l'utilisateur de **dessiner un rectangle** sur le PDF pour délimiter la zone de recherche :
- Après sélection du fichier PDF, afficher un **aperçu du PDF** dans le dialog (iframe ou canvas)
- Superposer un **canvas transparent** sur lequel l'utilisateur peut dessiner un rectangle (mousedown → mousemove → mouseup)
- Stocker les coordonnées normalisées (0-1) du rectangle comme `searchArea: { x, y, width, height }`
- Envoyer ces coordonnées à l'edge function qui les inclut dans le prompt IA : "Cherche uniquement les repères dans la zone définie par [x%, y%, largeur%, hauteur%] du document"
- Bouton "Réinitialiser la zone" pour effacer le rectangle
- Si aucune zone n'est dessinée, chercher sur tout le document

### 4. Mise à jour edge function (`extract-reperes/index.ts`)
- Accepter un paramètre optionnel `searchArea: { x, y, width, height }` dans le body
- Ajouter au prompt système une instruction de délimitation spatiale si `searchArea` est fourni

### 5. Plan en grand sur Compo Camion (`TruckCompositionTab.tsx`)
Quand `selectionMode === 'plans'` et un plan est sélectionné :
- Passer le layout de `flex-row` (panneau gauche 320px + calendrier) à **`flex-col`** (layout vertical)
- En haut : PDF en grand (iframe pleine largeur, `h-[50vh]`) avec la liste des repères du plan à côté
- En bas : le calendrier/planning
- L'iframe actuelle `h-48` (ligne 463) sera remplacée par un conteneur pleine largeur

### Fichiers modifiés
- `src/components/delivery/DatabaseTab.tsx` — dialog adaptatif, matching sous-chaîne, canvas de sélection zone
- `src/components/delivery/TruckCompositionTab.tsx` — matching sous-chaîne, layout vertical plan
- `supabase/functions/extract-reperes/index.ts` — paramètre `searchArea`

