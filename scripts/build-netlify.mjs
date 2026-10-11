import { cpSync, existsSync, mkdirSync, mkdtempSync, symlinkSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const project = process.cwd();
const target = process.env.KK_NETLIFY_TARGET || "both";
if (!["storefront", "admin", "both"].includes(target)) {
  throw new Error("KK_NETLIFY_TARGET must be storefront, admin or both.");
}
const output = resolve(project, target === "admin" ? "netlify-admin-dist" : "netlify-dist");
const includeAdministration = target !== "storefront";
// Build in an isolated copy. Never move or remove the backend source routes.
if (existsSync(resolve(project, ".netlify-build-hold"))) {
  throw new Error("A previous build left .netlify-build-hold. Restore and compare those files before building.");
}
const stage = mkdtempSync(resolve(project, ".netlify-stage-"));
try {
  for (const name of ["app", "components", "lib", "hooks", "public", "db", "vendor", "build", "package.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs", "cloudflare-env.d.ts"]) {
    if (existsSync(resolve(project, name))) cpSync(resolve(project, name), resolve(stage, name), { recursive: true });
  }
  for (const route of ["api", "request"]) rmSync(resolve(stage, "app", route), { recursive: true, force: true });
  symlinkSync(resolve(project, "node_modules"), resolve(stage, "node_modules"), "dir");
  const result = spawnSync(process.execPath, [resolve(project, "node_modules/next/dist/bin/next"), "build", "--webpack"], {
    cwd: stage, stdio: "inherit", env: {
      ...process.env,
      ...(target === "admin" ? { NEXT_PUBLIC_KK_STOREFRONT_URL: process.env.NEXT_PUBLIC_KK_STOREFRONT_URL || "https://adela-purchasing-agent-shop.netlify.app" } : {}),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Next build failed with status ${result.status ?? 1}`);

  const storefront = resolve(stage, ".next/server/app/index.html");
  const administration = resolve(stage, ".next/server/app/admin.html");
  if (!existsSync(storefront) || (includeAdministration && !existsSync(administration))) {
    throw new Error("Netlify static entry pages were not generated.");
  }

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(resolve(project, "public"), output, { recursive: true });
  cpSync(resolve(stage, ".next/static"), resolve(output, "_next/static"), { recursive: true });
  cpSync(target === "admin" ? administration : storefront, resolve(output, "index.html"));
  if (includeAdministration) {
    mkdirSync(resolve(output, "admin"), { recursive: true });
    cpSync(administration, resolve(output, "admin/index.html"));
  } else {
    const notFound = resolve(stage, ".next/server/app/_not-found.html");
    if (!existsSync(notFound)) throw new Error("Netlify 404 page was not generated.");
    cpSync(notFound, resolve(output, "404.html"));
  }
  writeFileSync(resolve(output, "_redirects"), [
    "/api/* /.netlify/functions/kk-proxy 200",
    "/request/* /.netlify/functions/kk-proxy 200",
    ...(includeAdministration ? [
      "/admin /admin/index.html 200",
      "/admin/* /admin/index.html 200",
    ] : [
      "/admin /404.html 404!",
      "/admin/* /404.html 404!",
    ]),
    ...(target === "admin" ? ["/ /admin/index.html 200", "/* /admin/index.html 200"] : ["/* /index.html 200"]),
    "",
  ].join("\n"));
} finally {
  rmSync(stage, { recursive: true, force: true });
}
