// Verifies the single-file build opens from file:// and that no source file is swallowed by .gitignore.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const problems = [];
const file = "dist/index.html";
if (!existsSync(file)) {
  console.error("dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}
const html = readFileSync(file, "utf8");
const scriptSrc = html.match(/<script[^>]*\ssrc=/gi) ?? [];
const cssLinks = html.match(/<link[^>]*rel=["']?stylesheet[^>]*>/gi) ?? [];
const modulePreload = html.match(/<link[^>]*rel=["']?modulepreload/gi) ?? [];
const external = scriptSrc.length + cssLinks.length + modulePreload.length;
if (external > 0) problems.push(`${external} external script/stylesheet references found`);
if (!/<script[^>]*type="module"[^>]*>/.test(html)) problems.push("no inline module script found");
if (!html.includes("연습용 데모") && !html.includes("practice")) problems.push("practice (mock) banner text is missing");

// Anything under these folders must not be ignored by git.
let ignored = "";
let gitChecked = false;
try {
  ignored = execFileSync("git", ["ls-files", "--others", "--ignored", "--exclude-standard", "src", "test", "fixtures", "examples", "scripts", "tools"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  gitChecked = true;
} catch {
  /* not a git checkout (for example an npm tarball): nothing to verify */
}
if (ignored.trim()) problems.push(`ignored by .gitignore:\n${ignored}`);

if (problems.length) {
  console.error("static check failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`static ok: single file, ${external} external refs; ${gitChecked ? "gitignore ok" : "gitignore check skipped (not a git checkout)"}`);
