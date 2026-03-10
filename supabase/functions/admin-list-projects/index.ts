import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");

    if (!adminPassword || password !== adminPassword) {
      return new Response(
        JSON.stringify({ error: "Mot de passe incorrect" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select("id, site_name, client_name, created_at")
      .order("created_at", { ascending: false });

    if (pErr) throw pErr;

    const { data: links, error: lErr } = await supabase
      .from("project_access_links")
      .select("project_id, role, token");

    if (lErr) throw lErr;

    const result = (projects || []).map((p: any) => {
      const projectLinks = (links || []).filter((l: any) => l.project_id === p.id);
      return {
        ...p,
        links: {
          admin: projectLinks.find((l: any) => l.role === "admin")?.token || null,
          editor: projectLinks.find((l: any) => l.role === "editor")?.token || null,
          viewer: projectLinks.find((l: any) => l.role === "viewer")?.token || null,
        },
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
