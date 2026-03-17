import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';

interface PresenceUser {
  odisplayName: string;
  odisplayId: string;
  joinedAt: string;
}

function getDisplayName(user: { email?: string | null } | null): string {
  if (!user) return 'Anonyme';
  if (user.email) return user.email.split('@')[0];
  return 'Anonyme';
}

function getVisitorId(): string {
  let id = sessionStorage.getItem('presence_visitor_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('presence_visitor_id', id);
  }
  return id;
}

export default function ActiveUsersNotification({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [otherUsers, setOtherUsers] = useState<string[]>([]);

  const myId = user?.id ?? getVisitorId();
  const myName = getDisplayName(user);

  useEffect(() => {
    const channel = supabase.channel(`presence:project:${projectId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const names: string[] = [];
        for (const key of Object.keys(state)) {
          for (const p of state[key]) {
            if (p.odisplayId !== myId) {
              names.push(p.odisplayName);
            }
          }
        }
        setOtherUsers([...new Set(names)]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            odisplayName: myName,
            odisplayId: myId,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [projectId, myId, myName]);

  return (
    <AnimatePresence>
      {otherUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent-foreground"
        >
          <Users className="h-4 w-4 shrink-0" />
          <span>
            Également sur ce chantier : <strong>{otherUsers.join(', ')}</strong>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
