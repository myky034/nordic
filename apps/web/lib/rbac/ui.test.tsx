import { renderToStaticMarkup } from "react-dom/server";
import { expect,it,vi } from "vitest";
vi.mock("@/app/(app)/admin/access/actions",()=>({saveRole:async()=>({}),assignRole:async()=>({})}));
vi.mock("@/app/(app)/documents/import/actions",()=>({importDocument:async()=>({})}));
import { RoleForm,UserRoles } from "@/app/(app)/admin/access/forms";
import { ImportForm } from "@/app/(app)/documents/import/form";
const role=(id:string,name:string,keys:string[])=>({id,name,description:"",role_permissions:keys.map(permission_key=>({permission_key}))});
it("shows configuration controls with readable permission names and prevents self-assignment in the UI",()=>{
  const html=renderToStaticMarkup(<RoleForm permissions={[{key:"documents.ingest",description:"Import"},{key:"roles.manage",description:"Roles"}]} own={["documents.ingest"]}/>);
  expect(html).toContain('type="checkbox"');expect(html).toContain("Tạo vai trò");
  expect(html).toContain("Nhập tài liệu");expect(html).toContain("documents.ingest");
  // A permission the editor does not hold cannot be granted from the form.
  expect(html).toMatch(/value="roles.manage"[^>]*disabled|disabled[^>]*value="roles.manage"/);
  const self=renderToStaticMarkup(<UserRoles user="id" roles={[role("r1","Editor",["documents.ingest"])]} own={["documents.ingest"]} current={["r1"]} self/>);
  expect(self).toContain("quản trị viên khác");expect(self).toContain("Editor");
  expect(self).not.toContain(">Gỡ<");expect(self).not.toContain("Thêm vai trò");
});
it("lists assigned roles with an explicit remove button and offers only grantable, unassigned roles to add",()=>{
  const html=renderToStaticMarkup(<UserRoles user="u" own={["documents.ingest"]} self={false} current={["r1"]}
    roles={[role("r1","Editor",["documents.ingest"]),role("r2","Importer",["documents.ingest"]),role("r3","Admin",["roles.manage"])]}/>);
  expect(html).toContain(">Gỡ<");
  expect(html).toMatch(/name="grant" value="no"/);expect(html).toMatch(/name="grant" value="yes"/);
  expect(html).toContain("Importer (1 quyền)");expect(html).not.toContain("Admin (");
});
it("provides a preview action and keeps the source file out of submitted fields",()=>{
  const html=renderToStaticMarkup(<ImportForm sources={[{id:"id",name:"Synthetic fixture",url:"https://example.com/",blocked:false}]} locale="vi"/>);
  expect(html).toContain("Xem trước");expect(html).toContain('type="file"');
  expect(html).not.toContain('name="sourceFile"');expect(html).not.toContain("INGESTION_API_TOKEN");
});
