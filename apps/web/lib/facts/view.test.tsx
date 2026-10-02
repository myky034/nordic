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
it("labels AI proposals with the model and its self-reported confidence, and keeps the AI origin after review — for editors",()=>{
 const base={id:"t",document_id:"doc",topic:"immigration",subject:"s",predicate:"p",value:"1",unit:null,valid_from:null,valid_until:null,reviewed_at:null,origin:"ai",ai_model:"synthetic-model",ai_confidence:"0.85",evidence:{source_url:"https://example.com/",excerpt:"e",retrieved_at:"2026-09-19T00:00:00Z"},documents:{title:null,sources:{name:"S",source_tier:"T1"}}};
 const proposed=renderToStaticMarkup(<FactCard fact={{...base,status:"proposed"}} internal/>);
 for(const v of ["Đề xuất bởi AI · synthetic-model","mô hình tự đánh giá 85%"]) expect(proposed).toContain(v);
 const reviewed=renderToStaticMarkup(<FactCard fact={{...base,status:"reviewed"}} internal/>);
 for(const v of ["Trích bởi AI, đã qua người duyệt","Đã duyệt bằng chứng"]) expect(reviewed).toContain(v);
 expect(reviewed).not.toContain("tự đánh giá");
 // Visitors (owner decision 2026-10-02): no AI origin, model or "reviewed" badge,
 // but a conflict and the source, dates and validity stay.
 const pub=renderToStaticMarkup(<FactCard fact={{...base,status:"reviewed"}}/>);
 for(const v of ["synthetic-model","Trích bởi AI","Đã duyệt bằng chứng"]) expect(pub).not.toContain(v);
 // Compact card: source link, retrieval date and validity on one visible line; evidence folded.
 for(const v of ['href="https://example.com/"',"lấy trang 2026-09-19","hiệu lực hiện tại chưa xác minh","<details","Xem bằng chứng","Mở trang gốc"]) expect(pub).toContain(v);
 expect(renderToStaticMarkup(<FactCard fact={{...base,status:"conflicted"}}/>)).toContain("Có mâu thuẫn");
});
