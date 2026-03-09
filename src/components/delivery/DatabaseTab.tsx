import { useState, useRef } from 'react';
import { useDelivery } from '@/context/DeliveryContext';
import { BeamElement, PRODUCT_TYPES } from '@/types/delivery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Plus, Trash2, Database } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function DatabaseTab() {
  const { elements, setElements, addElements, updateElement, deleteElement } = useDelivery();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const mapped: BeamElement[] = json.map((row, i) => ({
        id: crypto.randomUUID(),
        repere: String(row['Numéro de repère'] ?? row['Repère'] ?? row['repere'] ?? `REP-${i + 1}`),
        zone: String(row['Zone'] ?? row['zone'] ?? ''),
        productType: String(row['Type de produit'] ?? row['type'] ?? ''),
        section: String(row['Section'] ?? row['section'] ?? ''),
        length: Number(row['Longueur (m)'] ?? row['Longueur'] ?? row['longueur'] ?? 0),
        weight: Number(row['Poids (tonnes)'] ?? row['Poids'] ?? row['poids'] ?? 0),
        factory: String(row['Usine de fabrication'] ?? row['Usine'] ?? row['usine'] ?? ''),
      }));
      addElements(mapped);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const addRow = () => {
    const newEl: BeamElement = {
      id: crypto.randomUUID(),
      repere: '',
      zone: '',
      productType: '',
      section: '',
      length: 0,
      weight: 0,
      factory: '',
    };
    addElements([newEl]);
    setEditingId(newEl.id);
  };

  const totalWeight = elements.reduce((sum, el) => sum + el.weight, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-accent" />
              Base de données – {elements.length} éléments – {totalWeight.toFixed(2)} t
            </CardTitle>
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Importer Excel
              </Button>
              <Button onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter ligne
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[65vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">N° Repère</TableHead>
                  <TableHead className="w-24">Zone</TableHead>
                  <TableHead className="w-40">Type de produit</TableHead>
                  <TableHead className="w-24">Section</TableHead>
                  <TableHead className="w-28">Longueur (m)</TableHead>
                  <TableHead className="w-28">Poids (t)</TableHead>
                  <TableHead className="w-32">Usine</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {elements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      Aucun élément. Importez un fichier Excel ou ajoutez des lignes manuellement.
                    </TableCell>
                  </TableRow>
                ) : (
                  elements.map(el => (
                    <TableRow key={el.id} onClick={() => setEditingId(el.id)} className="cursor-pointer hover:bg-muted/50">
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
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="h-8 w-8 text-destructive hover:text-destructive">
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
    </div>
  );
}
