import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {FactCard,type FactRow} from "./view";
it("renders one-to-one evidence with escaped text, dates, source and conflict status",()=>{
 const fact:FactRow={id:"test",document_id:"doc",topic:"test",subject:"test",predicate:"test",value:"<script>bad</script>",unit:null,status:"conflicted",valid_from:null,valid_until:null,reviewed_at:null,evidence:{source_url:"https://example.com/",excerpt:"Test excerpt",retrieved_at:"2026-09-19T00:00:00Z"},documents:{title:null,sources:{name:"Test source",source_tier:null}}};
 const html=renderToStaticMarkup(<FactCard fact={fact}/>);
 for(const value of ["Test source","Test excerpt","2026-09-19","Có mâu thuẫn","chưa được xác minh","&lt;script&gt;"]) expect(html).toContain(value);
 expect(html).not.toContain("<script>");
});
