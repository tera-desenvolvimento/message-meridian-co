import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: integ } = await supabaseAdmin
    .from("workspace_integrations")
    .select("api_url, token, workspace_id")
    .eq("provider", "whapi")
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  if (!integ?.token) { console.log("no integ"); return; }
  const { data: convs } = await supabaseAdmin
    .from("conversations")
    .select("id, name, type, external_id")
    .eq("workspace_id", integ.workspace_id)
    .not("external_id", "is", null);

  const apiUrl = integ.api_url.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${integ.token}`, Accept: "application/json" };

  for (const c of convs || []) {
    const isGroup = c.type === "GROUP";
    const digits = c.external_id.split("@")[0].replace(/\D+/g, "");
    const endpoints = isGroup
      ? [`${apiUrl}/groups/${encodeURIComponent(c.external_id)}`]
      : [`${apiUrl}/contacts/${encodeURIComponent(digits)}/profile`, `${apiUrl}/chats/${encodeURIComponent(c.external_id)}`];
    let pic: string | null = null, name: string | null = null;
    for (const url of endpoints) {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) continue;
      const data = await res.json();
      pic = pic || data.profile_pic_full || data.profile_pic || data.chat_pic_full || data.chat_pic || data.icon_full || data.icon || null;
      name = name || data.subject || data.name || data.pushname || data.push_name || null;
      if (pic && name) break;
    }
    console.log(`${c.type} ${c.name.padEnd(25)} → name="${name}" pic=${pic ? "✅" : "❌"}`);
  }
}
main().catch(console.error);
