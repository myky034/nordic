import { expect, it } from "vitest";
import { textHash } from "@nordic/db/document-hash";
import { extractPage } from "./extract";

const html = `<html><head><title> Permit for studies – Agency </title><script>var token="abc123"</script></head>
<body><header>Menu</header><nav>Links</nav><main><h1>Permit</h1><p>You must be   admitted.</p><ul><li>Rule one</li><li>Rule two</li></ul>
<form><button>Search</button></form></main><footer>Footer</footer></body></html>`;

it("keeps the main content as lines and drops navigation, scripts and forms", () => {
  const page = extractPage(html);
  expect(page.title).toBe("Permit for studies – Agency");
  expect(page.text).toBe("Permit\nYou must be admitted.\nRule one\nRule two");
});
it("honours a registered CSS selector and falls back when it matches nothing", () => {
  expect(extractPage(html, "ul").text).toBe("Rule one\nRule two");
  expect(extractPage(html, ".missing").text).toContain("You must be admitted.");
});
it("produces a stable hash when only scripts or spacing change", () => {
  const a = extractPage(html).text;
  const b = extractPage(html.replace("abc123", "zzz999").replace("You must be   admitted.", "You must be admitted.")).text;
  expect(textHash(a)).toBe(textHash(b));
  expect(textHash(a)).not.toBe(textHash(a + "\nNew rule"));
});
