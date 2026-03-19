import { useState, useRef, useMemo } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { BeamElement, Plan, PRODUCT_TYPES } from '@/types/delivery';
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
import { Badge } from '@/components/ui/badge';
import { Upload, Plus, Trash2, Database, Filter, FileDown, RefreshCw, FileText, X, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';

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
  const { elements, setElements, addElements, updateElement, deleteElement, plans, addPlan, updatePlan, deletePlan, trucks, projectInfo } = useDelivery();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'overwrite' | 'update' | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});

  // Duplicate detection state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingNew, setPendingNew] = useState<BeamElement[]>([]);
  const [duplicates, setDuplicates] = useState<{ existing: BeamElement; incoming: BeamElement }[]>([]);

  // Manual add form state
  const [newRepere, setNewRepere] = useState('');
  const [newZone, setNewZone] = useState('');
  const [newType, setNewType] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newLength, setNewLength] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newFactory, setNewFactory] = useState('');
  const [pasteText, setPasteText] = useState('');

  // PDF import state (simplified — no AI detection)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPlanName, setPdfPlanName] = useState('');
  const [pdfZones, setPdfZones] = useState<string[]>([]);
  const [pdfProductTypes, setPdfProductTypes] = useState<string[]>([]);
  const [pdfImportMode, setPdfImportMode] = useState<'new' | 'replace'>('new');
  const [pdfReplaceId, setPdfReplaceId] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Delete plans dialog state
  const [deletePlansDialogOpen, setDeletePlansDialogOpen] = useState(false);
  const [selectedPlanIdsToDelete, setSelectedPlanIdsToDelete] = useState<Set<string>>(new Set());

  const availableZones = useMemo(() => [...new Set(elements.map(e => e.zone).filter(Boolean))].sort(), [elements]);
  const availableProductTypes = useMemo(() => [...new Set(elements.map(e => e.productType).filter(Boolean))].sort(), [elements]);

  // Map element ID → truck info
  const elementTruckMap = useMemo(() => {
    const map = new Map<string, { number: string; date: string }>();
    trucks.forEach(truck => {
      const ids = Array.isArray(truck.elementIds) ? truck.elementIds : [];
      ids.forEach(eid => {
        map.set(eid, { number: truck.number, date: truck.date });
      });
    });
    return map;
  }, [trucks]);

  const formatTruckDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = parse(dateStr, 'yyyy-MM-dd', new Date());
      return format(d, 'dd-MM-yyyy');
    } catch {
      return dateStr;
    }
  };

  const getMonthLabel = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = parse(dateStr, 'yyyy-MM-dd', new Date());
      const m = format(d, 'MM/yyyy');
      return m;
    } catch {
      return '';
    }
  };

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

  const processNewElements = (newEls: BeamElement[]) => {
    const existingMap = new Map(elements.map(el => [el.repere.toLowerCase(), el]));
    const dupes: { existing: BeamElement; incoming: BeamElement }[] = [];
    const fresh: BeamElement[] = [];

    newEls.forEach(el => {
      const match = existingMap.get(el.repere.toLowerCase());
      if (match) {
        dupes.push({ existing: match, incoming: el });
      } else {
        fresh.push(el);
      }
    });

    if (fresh.length > 0) addElements(fresh);

    if (dupes.length > 0) {
      setDuplicates(dupes);
      setPendingNew(fresh);
      setDuplicateDialogOpen(true);
    }
  };

  const handleOverwriteDuplicates = () => {
    duplicates.forEach(({ existing, incoming }) => {
      updateElement(existing.id, {
        zone: incoming.zone,
        productType: incoming.productType,
        section: incoming.section,
        length: incoming.length,
        weight: incoming.weight,
        factory: incoming.factory,
      });
    });
    setDuplicateDialogOpen(false);
    setDuplicates([]);
    setPendingNew([]);
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
    processNewElements([newEl]);
    resetForm();
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split('\n');
    const newElements: BeamElement[] = lines.map((line) => {
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
    processNewElements(newElements);
    setPasteText('');
    setAddDialogOpen(false);
  };

  const resetForm = () => {
    setNewRepere(''); setNewZone(''); setNewType(''); setNewSection('');
    setNewLength(''); setNewWeight(''); setNewFactory('');
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setPdfPlanName(file.name.replace(/\.pdf$/i, ''));
      const url = URL.createObjectURL(file);
      setPdfPreviewUrl(url);
    }
    e.target.value = '';
  };

  const togglePdfZone = (zone: string) => {
    setPdfZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  };

  const togglePdfProductType = (type: string) => {
    setPdfProductTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handlePdfImport = async () => {
    if (!pdfFile) return;

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const pdfDataUrl = `data:application/pdf;base64,${base64}`;
      const plan: Plan = {
        id: crypto.randomUUID(),
        name: pdfPlanName.trim() || pdfFile.name,
        zones: pdfZones,
        productTypes: pdfProductTypes,
        detectedReperes: [], // No AI detection — repères are determined dynamically from DB
        pdfDataUrl,
      };

      if (pdfImportMode === 'replace' && pdfReplaceId) {
        updatePlan(pdfReplaceId, {
          name: plan.name,
          zones: plan.zones,
          productTypes: plan.productTypes,
          detectedReperes: plan.detectedReperes,
          pdfDataUrl: plan.pdfDataUrl,
        });
        toast.success('Plan remplacé avec succès');
      } else {
        addPlan(plan);
        toast.success('Plan importé avec succès');
      }

      resetPdfDialog();
      setPdfDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'import du plan');
    }
  };

  const resetPdfDialog = () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfFile(null);
    setPdfPlanName('');
    setPdfPreviewUrl(null);
    setPdfZones([]);
    setPdfProductTypes([]);
    setPdfImportMode('new');
    setPdfReplaceId('');
  };

  // Delete plans helpers
  const togglePlanToDelete = (planId: string) => {
    setSelectedPlanIdsToDelete(prev => {
      const next = new Set(prev);
      next.has(planId) ? next.delete(planId) : next.add(planId);
      return next;
    });
  };

  const handleDeleteSelectedPlans = () => {
    selectedPlanIdsToDelete.forEach(id => deletePlan(id));
    toast.success(`${selectedPlanIdsToDelete.size} plan(s) supprimé(s)`);
    setSelectedPlanIdsToDelete(new Set());
    setDeletePlansDialogOpen(false);
  };

  const handleDeleteAllPlans = () => {
    plans.forEach(p => deletePlan(p.id));
    toast.success('Tous les plans ont été supprimés');
    setSelectedPlanIdsToDelete(new Set());
    setDeletePlansDialogOpen(false);
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

  const hasActiveFilters = useMemo(() => Object.values(filters).some(s => s.size > 0), [filters]);

  const totalLength = filteredElements.reduce((s, el) => s + el.length, 0);
  const totalWeight = filteredElements.reduce((s, el) => s + el.weight, 0);

  // Count matched elements for a plan (dynamic matching by zones/productTypes)
  const getPlanElementCount = (plan: Plan) => {
    return elements.filter(el => {
      if (plan.zones.length > 0 && !plan.zones.includes(el.zone)) return false;
      if (plan.productTypes.length > 0 && !plan.productTypes.includes(el.productType)) return false;
      return true;
    }).length;
  };

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
              <input ref={pdfInputRef} type="file" accept=".pdf" onChange={handlePdfFileChange} className="hidden" />
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-1" /> Importer Excel
              </Button>
              <Button variant="outline" onClick={() => { resetPdfDialog(); setPdfDialogOpen(true); }}>
                <FileText className="h-4 w-4 mr-1" /> Importer un plan PDF
              </Button>
              {plans.length > 0 && (
                <Button variant="outline" onClick={() => { setSelectedPlanIdsToDelete(new Set()); setDeletePlansDialogOpen(true); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Supprimer plans
                </Button>
              )}
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
          <div className="flex items-center gap-4 mb-3 px-2 py-2 rounded-md bg-muted/40 text-sm font-medium">
            <span>{filteredElements.length}{filteredElements.length !== elements.length ? ` / ${elements.length}` : ''} éléments</span>
            <span className="text-muted-foreground">•</span>
            <span>{totalLength.toFixed(2)} m</span>
            <span className="text-muted-foreground">•</span>
            <span>{totalWeight.toFixed(3)} t</span>
          </div>
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mb-2 px-2">
              <Button variant="default" size="sm" className="text-xs" onClick={() => setFilters({})}>
                <RefreshCw className="h-3 w-3 mr-1" /> Réinitialiser les filtres
              </Button>
              <span className="text-xs text-muted-foreground">
                {Object.entries(filters).filter(([, s]) => s.size > 0).map(([col, s]) => `${col === 'zone' ? 'Zone' : col === 'productType' ? 'Type' : col === 'section' ? 'Section' : 'Usine'} (${s.size})`).join(', ')}
              </span>
            </div>
          )}
          <div className="overflow-auto max-h-[65vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">N° Repère</TableHead>
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
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Plans importés section */}
      {plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-accent" />
              Plans importés – {plans.length} plan(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {plans.map(plan => (
                <div key={plan.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-secondary/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{plan.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {plan.zones.map(z => (
                        <Badge key={z} variant="secondary" className="text-[10px]">{z}</Badge>
                      ))}
                      {plan.productTypes.map(t => (
                        <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {getPlanElementCount(plan)} élément(s) correspondant(s)
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deletePlan(plan.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="w-fit">
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
        <DialogContent className="w-fit">
          <DialogHeader>
            <DialogTitle>Ajouter des éléments</DialogTitle>
            <DialogDescription>
              Saisissez les informations manuellement ou collez des lignes depuis Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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

      {/* Duplicate Comparison Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={(open) => { if (!open) { setDuplicateDialogOpen(false); setDuplicates([]); setPendingNew([]); } }}>
        <DialogContent className="w-fit max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Repères en doublon détectés</DialogTitle>
            <DialogDescription>
              {duplicates.length} repère(s) existe(nt) déjà. Comparez les données ci-dessous et choisissez si vous souhaitez écraser les lignes existantes.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Source</TableHead>
                  <TableHead>Repère</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Longueur</TableHead>
                  <TableHead>Poids</TableHead>
                  <TableHead>Usine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map(({ existing, incoming }, i) => (
                  <>
                    <TableRow key={`ex-${i}`} className="bg-muted/30">
                      <TableCell className="text-xs font-medium text-muted-foreground">Existant</TableCell>
                      <TableCell>{existing.repere}</TableCell>
                      <TableCell>{existing.zone}</TableCell>
                      <TableCell>{existing.productType}</TableCell>
                      <TableCell>{existing.section}</TableCell>
                      <TableCell>{existing.length}</TableCell>
                      <TableCell>{existing.weight}</TableCell>
                      <TableCell>{existing.factory}</TableCell>
                    </TableRow>
                    <TableRow key={`in-${i}`} className="bg-primary/5 border-b-2 border-border">
                      <TableCell className="text-xs font-medium text-primary">Nouveau</TableCell>
                      <TableCell>{incoming.repere}</TableCell>
                      <TableCell>{incoming.zone}</TableCell>
                      <TableCell>{incoming.productType}</TableCell>
                      <TableCell>{incoming.section}</TableCell>
                      <TableCell>{incoming.length}</TableCell>
                      <TableCell>{incoming.weight}</TableCell>
                      <TableCell>{incoming.factory}</TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDuplicateDialogOpen(false); setDuplicates([]); setPendingNew([]); }}>
              Annuler
            </Button>
            <Button onClick={handleOverwriteDuplicates}>
              Écraser les existants ({duplicates.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Import Dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={(open) => { if (!open) resetPdfDialog(); setPdfDialogOpen(open); }}>
        <DialogContent className="w-fit max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Importer un plan PDF</DialogTitle>
            <DialogDescription>
              Sélectionnez les zones et types de produits, puis choisissez un fichier PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Zones multi-select */}
            <div>
              <Label className="text-xs">Zones concernées</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {availableZones.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Aucune zone disponible</span>
                ) : availableZones.map(zone => (
                  <label key={zone} className="flex items-center gap-1.5 text-sm cursor-pointer bg-secondary/50 hover:bg-secondary rounded px-2 py-1">
                    <Checkbox checked={pdfZones.includes(zone)} onCheckedChange={() => togglePdfZone(zone)} />
                    <span>{zone}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Product types multi-select */}
            <div>
              <Label className="text-xs">Types de produits concernés</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {availableProductTypes.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Aucun type disponible</span>
                ) : availableProductTypes.map(type => (
                  <label key={type} className="flex items-center gap-1.5 text-sm cursor-pointer bg-secondary/50 hover:bg-secondary rounded px-2 py-1">
                    <Checkbox checked={pdfProductTypes.includes(type)} onCheckedChange={() => togglePdfProductType(type)} />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Plan name */}
            {pdfFile && (
              <div>
                <Label className="text-xs">Nom du plan</Label>
                <Input value={pdfPlanName} onChange={e => setPdfPlanName(e.target.value)} className="h-8 text-sm mt-1" placeholder="Nom du plan" />
              </div>
            )}

            {/* File input */}
            <div>
              <Label className="text-xs">Fichier PDF</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button variant="outline" size="sm" onClick={() => pdfInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Choisir un fichier
                </Button>
                {pdfFile && <span className="text-sm text-muted-foreground truncate">{pdfFile.name}</span>}
              </div>
            </div>

            {/* PDF preview */}
            {pdfPreviewUrl && (
              <div className="border rounded-md overflow-hidden" style={{ height: '400px' }}>
                <iframe src={pdfPreviewUrl} className="w-full h-full" title="Aperçu PDF" />
              </div>
            )}

            {/* Import mode */}
            <div>
              <Label className="text-xs">Mode d'import</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button
                  variant={pdfImportMode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPdfImportMode('new')}
                  className="justify-start"
                >
                  <Plus className="h-4 w-4 mr-1" /> Nouveau plan
                </Button>
                <Button
                  variant={pdfImportMode === 'replace' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPdfImportMode('replace')}
                  disabled={plans.length === 0}
                  className="justify-start"
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Écraser existant
                </Button>
              </div>
              {pdfImportMode === 'replace' && plans.length > 0 && (
                <Select value={pdfReplaceId} onValueChange={setPdfReplaceId}>
                  <SelectTrigger className="h-8 text-sm mt-2"><SelectValue placeholder="Sélectionner un plan à écraser" /></SelectTrigger>
                  <SelectContent>
                    {plans.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetPdfDialog(); setPdfDialogOpen(false); }}>
              Annuler
            </Button>
            <Button
              onClick={handlePdfImport}
              disabled={!pdfFile || (pdfImportMode === 'replace' && !pdfReplaceId)}
            >
              <FileText className="h-4 w-4 mr-1" /> Importer le plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Plans Dialog */}
      <Dialog open={deletePlansDialogOpen} onOpenChange={setDeletePlansDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Supprimer des plans</DialogTitle>
            <DialogDescription>
              Sélectionnez les plans à supprimer ou supprimez tous les plans.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button variant="destructive" size="sm" className="w-full" onClick={handleDeleteAllPlans}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer tous les plans ({plans.length})
            </Button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou sélectionner</span></div>
            </div>
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {plans.map(plan => (
                <label key={plan.id} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-secondary/50 transition-colors">
                  <Checkbox
                    checked={selectedPlanIdsToDelete.has(plan.id)}
                    onCheckedChange={() => togglePlanToDelete(plan.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{plan.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {plan.zones.join(', ')} · {plan.productTypes.join(', ')}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePlansDialogOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelectedPlans}
              disabled={selectedPlanIdsToDelete.size === 0}
            >
              Supprimer ({selectedPlanIdsToDelete.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
