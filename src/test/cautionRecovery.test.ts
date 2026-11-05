import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

const recovery = readFileSync('scripts/backfillCautionDates.sql', 'utf8');
const migration = readFileSync('drizzle/migrations/0002_preserve_existing_caution_expiry_during_recovery.sql', 'utf8');
const original = readFileSync('drizzle/migrations/0000_adv_caution_tracking_and_guarantee.sql', 'utf8');
let db: PGlite;
beforeEach(async () => {
 db = new PGlite();
 await db.exec(`CREATE TABLE adv_status(project_id uuid PRIMARY KEY,caution_rg text,garantie_paiement_st text);
 CREATE TABLE adv_cautions_custom(id uuid PRIMARY KEY,project_id uuid,nom text,statut text);
 CREATE TABLE adv_historique(project_id uuid,date timestamptz,description text);
 CREATE TABLE adv_caution_tracking(id uuid DEFAULT gen_random_uuid(),project_id uuid,caution_key text,date_demande date,date_obtention date,date_echeance date,echeance_manuelle boolean DEFAULT false,commentaire text DEFAULT '',updated_at timestamptz,UNIQUE(project_id,caution_key));`);
 await db.exec(migration);
 await db.exec(`CREATE TRIGGER adv_tracking_dates BEFORE INSERT OR UPDATE ON adv_caution_tracking FOR EACH ROW EXECUTE FUNCTION adv_tracking_dates();`);
 await db.exec(original.slice(original.indexOf('CREATE FUNCTION public.adv_sync_caution_transition()')));
 await db.exec(`INSERT INTO adv_status VALUES ('00000000-0000-0000-0000-000000000001','Obtenue','À demander');`);
});
afterEach(async () => { await db.close(); });
const project = '00000000-0000-0000-0000-000000000001';
async function history(description: string, date: string) {
 await db.query('INSERT INTO adv_historique VALUES ($1,$2,$3)', [project,date,description]);
}
async function tracked() { return (await db.query('SELECT date_demande::text,date_obtention::text,date_echeance::text,echeance_manuelle FROM adv_caution_tracking')).rows; }
describe('Caution history recovery', () => {
 it('uses the last matching transition in Paris and is idempotent', async () => {
  await history('Caution RG : À demander → Demandée','2026-09-01T10:00:00Z');
  await history('Caution RG : À demander → Demandée','2026-11-04T23:30:00Z');
  await history('Caution RG : Demandée → Obtenue','2026-11-05T23:30:00Z');
  await history('Garantie SFAC : À demander → Demandée','2026-11-07T10:00:00Z');
  await db.query(recovery);
  expect(await tracked()).toEqual([{date_demande:'2026-11-05',date_obtention:'2026-11-06',date_echeance:'2027-11-06',echeance_manuelle:false}]);
  expect((await db.query(recovery)).rows[0]).toMatchObject({lignes_modifiees:0,demandes_reconstituees:0,obtentions_reconstituees:0,echeances_calculees:0});
 });
 it('does not invent dates without history', async () => {
  await db.query(recovery);
  expect(await tracked()).toEqual([{date_demande:null,date_obtention:null,date_echeance:null,echeance_manuelle:false}]);
 });
 it('fills only obtention without a Demandée transition, including leap-year expiry', async () => {
  await history('Caution RG : À demander → Obtenue','2024-02-29T12:00:00Z');
  await db.query(recovery);
  expect(await tracked()).toEqual([{date_demande:null,date_obtention:'2024-02-29',date_echeance:'2025-02-28',echeance_manuelle:false}]);
 });
 it.each([false,true])('preserves existing dates and expiry with manual flag %s', async (manual) => {
  await db.query(`INSERT INTO adv_caution_tracking(project_id,caution_key,date_demande,date_echeance,echeance_manuelle) VALUES ($1,'caution_rg','2020-01-01','2030-12-31',$2)`,[project,manual]);
  await history('Caution RG : À demander → Demandée','2026-11-05T12:00:00Z');
  await history('Caution RG : Demandée → Obtenue','2026-11-06T12:00:00Z');
  await db.query(recovery);
  expect(await tracked()).toEqual([{date_demande:'2020-01-01',date_obtention:'2026-11-06',date_echeance:'2030-12-31',echeance_manuelle:manual}]);
 });
 it('matches standard ST and quoted custom labels without matching duplicate names', async () => {
  await db.exec(`UPDATE adv_status SET garantie_paiement_st='Obtenue'; DELETE FROM adv_caution_tracking;
  INSERT INTO adv_cautions_custom VALUES ('00000000-0000-0000-0000-000000000002','${project}','RG avenant','Obtenue'),('00000000-0000-0000-0000-000000000003','${project}','Doublon','Obtenue'),('00000000-0000-0000-0000-000000000004','${project}','Doublon','Obtenue');`);
  await history('Garantie de paiement sous-traitant : Demandée → Obtenue','2026-11-05T12:00:00Z');
  await history('Caution "RG avenant" : Demandée → Obtenue','2026-11-05T12:00:00Z');
  await history('Caution "Doublon" : Demandée → Obtenue','2026-11-05T12:00:00Z');
  await db.query(recovery);
  const rows = (await db.query('SELECT caution_key,date_obtention::text FROM adv_caution_tracking ORDER BY caution_key')).rows;
  expect(rows).toContainEqual({caution_key:'garantie_paiement_st',date_obtention:'2026-11-05'});
  expect(rows).toContainEqual({caution_key:'custom:00000000-0000-0000-0000-000000000002',date_obtention:'2026-11-05'});
  expect(rows.filter(r => String(r.caution_key).endsWith('000003') || String(r.caution_key).endsWith('000004')).every(r => r.date_obtention === null)).toBe(true);
 });
 it('automatically fills actual UPDATE transitions for all three caution types without overwriting dates', async () => {
  await db.exec(`UPDATE adv_status SET caution_rg='Demandée',garantie_paiement_st='Demandée';
  INSERT INTO adv_cautions_custom VALUES ('00000000-0000-0000-0000-000000000002','${project}','Test','À demander');
  UPDATE adv_cautions_custom SET statut='Demandée';
  UPDATE adv_status SET caution_rg='Obtenue',garantie_paiement_st='Obtenue';
  UPDATE adv_cautions_custom SET statut='Obtenue';`);
  const result = await db.query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE date_demande=(now() AT TIME ZONE 'Europe/Paris')::date AND date_obtention=(now() AT TIME ZONE 'Europe/Paris')::date AND date_echeance=(date_obtention+interval '1 year')::date)::int AS correct FROM adv_caution_tracking`);
  expect(result.rows[0]).toEqual({total:3,correct:3});
  await db.exec(`UPDATE adv_caution_tracking SET date_demande='2020-01-01',date_obtention='2020-02-01'; UPDATE adv_status SET caution_rg='Demandée'; UPDATE adv_status SET caution_rg='Obtenue';`);
  expect((await db.query(`SELECT date_demande::text,date_obtention::text FROM adv_caution_tracking WHERE caution_key='caution_rg'`)).rows[0]).toEqual({date_demande:'2020-01-01',date_obtention:'2020-02-01'});
 });
});