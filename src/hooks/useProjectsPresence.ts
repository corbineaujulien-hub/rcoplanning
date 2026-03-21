import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface PresenceUser {
  odisplayName: string;
  odisplayId: string;
  joinedAt: string;
}

function formatUserName(email: string): string {
  const localPart = email.split('@')[0];
  const parts = localPart.split('.');
  return parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getDisplayName(user: { email?: string | null } | null): string {
  if (!user) return 'Anonyme';
  if (user.email) return formatUserName(user.email);
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

// Returns a map of projectId -> list of other user names currently on that project
export function useProjectsPresence(projectIds: string[]): Map<string, string[]> {
  const { user } = useAuth();
  const [presenceMap, setPresenceMap] = useState<Map<string, string[]>>(new Map());
  const channelsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());
  const myId = user?.id ?? getVisitorId();

  useEffect(() => {
    const currentChannels = channelsRef.current;
    const activeIds = new Set(projectIds);

    // Remove channels for projects no longer in the list
    for (const [pid, ch] of currentChannels) {
      if (!activeIds.has(pid)) {
        ch.untrack();
        supabase.removeChannel(ch);
        currentChannels.delete(pid);
      }
    }

    // Add channels for new projects
    for (const pid of projectIds) {
      if (currentChannels.has(pid)) continue;

      const channel = supabase.channel(`presence:project:${pid}`);
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
          setPresenceMap(prev => {
            const next = new Map(prev);
            next.set(pid, [...new Set(names)]);
            return next;
          });
        })
        .subscribe();

      currentChannels.set(pid, channel);
    }

    return () => {
      for (const [, ch] of currentChannels) {
        ch.untrack();
        supabase.removeChannel(ch);
      }
      currentChannels.clear();
    };
  }, [projectIds.join(','), myId]);

  return presenceMap;
}
