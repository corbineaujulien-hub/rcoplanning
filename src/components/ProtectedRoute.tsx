// TEMPORAIRE : authentification désactivée le temps de résoudre le problème CORS
// TODO: Réactiver l'authentification une fois le CORS corrigé
// import { Navigate } from 'react-router-dom';
// import { useAuth } from '@/context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Auth bypass temporaire - toutes les routes sont accessibles
  return <>{children}</>;
}
