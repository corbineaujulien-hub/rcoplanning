/** Same-tab notification complements Realtime; it never persists data. */
export const ADV_CHANGED_EVENT = 'adv-data-changed';
export function notifyAdvChanged(projectId: string) {
  window.dispatchEvent(new CustomEvent(ADV_CHANGED_EVENT, { detail: { projectId } }));
}
export function subscribeAdvChanged(refresh: () => void, projectId?: string) {
  const listener = (event: Event) => {
    const changed = (event as CustomEvent<{ projectId: string }>).detail;
    if (!projectId || changed?.projectId === projectId) refresh();
  };
  window.addEventListener(ADV_CHANGED_EVENT, listener);
  return () => window.removeEventListener(ADV_CHANGED_EVENT, listener);
}