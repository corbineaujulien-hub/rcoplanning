import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DeliveryProvider } from '@/context/DeliveryContext';
import DeliveryApp from '@/components/delivery/DeliveryApp';
import { toast } from 'sonner';


export default function Project() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    const validate = async () => {
      const { data, error } = await supabase.rpc('validate_token', { p_token: token });
      if (error || !data) {
        toast.error('Lien invalide ou expiré');
        navigate('/');
        return;
      }
      const result = data as { project_id: string; site_name: string };
      setProjectId(result.project_id);
      setLoading(false);
    };

    validate();
  }, [token, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Chargement du chantier...</div>
      </div>
    );
  }

  return (
    <DeliveryProvider projectId={projectId!} token={token!}>
      <DeliveryApp />
    </DeliveryProvider>
  );
}
