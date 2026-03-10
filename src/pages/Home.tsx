import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck, Plus, LogIn, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function Home() {
  const navigate = useNavigate();
  const [linkInput, setLinkInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdLinks, setCreatedLinks] = useState<{ admin: string; editor: string; viewer: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
    // Extract token from URL or direct token
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container py-4 flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <Truck className="h-7 w-7" />
          <h1 className="text-lg font-bold tracking-tight">RECTOR – Planification des livraisons</h1>
        </div>
      </header>

      <main className="flex-1 container py-12 flex flex-col items-center gap-8 max-w-xl">
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
                { label: 'Administrateur', desc: 'Accès complet + gestion des liens', url: createdLinks.admin, color: 'text-red-600' },
                { label: 'Éditeur', desc: 'Peut modifier les données', url: createdLinks.editor, color: 'text-blue-600' },
                { label: 'Lecteur', desc: 'Consultation uniquement', url: createdLinks.viewer, color: 'text-gray-600' },
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

              <Button onClick={goToAdmin} className="w-full mt-4" size="lg">
                Ouvrir le chantier (Admin)
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
