import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ProjectInfo, BeamElement, Truck, DEFAULT_PROJECT_INFO } from '@/types/delivery';

interface DeliveryState {
  projectInfo: ProjectInfo;
  elements: BeamElement[];
  trucks: Truck[];
}

interface DeliveryContextType extends DeliveryState {
  setProjectInfo: (info: ProjectInfo) => void;
  setElements: (elements: BeamElement[]) => void;
  addElements: (elements: BeamElement[]) => void;
  updateElement: (id: string, updates: Partial<BeamElement>) => void;
  deleteElement: (id: string) => void;
  addTruck: (truck: Truck) => void;
  updateTruck: (id: string, updates: Partial<Truck>) => void;
  deleteTruck: (id: string) => void;
  addElementsToTruck: (truckId: string, elementIds: string[]) => void;
  removeElementFromTruck: (truckId: string, elementId: string) => void;
  getElementById: (id: string) => BeamElement | undefined;
  getTruckElements: (truckId: string) => BeamElement[];
  getUnassignedElements: () => BeamElement[];
  isElementAssigned: (elementId: string) => boolean;
  getTrucksForDate: (date: string) => Truck[];
}

const STORAGE_KEY = 'rector-delivery-planner';
const defaultState: DeliveryState = { projectInfo: DEFAULT_PROJECT_INFO, elements: [], trucks: [] };

const DeliveryContext = createContext<DeliveryContextType | null>(null);

export function DeliveryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DeliveryState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultState;
    } catch {
      return defaultState;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setProjectInfo = useCallback((projectInfo: ProjectInfo) => {
    setState(s => ({ ...s, projectInfo }));
  }, []);

  const setElements = useCallback((elements: BeamElement[]) => {
    setState(s => ({ ...s, elements }));
  }, []);

  const addElements = useCallback((newElements: BeamElement[]) => {
    setState(s => ({ ...s, elements: [...s.elements, ...newElements] }));
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<BeamElement>) => {
    setState(s => ({
      ...s,
      elements: s.elements.map(el => el.id === id ? { ...el, ...updates } : el),
    }));
  }, []);

  const deleteElement = useCallback((id: string) => {
    setState(s => ({
      ...s,
      elements: s.elements.filter(el => el.id !== id),
      trucks: s.trucks.map(t => ({ ...t, elementIds: t.elementIds.filter(eid => eid !== id) })),
    }));
  }, []);

  const addTruck = useCallback((truck: Truck) => {
    setState(s => ({ ...s, trucks: [...s.trucks, truck] }));
  }, []);

  const updateTruck = useCallback((id: string, updates: Partial<Truck>) => {
    setState(s => ({
      ...s,
      trucks: s.trucks.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  }, []);

  const deleteTruck = useCallback((id: string) => {
    setState(s => ({ ...s, trucks: s.trucks.filter(t => t.id !== id) }));
  }, []);

  const addElementsToTruck = useCallback((truckId: string, elementIds: string[]) => {
    setState(s => ({
      ...s,
      trucks: s.trucks.map(t =>
        t.id === truckId ? { ...t, elementIds: [...new Set([...t.elementIds, ...elementIds])] } : t
      ),
    }));
  }, []);

  const removeElementFromTruck = useCallback((truckId: string, elementId: string) => {
    setState(s => ({
      ...s,
      trucks: s.trucks.map(t =>
        t.id === truckId ? { ...t, elementIds: t.elementIds.filter(eid => eid !== elementId) } : t
      ),
    }));
  }, []);

  const getElementById = useCallback((id: string) => {
    return state.elements.find(el => el.id === id);
  }, [state.elements]);

  const getTruckElements = useCallback((truckId: string) => {
    const truck = state.trucks.find(t => t.id === truckId);
    if (!truck) return [];
    return truck.elementIds.map(id => state.elements.find(el => el.id === id)).filter(Boolean) as BeamElement[];
  }, [state.trucks, state.elements]);

  const getUnassignedElements = useCallback(() => {
    const assignedIds = new Set(state.trucks.flatMap(t => t.elementIds));
    return state.elements.filter(el => !assignedIds.has(el.id));
  }, [state.trucks, state.elements]);

  const isElementAssigned = useCallback((elementId: string) => {
    return state.trucks.some(t => t.elementIds.includes(elementId));
  }, [state.trucks]);

  const getTrucksForDate = useCallback((date: string) => {
    return state.trucks.filter(t => t.date === date).sort((a, b) => a.time.localeCompare(b.time));
  }, [state.trucks]);

  return (
    <DeliveryContext.Provider value={{
      ...state, setProjectInfo, setElements, addElements, updateElement, deleteElement,
      addTruck, updateTruck, deleteTruck, addElementsToTruck, removeElementFromTruck,
      getElementById, getTruckElements, getUnassignedElements, isElementAssigned, getTrucksForDate,
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
