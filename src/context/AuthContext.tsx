// TEMPORAIRE : Auth neutralisée le temps de résoudre le problème CORS
// TODO: Réactiver l'authentification une fois le CORS corrigé
import { createContext, useContext, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

// Session fictive pour éviter les erreurs dans les composants dépendants
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
  const signOut = async () => {
    // Désactivé temporairement
  };

  return (
    <AuthContext.Provider value={{ session: fakeSession, user: fakeUser, loading: false, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
