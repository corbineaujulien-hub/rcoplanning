import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck, Plus, LogIn, Copy, Check, FolderOpen, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface SavedProject {
  projectId: string;
  siteName?: string;
  createdAt: string;
  links: { admin: string; editor: string; viewer: string };
}

const STORAGE_KEY = 'rector_saved_projects';

function getSavedProjects(): SavedProject[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveProject(project: SavedProject) {
  const projects = getSavedProjects().filter(p => p.projectId !== project.projectId);
  projects.unshift(project);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function removeProject(projectId: string) {
  const projects = getSavedProjects().filter(p => p.projectId !== projectId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export default function Home() {
  const navigate = useNavigate();
  const [linkInput, setLinkInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdLinks, setCreatedLinks] = useState<{ admin: string; editor: string; viewer: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const projects = getSavedProjects();
    setSavedProjects(projects);
    // Fetch current site names for all saved projects
    if (projects.length > 0) {
      const ids = projects.map(p => p.projectId);
      supabase.from('projects').select('id, site_name').in('id', ids).then(({ data }) => {
        if (data) {
          const names: Record<string, string> = {};
          data.forEach(p => { if (p.site_name) names[p.id] = p.site_name; });
          setProjectNames(names);
        }
      });
    }
  }, [createdLinks]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_project');
      if (error) throw error;
      const result = data as { project_id: string; admin_token: string; editor_token: string; viewer_token: string };
      const base = window.location.origin;
      const links = {
        admin: `${base}/p/${result.admin_token}`,
        editor: `${base}/p/${result.editor_token}`,
        viewer: `${base}/p/${result.viewer_token}`,
      };
      setCreatedLinks(links);
      saveProject({
        projectId: result.project_id,
        createdAt: new Date().toISOString(),
        links,
      });
      setSavedProjects(getSavedProjects());
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

  const copyLink = (label: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    toast.success(`Lien ${label} copié !`);
    setTimeout(() => setCopied(null), 2000);
  };

  const goToAdmin = () => {
    if (createdLinks) {
      const token = createdLinks.admin.split('/p/')[1];
      navigate(`/p/${token}`);
    }
  };

  const handleRemoveSaved = (projectId: string) => {
    removeProject(projectId);
    setSavedProjects(getSavedProjects());
    toast.success('Chantier retiré de la liste');
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

      <main className="flex-1 container py-12 flex flex-col items-center gap-8 max-w-2xl">
        {!createdLinks ? (
          <>
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-accent" />
                  Nouveau chantier
                </CardTitle>
                <CardDescription>Créez un nouvel outil de planification pour un chantier</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleCreate} disabled={creating} className="w-full" size="lg">
                  {creating ? 'Création en cours...' : 'Créer un chantier'}
                </Button>
              </CardContent>
            </Card>

            <div className="text-muted-foreground text-sm">ou</div>

            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-accent" />
                  Rejoindre un chantier
                </CardTitle>
                <CardDescription>Collez le lien d'accès qui vous a été partagé</CardDescription>
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

            {savedProjects.length > 0 && (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-accent" />
                    Mes chantiers
                  </CardTitle>
                  <CardDescription>Chantiers créés depuis ce navigateur</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {savedProjects.map(project => {
                    const name = projectNames[project.projectId] || project.siteName;
                    return (
                      <div key={project.projectId} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {name || 'Chantier sans nom'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(project.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSaved(project.projectId)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { label: 'Admin', url: project.links.admin, variant: 'default' as const },
                            { label: 'Éditeur', url: project.links.editor, variant: 'secondary' as const },
                            { label: 'Lecteur', url: project.links.viewer, variant: 'outline' as const },
                          ]).map(link => (
                            <div key={link.label} className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <Button
                                  variant={link.variant}
                                  size="sm"
                                  className="flex-1 text-xs"
                                  onClick={() => {
                                    const token = link.url.split('/p/')[1];
                                    navigate(`/p/${token}`);
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  {link.label}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-2"
                                  onClick={() => copyLink(`${link.label} - ${name || 'chantier'}`, link.url)}
                                >
                                  {copied === `${link.label} - ${name || 'chantier'}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="w-full">
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
                    <Button variant="ghost" size="sm" onClick={() => copyLink(link.label, link.url)}>
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
