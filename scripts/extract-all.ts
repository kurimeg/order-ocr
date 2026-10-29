// samples/ の注文書を OpenAI API でまとめて読み取り、extracted/<指示の版>_<モデル名>/ に保存する
//
// 使い方：
//   npm run extract                       # 指示 v1、.env の OCR_MODEL ですべて読み取る
//   npm run extract -- --prompt v2        # prompts/extract-v2.md を使う
//   npm run extract -- --limit 5          # 最初の5枚だけ読み取る
//   npm run extract -- --only order-001   # 指定した1枚だけ読み取る
import "dotenv/config";
import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, parse } from "node:path";
import { parseArgs } from "node:util";
import { ApiExtractor } from "../server/api-extractor.js";

const { values: args } = parseArgs({
  options: {
    prompt: { type: "string", default: "v1" },
    limit: { type: "string" },
    only: { type: "string" },
  },
});

const SAMPLES_DIR = "samples";
const USAGE_CSV = "results/usage.csv";
const SUPPORTED = [".pdf", ".png", ".jpg", ".jpeg"];

let files = readdirSync(SAMPLES_DIR)
  .filter((f) => SUPPORTED.includes(parse(f).ext.toLowerCase()))
  .sort();
if (args.only) files = files.filter((f) => parse(f).name === args.only);
if (args.limit) files = files.slice(0, Number(args.limit));

if (files.length === 0) {
  console.log(`${SAMPLES_DIR}/ に読み取る注文書がありません`);
  process.exit(0);
}

let extractor: ApiExtractor;
try {
  extractor = new ApiExtractor(process.env.OCR_MODEL, `prompts/extract-${args.prompt}.md`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
const outDir = join("extracted", `${args.prompt}_${extractor.model}`);
mkdirSync(outDir, { recursive: true });

if (!existsSync(USAGE_CSV)) {
  appendFileSync(USAGE_CSV, "datetime,file,model,prompt,input_tokens,output_tokens,elapsed_ms\n");
}

let failed = 0;
for (const file of files) {
  const outPath = join(outDir, `${parse(file).name}.json`);
  // 保存済みの注文書は飛ばす（同じ注文書に何度も費用をかけない）
  if (existsSync(outPath)) {
    console.log(`skip  ${file}（保存済み）`);
    continue;
  }

  const started = Date.now();
  try {
    const order = await extractor.extract(join(SAMPLES_DIR, file));
    const elapsed = Date.now() - started;
    writeFileSync(outPath, JSON.stringify(order, null, 2) + "\n");

    const usage = extractor.lastUsage;
    appendFileSync(
      USAGE_CSV,
      [new Date().toISOString(), file, extractor.model, args.prompt, usage?.input_tokens ?? "", usage?.output_tokens ?? "", elapsed].join(",") + "\n",
    );
    console.log(`ok    ${file}（${(elapsed / 1000).toFixed(1)}秒、入力 ${usage?.input_tokens} / 出力 ${usage?.output_tokens} トークン）`);
  } catch (e) {
    failed++;
    console.error(`error ${file}: ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`\n保存先: ${outDir}`);
if (failed > 0) {
  console.error(`${failed} 件が失敗しました。もう一度実行すると、失敗した注文書だけを読み取ります。`);
  process.exit(1);
}
