import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdfBase64, zones, productTypes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "No PDF data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es un expert en lecture de plans techniques de construction (béton préfabriqué). 
On te fournit un plan PDF en base64. Tu dois extraire TOUS les numéros de repère (identifiants de pièces) présents sur ce plan.

Les repères sont généralement des codes alphanumériques comme "P1", "PO-01", "L12", "PA-03", "DAP-5", etc. 
Ils identifient des éléments structurels : poteaux, poutres, panneaux, longrines, linteaux, prédales, dalles alvéolaires, etc.

${zones?.length ? `Zones concernées par ce plan : ${zones.join(', ')}` : ''}
${productTypes?.length ? `Types de produits concernés : ${productTypes.join(', ')}` : ''}

IMPORTANT : 
- Extrais UNIQUEMENT les identifiants/repères de pièces, pas les cotes, dimensions ou numéros de page.
- Un repère est un identifiant unique attribué à une pièce préfabriquée.
- Retourne la liste sans doublons.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extrais tous les numéros de repère présents sur ce plan PDF."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_reperes",
              description: "Retourne la liste des repères détectés sur le plan",
              parameters: {
                type: "object",
                properties: {
                  reperes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Liste des numéros de repère détectés (sans doublons)"
                  }
                },
                required: ["reperes"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_reperes" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur lors de l'analyse du PDF" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let reperes: string[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        reperes = args.reperes || [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Deduplicate and clean
    reperes = [...new Set(reperes.map((r: string) => r.trim()).filter(Boolean))];

    return new Response(JSON.stringify({ reperes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-reperes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
