import { describe, expect, it } from 'vitest';
import { calculateAdvScore, CAUTION_STATUSES, DEMARCHE_OPTIONS, findRelanceRules, getApplicableDemarches, getDefaultAdv, getStatusColor } from '@/utils/adv';
import { automaticExpiry, buildCautionsWorkbook, emptyTracking, excelDateSerial, isOverdue, previewCautionTransition, remapTrackingRows, VISIBLE_CAUTION_STATUSES } from '@/utils/cautionTracking';
import { format } from 'date-fns';

describe('Cautions ADV', () => {
  it.each(['caution_rg', 'garantie_paiement_st', 'custom:123'])('previews request and obtaining dates for %s', key => {
    const requested = previewCautionTransition(emptyTracking('p', key), 'Demandée', '2026-11-06');
    expect(requested.date_demande).toBe('2026-11-06');
    const obtained = previewCautionTransition(requested, 'Obtenue', '2026-11-07');
    expect(obtained).toMatchObject({ date_demande: '2026-11-06', date_obtention: '2026-11-07', date_echeance: '2027-11-07' });
  });
  it.each(['À demander', 'Non nécessaire'])('clears dates and manual expiry on %s', status => {
    expect(previewCautionTransition({ ...emptyTracking('p', 'caution_rg'), date_demande: '2026-10-01', date_obtention: '2026-10-02', date_echeance: '2028-01-01', echeance_manuelle: true }, status))
      .toMatchObject({ date_demande: null, date_obtention: null, date_echeance: null, echeance_manuelle: false });
  });
  it('preserves Levée dates and resets obtaining on a new request', () => {
    const row = { ...emptyTracking('p', 'caution_rg'), date_demande: '2026-10-01', date_obtention: '2026-10-02', date_echeance: '2028-01-01', echeance_manuelle: true };
    expect(previewCautionTransition(row, 'Levée')).toEqual(row);
    expect(previewCautionTransition(row, 'Demandée', '2026-11-06')).toMatchObject({ date_demande: '2026-10-01', date_obtention: null, date_echeance: null, echeance_manuelle: false });
    expect(previewCautionTransition(row, 'Obtenue')).toEqual(row);
  });
  it('initializes standard guarantee as À demander', () => expect(getDefaultAdv(false).garantie_paiement_st).toBe('À demander'));
  it('excludes supply-only guarantee by default', () => expect(getDefaultAdv(true).garantie_paiement_st).toBe('Non nécessaire'));
  it('limits Levée to the three caution types', () => {
    expect(CAUTION_STATUSES).toEqual(['Non nécessaire', 'À demander', 'Demandée', 'Obtenue', 'Levée']);
    expect(DEMARCHE_OPTIONS.garantie_paiement_st).toEqual(CAUTION_STATUSES);
    expect(DEMARCHE_OPTIONS.contrat_client).not.toContain('Levée');
    expect(getStatusColor('Levée')).toBe('green');
  });
  it('includes guarantee in score and pending actions', () => {
    const a = { ...getDefaultAdv(false), compte_client: 'Ouvert', garantie_sfac: 'Accord obtenu', contrat_client: 'Signé', caution_rg: 'Levée', contrat_st: 'Contrat signé', dast: 'Acceptée' };
    expect(calculateAdvScore(a)).toBe(86);
    expect(getApplicableDemarches(a).find(d => d.key === 'garantie_paiement_st')?.status).toBe('À demander');
    expect(calculateAdvScore({ ...a, garantie_paiement_st: 'Levée' }, [{ statut: 'Levée' }])).toBe(100);
  });
  it('creates guarantee reminder at J+7 only when Demandée', () => {
    expect(format(findRelanceRules('garantie_paiement_st', 'Demandée')[0].computeEcheance(new Date(2026, 10, 5), null) as Date, 'yyyy-MM-dd')).toBe('2026-11-12');
    expect(findRelanceRules('garantie_paiement_st', 'Levée')).toHaveLength(0);
  });
  it('shows only open cautions', () => expect(VISIBLE_CAUTION_STATUSES).toEqual(['À demander', 'Demandée', 'Obtenue']));
  it('does not invent historic dates', () => expect(emptyTracking('p', 'caution_rg').date_obtention).toBeNull());
  it('calculates one year including leap years', () => { expect(automaticExpiry('2026-11-05')).toBe('2027-11-05'); expect(automaticExpiry('2024-02-29')).toBe('2025-02-28'); });
  it('marks overdue strictly before today', () => { expect(isOverdue('2026-11-04', '2026-11-05')).toBe(true); expect(isOverdue('2026-11-05', '2026-11-05')).toBe(false); });
  it('remaps custom caution keys without losing dates', () => {
    expect(remapTrackingRows([{ ...emptyTracking('old', 'custom:oldc'), date_obtention: '2026-11-05', date_echeance: '2028-01-01', echeance_manuelle: true }], 'new', new Map([['oldc', 'newc']]))[0]).toMatchObject({ project_id: 'new', caution_key: 'custom:newc', date_echeance: '2028-01-01', echeance_manuelle: true });
    expect(remapTrackingRows([], 'new', new Map())).toEqual([]);
  });
  it('exports numeric dates with correct serial and archive flag', () => {
    expect(excelDateSerial('2026-11-05')).toBe(46331);
    const wb = buildCautionsWorkbook([{ ...emptyTracking('p', 'caution_rg'), chantier: 'Test', caution: 'RG', statut: 'Obtenue', archived: true, date_echeance: '2020-03-29' }]);
    const ws = wb.Sheets['Suivi des cautions'];
    expect(ws.F2.t).toBe('n'); expect(ws.F2.z).toBe('DD/MM/YYYY'); expect(ws.F2.s.font.color.rgb).toBe('DC2626'); expect(ws.H2.v).toBe('Oui'); expect(ws['!autofilter']?.ref).toBe('A1:H2');
  });
});