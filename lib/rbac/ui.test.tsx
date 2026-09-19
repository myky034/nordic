import { renderToStaticMarkup } from "react-dom/server";
import { expect,it,vi } from "vitest";
vi.mock("@/app/(app)/admin/access/actions",()=>({saveRole:async()=>({}),assignRole:async()=>({})}));
vi.mock("@/app/(app)/documents/import/actions",()=>({importDocument:async()=>({})}));
import { RoleForm,AssignmentForm } from "@/app/(app)/admin/access/forms";
import { ImportForm } from "@/app/(app)/documents/import/form";
it("shows configuration controls and prevents self-assignment in the UI",()=>{
  const html=renderToStaticMarkup(<RoleForm permissions={[{key:"documents.ingest",description:"Import"}]} own={["documents.ingest"]}/>);
  expect(html).toContain('type="checkbox"');expect(html).toContain("Lưu vai trò");
  const self=renderToStaticMarkup(<AssignmentForm user="id" roles={[]} own={[]} current={[]} self/>);
  expect(self).toContain("quản trị viên khác");expect(self).not.toContain("Áp dụng");
});
it("provides a preview action and keeps the source file out of submitted fields",()=>{
  const html=renderToStaticMarkup(<ImportForm sources={[{id:"id",name:"Synthetic fixture",url:"https://example.com/",blocked:false}]}/>);
  expect(html).toContain("Xem trước");expect(html).toContain('type="file"');
  expect(html).not.toContain('name="sourceFile"');expect(html).not.toContain("INGESTION_API_TOKEN");
});
