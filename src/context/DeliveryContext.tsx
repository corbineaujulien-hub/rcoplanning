import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ProjectInfo, BeamElement, Truck, Plan, Team, DEFAULT_PROJECT_INFO } from '@/types/delivery';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeliveryContextType {
  projectInfo: ProjectInfo;
  elements: BeamElement[];
  trucks: Truck[];
  plans: Plan[];
  teams: Team[];
  projectId: string;
  loading: boolean;
  setProjectInfo: (info: ProjectInfo) => void;
  setElements: (elements: BeamElement[]) => void;
  addElements: (elements: BeamElement[]) => void;
  updateElement: (id: string, updates: Partial<BeamElement>) => void;
  deleteElement: (id: string) => void;
  addTruck: (truck: Truck) => void;
  updateTruck: (id: string, updates: Partial<Truck>) => void;
  deleteTruck: (id: string) => void;
  deleteAllTrucks: () => void;
  addElementsToTruck: (truckId: string, elementIds: string[]) => void;
  removeElementFromTruck: (truckId: string, elementId: string) => void;
  getElementById: (id: string) => BeamElement | undefined;
  getTruckElements: (truckId: string) => BeamElement[];
  getUnassignedElements: () => BeamElement[];
  isElementAssigned: (elementId: string) => boolean;
  getTrucksForDate: (date: string) => Truck[];
  addPlan: (plan: Plan) => void;
  updatePlan: (id: string, updates: Partial<Plan>) => void;
  deletePlan: (id: string) => void;
  addTeam: (team: Team) => void;
  updateTeam: (id: string, updates: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
}

const DeliveryContext = createContext<DeliveryContextType | null>(null);

interface DeliveryProviderProps {
  children: React.ReactNode;
  projectId: string;
  token: string;
}

export function DeliveryProvider({ children, projectId, token }: DeliveryProviderProps) {
  const [projectInfo, setProjectInfoState] = useState<ProjectInfo>(DEFAULT_PROJECT_INFO);
  const [elements, setElementsState] = useState<BeamElement[]>([]);
  const [trucks, setTrucksState] = useState<Truck[]>([]);
  const [plans, setPlansState] = useState<Plan[]>([]);
  const [teams, setTeamsState] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (proj) {
          setProjectInfoState({
            otpNumber: proj.otp_number || '', siteName: proj.site_name || '',
            clientName: proj.client_name || '', siteAddress: proj.site_address || '',
            conductor: proj.conductor || '', subcontractor: proj.subcontractor || '',
            contactName: proj.contact_name || '', contactPhone: proj.contact_phone || '',
            showSaturdays: proj.show_saturdays || false,
          });
        }

        // Paginated fetch to support up to 5000 elements
        const PAGE_SIZE = 1000;
        let allElems: any[] = [];
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: batch } = await supabase.from('beam_elements').select('*').eq('project_id', projectId).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
          if (!batch || batch.length === 0) { hasMore = false; } else {
            allElems = [...allElems, ...batch];
            page++;
            if (allElems.length >= 5000) hasMore = false;
          }
        }
        if (allElems.length > 0) {
          setElementsState(allElems.map(e => ({
            id: e.id, repere: e.repere || '', zone: e.zone || '', productType: e.product_type || '',
            section: e.section || '', length: Number(e.length) || 0, weight: Number(e.weight) || 0, factory: e.factory || '',
          })));
        }

        const { data: trks } = await supabase.from('trucks').select('*').eq('project_id', projectId);
        if (trks) {
          setTrucksState(trks.map(t => ({
            id: t.id, number: t.number || '', date: t.date || '', time: t.time || '',
            elementIds: (t.element_ids as string[]) || [], comment: t.comment || '',
            teamId: (t as any).team_id || undefined,
          })));
        }

        const { data: pls } = await supabase.from('plans').select('*').eq('project_id', projectId);
        if (pls) {
          setPlansState(pls.map(p => ({
            id: p.id, name: p.name || '', zones: (p.zones as string[]) || [],
            productTypes: (p.product_types as string[]) || [], detectedReperes: (p.detected_reperes as string[]) || [],
            pdfDataUrl: p.pdf_data_url || '',
          })));
        }

        // Load teams
        const { data: tms } = await supabase.from('teams').select('*').eq('project_id', projectId).order('sort_order');
        let firstTeamId: string;
        if (tms && tms.length > 0) {
          setTeamsState(tms.map(t => ({
            id: t.id, projectId: t.project_id, name: t.name, sortOrder: t.sort_order,
          })));
          firstTeamId = tms[0].id;
        } else {
          // Create default team if none exist
          const defaultTeam: Team = { id: crypto.randomUUID(), projectId, name: 'Équipe 1', sortOrder: 0 };
          await supabase.from('teams').insert({
            id: defaultTeam.id, project_id: projectId, name: defaultTeam.name, sort_order: 0,
          });
          setTeamsState([defaultTeam]);
          firstTeamId = defaultTeam.id;
        }

        // Auto-assign unassigned trucks to first team
        if (trks) {
          const unassigned = trks.filter(t => !t.team_id);
          if (unassigned.length > 0) {
            for (const t of unassigned) {
              await supabase.from('trucks').update({ team_id: firstTeamId }).eq('id', t.id);
            }
            setTrucksState(prev => prev.map(t => t.teamId ? t : { ...t, teamId: firstTeamId }));
          }
        }
      } catch (err: any) {
        toast.error('Erreur de chargement : ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const p = payload.new as any;
          setProjectInfoState({
            otpNumber: p.otp_number || '', siteName: p.site_name || '',
            clientName: p.client_name || '', siteAddress: p.site_address || '',
            conductor: p.conductor || '', subcontractor: p.subcontractor || '',
            contactName: p.contact_name || '', contactPhone: p.contact_phone || '',
            showSaturdays: p.show_saturdays || false,
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beam_elements', filter: `project_id=eq.${projectId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const e = payload.new as any;
          setElementsState(prev => {
            if (prev.some(el => el.id === e.id)) return prev;
            return [...prev, { id: e.id, repere: e.repere || '', zone: e.zone || '', productType: e.product_type || '', section: e.section || '', length: Number(e.length) || 0, weight: Number(e.weight) || 0, factory: e.factory || '' }];
          });
        } else if (payload.eventType === 'UPDATE') {
          const e = payload.new as any;
          setElementsState(prev => prev.map(el => el.id === e.id ? { id: e.id, repere: e.repere || '', zone: e.zone || '', productType: e.product_type || '', section: e.section || '', length: Number(e.length) || 0, weight: Number(e.weight) || 0, factory: e.factory || '' } : el));
        } else if (payload.eventType === 'DELETE') {
          const e = payload.old as any;
          setElementsState(prev => prev.filter(el => el.id !== e.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trucks', filter: `project_id=eq.${projectId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const t = payload.new as any;
          setTrucksState(prev => {
            if (prev.some(tr => tr.id === t.id)) return prev;
            return [...prev, { id: t.id, number: t.number || '', date: t.date || '', time: t.time || '', elementIds: (t.element_ids as string[]) || [], comment: t.comment || '', teamId: t.team_id || undefined }];
          });
        } else if (payload.eventType === 'UPDATE') {
          const t = payload.new as any;
          setTrucksState(prev => prev.map(tr => tr.id === t.id ? { id: t.id, number: t.number || '', date: t.date || '', time: t.time || '', elementIds: (t.element_ids as string[]) || [], comment: t.comment || '', teamId: t.team_id || undefined } : tr));
        } else if (payload.eventType === 'DELETE') {
          const t = payload.old as any;
          setTrucksState(prev => prev.filter(tr => tr.id !== t.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans', filter: `project_id=eq.${projectId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const p = payload.new as any;
          setPlansState(prev => {
            if (prev.some(pl => pl.id === p.id)) return prev;
            return [...prev, { id: p.id, name: p.name || '', zones: (p.zones as string[]) || [], productTypes: (p.product_types as string[]) || [], detectedReperes: (p.detected_reperes as string[]) || [], pdfDataUrl: p.pdf_data_url || '' }];
          });
        } else if (payload.eventType === 'UPDATE') {
          const p = payload.new as any;
          setPlansState(prev => prev.map(pl => pl.id === p.id ? { id: p.id, name: p.name || '', zones: (p.zones as string[]) || [], productTypes: (p.product_types as string[]) || [], detectedReperes: (p.detected_reperes as string[]) || [], pdfDataUrl: p.pdf_data_url || '' } : pl));
        } else if (payload.eventType === 'DELETE') {
          const p = payload.old as any;
          setPlansState(prev => prev.filter(pl => pl.id !== p.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `project_id=eq.${projectId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const t = payload.new as any;
          setTeamsState(prev => {
            if (prev.some(tm => tm.id === t.id)) return prev;
            return [...prev, { id: t.id, projectId: t.project_id, name: t.name, sortOrder: t.sort_order }].sort((a, b) => a.sortOrder - b.sortOrder);
          });
        } else if (payload.eventType === 'UPDATE') {
          const t = payload.new as any;
          setTeamsState(prev => prev.map(tm => tm.id === t.id ? { id: t.id, projectId: t.project_id, name: t.name, sortOrder: t.sort_order } : tm).sort((a, b) => a.sortOrder - b.sortOrder));
        } else if (payload.eventType === 'DELETE') {
          const t = payload.old as any;
          setTeamsState(prev => prev.filter(tm => tm.id !== t.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  // --- Mutations ---
  const setProjectInfo = useCallback(async (info: ProjectInfo) => {
    setProjectInfoState(info);
    await supabase.from('projects').update({
      otp_number: info.otpNumber, site_name: info.siteName,
      client_name: info.clientName, site_address: info.siteAddress,
      conductor: info.conductor, subcontractor: info.subcontractor,
      contact_name: info.contactName, contact_phone: info.contactPhone,
      show_saturdays: info.showSaturdays, updated_at: new Date().toISOString(),
    }).eq('id', projectId);
  }, [projectId]);

  const setElements = useCallback(async (newElements: BeamElement[]) => {
    setElementsState(newElements);
    await supabase.from('beam_elements').delete().eq('project_id', projectId);
    if (newElements.length > 0) {
      const rows = newElements.map(e => ({
        id: e.id, project_id: projectId, repere: e.repere, zone: e.zone,
        product_type: e.productType, section: e.section, length: e.length,
        weight: e.weight, factory: e.factory,
      }));
      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await supabase.from('beam_elements').insert(rows.slice(i, i + BATCH_SIZE));
      }
    }
  }, [projectId]);

  const addElements = useCallback(async (newElements: BeamElement[]) => {
    setElementsState(prev => [...prev, ...newElements]);
    await supabase.from('beam_elements').insert(
      newElements.map(e => ({
        id: e.id, project_id: projectId, repere: e.repere, zone: e.zone,
        product_type: e.productType, section: e.section, length: e.length,
        weight: e.weight, factory: e.factory,
      }))
    );
  }, [projectId]);

  const updateElement = useCallback(async (id: string, updates: Partial<BeamElement>) => {
    setElementsState(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    const dbUpdates: any = {};
    if (updates.repere !== undefined) dbUpdates.repere = updates.repere;
    if (updates.zone !== undefined) dbUpdates.zone = updates.zone;
    if (updates.productType !== undefined) dbUpdates.product_type = updates.productType;
    if (updates.section !== undefined) dbUpdates.section = updates.section;
    if (updates.length !== undefined) dbUpdates.length = updates.length;
    if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
    if (updates.factory !== undefined) dbUpdates.factory = updates.factory;
    await supabase.from('beam_elements').update(dbUpdates).eq('id', id);
  }, []);

  const deleteElement = useCallback(async (id: string) => {
    setElementsState(prev => prev.filter(el => el.id !== id));
    setTrucksState(prev => {
      const updated = prev.map(t => ({ ...t, elementIds: t.elementIds.filter(eid => eid !== id) }));
      updated.forEach(t => {
        if (prev.find(pt => pt.id === t.id)?.elementIds.includes(id)) {
          supabase.from('trucks').update({ element_ids: t.elementIds }).eq('id', t.id);
        }
      });
      return updated;
    });
    await supabase.from('beam_elements').delete().eq('id', id);
  }, []);

  const addTruck = useCallback(async (truck: Truck) => {
    setTrucksState(prev => [...prev, truck]);
    await supabase.from('trucks').insert({
      id: truck.id, project_id: projectId, number: truck.number,
      date: truck.date, time: truck.time, element_ids: truck.elementIds,
      comment: truck.comment || '', team_id: truck.teamId || null,
    } as any);
  }, [projectId]);

  const updateTruck = useCallback(async (id: string, updates: Partial<Truck>) => {
    setTrucksState(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const dbUpdates: any = {};
    if (updates.number !== undefined) dbUpdates.number = updates.number;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.time !== undefined) dbUpdates.time = updates.time;
    if (updates.elementIds !== undefined) dbUpdates.element_ids = updates.elementIds;
    if (updates.comment !== undefined) dbUpdates.comment = updates.comment;
    if (updates.teamId !== undefined) dbUpdates.team_id = updates.teamId;
    await supabase.from('trucks').update(dbUpdates).eq('id', id);
  }, []);

  const deleteTruck = useCallback(async (id: string) => {
    setTrucksState(prev => prev.filter(t => t.id !== id));
    await supabase.from('trucks').delete().eq('id', id);
  }, []);

  const deleteAllTrucks = useCallback(async () => {
    setTrucksState([]);
    await supabase.from('trucks').delete().eq('project_id', projectId);
  }, [projectId]);

  const addElementsToTruck = useCallback(async (truckId: string, elementIds: string[]) => {
    let newElementIds: string[] = [];
    setTrucksState(prev => {
      const updated = prev.map(t =>
        t.id === truckId ? { ...t, elementIds: [...new Set([...t.elementIds, ...elementIds])] } : t
      );
      const truck = updated.find(t => t.id === truckId);
      if (truck) newElementIds = truck.elementIds;
      return updated;
    });
    await supabase.from('trucks').update({ element_ids: newElementIds }).eq('id', truckId);
  }, []);

  const removeElementFromTruck = useCallback(async (truckId: string, elementId: string) => {
    let newElementIds: string[] = [];
    setTrucksState(prev => {
      const updated = prev.map(t =>
        t.id === truckId ? { ...t, elementIds: t.elementIds.filter(eid => eid !== elementId) } : t
      );
      const truck = updated.find(t => t.id === truckId);
      if (truck) newElementIds = truck.elementIds;
      return updated;
    });
    await supabase.from('trucks').update({ element_ids: newElementIds }).eq('id', truckId);
  }, []);

  const getElementById = useCallback((id: string) => elements.find(el => el.id === id), [elements]);
  const getTruckElements = useCallback((truckId: string) => {
    const truck = trucks.find(t => t.id === truckId);
    if (!truck) return [];
    return truck.elementIds.map(id => elements.find(el => el.id === id)).filter(Boolean) as BeamElement[];
  }, [trucks, elements]);
  const getUnassignedElements = useCallback(() => {
    const assignedIds = new Set(trucks.flatMap(t => t.elementIds));
    return elements.filter(el => !assignedIds.has(el.id));
  }, [trucks, elements]);
  const isElementAssigned = useCallback((elementId: string) => trucks.some(t => t.elementIds.includes(elementId)), [trucks]);
  const getTrucksForDate = useCallback((date: string) => trucks.filter(t => t.date === date).sort((a, b) => a.time.localeCompare(b.time)), [trucks]);

  const addPlan = useCallback(async (plan: Plan) => {
    setPlansState(prev => [...prev, plan]);
    await supabase.from('plans').insert({
      id: plan.id, project_id: projectId, name: plan.name,
      zones: plan.zones, product_types: plan.productTypes,
      detected_reperes: plan.detectedReperes, pdf_data_url: plan.pdfDataUrl,
    });
  }, [projectId]);

  const updatePlan = useCallback(async (id: string, updates: Partial<Plan>) => {
    setPlansState(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.zones !== undefined) dbUpdates.zones = updates.zones;
    if (updates.productTypes !== undefined) dbUpdates.product_types = updates.productTypes;
    if (updates.detectedReperes !== undefined) dbUpdates.detected_reperes = updates.detectedReperes;
    if (updates.pdfDataUrl !== undefined) dbUpdates.pdf_data_url = updates.pdfDataUrl;
    await supabase.from('plans').update(dbUpdates).eq('id', id);
  }, []);

  const deletePlan = useCallback(async (id: string) => {
    setPlansState(prev => prev.filter(p => p.id !== id));
    await supabase.from('plans').delete().eq('id', id);
  }, []);

  // Team mutations
  const addTeam = useCallback(async (team: Team) => {
    setTeamsState(prev => [...prev, team].sort((a, b) => a.sortOrder - b.sortOrder));
    await supabase.from('teams').insert({
      id: team.id, project_id: projectId, name: team.name, sort_order: team.sortOrder,
    });
  }, [projectId]);

  const updateTeam = useCallback(async (id: string, updates: Partial<Team>) => {
    setTeamsState(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t).sort((a, b) => a.sortOrder - b.sortOrder));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    await supabase.from('teams').update(dbUpdates).eq('id', id);
  }, []);

  const deleteTeam = useCallback(async (id: string) => {
    setTeamsState(prev => prev.filter(t => t.id !== id));
    // Unassign trucks from this team
    setTrucksState(prev => {
      const updated = prev.map(t => t.teamId === id ? { ...t, teamId: undefined } : t);
      updated.filter(t => t.teamId === undefined && prev.find(pt => pt.id === t.id)?.teamId === id)
        .forEach(t => supabase.from('trucks').update({ team_id: null } as any).eq('id', t.id));
      return updated;
    });
    await supabase.from('teams').delete().eq('id', id);
  }, []);

  return (
    <DeliveryContext.Provider value={{
      projectInfo, elements, trucks, plans, teams, projectId, loading,
      setProjectInfo, setElements, addElements, updateElement, deleteElement,
      addTruck, updateTruck, deleteTruck, deleteAllTrucks, addElementsToTruck, removeElementFromTruck,
      getElementById, getTruckElements, getUnassignedElements, isElementAssigned, getTrucksForDate,
      addPlan, updatePlan, deletePlan,
      addTeam, updateTeam, deleteTeam,
    }}>
      {children}
    </DeliveryContext.Provider>
  );
}

export function useDelivery() {
  const ctx = useContext(DeliveryContext);
  if (!ctx) throw new Error('useDelivery must be used within DeliveryProvider');
  return ctx;
}
