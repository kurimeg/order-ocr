// 読み取り結果を正解データと突き合わせ、項目ごとの正解率を results/<条件>.csv に保存する
//
// 使い方：
//   npm run evaluate                          # extracted/ のすべての条件を評価し、比較表も出す
//   npm run evaluate -- v2_gpt-6.1-terra      # 指定した条件だけ評価する
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, parse } from "node:path";
import { parseArgs } from "node:util";
import { GroundTruthSchema, OrderSchema } from "../server/schema.js";
import {
  evaluateOrder, FIELD_LABELS, perfectDocs, summarizeByField,
  type FieldSummary, type ItemResult,
} from "../server/evaluate.js";

const { positionals } = parseArgs({ allowPositionals: true });

const EXTRACTED_DIR = "extracted";
const TRUTH_DIR = "ground-truth";
const RESULTS_DIR = "results";

const conditions = positionals.length > 0
  ? positionals
  : readdirSync(EXTRACTED_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

if (conditions.length === 0) {
  console.log(`${EXTRACTED_DIR}/ に読み取り結果がありません。先に npm run extract を実行してください`);
  process.exit(0);
}

const truthNames = readdirSync(TRUTH_DIR).filter((f) => f.endsWith(".json")).map((f) => parse(f).name).sort();

const pct = (n: number, d: number) => (d === 0 ? "-" : `${Math.round((n / d) * 1000) / 10}%`);
const label = (field: string) => FIELD_LABELS[field] ?? (field === "extra_line" ? "余分な明細行" : field);
const describe = (r: ItemResult) =>
  `${r.doc}${r.line ? ` ${r.line}行目` : ""}：${r.actual ?? "（空）"} → 正解 ${r.expected ?? "（空）"}${r.note ? `（${r.note}）` : ""}`;

// Excel で文字化けしないよう、BOM 付きの UTF-8 で保存する
function writeCsv(path: string, rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  writeFileSync(path, "﻿" + rows.map((r) => r.map(cell).join(",")).join("\n") + "\n");
}

type ConditionResult = { condition: string; results: ItemResult[]; summary: FieldSummary[] };

function evaluateCondition(condition: string): ConditionResult | null {
  const dir = join(EXTRACTED_DIR, condition);
  if (!existsSync(dir)) {
    console.error(`${dir} がありません`);
    return null;
  }

  const results: ItemResult[] = [];
  const missing: string[] = [];
  for (const name of truthNames) {
    const path = join(dir, `${name}.json`);
    if (!existsSync(path)) {
      missing.push(name);
      continue;
    }
    const truth = GroundTruthSchema.parse(JSON.parse(readFileSync(join(TRUTH_DIR, `${name}.json`), "utf-8")));
    const parsed = OrderSchema.safeParse(JSON.parse(readFileSync(path, "utf-8")));
    if (!parsed.success) {
      console.error(`${path} の形式が正しくないため飛ばします: ${parsed.error.message}`);
      missing.push(name);
      continue;
    }
    results.push(...evaluateOrder(name, truth, parsed.data));
  }

  const summary = summarizeByField(results);
  const { docs, perfect } = perfectDocs(results);
  const errors = results.filter((r) => !r.correct);
  const flagged = errors.filter((r) => r.concern !== null).length;

  // ---- 画面への表示 ----
  console.log(`\n■ ${condition}（注文書 ${docs}枚${missing.length > 0 ? `、未読み取り ${missing.length}枚：${missing.join(", ")}` : ""}）`);
  for (const s of summary) {
    const examples = s.errors.slice(0, 2).map(describe).join(" ／ ");
    console.log(`  ${label(s.field).padEnd(8, "　")} ${pct(s.correct, s.total).padStart(6)}  (${s.correct}/${s.total})  ${examples}`);
  }
  console.log(`  ${"全項目が正解".padEnd(8, "　")} ${pct(perfect, docs).padStart(6)}  (${perfect}/${docs}枚)`);
  console.log(`  誤り ${errors.length}件のうち、AIが concern で指摘していたもの ${flagged}件`);

  // ---- CSV ----
  writeCsv(join(RESULTS_DIR, `${condition}.csv`), [
    ["項目", "件数", "正解", "正解率", "誤りのうちAIが指摘", "誤りの例"],
    ...summary.map((s) => [
      label(s.field), s.total, s.correct, pct(s.correct, s.total),
      s.errors.filter((r) => r.concern !== null).length,
      s.errors.map(describe).join(" ／ "),
    ]),
    ["全項目が正解（注文書）", docs, perfect, pct(perfect, docs), "", ""],
  ]);
  writeCsv(join(RESULTS_DIR, `${condition}-details.csv`), [
    ["注文書", "項目", "行", "正解", "AIの値", "判定", "AIの指摘", "注文書の文字", "備考"],
    ...results.map((r) => [
      r.doc, label(r.field), r.line, r.expected, r.actual, r.correct ? "○" : "×", r.concern, r.source_text, r.note,
    ]),
  ]);

  return { condition, results, summary };
}

const evaluated = conditions.map(evaluateCondition).filter((c): c is ConditionResult => c !== null);

// ---- 条件の比較表（2条件以上のとき） ----
if (evaluated.length >= 2) {
  const fields = [...new Set(evaluated.flatMap((c) => c.summary.map((s) => s.field)))];
  const rows: (string | number)[][] = [["項目", ...evaluated.map((c) => c.condition)]];
  for (const f of fields) {
    rows.push([label(f), ...evaluated.map((c) => {
      const s = c.summary.find((x) => x.field === f);
      return s ? pct(s.correct, s.total) : "-";
    })]);
  }
  rows.push(["全項目が正解", ...evaluated.map((c) => {
    const { docs, perfect } = perfectDocs(c.results);
    return pct(perfect, docs);
  })]);
  writeCsv(join(RESULTS_DIR, "comparison.csv"), rows);

  console.log("\n■ 条件の比較");
  for (const r of rows) console.log("  " + r.map((v, i) => (i === 0 ? String(v).padEnd(8, "　") : String(v).padStart(20))).join(""));
}

console.log(`\n保存先: ${RESULTS_DIR}/`);
