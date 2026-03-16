// TEMPORAIRE : Auth neutralisée le temps de résoudre le problème CORS
// TODO: Réactiver l'authentification une fois le CORS corrigé
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

// Session fictive pour les composants qui dépendent du contexte
const fakeUser = {
  id: 'temp-user',
  email: 'utilisateur@temp.local',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
} as unknown as User;

const fakeSession = {
  access_token: 'temp-token',
  refresh_token: 'temp-refresh',
  expires_in: 999999,
  token_type: 'bearer',
  user: fakeUser,
} as unknown as Session;

const AuthContext = createContext<AuthContextType>({
  session: fakeSession,
  user: fakeUser,
  loading: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  // Nettoyer toute session Supabase persistée pour que les requêtes
  // utilisent uniquement la anon key (sans JWT invalide)
  useEffect(() => {
    supabase.auth.signOut().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session: fakeSession, user: fakeUser, loading: false, signOut: async () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}
