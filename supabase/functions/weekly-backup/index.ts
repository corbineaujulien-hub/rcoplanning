// Sauvegarde globale hebdomadaire : génère un ZIP (1 JSON de réimport par chantier)
// et l'envoie par email (pièce jointe, ou lien de téléchargement si trop volumineux).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKUP_RECIPIENT = Deno.env.get("BACKUP_RECIPIENT_EMAIL") ?? "julien.corbineau@rector.fr";
const BACKUP_FROM = Deno.env.get("BACKUP_FROM_EMAIL") ?? "onboarding@resend.dev";
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // ~20 Mo

const CHILD_TABLES = [
  "teams",
  "beam_elements",
  "trucks",
  "plans",
  "forecast_weeks",
  "forecast_slots",
  "forecast_history",
  "adv_status",
  "adv_cautions_custom",
  "adv_relances",
  "adv_historique",
] as const;

function sanitizeName(name: string): string {
  const nom = (name || "chantier")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return nom || "CHANTIER";
}

function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function fetchAll(supabase: any, table: string, projectId: string) {
  const PAGE = 1000;
  let all: any[] = [];
  let page = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("project_id", projectId)
      .order("id", { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    page++;
  }
  return all;
}

/** Même format que l'archivage externe côté application. */
async function generateReimportJSON(supabase: any, project: any) {
  const bundle: Record<string, unknown> = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project,
  };
  for (const table of CHILD_TABLES) {
    bundle[table] = await fetchAll(supabase, table, project.id);
  }
  return bundle;
}

async function buildGlobalBackup() {
  const supabase = createAdminClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("site_name", { ascending: true });
  if (error) throw error;
  const list = projects ?? [];

  const zip = new JSZip();
  const index = {
    version: "1.0",
    backup_date: new Date().toISOString(),
    total_projects: list.length,
    active_projects: list.filter((p: any) => !p.archived).length,
    archived_projects: list.filter((p: any) => p.archived).length,
    projects: [] as { otp: string; name: string; file: string; archived: boolean }[],
  };

  const used = new Set<string>();
  for (const project of list) {
    const data = await generateReimportJSON(supabase, project);
    let fileName = `Reimport_${sanitizeName(project.site_name || project.otp_number)}.json`;
    if (used.has(fileName)) {
      let n = 2;
      while (used.has(fileName.replace(/\.json$/, `_${n}.json`))) n++;
      fileName = fileName.replace(/\.json$/, `_${n}.json`);
    }
    used.add(fileName);
    zip.file(fileName, JSON.stringify(data, null, 2));
    index.projects.push({
      otp: project.otp_number ?? "",
      name: project.site_name ?? "",
      file: fileName,
      archived: !!project.archived,
    });
  }

  zip.file("index.json", JSON.stringify(index, null, 2));
  const zipBuffer: Uint8Array = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  return { zipBuffer, index };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function uploadBackup(fileName: string, zipBuffer: Uint8Array): Promise<string | null> {
  const supabase = createAdminClient();
  const path = `auto/${fileName}`;
  const { error } = await supabase.storage.from("backups").upload(path, zipBuffer, {
    contentType: "application/zip",
    upsert: true,
  });
  if (error) {
    console.error("upload backup failed", error.message);
    return null;
  }
  const { data } = await supabase.storage.from("backups")
    .createSignedUrl(path, 60 * 60 * 24 * 30);
  return data?.signedUrl ?? null;
}

async function sendBackupEmail(zipBuffer: Uint8Array, index: any) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY manquant");

  const date = new Date().toLocaleDateString("fr-FR");
  const fileName = `sauvegarde_RCO_${date.replace(/\//g, "-")}.zip`;
  const tooBig = zipBuffer.length > MAX_ATTACHMENT_BYTES;
  const link = tooBig ? await uploadBackup(fileName, zipBuffer) : null;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1e3a5f">
      <h2 style="color:#1e3a5f">Sauvegarde hebdomadaire RCO Planning</h2>
      <p>Bonjour,</p>
      <p>Veuillez trouver ${tooBig ? "le lien de téléchargement" : "en pièce jointe"} la sauvegarde hebdomadaire automatique de l'outil RCO Planning.</p>
      <ul>
        <li><strong>Date :</strong> ${date}</li>
        <li><strong>Chantiers actifs :</strong> ${index.active_projects}</li>
        <li><strong>Chantiers archivés :</strong> ${index.archived_projects}</li>
        <li><strong>Total :</strong> ${index.total_projects} chantiers</li>
      </ul>
      ${tooBig
        ? link
          ? `<p><a href="${link}">Télécharger ${fileName}</a> (lien valable 30 jours)</p>`
          : `<p style="color:#dc2626">Le fichier est trop volumineux et son stockage a échoué. Utilisez la sauvegarde manuelle depuis l'application.</p>`
        : ""}
      <p>Ce fichier ZIP contient un fichier JSON par chantier permettant une réimportation complète.</p>
      <p style="color:#64748b;font-size:12px">RCO Planning — Sauvegarde automatique</p>
    </div>`;

  const payload: Record<string, unknown> = {
    from: BACKUP_FROM,
    to: [BACKUP_RECIPIENT],
    subject: `Sauvegarde RCO Planning — ${date}`,
    html,
  };
  if (!tooBig) {
    payload.attachments = [{ filename: fileName, content: toBase64(zipBuffer) }];
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
  return { fileName, attached: !tooBig, link };
}

async function runBackup() {
  const { zipBuffer, index } = await buildGlobalBackup();
  const sent = await sendBackupEmail(zipBuffer, index);
  console.log("weekly-backup done", { projects: index.total_projects, bytes: zipBuffer.length, ...sent });
  return { ...sent, index };
}

// Chaque lundi à 2h du matin (UTC)
try {
  Deno.cron("weekly-backup", "0 2 * * 1", async () => {
    try {
      await runBackup();
    } catch (err) {
      console.error("weekly-backup cron failed", err);
    }
  });
} catch (err) {
  console.error("Deno.cron unavailable", err);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const result = await runBackup();
    return new Response(
      JSON.stringify({
        ok: true,
        total_projects: result.index.total_projects,
        file: result.fileName,
        attached: result.attached,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String((err as Error).message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
