import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface ForecastSnapshotWeek { year: number; weekNumber: number; }
export interface ForecastSnapshot {
  id: string;
  projectId: string;
  snapshotDate: string;
  weeks: ForecastSnapshotWeek[];
  userEmail: string;
  isInitial: boolean;
}

function normalizeWeeks(weeks: ForecastSnapshotWeek[]): string {
  return weeks
    .map(w => `${w.year}-${w.weekNumber}`)
    .sort()
    .join(',');
}

function normalizeWeekRows(raw: any): ForecastSnapshotWeek[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w: any) => ({
      year: Number(w?.year),
      weekNumber: Number(w?.weekNumber ?? w?.week_number),
    }))
    .filter(w => Number.isFinite(w.year) && Number.isFinite(w.weekNumber));
}

export function useForecastHistory(projectId: string, currentWeeks: ForecastSnapshotWeek[], ready: boolean) {
  const { user } = useAuth();
  const [history, setHistory] = useState<ForecastSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Load history
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase.from as any)('forecast_history')
        .select('*')
        .eq('project_id', projectId)
        .order('snapshot_date', { ascending: false });
      if (cancel) return;
      const rows: ForecastSnapshot[] = (data || []).map((r: any) => ({
        id: r.id, projectId: r.project_id, snapshotDate: r.snapshot_date,
        weeks: normalizeWeekRows(r.weeks),
        userEmail: r.user_email || '', isInitial: !!r.is_initial,
      }));
      setHistory(rows);
      if (rows.length > 0) {
        // most recent is index 0
        lastSavedSignatureRef.current = normalizeWeeks(rows[0].weeks);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [projectId]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`forecast_history-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forecast_history', filter: `project_id=eq.${projectId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new as any;
          setHistory(prev => {
            if (prev.some(s => s.id === r.id)) return prev;
            return [{
              id: r.id, projectId: r.project_id, snapshotDate: r.snapshot_date,
              weeks: normalizeWeekRows(r.weeks),
              userEmail: r.user_email || '', isInitial: !!r.is_initial,
            }, ...prev].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
          });
        } else if (payload.eventType === 'DELETE') {
          const r = payload.old as any;
          setHistory(prev => prev.filter(s => s.id !== r.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  const saveSnapshot = useCallback(async (weeks: ForecastSnapshotWeek[], isInitial: boolean) => {
    const sig = normalizeWeeks(weeks);
    if (lastSavedSignatureRef.current === sig) return;
    lastSavedSignatureRef.current = sig;
    const payload = {
      project_id: projectId,
      weeks: weeks.map(w => ({ year: w.year, week_number: w.weekNumber })) as any,
      user_email: user?.email || '',
      is_initial: isInitial,
    };
    await (supabase.from as any)('forecast_history').insert(payload);
  }, [projectId, user]);

  // Debounced auto-save when currentWeeks changes
  useEffect(() => {
    if (!ready || loading) return;

    // Create initial snapshot if none exists yet
    if (history.length === 0 && lastSavedSignatureRef.current === null) {
      saveSnapshot(currentWeeks, true);
      return;
    }

    const sig = normalizeWeeks(currentWeeks);
    if (sig === lastSavedSignatureRef.current) return;

    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      saveSnapshot(currentWeeks, false);
    }, 3000);

    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [currentWeeks, ready, loading, history.length, saveSnapshot]);

  return { history, loading };
}