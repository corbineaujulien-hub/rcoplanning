import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

export default function ActiveUsersNotification({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [otherUsers, setOtherUsers] = useState<string[]>([]);
  const isMobile = useIsMobile();

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

  if (otherUsers.length === 0) return null;

  const maxVisible = 3;
  const visibleNames = otherUsers.slice(0, maxVisible);
  const remaining = otherUsers.length - maxVisible;

  const content = isMobile ? (
    <span className="text-xs font-medium text-primary-foreground">{otherUsers.length}</span>
  ) : (
    <span className="text-xs text-primary-foreground/90">
      {visibleNames.join(', ')}
      {remaining > 0 && (
        <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-bold text-primary-foreground">
          +{remaining}
        </span>
      )}
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <Users className="h-4 w-4 text-primary-foreground/70 shrink-0" />
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs font-medium mb-1">Utilisateurs connectés :</p>
          {otherUsers.map((name, i) => (
            <p key={i} className="text-xs">{name}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
