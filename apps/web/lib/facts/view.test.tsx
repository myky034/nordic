import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {FactCard,type FactRow} from "./view";
it("renders one-to-one evidence with escaped text, dates, source and conflict status",()=>{
 const fact:FactRow={id:"test",document_id:"doc",topic:"test",subject:"test",predicate:"test",value:"<script>bad</script>",unit:null,status:"conflicted",valid_from:null,valid_until:null,reviewed_at:null,evidence:{source_url:"https://example.com/",excerpt:"Test excerpt",retrieved_at:"2026-09-19T00:00:00Z"},documents:{title:null,sources:{name:"Test source",source_tier:null}}};
 const html=renderToStaticMarkup(<FactCard fact={fact}/>);
 for(const value of ["Test source","Test excerpt","2026-09-19","Có mâu thuẫn","chưa được xác minh","&lt;script&gt;"]) expect(html).toContain(value);
 expect(html).not.toContain("<script>");
});
it("keeps a fact whose source page changed visible, with a warning and a link to the new version",()=>{
 const fact:FactRow={id:"test",document_id:"doc",topic:"test",subject:"test",predicate:"test",value:"1",unit:null,status:"reviewed",valid_from:null,valid_until:null,reviewed_at:null,source_changed_at:"2026-09-25T00:00:00Z",source_changed_document_id:"newdoc",evidence:{source_url:"https://example.com/",excerpt:"Test excerpt",retrieved_at:"2026-09-19T00:00:00Z"},documents:{title:null,sources:{name:"Test source",source_tier:"T1"}}};
 const html=renderToStaticMarkup(<FactCard fact={fact}/>);
 for(const value of ["Trang nguồn đã thay đổi từ 2026-09-25","/documents/newdoc","Test excerpt"]) expect(html).toContain(value);
});
