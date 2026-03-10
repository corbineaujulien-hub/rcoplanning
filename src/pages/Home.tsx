import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Plus, LogIn, Copy, Check, Search, ExternalLink, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectRow {
  id: string;
  site_name: string | null;
  client_name: string | null;
  conductor: string | null;
  created_at: string | null;
}

interface ProjectLink {
  project_id: string;
  role: string;
  token: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [linkInput, setLinkInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdLinks, setCreatedLinks] = useState<{ admin: string; editor: string; viewer: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [filterConductor, setFilterConductor] = useState('all');

  const fetchProjects = async () => {
    setLoading(true);
    const [{ data: pData }, { data: lData }] = await Promise.all([
      supabase.from('projects').select('id, site_name, client_name, conductor, created_at').order('created_at', { ascending: false }),
      supabase.from('project_access_links').select('project_id, role, token'),
    ]);
    setProjects(pData || []);
    setLinks(lData || []);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  // Re-fetch after creating a project
  useEffect(() => {
    if (!createdLinks) fetchProjects();
  }, [createdLinks]);

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

  const getProjectLinks = (projectId: string) => {
    const projectLinks = links.filter(l => l.project_id === projectId);
    return {
      admin: projectLinks.find(l => l.role === 'admin')?.token || null,
      editor: projectLinks.find(l => l.role === 'editor')?.token || null,
      viewer: projectLinks.find(l => l.role === 'viewer')?.token || null,
    };
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_project');
      if (error) throw error;
      const result = data as { project_id: string; admin_token: string; editor_token: string; viewer_token: string };
      const base = window.location.origin;
      setCreatedLinks({
        admin: `${base}/p/${result.admin_token}`,
        editor: `${base}/p/${result.editor_token}`,
        viewer: `${base}/p/${result.viewer_token}`,
      });
      toast.success('Chantier créé avec succès !');
    } catch (err: any) {
      toast.error('Erreur lors de la création : ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = () => {
    const input = linkInput.trim();
    const match = input.match(/\/p\/([a-f0-9]+)$/i);
    const token = match ? match[1] : input;
    if (token && /^[a-f0-9]{20,}$/i.test(token)) {
      navigate(`/p/${token}`);
    } else {
      toast.error('Lien invalide. Collez un lien de chantier valide.');
    }
  };

  const copyLink = (key: string, token: string) => {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(key);
    toast.success('Lien copié !');
    setTimeout(() => setCopied(null), 2000);
  };

  const goToAdmin = () => {
    if (createdLinks) {
      const token = createdLinks.admin.split('/p/')[1];
      navigate(`/p/${token}`);
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

      <main className="flex-1 container py-8 flex flex-col gap-8 max-w-4xl">
        {!createdLinks ? (
          <>
            {/* Actions row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LogIn className="h-5 w-5 text-accent" />
                    Rejoindre un chantier
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Input
                    value={linkInput}
                    onChange={e => setLinkInput(e.target.value)}
                    placeholder="Collez votre lien ici..."
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  />
                  <Button onClick={handleJoin} variant="secondary">
                    Accéder
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Projects list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-accent" />
                  Tous les chantiers
                </CardTitle>
                <CardDescription>{projects.length} chantier(s) au total</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
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

                {/* Project cards */}
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">Chargement...</div>
                ) : filteredProjects.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {projects.length === 0 ? 'Aucun chantier créé pour le moment.' : 'Aucun chantier ne correspond aux filtres.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProjects.map(project => {
                      const pLinks = getProjectLinks(project.id);
                      return (
                        <div key={project.id} className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-foreground">
                                {project.site_name || 'Chantier sans nom'}
                              </span>
                              {project.client_name && (
                                <span className="text-sm text-muted-foreground ml-2">— {project.client_name}</span>
                              )}
                              {project.conductor && (
                                <div className="text-xs text-muted-foreground">Conducteur : {project.conductor}</div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                              {project.created_at ? new Date(project.created_at).toLocaleDateString('fr-FR') : ''}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { label: 'Admin', token: pLinks.admin, variant: 'default' as const },
                              { label: 'Éditeur', token: pLinks.editor, variant: 'secondary' as const },
                              { label: 'Lecteur', token: pLinks.viewer, variant: 'outline' as const },
                            ]).map(link => link.token && (
                              <div key={link.label} className="flex gap-1">
                                <Button
                                  variant={link.variant}
                                  size="sm"
                                  className="flex-1 text-xs"
                                  onClick={() => navigate(`/p/${link.token}`)}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  {link.label}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-2"
                                  onClick={() => copyLink(`${project.id}-${link.label}`, link.token!)}
                                >
                                  {copied === `${project.id}-${link.label}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="max-w-xl mx-auto w-full">
            <CardHeader>
              <CardTitle className="text-green-600 flex items-center gap-2">
                <Check className="h-5 w-5" /> Chantier créé !
              </CardTitle>
              <CardDescription>
                Conservez précieusement ces liens. Ils permettent d'accéder au chantier avec différents niveaux de droits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                { label: 'Administrateur', desc: 'Accès complet + gestion des liens', url: createdLinks.admin, color: 'text-destructive' },
                { label: 'Éditeur', desc: 'Peut modifier les données', url: createdLinks.editor, color: 'text-primary' },
                { label: 'Lecteur', desc: 'Consultation uniquement', url: createdLinks.viewer, color: 'text-muted-foreground' },
              ] as const).map(link => (
                <div key={link.label} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-semibold ${link.color}`}>{link.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{link.desc}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      navigator.clipboard.writeText(link.url);
                      setCopied(link.label);
                      toast.success(`Lien ${link.label} copié !`);
                      setTimeout(() => setCopied(null), 2000);
                    }}>
                      {copied === link.label ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <code className="text-xs block bg-muted p-2 rounded break-all">{link.url}</code>
                </div>
              ))}

              <div className="flex gap-2 mt-4">
                <Button onClick={goToAdmin} className="flex-1" size="lg">
                  Ouvrir le chantier (Admin)
                </Button>
                <Button onClick={() => setCreatedLinks(null)} variant="outline" size="lg">
                  Retour
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
