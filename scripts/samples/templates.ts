// 正解データから注文書の HTML を組み立てる（書式は3種類）
import type { GroundTruth } from "../../server/schema.js";

export type Layout = "standard" | "fax" | "compact";

// 手書きの訂正：キー（"lines.0.quantity"、"total_amount" など）→ 印刷されていた訂正前の値
export type Corrections = Record<string, string>;

const RECIPIENT = "株式会社サンプル飲料販売";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// ---- 日付・数値の書き方 ----

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, w: WEEKDAYS[new Date(y, m - 1, d).getDay()] };
}
const jpDate = (iso: string) => { const { y, m, d } = parts(iso); return `${y}年${m}月${d}日`; };
const warekiDate = (iso: string) => { const { y, m, d } = parts(iso); return `令和${y - 2018}年${m}月${d}日`; };
const slashDate = (iso: string) => { const { y, m, d } = parts(iso); return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`; };
const mdDate = (iso: string) => { const { m, d, w } = parts(iso); return `${m}月${d}日（${w}）`; };
const yen = (v: string | null) => (v === null ? "" : Number(v).toLocaleString("ja-JP"));

const esc = (s: string | null) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 訂正があれば、印刷された値を二重線で消し、正しい値を手書き風に書き添える
function cell(key: string, value: string, corrections: Corrections, format = (v: string) => v): string {
  const printed = corrections[key];
  if (printed === undefined) return esc(format(value));
  return `<span class="struck">${esc(format(printed))}</span><span class="hw">${esc(format(value))}</span>`;
}

const hasCorrections = (c: Corrections) => Object.keys(c).length > 0;

// ---- 共通のスタイル ----

const BASE_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { width: 210mm; min-height: 297mm; padding: 16mm 15mm; color: #111; font-size: 10.5pt; background: #fff; }
  table { border-collapse: collapse; width: 100%; }
  .num { text-align: right; }
  .struck { text-decoration: line-through double; text-decoration-color: #000; margin-right: 4px; }
  .hw { font-family: "Segoe Print", cursive; color: #1d3c9c; font-size: 1.25em; display: inline-block; transform: rotate(-5deg); }
  .stamp { display: inline-block; width: 15mm; height: 15mm; border: 2px solid #c8102e; border-radius: 50%; color: #c8102e;
           font-size: 8pt; line-height: 1.1; text-align: center; padding-top: 3.5mm; transform: rotate(-12deg); }
`;

function page(css: string, body: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

function blankRows(count: number, cols: number): string {
  return Array.from({ length: count }, () => `<tr>${"<td>&nbsp;</td>".repeat(cols)}</tr>`).join("");
}

// ---- 書式A：標準（ゴシック、横書きの一般的な注文書） ----

function standard(t: GroundTruth, c: Corrections): string {
  const rows = t.lines.map((l, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(l.item_code)}</td>
      <td>${esc(l.item_name)}</td>
      <td class="num">${cell(`lines.${i}.quantity`, l.quantity ?? "", c, yen)}</td>
      <td class="c">${esc(l.unit)}</td>
      <td class="num">${cell(`lines.${i}.unit_price`, l.unit_price ?? "", c, yen)}</td>
      <td class="num">${cell(`lines.${i}.amount`, l.amount ?? "", c, yen)}</td>
    </tr>`).join("");

  return page(`
    body { font-family: "Yu Gothic", "Meiryo", sans-serif; }
    h1 { text-align: center; letter-spacing: 1em; font-size: 22pt; margin: 0 0 8mm; border-bottom: 3px double #333; padding-bottom: 2mm; }
    .head { display: flex; justify-content: space-between; margin-bottom: 6mm; }
    .to { font-size: 14pt; border-bottom: 1px solid #333; padding: 0 2mm 1mm; align-self: flex-start; }
    .meta td { padding: 1mm 2mm; }
    .from { margin-top: 3mm; line-height: 1.6; }
    .items th, .items td { border: 1px solid #333; padding: 2mm 2mm; height: 9mm; }
    .items th { background: #e8e8e8; font-weight: normal; }
    .c { text-align: center; }
    .total { margin-top: 3mm; width: 45%; margin-left: auto; }
    .total td { border: 1px solid #333; padding: 2mm; font-size: 12pt; }
    .info { margin-top: 6mm; }
    .info th { width: 25mm; text-align: left; font-weight: normal; background: #e8e8e8; }
    .info th, .info td { border: 1px solid #333; padding: 2mm; }
  `, `
    <h1>注文書</h1>
    <div class="head">
      <div>
        <div class="to">${RECIPIENT}　御中</div>
        <p>下記のとおり注文いたします。</p>
      </div>
      <div>
        <table class="meta">
          <tr><td>注文番号</td><td>${esc(t.order_no)}</td></tr>
          <tr><td>発注日</td><td>${jpDate(t.order_date!)}</td></tr>
        </table>
        <div class="from"><strong>${esc(t.customer_name)}</strong><br>購買部　担当：佐藤<br>TEL 03-0000-0000</div>
      </div>
    </div>
    <table class="items">
      <tr><th style="width:8mm">No</th><th style="width:24mm">品番</th><th>品名</th><th style="width:20mm">数量</th><th style="width:16mm">単位</th><th style="width:22mm">単価</th><th style="width:28mm">金額</th></tr>
      ${rows}${blankRows(Math.max(0, 10 - t.lines.length), 7)}
    </table>
    <table class="total"><tr><td>合計金額（税抜）</td><td class="num">¥${cell("total_amount", t.total_amount ?? "", c, yen)}</td></tr></table>
    <table class="info">
      <tr><th>希望納期</th><td>${jpDate(t.delivery_date!)}</td></tr>
      <tr><th>納品先</th><td>${esc(t.ship_to)}</td></tr>
      <tr><th>備考</th><td>${esc(t.remarks)}&nbsp;</td></tr>
    </table>
    ${hasCorrections(c) ? `<div style="text-align:right;margin-top:4mm"><span class="stamp">訂正<br>佐藤</span></div>` : ""}
  `);
}

// ---- 書式B：FAX向け（明朝、和暦、罫線の多い帳票。上端にFAXの送信情報） ----

function fax(t: GroundTruth, c: Corrections): string {
  const rows = t.lines.map((l, i) => `
    <tr>
      <td>${esc(l.item_code)}</td>
      <td>${esc(l.item_name)}</td>
      <td class="num">${cell(`lines.${i}.quantity`, l.quantity ?? "", c, yen)}</td>
      <td class="c">${esc(l.unit)}</td>
      <td class="num">${cell(`lines.${i}.unit_price`, l.unit_price ?? "", c, yen)}</td>
      <td class="num">${cell(`lines.${i}.amount`, l.amount ?? "", c, yen)}</td>
    </tr>`).join("");
  const { m, d } = parts(t.order_date!);

  return page(`
    body { font-family: "MS Mincho", serif; padding-top: 8mm; }
    .faxline { font-family: "MS Gothic", monospace; font-size: 8.5pt; display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 1mm; margin-bottom: 8mm; }
    h1 { text-align: center; font-size: 20pt; letter-spacing: 0.8em; margin: 0 0 6mm; }
    .grid td, .grid th { border: 1px solid #000; padding: 2mm; }
    .grid th { font-weight: normal; width: 24mm; }
    .items { margin-top: 5mm; }
    .items th, .items td { border: 1px solid #000; padding: 1.8mm 2mm; height: 8.5mm; }
    .items th { font-weight: normal; }
    .c { text-align: center; white-space: nowrap; }
    .sum td { font-weight: bold; }
  `, `
    <div class="faxline"><span>${m}月${d}日 14:03</span><span>FROM：${esc(t.customer_name)}</span><span>FAX 011-000-0000</span><span>P. 1/1</span></div>
    <h1>発注書</h1>
    <table class="grid">
      <tr><th>宛先</th><td>${RECIPIENT}　受注センター　御中</td><th>発注No.</th><td>${esc(t.order_no)}</td></tr>
      <tr><th>発注元</th><td>${esc(t.customer_name)}</td><th>発注日</th><td>${warekiDate(t.order_date!)}</td></tr>
      <tr><th>納品場所</th><td>${esc(t.ship_to)}</td><th>納期</th><td>${mdDate(t.delivery_date!)}</td></tr>
    </table>
    <table class="items">
      <tr><th style="width:26mm">商品コード</th><th>商品名</th><th style="width:20mm">数量</th><th style="width:15mm">単位</th><th style="width:22mm">単価</th><th style="width:28mm">金額</th></tr>
      ${rows}${blankRows(Math.max(0, 12 - t.lines.length), 6)}
      <tr class="sum"><td colspan="5" class="c">合　計</td><td class="num">${cell("total_amount", t.total_amount ?? "", c, yen)}</td></tr>
    </table>
    <p>【通信欄】${esc(t.remarks)}</p>
  `);
}

// ---- 書式C：簡易（小規模店舗の手作り風。列の順番が違い、数量と単位が同じ欄） ----

function compact(t: GroundTruth, c: Corrections): string {
  const rows = t.lines.map((l, i) => `
    <tr>
      <td>${esc(l.item_name)}</td>
      <td>${esc(l.item_code)}</td>
      <td class="num">@${cell(`lines.${i}.unit_price`, l.unit_price ?? "", c, yen)}</td>
      <td class="num">${cell(`lines.${i}.quantity`, l.quantity ?? "", c, yen)} ${esc(l.unit)}</td>
      <td class="num">${cell(`lines.${i}.amount`, l.amount ?? "", c, yen)}円</td>
    </tr>`).join("");

  return page(`
    body { font-family: "Meiryo", sans-serif; font-size: 10pt; }
    h1 { font-size: 16pt; margin: 0 0 4mm; color: #2b5c3a; }
    .bar { background: #2b5c3a; color: #fff; padding: 2mm 3mm; margin-bottom: 5mm; display: flex; justify-content: space-between; }
    dl { display: grid; grid-template-columns: 26mm 1fr; row-gap: 2mm; margin: 0 0 6mm; }
    dt { color: #555; }
    dd { margin: 0; border-bottom: 1px dotted #999; }
    .items th { border-bottom: 2px solid #2b5c3a; text-align: left; padding: 2mm; font-weight: normal; color: #2b5c3a; }
    .items td { border-bottom: 1px solid #ccc; padding: 2.5mm 2mm; }
    .items th.num { text-align: right; }
    .total { margin-top: 4mm; text-align: right; font-size: 13pt; }
  `, `
    <h1>ご注文票</h1>
    <div class="bar"><span>${RECIPIENT} 様</span><span>No. ${esc(t.order_no)}</span></div>
    <dl>
      <dt>ご注文日</dt><dd>${slashDate(t.order_date!)}</dd>
      <dt>お店の名前</dt><dd>${esc(t.customer_name)}</dd>
      <dt>お届け先</dt><dd>${esc(t.ship_to)}</dd>
      <dt>お届け希望日</dt><dd>${slashDate(t.delivery_date!)}</dd>
    </dl>
    <table class="items">
      <tr><th>品名</th><th>品番</th><th class="num">単価</th><th class="num">数量</th><th class="num">金額</th></tr>
      ${rows}
    </table>
    <div class="total">合計　${cell("total_amount", t.total_amount ?? "", c, yen)}円</div>
    <p>メモ：${esc(t.remarks)}</p>
  `);
}

export function renderOrder(t: GroundTruth, layout: Layout, corrections: Corrections = {}): string {
  switch (layout) {
    case "standard": return standard(t, corrections);
    case "fax": return fax(t, corrections);
    case "compact": return compact(t, corrections);
  }
}
