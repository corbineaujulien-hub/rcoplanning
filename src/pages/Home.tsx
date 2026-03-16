import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Truck, Plus, Search, FolderOpen, Trash2, Archive, ArchiveRestore, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface ProjectRow {
  id: string;
  site_name: string | null;
  client_name: string | null;
  conductor: string | null;
  subcontractor: string | null;
  otp_number: string | null;
  created_at: string | null;
  archived: boolean;
}

interface ProjectLink {
  project_id: string;
  token: string;
}

interface TruckRow {
  project_id: string;
  date: string;
}

interface ElementRow {
  project_id: string;
  weight: number;
}

interface TruckElementInfo {
  project_id: string;
  element_ids: string[];
  date: string;
}

export default function Home() {
  const navigate = useNavigate();
  
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [allTrucks, setAllTrucks] = useState<TruckElementInfo[]>([]);
  const [allElements, setAllElements] = useState<ElementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [filterConductor, setFilterConductor] = useState('all');
  const [filterSubcontractor, setFilterSubcontractor] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    const [{ data: pData }, { data: lData }, { data: tData }, { data: eData }] = await Promise.all([
      supabase.from('projects').select('id, site_name, client_name, conductor, subcontractor, otp_number, created_at, archived').order('created_at', { ascending: false }),
      supabase.from('project_access_links').select('project_id, token'),
      supabase.from('trucks').select('project_id, date, element_ids'),
      supabase.from('beam_elements').select('project_id, weight'),
    ]);
    setProjects(pData as ProjectRow[] || []);
    setLinks(lData || []);
    setAllTrucks((tData || []).map(t => ({ project_id: t.project_id, element_ids: (t.element_ids as string[]) || [], date: t.date })));
    setAllElements((eData || []).map(e => ({ project_id: e.project_id, weight: Number(e.weight) || 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const conductors = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (p.conductor) set.add(p.conductor); });
    return Array.from(set).sort();
  }, [projects]);

  const subcontractors = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (p.subcontractor) set.add(p.subcontractor); });
    return Array.from(set).sort();
  }, [projects]);

  // Compute first truck date per project
  const firstTruckDateMap = useMemo(() => {
    const map = new Map<string, string>();
    allTrucks.forEach(t => {
      const current = map.get(t.project_id);
      if (!current || t.date < current) map.set(t.project_id, t.date);
    });
    return map;
  }, [allTrucks]);

  // Compute total weight per project
  const totalWeightMap = useMemo(() => {
    const map = new Map<string, number>();
    allElements.forEach(e => {
      map.set(e.project_id, (map.get(e.project_id) || 0) + e.weight);
    });
    return map;
  }, [allElements]);

  // Compute loaded weight (elements assigned to trucks) per project
  const loadedWeightMap = useMemo(() => {
    const map = new Map<string, number>();
    // Build element weight lookup
    const elementWeights = new Map<string, number>();
    // We need element ids to weights - but we only have project_id+weight from allElements
    // We need a different approach: fetch element_ids from trucks, cross with elements
    // Actually we need element-level data. Let's compute from allTrucks element_ids
    // For simplicity, we'll need to know which elements are in trucks
    // Since we have allTrucks with element_ids, we can count unique assigned element IDs per project
    // But we need weights per element... Let's just use count-based approximation
    // Actually let me rethink: we have allElements with project_id + weight, and allTrucks with element_ids
    // We can't map element_id to weight without fetching individual elements
    // So let's fetch that data differently
    return map;
  }, []);

  // Better approach: fetch elements with id+weight+project_id
  const [elementDetailsMap, setElementDetailsMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const fetchElementDetails = async () => {
      const { data } = await supabase.from('beam_elements').select('id, weight, project_id');
      if (data) {
        const map = new Map<string, number>();
        data.forEach(e => map.set(e.id, Number(e.weight) || 0));
        setElementDetailsMap(map);
      }
    };
    fetchElementDetails();
  }, []);

  // Loaded weight per project (elements assigned to any truck)
  const projectLoadedWeight = useMemo(() => {
    const map = new Map<string, number>();
    const projectAssignedIds = new Map<string, Set<string>>();
    allTrucks.forEach(t => {
      if (!projectAssignedIds.has(t.project_id)) projectAssignedIds.set(t.project_id, new Set());
      t.element_ids.forEach(id => projectAssignedIds.get(t.project_id)!.add(id));
    });
    projectAssignedIds.forEach((ids, projectId) => {
      let w = 0;
      ids.forEach(id => { w += elementDetailsMap.get(id) || 0; });
      map.set(projectId, w);
    });
    return map;
  }, [allTrucks, elementDetailsMap]);

  // Delivered weight (elements in trucks with date <= today)
  const projectDeliveredWeight = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const map = new Map<string, number>();
    const projectDeliveredIds = new Map<string, Set<string>>();
    allTrucks.forEach(t => {
      if (t.date <= today) {
        if (!projectDeliveredIds.has(t.project_id)) projectDeliveredIds.set(t.project_id, new Set());
        t.element_ids.forEach(id => projectDeliveredIds.get(t.project_id)!.add(id));
      }
    });
    projectDeliveredIds.forEach((ids, projectId) => {
      let w = 0;
      ids.forEach(id => { w += elementDetailsMap.get(id) || 0; });
      map.set(projectId, w);
    });
    return map;
  }, [allTrucks, elementDetailsMap]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => {
        if (showArchived !== (p.archived ?? false)) return false;
        const searchLower = searchName.toLowerCase();
        const matchesName = !searchName || (p.site_name || '').toLowerCase().includes(searchLower) || (p.otp_number || '').toLowerCase().includes(searchLower) || (p.client_name || '').toLowerCase().includes(searchLower);
        const matchesConductor = filterConductor === 'all' || p.conductor === filterConductor;
        const matchesSubcontractor = filterSubcontractor === 'all' || p.subcontractor === filterSubcontractor;
        return matchesName && matchesConductor && matchesSubcontractor;
      })
      .sort((a, b) => {
        const dateA = firstTruckDateMap.get(a.id);
        const dateB = firstTruckDateMap.get(b.id);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB);
      });
  }, [projects, searchName, filterConductor, filterSubcontractor, showArchived, firstTruckDateMap]);

  const getProjectToken = (projectId: string) => {
    return links.find(l => l.project_id === projectId)?.token || null;
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_project');
      if (error) throw error;
      const result = data as { project_id: string; token: string };
      navigate(`/p/${result.token}`);
    } catch (err: any) {
      toast.error('Erreur lors de la création : ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    try {
      const { error } = await supabase.rpc('delete_project_by_id', { p_project_id: projectId });
      if (error) throw error;
      toast.success('Chantier supprimé');
      fetchProjects();
    } catch (err: any) {
      toast.error('Erreur : ' + err.message);
    }
  };

  const handleArchive = async (projectId: string, archive: boolean) => {
    try {
      const { error } = await supabase.from('projects').update({ archived: archive } as any).eq('id', projectId);
      if (error) throw error;
      toast.success(archive ? 'Chantier archivé' : 'Chantier désarchivé');
      fetchProjects();
    } catch (err: any) {
      toast.error('Erreur : ' + err.message);
    }
  };

  const activeCount = projects.filter(p => !p.archived).length;
  const archivedCount = projects.filter(p => p.archived).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <Truck className="h-7 w-7" />
            <h1 className="text-lg font-bold tracking-tight">RECTOR – Planification des livraisons</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8 flex flex-col gap-6 max-w-4xl">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-accent" />
              Nouveau chantier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCreate} disabled={creating} className="w-full" size="lg">
              {creating ? 'Création en cours...' : 'Créer un chantier'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-accent" />
              {showArchived ? 'Chantiers archivés' : 'Tous les chantiers'}
            </CardTitle>
            <CardDescription>{showArchived ? archivedCount : activeCount} chantier(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  placeholder="Rechercher par nom ou OTP..."
                  className="pl-9"
                />
              </div>
              <Select value={filterConductor} onValueChange={setFilterConductor}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Conducteur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les conducteurs</SelectItem>
                  {conductors.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSubcontractor} onValueChange={setFilterSubcontractor}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Poseur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les poseurs</SelectItem>
                  {subcontractors.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant={!showArchived ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowArchived(false)}
              >
                <FolderOpen className="h-4 w-4 mr-1" /> Actifs ({activeCount})
              </Button>
              <Button
                variant={showArchived ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowArchived(true)}
              >
                <Archive className="h-4 w-4 mr-1" /> Archivés ({archivedCount})
              </Button>
            </div>

            {loading ? (
              <div className="text-center text-muted-foreground py-8">Chargement...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {projects.length === 0 ? 'Aucun chantier créé pour le moment.' : 'Aucun chantier ne correspond aux filtres.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProjects.map(project => {
                  const token = getProjectToken(project.id);
                  const firstDate = firstTruckDateMap.get(project.id);
                  const totalW = totalWeightMap.get(project.id) || 0;
                  const loadedW = projectLoadedWeight.get(project.id) || 0;
                  const deliveredW = projectDeliveredWeight.get(project.id) || 0;
                  const planningPct = totalW > 0 ? Math.round((loadedW / totalW) * 100) : 0;
                  const deliveryPct = totalW > 0 ? Math.round((deliveredW / totalW) * 100) : 0;

                  return (
                    <div
                      key={project.id}
                      className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                      onDoubleClick={() => { if (token) navigate(`/p/${token}`); }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="font-semibold text-foreground truncate">
                            {project.site_name || 'Chantier sans nom'}
                            {project.otp_number && <span className="text-muted-foreground font-normal ml-2 text-sm">OTP: {project.otp_number}</span>}
                          </div>
                          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                            <div className="flex flex-wrap gap-x-3">
                              {project.client_name && <span>{project.client_name}</span>}
                              {project.conductor && <span>Conducteur : {project.conductor.split('–')[0].trim()}</span>}
                            </div>
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <User className="h-3 w-3" />
                              {project.subcontractor || 'Poseur à désigner'}
                            </span>
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Calendar className="h-3 w-3" />
                              {firstDate ? `1er camion : ${new Date(firstDate).toLocaleDateString('fr-FR')}` : 'À programmer'}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-28 shrink-0">Planification</span>
                              <Progress value={planningPct} className="h-2 flex-1" />
                              <span className="font-medium w-10 text-right">{planningPct}%</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-28 shrink-0">Livré à ce jour</span>
                              <Progress value={deliveryPct} className="h-2 flex-1" />
                              <span className="font-medium w-10 text-right">{deliveryPct}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {!project.archived ? (
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleArchive(project.id, true); }} title="Archiver">
                              <Archive className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleArchive(project.id, false); }} title="Désarchiver">
                              <ArchiveRestore className="h-4 w-4" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer ce chantier ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. Toutes les données du chantier « {project.site_name || 'sans nom'} » seront définitivement supprimées.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(project.id)}>
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
