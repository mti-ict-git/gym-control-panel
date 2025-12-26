import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function tcpReachable(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Deno TCP connect with abort support via closing after timeout
    const conn = await Deno.connect({ hostname: host, port });
    try {
      // Send no data; if connect succeeded, it's reachable
      conn.close();
    } catch (_) {
      // ignore
    }
    return true;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const host = String(body.host || "").trim();
    const port = Number(body.port || 0);

    if (!host || !port) {
      return new Response(JSON.stringify({ error: "host and port are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reachable = await tcpReachable(host, port);
    return new Response(JSON.stringify({ reachable }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

