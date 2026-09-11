import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const skipBuild = process.argv.includes("--skip-build");
const packageEntries = ["dist", "komari-theme.json", "preview.png"];
const platformCommand = (command) =>
  process.platform === "win32" && command === "npm" ? "npm.cmd" : command;

const quoteWindowsArg = (value) => {
  const text = String(value);
  if (!/[ \t"]/g.test(text)) return text;
  return `"${text.replace(/(\\*)"/g, "$1$1\\\"").replace(/\\+$/g, "$&$&")}"`;
};

const run = (command, args, options = {}) => {
  const isWindowsNpm = process.platform === "win32" && command === "npm";
  const result = isWindowsNpm
    ? spawnSync(
        process.env.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", ["npm", ...args].map(quoteWindowsArg).join(" ")],
        {
          cwd: root,
          stdio: "inherit",
          ...options,
        },
      )
    : spawnSync(platformCommand(command), args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    if (result.error) throw result.error;
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
};

const commandExists = (command) => {
  if (process.platform === "win32") {
    return spawnSync("where.exe", [command], { stdio: "ignore" }).status === 0;
  }

  const probe =
    spawnSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
  return probe.status === 0;
};

const safeName = (value) =>
  String(value || "theme")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
    .replace(/^\.+|\.+$/g, "") || "theme";

const assertExists = async (target) => {
  try {
    await fs.access(path.join(root, target));
  } catch {
    throw new Error(`Missing required file: ${target}`);
  }
};

const listArchive = (archivePath) => {
  if (!commandExists("tar")) return;
  const result = spawnSync(platformCommand("tar"), ["-tf", archivePath], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) return;

  const entries = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((entry) => entry.replace(/^\.\//, "").replace(/\/$/, ""));
  const required = ["komari-theme.json", "preview.png", "dist/index.html"];
  const missing = required.filter((entry) => !entries.includes(entry));
  if (missing.length > 0) {
    throw new Error(`Package is missing: ${missing.join(", ")}`);
  }
  if (entries.some((entry) => entry.includes("\\"))) {
    throw new Error("Package contains non-portable backslash paths");
  }
};

const main = async () => {
  const manifestPath = path.join(root, "komari-theme.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const packageName = `${safeName(manifest.short)}-v${safeName(manifest.version)}.zip`;
  const packagePath = path.join(root, packageName);
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), "komari-theme-"));

  try {
    if (!skipBuild) {
      run("npm", ["run", "-s", "build"]);
    }

    await assertExists("preview.png");
    await assertExists("komari-theme.json");
    await assertExists(path.join("dist", "index.html"));

    await fs.rm(packagePath, { force: true });
    await fs.copyFile(path.join(root, "preview.png"), path.join(stage, "preview.png"));
    await fs.copyFile(manifestPath, path.join(stage, "komari-theme.json"));
    await fs.cp(path.join(root, "dist"), path.join(stage, "dist"), {
      recursive: true,
    });

    if (commandExists("zip")) {
      run("zip", ["-qr", packagePath, ...packageEntries], { cwd: stage });
    } else if (process.platform === "win32" && commandExists("tar")) {
      run("tar", ["-a", "-c", "-f", packagePath, "-C", stage, ...packageEntries]);
    } else {
      throw new Error("Install zip, or run this script on Windows with tar available.");
    }

    listArchive(packagePath);
    const stat = await fs.stat(packagePath);
    console.log(`Created ${packageName} (${Math.round(stat.size / 1024)} KiB)`);
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
