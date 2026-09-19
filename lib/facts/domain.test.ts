import {expect,it} from "vitest";
import {validity,factError} from "./domain";
it("never treats unknown or in-range validity as verified",()=>{
 const now=new Date("2026-09-19T00:00:00Z");
 expect(validity(null,null,now)).toContain("chưa được xác minh");
 expect(validity("2026-01-01","2026-12-31",now)).toContain("chưa được xác minh");
 expect(validity(null,"2026-01-01",now)).toContain("Đã quá");
 expect(validity("2027-01-01",null,now)).toContain("Chưa đến");
});
it("does not leak raw database errors",()=>{expect(factError("password secret")).not.toContain("secret");});
