import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Plus, Search, ExternalLink, FolderOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface ProjectRow {
  id: string;
  site_name: string | null;
  client_name: string | null;
  conductor: string | null;
  created_at: string | null;
}

interface ProjectLink {
  project_id: string;
  token: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [filterConductor, setFilterConductor] = useState('all');

  const fetchProjects = async () => {
    setLoading(true);
    const [{ data: pData }, { data: lData }] = await Promise.all([
      supabase.from('projects').select('id, site_name, client_name, conductor, created_at').order('created_at', { ascending: false }),
      supabase.from('project_access_links').select('project_id, token'),
    ]);
    setProjects(pData || []);
    setLinks(lData || []);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const conductors = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (p.conductor) set.add(p.conductor); });
    return Array.from(set).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesName = !searchName || (p.site_name || '').toLowerCase().includes(searchName.toLowerCase());
      const matchesConductor = filterConductor === 'all' || p.conductor === filterConductor;
      return matchesName && matchesConductor;
    });
  }, [projects, searchName, filterConductor]);

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-4 flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <Truck className="h-7 w-7" />
          <h1 className="text-lg font-bold tracking-tight">RECTOR – Planification des livraisons</h1>
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
              Tous les chantiers
            </CardTitle>
            <CardDescription>{projects.length} chantier(s) au total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  placeholder="Rechercher par nom de chantier..."
                  className="pl-9"
                />
              </div>
              <Select value={filterConductor} onValueChange={setFilterConductor}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Conducteur de travaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les conducteurs</SelectItem>
                  {conductors.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  return (
                    <div key={project.id} className="border rounded-lg p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground truncate">
                          {project.site_name || 'Chantier sans nom'}
                        </div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3">
                          {project.client_name && <span>{project.client_name}</span>}
                          {project.conductor && <span>Conducteur : {project.conductor}</span>}
                          {project.created_at && <span>{new Date(project.created_at).toLocaleDateString('fr-FR')}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {token && (
                          <Button size="sm" onClick={() => navigate(`/p/${token}`)}>
                            <ExternalLink className="h-4 w-4 mr-1" /> Ouvrir
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
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
