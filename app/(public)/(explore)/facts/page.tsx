import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { logAccessError } from "@/lib/rbac/access";
export default async function Page() {
 const client=await createClient();
 // Explicit public statuses even for editors: the public page never shows drafts.
 const {data,error}=await client.from("facts").select(factSelect).in("status",["reviewed","conflicted"]).order("created_at",{ascending:false}).limit(100);
 if(error){logAccessError("public_facts");throw new Error("Không tải được thông tin.");}
 return <div className="space-y-6"><h1 className="text-3xl font-semibold">Thông tin có bằng chứng</h1><p>100 thông tin gần nhất. Luôn kiểm tra nguồn và hiệu lực; mâu thuẫn chưa được tự động giải quyết.</p><Link href="/facts/workspace" className="inline-block underline">Biên tập thông tin</Link>{!data.length&&<p>Chưa có thông tin được công bố.</p>}{(data as unknown as FactRow[]).map(f=><FactCard key={f.id} fact={f}/>)}</div>;
}
