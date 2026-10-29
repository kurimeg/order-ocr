// 読み取り結果（extracted/）と正解データ（ground-truth/）を項目ごとに突き合わせる
import type { GroundTruth, Order, OrderField } from "./schema.js";

export const HEADER_FIELDS = ["customer_name", "order_no", "order_date", "delivery_date", "ship_to", "total_amount", "remarks"] as const;
export const LINE_FIELDS = ["item_code", "item_name", "quantity", "unit", "unit_price", "amount"] as const;

export const FIELD_LABELS: Record<string, string> = {
  customer_name: "得意先",
  order_no: "注文番号",
  order_date: "発注日",
  delivery_date: "希望納期",
  ship_to: "納品先",
  total_amount: "合計金額",
  remarks: "備考",
  item_code: "品番",
  item_name: "品名",
  quantity: "数量",
  unit: "単位",
  unit_price: "単価",
  amount: "金額",
};

// 比較の前に書き方の違いをそろえる（正しく読めているのに不正解と判定しないため）
export function normalize(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  let s = v.normalize("NFKC") // 全角英数字・記号を半角に、㈱ を (株) に
    .replace(/\(株\)/g, "株式会社")
    .replace(/\(有\)/g, "有限会社")
    .replace(/[\s,，、]/g, "") // 空白とカンマ
    .replace(/^[¥￥]|円$/g, ""); // 金額の記号
  // 日付：2026/11/5、2026.11.05 などを 2026-11-05 に
  const date = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (date) s = `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}`;
  // 数値：120.0 や 0120 を 120 に
  if (/^-?\d+(\.\d+)?$/.test(s)) s = String(Number(s));
  return s === "" ? null : s;
}

export type ItemResult = {
  doc: string; // 注文書の名前（例：order-004）
  field: string; // 項目（例：quantity）
  line: number | null; // 明細の行番号（正解データでの順番、1から）。ヘッダは null
  expected: string | null;
  actual: string | null;
  correct: boolean;
  concern: string | null; // AIの指摘
  source_text: string | null;
  note: string | null; // 明細行が見つからない、など
};

function judge(doc: string, field: string, line: number | null, expected: string | null, got: OrderField | undefined, note: string | null = null): ItemResult {
  const actual = got?.value ?? null;
  return {
    doc, field, line, expected, actual,
    correct: got !== undefined && normalize(expected) === normalize(actual),
    concern: got?.concern ?? null,
    source_text: got?.source_text ?? null,
    note,
  };
}

// 1枚の注文書を評価する。明細は行の順番ではなく品番で対応させる
export function evaluateOrder(doc: string, truth: GroundTruth, order: Order): ItemResult[] {
  const results: ItemResult[] = HEADER_FIELDS.map((f) => judge(doc, f, null, truth[f], order[f]));

  const unmatched = new Set(order.lines.map((_, i) => i));
  truth.lines.forEach((tl, i) => {
    // 品番が一致する行を探す。見つからなければ同じ位置の行を使う（品番の読み間違いを数えるため）
    let j = order.lines.findIndex((ol, k) => unmatched.has(k) && normalize(ol.item_code.value) === normalize(tl.item_code));
    if (j < 0 && unmatched.has(i)) j = i;
    const ol = j >= 0 ? order.lines[j] : undefined;
    if (j >= 0) unmatched.delete(j);
    const note = ol ? null : "明細行を読み取れていない";
    for (const f of LINE_FIELDS) results.push(judge(doc, f, i + 1, tl[f], ol?.[f], note));
  });

  // 正解にない明細行を読み取った場合（行の重複や、空行を明細と読んだなど）
  for (const k of unmatched) {
    results.push({
      doc, field: "extra_line", line: null, expected: null,
      actual: order.lines[k].item_code.value, correct: false,
      concern: null, source_text: order.lines[k].item_code.source_text, note: "正解にない明細行",
    });
  }
  return results;
}

export type FieldSummary = { field: string; total: number; correct: number; errors: ItemResult[] };

export function summarizeByField(results: ItemResult[]): FieldSummary[] {
  const order = [...HEADER_FIELDS, ...LINE_FIELDS, "extra_line"];
  const map = new Map<string, FieldSummary>();
  for (const r of results) {
    const s = map.get(r.field) ?? { field: r.field, total: 0, correct: 0, errors: [] };
    s.total++;
    if (r.correct) s.correct++;
    else s.errors.push(r);
    map.set(r.field, s);
  }
  return order.flatMap((f) => (map.has(f) ? [map.get(f)!] : []));
}

// 注文書ごとに「全項目が正解」かどうか
export function perfectDocs(results: ItemResult[]): { docs: number; perfect: number } {
  const byDoc = new Map<string, boolean>();
  for (const r of results) byDoc.set(r.doc, (byDoc.get(r.doc) ?? true) && r.correct);
  return { docs: byDoc.size, perfect: [...byDoc.values()].filter(Boolean).length };
}
