import { useState, useRef, useMemo } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { BeamElement, PRODUCT_TYPES } from '@/types/delivery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Trash2, Database, Filter, FileDown, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

function findColumn(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const key = Object.keys(row).find(k => k.trim().toLowerCase() === alias.toLowerCase());
    if (key !== undefined && row[key] !== undefined && row[key] !== '') return row[key];
  }
  return undefined;
}

const REPERE_ALIASES = ['Numéro de repère', 'N° Repère', 'N°repère', 'N° repère', 'Repère', 'Repere', 'repere', 'repère', 'REPERE', 'N°Repère', 'Numero de repere', 'REP'];
const ZONE_ALIASES = ['Zone', 'zone', 'ZONE'];
const TYPE_ALIASES = ['Type de produit', 'Type produit', 'type', 'Type', 'TYPE'];
const SECTION_ALIASES = ['Section', 'section', 'SECTION'];
const LENGTH_ALIASES = ['Longueur (m)', 'Longueur', 'longueur', 'LONGUEUR', 'Longueur(m)', 'Long.', 'Long'];
const WEIGHT_ALIASES = ['Poids (tonnes)', 'Poids (t)', 'Poids(t)', 'Poids', 'poids', 'POIDS', 'Poids(tonnes)', 'poids (t)', 'poids (tonnes)', 'Weight', 'Masse', 'masse'];
const FACTORY_ALIASES = ['Usine de fabrication', 'Usine', 'usine', 'USINE', 'Factory'];

function mapRow(row: Record<string, unknown>, index: number): BeamElement {
  const repereVal = findColumn(row, REPERE_ALIASES);
  const weightVal = findColumn(row, WEIGHT_ALIASES);
  const lengthVal = findColumn(row, LENGTH_ALIASES);

  return {
    id: crypto.randomUUID(),
    repere: repereVal != null ? String(repereVal).trim() : `REP-${index + 1}`,
    zone: String(findColumn(row, ZONE_ALIASES) ?? '').trim(),
    productType: String(findColumn(row, TYPE_ALIASES) ?? '').trim(),
    section: String(findColumn(row, SECTION_ALIASES) ?? '').trim(),
    length: lengthVal != null ? parseFloat(String(lengthVal).replace(',', '.')) || 0 : 0,
    weight: weightVal != null ? parseFloat(String(weightVal).replace(',', '.')) || 0 : 0,
    factory: String(findColumn(row, FACTORY_ALIASES) ?? '').trim(),
  };
}

type FilterState = Record<string, Set<string>>;

function ColumnFilter({ column, values, filters, setFilters }: {
  column: string;
  values: string[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}) {
  const active = filters[column];
  const sorted = [...new Set(values)].sort();
  const isFiltered = active && active.size > 0;

  const toggle = (val: string) => {
    setFilters(prev => {
      const s = new Set(prev[column] || []);
      if (s.has(val)) s.delete(val); else s.add(val);
      return { ...prev, [column]: s };
    });
  };

  const clearFilter = () => {
    setFilters(prev => ({ ...prev, [column]: new Set<string>() }));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={`h-5 w-5 ml-1 ${isFiltered ? 'text-primary' : 'text-muted-foreground'}`}>
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="start">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium">Filtrer</span>
          {isFiltered && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearFilter}>Effacer</Button>
          )}
        </div>
        <div className="space-y-1">
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune valeur</p>
          ) : sorted.map(val => (
            <label key={val} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
              <Checkbox checked={active?.has(val) || false} onCheckedChange={() => toggle(val)} />
              <span className="truncate">{val || '(vide)'}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DatabaseTab() {
  const { elements, setElements, addElements, updateElement, deleteElement } = useDelivery();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'overwrite' | 'update' | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});

  // Manual add form state
  const [newRepere, setNewRepere] = useState('');
  const [newZone, setNewZone] = useState('');
  const [newType, setNewType] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newLength, setNewLength] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newFactory, setNewFactory] = useState('');
  const [pasteText, setPasteText] = useState('');

  const parseExcel = (data: Uint8Array): BeamElement[] => {
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false });
    return json.map((row, i) => mapRow(row, i));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const mapped = parseExcel(data);

      if (importMode === 'overwrite') {
        setElements(mapped);
      } else if (importMode === 'update') {
        const existing = new Map(elements.map(el => [el.repere, el]));
        mapped.forEach(newEl => {
          const match = existing.get(newEl.repere);
          if (match) {
            existing.set(newEl.repere, { ...match, ...newEl, id: match.id });
          } else {
            existing.set(newEl.repere, newEl);
          }
        });
        setElements(Array.from(existing.values()));
      }
      setImportDialogOpen(false);
      setImportMode(null);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const triggerFileInput = (mode: 'overwrite' | 'update') => {
    setImportMode(mode);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleAddManual = () => {
    const newEl: BeamElement = {
      id: crypto.randomUUID(),
      repere: newRepere,
      zone: newZone,
      productType: newType,
      section: newSection,
      length: parseFloat(newLength.replace(',', '.')) || 0,
      weight: parseFloat(newWeight.replace(',', '.')) || 0,
      factory: newFactory,
    };
    addElements([newEl]);
    resetForm();
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split('\n');
    const newElements: BeamElement[] = lines.map((line, i) => {
      const cols = line.split('\t');
      return {
        id: crypto.randomUUID(),
        repere: cols[0]?.trim() ?? '',
        zone: cols[1]?.trim() ?? '',
        productType: cols[2]?.trim() ?? '',
        section: cols[3]?.trim() ?? '',
        length: parseFloat((cols[4] ?? '').replace(',', '.')) || 0,
        weight: parseFloat((cols[5] ?? '').replace(',', '.')) || 0,
        factory: cols[6]?.trim() ?? '',
      };
    });
    addElements(newElements);
    setPasteText('');
    setAddDialogOpen(false);
  };

  const resetForm = () => {
    setNewRepere(''); setNewZone(''); setNewType(''); setNewSection('');
    setNewLength(''); setNewWeight(''); setNewFactory('');
  };

  // Filtering
  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      for (const [col, vals] of Object.entries(filters)) {
        if (vals.size === 0) continue;
        const elVal = el[col as keyof BeamElement];
        if (!vals.has(String(elVal ?? ''))) return false;
      }
      return true;
    });
  }, [elements, filters]);

  const filterValues = useMemo(() => ({
    zone: elements.map(el => el.zone),
    productType: elements.map(el => el.productType),
    section: elements.map(el => el.section),
    factory: elements.map(el => el.factory),
  }), [elements]);

  const totalLength = filteredElements.reduce((s, el) => s + el.length, 0);
  const totalWeight = filteredElements.reduce((s, el) => s + el.weight, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-accent" />
              Base de données – {filteredElements.length}{filteredElements.length !== elements.length ? `/${elements.length}` : ''} éléments – {totalWeight.toFixed(2)} t
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-1" /> Importer Excel
              </Button>
              <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter ligne manuellement
              </Button>
              {elements.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Supprimer la base
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer toute la base ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action supprimera définitivement les {elements.length} éléments de la base de données. Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => setElements([])}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[65vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">
                    N° Repère
                  </TableHead>
                  <TableHead className="w-24">
                    <span className="flex items-center">Zone <ColumnFilter column="zone" values={filterValues.zone} filters={filters} setFilters={setFilters} /></span>
                  </TableHead>
                  <TableHead className="w-40">
                    <span className="flex items-center">Type de produit <ColumnFilter column="productType" values={filterValues.productType} filters={filters} setFilters={setFilters} /></span>
                  </TableHead>
                  <TableHead className="w-24">
                    <span className="flex items-center">Section <ColumnFilter column="section" values={filterValues.section} filters={filters} setFilters={setFilters} /></span>
                  </TableHead>
                  <TableHead className="w-28">Longueur (m)</TableHead>
                  <TableHead className="w-28">Poids (t)</TableHead>
                  <TableHead className="w-32">
                    <span className="flex items-center">Usine <ColumnFilter column="factory" values={filterValues.factory} filters={filters} setFilters={setFilters} /></span>
                  </TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredElements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      {elements.length === 0 
                        ? "Aucun élément. Importez un fichier Excel ou ajoutez des lignes manuellement."
                        : "Aucun élément ne correspond aux filtres appliqués."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredElements.map(el => (
                    <TableRow key={el.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Input value={el.repere} onChange={e => updateElement(el.id, { repere: e.target.value })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input value={el.zone} onChange={e => updateElement(el.id, { zone: e.target.value })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Select value={el.productType} onValueChange={v => updateElement(el.id, { productType: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
                          <SelectContent>
                            {PRODUCT_TYPES.map(pt => (
                              <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input value={el.section} onChange={e => updateElement(el.id, { section: e.target.value })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={el.length || ''} onChange={e => updateElement(el.id, { length: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.001" value={el.weight || ''} onChange={e => updateElement(el.id, { weight: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input value={el.factory} onChange={e => updateElement(el.id, { factory: e.target.value })} className="h-8 text-sm" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteElement(el.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filteredElements.length > 0 && (
                <TableFooter>
                  <TableRow className="font-semibold bg-muted/30">
                    <TableCell>{filteredElements.length} éléments</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell>{totalLength.toFixed(2)} m</TableCell>
                    <TableCell>{totalWeight.toFixed(3)} t</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importer un fichier Excel</DialogTitle>
            <DialogDescription>
              Choisissez le mode d'import pour votre fichier Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button variant="outline" className="justify-start h-auto py-3" onClick={() => triggerFileInput('overwrite')}>
              <FileDown className="h-5 w-5 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Écraser la base</div>
                <div className="text-xs text-muted-foreground">Remplace entièrement les données existantes</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" onClick={() => triggerFileInput('update')}>
              <RefreshCw className="h-5 w-5 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Mettre à jour la base</div>
                <div className="text-xs text-muted-foreground">Ajoute les nouveaux repères, met à jour les existants</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Manual Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter des éléments</DialogTitle>
            <DialogDescription>
              Saisissez les informations manuellement ou collez des lignes depuis Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Manual form */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">N° Repère</Label>
                <Input value={newRepere} onChange={e => setNewRepere(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Zone</Label>
                <Input value={newZone} onChange={e => setNewZone(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Type de produit</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(pt => (
                      <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Section</Label>
                <Input value={newSection} onChange={e => setNewSection(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Longueur (m)</Label>
                <Input value={newLength} onChange={e => setNewLength(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Poids (t)</Label>
                <Input value={newWeight} onChange={e => setNewWeight(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Usine</Label>
                <Input value={newFactory} onChange={e => setNewFactory(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <Button onClick={handleAddManual} disabled={!newRepere.trim()} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Ajouter l'élément
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou coller depuis Excel</span></div>
            </div>

            <div>
              <Label className="text-xs">Coller des lignes (Repère → Zone → Type → Section → Longueur → Poids → Usine)</Label>
              <Textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Collez ici les lignes copiées depuis Excel (séparées par des tabulations)…"
                className="min-h-[100px] text-sm font-mono"
              />
            </div>
            <Button onClick={handlePaste} disabled={!pasteText.trim()} variant="outline" className="w-full">
              <Upload className="h-4 w-4 mr-1" /> Importer les lignes collées
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
