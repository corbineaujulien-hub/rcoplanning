import { describe, expect, it, vi } from 'vitest';
import { DESIGN_MANAGERS, DEFAULT_PROJECT_INFO } from '@/types/delivery';
import { getDisplayCDT, getDisplayPoseur, getFilterCDT, getProjectInfoDisplayCDT, matchesDesignManagerFilter, retainAvailableDesignManagers, UNASSIGNED_CDE } from '@/utils/supplyOnly';
import XLSX from 'xlsx-js-style';
import { exportWeeklyExcelStyled } from '@/utils/weeklyExcelExport';

describe('Chargé d’études', () => {
  it('propose les cinq personnes demandées et une affectation initiale nulle', () => {
    expect(DESIGN_MANAGERS).toEqual(['Bruno BARDET', 'Mickael CHAMORET', 'Gael CHEVALIER', 'Taoufik ELKHATTABI', 'Samuel LALLOUE']);
    expect(DEFAULT_PROJECT_INFO.designManager).toBeNull();
  });
  it('affiche le chargé d’études uniquement en fourniture seule', () => {
    const project = { supply_only: true, design_manager: 'Bruno BARDET', client_name: 'GSE', conductor: 'Samuel BOUTIN – 06 00 00 00 00' };
    expect(getDisplayCDT(project)).toBe('Bruno BARDET');
    expect(getDisplayCDT({ ...project, supply_only: false })).toBe('Samuel BOUTIN');
    expect(getDisplayPoseur(project)).toBe('Fourniture seule');
    expect(getFilterCDT(project)).toBe('Fourniture seule');
  });
  it('se replie sur le client puis sur le libellé non renseigné', () => {
    expect(getDisplayCDT({ supply_only: true, design_manager: null, client_name: 'GSE' })).toBe('GSE');
    expect(getDisplayCDT({ supply_only: true })).toBe('Client non renseigné');
    expect(getProjectInfoDisplayCDT({ ...DEFAULT_PROJECT_INFO, supplyOnly: true, designManager: 'Gael CHEVALIER' })).toBe('Gael CHEVALIER');
  });
  it('filtre les affectations et les chantiers sans CDE, tous inclus par défaut', () => {
    const p = { design_manager: 'Bruno BARDET' };
    expect(matchesDesignManagerFilter(p, new Set())).toBe(true);
    expect(matchesDesignManagerFilter(p, new Set(['Bruno BARDET']))).toBe(true);
    expect(matchesDesignManagerFilter(p, new Set(['Samuel LALLOUE']))).toBe(false);
    expect(matchesDesignManagerFilter({ design_manager: null }, new Set([UNASSIGNED_CDE]))).toBe(true);
  });
  const filterProjects = [
    { id: 'bruno', design_manager: 'Bruno BARDET', business_manager: 'Romain BERTEL' },
    { id: 'samuel', design_manager: 'Samuel LALLOUE', business_manager: 'Yoan BONNAIRE' },
    { id: 'sans-cde', design_manager: null, business_manager: 'Romain BERTEL' },
  ];
  it('inclut tous les chantiers sans sélection initiale et après désélection complète', () => {
    const selected = new Set(['Bruno BARDET']);
    selected.delete('Bruno BARDET');
    expect(selected.size).toBe(0);
    expect(filterProjects.filter(p => matchesDesignManagerFilter(p, selected)).map(p => p.id)).toEqual(['bruno', 'samuel', 'sans-cde']);
  });
  it('combine les noms sélectionnés en OR', () => {
    expect(filterProjects.filter(p => matchesDesignManagerFilter(p, new Set(['Bruno BARDET', 'Samuel LALLOUE']))).map(p => p.id)).toEqual(['bruno', 'samuel']);
  });
  it('sélectionne uniquement les chantiers sans affectation via CDE à désigner', () => {
    expect(filterProjects.filter(p => matchesDesignManagerFilter(p, new Set(['CDE à désigner']))).map(p => p.id)).toEqual(['sans-cde']);
  });
  it('reste cumulatif avec le chargé d’affaires', () => {
    expect(filterProjects.filter(p => p.business_manager === 'Romain BERTEL' && matchesDesignManagerFilter(p, new Set(['Samuel LALLOUE', 'CDE à désigner']))).map(p => p.id)).toEqual(['sans-cde']);
  });
  it('décoche les sélections indisponibles et conserve les autres', () => {
    expect([...retainAvailableDesignManagers(new Set(['Bruno BARDET', 'Samuel LALLOUE']), ['Bruno BARDET'])]).toEqual(['Bruno BARDET']);
  });
  it('réactive tous les chantiers quand la dernière sélection devient indisponible', () => {
    const selected = retainAvailableDesignManagers(new Set(['Samuel LALLOUE']), ['Bruno BARDET', 'CDE à désigner']);
    expect(selected.size).toBe(0);
    expect(filterProjects.filter(p => matchesDesignManagerFilter(p, selected))).toHaveLength(3);
  });
  it('transmet le CDE et Fourniture seule aux onglets Excel multi-semaines et multi-équipes', () => {
    const write = vi.spyOn(XLSX, 'write').mockReturnValue(new ArrayBuffer(0));
    const projectInfo = { ...DEFAULT_PROJECT_INFO, supplyOnly: true, designManager: 'Bruno BARDET', clientName: 'GSE', conductor: 'Ancien CDT' };
    exportWeeklyExcelStyled({
      selectedWeeks: [{ year: 2026, weekNumber: 45 }, { year: 2026, weekNumber: 46 }],
      allowedTrucks: [{ id: 't1', number: '1', date: '2026-11-02', time: '08:00', elementIds: [], teamId: 'a' }, { id: 't2', number: '2', date: '2026-11-09', time: '08:00', elementIds: [], teamId: 'b' }],
      teams: [{ id: 'a', projectId: 'p', name: 'Équipe 1', sortOrder: 0 }, { id: 'b', projectId: 'p', name: 'Équipe 2', sortOrder: 1 }],
      projectInfo, getTruckElements: () => [], mode: 'all', asBlob: true,
    });
    const workbook = write.mock.calls[0]?.[0];
    expect(workbook?.SheetNames.length).toBe(2);
    for (const name of workbook?.SheetNames || []) {
      const header = workbook?.Sheets[name].A2.v;
      expect(header).toContain('Conducteur: Bruno BARDET');
      expect(header).toContain('Poseur: Fourniture seule');
      expect(header).not.toContain('Ancien CDT');
    }
    write.mockRestore();
  });
});