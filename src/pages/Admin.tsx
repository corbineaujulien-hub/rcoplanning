import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Copy, Check, ExternalLink, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectWithLinks {
  id: string;
  site_name: string | null;
  client_name: string | null;
  created_at: string;
  links: { admin: string | null; editor: string | null; viewer: string | null };
}

export default function Admin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [projects, setProjects] = useState<ProjectWithLinks[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-list-projects', {
        body: { password },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setProjects(data);
      setAuthenticated(true);
    } catch (err: any) {
      toast.error('Erreur : ' + (err.message || 'Mot de passe incorrect'));
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (key: string, token: string) => {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(key);
    toast.success('Lien copié !');
    setTimeout(() => setCopied(null), 2000);
  };

  const openProject = (token: string) => {
    navigate(`/p/${token}`);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              Administration
            </CardTitle>
            <CardDescription>Entrez le mot de passe administrateur pour accéder à la liste des chantiers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mot de passe..."
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <div className="flex gap-2">
              <Button onClick={handleLogin} disabled={loading || !password} className="flex-1">
                {loading ? 'Vérification...' : 'Se connecter'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7" />
            <h1 className="text-lg font-bold tracking-tight">Administration – Tous les chantiers</h1>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Accueil
          </Button>
        </div>
      </header>

      <main className="flex-1 container py-8 max-w-4xl space-y-4">
        <p className="text-muted-foreground text-sm">{projects.length} chantier(s) trouvé(s)</p>

        {projects.map(project => (
          <Card key={project.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-foreground text-lg">
                    {project.site_name || 'Chantier sans nom'}
                  </span>
                  {project.client_name && (
                    <span className="text-sm text-muted-foreground ml-2">— {project.client_name}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(project.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: 'Admin', token: project.links.admin, variant: 'default' as const },
                  { label: 'Éditeur', token: project.links.editor, variant: 'secondary' as const },
                  { label: 'Lecteur', token: project.links.viewer, variant: 'outline' as const },
                ]).map(link => link.token && (
                  <div key={link.label} className="flex gap-1">
                    <Button
                      variant={link.variant}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => openProject(link.token!)}
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
            </CardContent>
          </Card>
        ))}

        {projects.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Aucun chantier n'a encore été créé.
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
