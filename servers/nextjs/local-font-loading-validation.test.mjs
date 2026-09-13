import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoots = ["app", "components", "lib"];
const runtimeExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

async function listFiles(directory, extensions = null) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listFiles(entryPath, extensions);
        return !extensions || extensions.has(path.extname(entry.name))
          ? [entryPath]
          : [];
      }),
    )
  ).flat();
}

test("runtime source does not load remote font services", async () => {
  const files = (
    await Promise.all(
      runtimeRoots.map((root) =>
        listFiles(path.join(projectDirectory, root), runtimeExtensions),
      ),
    )
  ).flat();
  const remoteFontPattern =
    /fonts\.googleapis\.com|fonts\.gstatic\.com|next\/font\/google/i;
  const violations = [];

  for (const file of files) {
    if (remoteFontPattern.test(await readFile(file, "utf8"))) {
      violations.push(path.relative(projectDirectory, file));
    }
  }

  assert.deepEqual(violations, []);
});

test("the local font catalog points to checked-in vendor assets", async () => {
  const catalogPath = path.join(
    projectDirectory,
    "components/slide-editor/text/local-fonts.ts",
  );
  const source = await readFile(catalogPath, "utf8");
  const entries = source.match(/^\s+(?:font|staticFont)\("/gm) ?? [];
  assert.equal(entries.length, 14);
  assert.doesNotMatch(source, /fonts\.googleapis|fonts\.gstatic/i);

  const fontFiles = await listFiles(
    path.join(projectDirectory, "public/vendor/fonts"),
  );
  assert.equal(fontFiles.length, 352);

  await Promise.all(
    [
      "sans_serif/inter/Inter[opsz,wght].ttf",
      "UOS/SourceHanSansSC/SourceHanSansSC-Regular.otf",
      "UOS/SourceHanSerifSC/SourceHanSerifSC-Regular.otf",
      "windows/arial/Arial-Regular.ttf",
      "windows/calibri/Calibri-Regular.ttf",
      "windows/consola/Consolas-Regular.ttf",
      "windows/georgia/Georgia-Regular.ttf",
      "windows/msyh/msyh-Regular.ttf",
      "windows/times/TimesNewRoman-Regular.ttf",
      "windows/zh_cn/simfang.ttf",
      "windows/zh_cn/simhei.ttf",
      "windows/zh_cn/simkai.ttf",
      "windows/zh_cn/simsun-new.ttf",
      "windows/zh_cn/simsun.ttf",
    ].map((asset) =>
      access(path.join(projectDirectory, "public/vendor/fonts", asset)),
    ),
  );
});
