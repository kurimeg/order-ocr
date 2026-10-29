// ground-truth/ の正解データからダミー注文書を作り、samples/ に保存する
//
// 使い方：
//   npm run samples                     # specs.ts のすべてを作る（既存のファイルは上書き）
//   npm run samples -- --only order-004 # 指定した1枚だけ作る
//
// ブラウザは PC にインストール済みの Edge（なければ Chrome）を使う
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Browser } from "playwright-core";
import sharp from "sharp";
import { GroundTruthSchema } from "../server/schema.js";
import { SPECS, type Spec } from "./samples/specs.js";
import { renderOrder } from "./samples/templates.js";

const { values: args } = parseArgs({ options: { only: { type: "string" } } });

const A4_CSS_PX = { width: 794, height: 1123 }; // A4 を 96dpi で表した大きさ
const SCALE = { fax: 200 / 96, scan: 300 / 96, none: 200 / 96 }; // 200dpi（FAX）・300dpi（スキャン）相当

// 毎回同じ画像になるよう、乱数は注文書名から決まる値で初期化する
function seededRandom(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

async function launch(): Promise<Browser> {
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // 次のブラウザを試す
    }
  }
  throw new Error("Edge も Chrome も見つかりません");
}

// 画像を FAX やスキャナで読み込んだように加工する
async function degrade(png: Buffer, kind: "fax" | "scan", seed: string): Promise<Buffer> {
  const rand = seededRandom(seed);
  const angle = (rand() - 0.5) * (kind === "fax" ? 2.4 : 1.6); // ±1.2度 / ±0.8度

  let img = sharp(png).rotate(angle, { background: "#ffffff" });
  if (kind === "fax") img = img.greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const setPixel = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * channels;
    for (let c = 0; c < Math.min(channels, 3); c++) data[i + c] = v;
  };

  // 点状のノイズ
  const dots = Math.floor(width * height * (kind === "fax" ? 0.0015 : 0.0003));
  for (let n = 0; n < dots; n++) {
    const x = Math.floor(rand() * width), y = Math.floor(rand() * height);
    const size = rand() < 0.8 ? 1 : 2;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) setPixel(x + dx, y + dy, Math.floor(rand() * 90));
  }

  if (kind === "fax") {
    // FAX 特有の横すじ（受信時の乱れ）
    for (let n = 0; n < 4; n++) {
      const y = Math.floor(rand() * height);
      for (let x = 0; x < width; x++) if (rand() < 0.35) setPixel(x, y, 40);
    }
    return sharp(data, { raw: info }).blur(0.7).threshold(165).png().toBuffer();
  }
  return sharp(data, { raw: info }).blur(0.4).modulate({ brightness: 0.97 }).png().toBuffer();
}

async function generate(browser: Browser, spec: Spec): Promise<string> {
  const truth = GroundTruthSchema.parse(JSON.parse(readFileSync(join("ground-truth", `${spec.name}.json`), "utf-8")));
  const html = renderOrder(truth, spec.layout, spec.corrections);
  const outPath = join("samples", `${spec.name}.${spec.output}`);

  const page = await browser.newPage({ viewport: A4_CSS_PX, deviceScaleFactor: SCALE[spec.degrade ?? "none"] });
  try {
    await page.setContent(html, { waitUntil: "load" });
    if (spec.output === "pdf") {
      writeFileSync(outPath, await page.pdf({ format: "A4", printBackground: true }));
    } else {
      let png = await page.screenshot({ fullPage: true, type: "png" });
      if (spec.degrade) png = await degrade(png, spec.degrade, spec.name);
      writeFileSync(outPath, png);
    }
  } finally {
    await page.close();
  }
  return outPath;
}

const specs = args.only ? SPECS.filter((s) => s.name === args.only) : SPECS;
if (specs.length === 0) {
  console.error(`specs.ts に ${args.only} がありません`);
  process.exit(1);
}

const browser = await launch();
try {
  for (const spec of specs) {
    console.log(`ok    ${await generate(browser, spec)}`);
  }
} finally {
  await browser.close();
}
