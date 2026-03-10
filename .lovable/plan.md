

## Plan : Import de plans PDF avec détection des repères

### Architecture

Les repères étant du texte sélectionnable dans les PDF, on peut les extraire côté serveur via une edge function utilisant une bibliothèque PDF (pdf-parse) ou l'IA Lovable (Gemini) pour identifier les repères dans le texte extrait.

**Approche retenue** : Edge function qui reçoit le PDF, extrait le texte via l'IA Lovable (Gemini 2.5 Flash), et retourne la liste des repères détectés. L'IA est plus fiable qu'un simple regex pour identifier les numéros de repère dans un plan technique.

### Modèle de données

Ajouter au type `delivery.ts` et au `DeliveryContext` :

```typescript
interface Plan {
  id: string;
  name: string;          // nom du fichier
  zones: string[];       // zones concernées
  productTypes: string[];// types de produits
  detectedReperes: string[]; // repères trouvés dans le PDF
  pdfDataUrl: string;    // PDF stocké en base64 dans localStorage
}
```

Ajouter `plans: Plan[]` au `DeliveryState` avec les méthodes `addPlan`, `updatePlan`, `deletePlan`.

### 1. Onglet Base de données — Import de plans

- Ajouter un bouton **"Importer un plan PDF"** dans la barre d'actions de `DatabaseTab.tsx`.
- Au clic, ouvrir un **Dialog** avec :
  - Sélecteur de fichier PDF
  - Multi-select pour les **zones** (calculées depuis `elements`)
  - Multi-select pour les **types de produits** (calculés depuis `elements`)
  - Choix : **"Ajouter un nouveau plan"** ou **"Écraser un plan existant"** (avec liste déroulante des plans déjà importés)
- À la validation :
  1. Envoyer le PDF à une edge function `extract-reperes` qui utilise Gemini Flash pour extraire les repères
  2. Croiser les repères détectés avec les éléments de la BDD filtrés par les zones et types sélectionnés
  3. Afficher un **résumé** : repères trouvés / non trouvés, avec message d'alerte pour les repères absents
  4. Stocker le plan (PDF en base64 + métadonnées) dans le contexte

### 2. Edge function `extract-reperes`

- Reçoit le PDF en base64
- Utilise l'API Lovable AI (Gemini 2.5 Flash) pour extraire tous les identifiants/repères du plan
- Retourne la liste des repères détectés

### 3. Onglet Compo Camion — Switch liste/plans

- Dans le panneau gauche, ajouter un **toggle** (boutons "Liste" / "Plans") au-dessus des filtres
- **Mode Liste** : comportement actuel (liste des repères filtrés)
- **Mode Plans** : 
  - Affiche la liste des plans importés
  - Au clic sur un plan, affiche le PDF dans un viewer (iframe/embed) et la liste des repères détectés
  - Les repères sont sélectionnables (checkbox) comme en mode liste, avec le même mécanisme de drag-and-drop vers les camions
  - Indicateur visuel pour les repères déjà chargés

### 4. Section plans dans DatabaseTab

- Sous le tableau existant, ajouter une section **"Plans importés"** avec :
  - Liste des plans avec nom, zones, types, nombre de repères
  - Bouton supprimer par plan

### Fichiers modifiés/créés

- `src/types/delivery.ts` — ajout interface `Plan`
- `src/context/DeliveryContext.tsx` — ajout `plans[]` + méthodes CRUD
- `src/components/delivery/DatabaseTab.tsx` — bouton import PDF, dialog, section plans
- `src/components/delivery/TruckCompositionTab.tsx` — toggle liste/plans dans le panneau gauche
- `supabase/functions/extract-reperes/index.ts` — edge function extraction via IA

