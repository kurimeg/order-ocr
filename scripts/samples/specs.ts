// 注文書ごとの作り方。name は ground-truth/<name>.json と samples/<name>.(pdf|png) に対応する
import type { Corrections, Layout } from "./templates.js";

export type Spec = {
  name: string;
  layout: Layout;
  output: "pdf" | "png";
  // 画像の加工：fax＝白黒・低解像度・ノイズ・傾き、scan＝カラーのまま軽い傾きとノイズ
  degrade?: "fax" | "scan";
  // 手書きの訂正（印刷されていた訂正前の値）。正解データには訂正後の値を入れておく
  corrections?: Corrections;
};

export const SPECS: Spec[] = [
  { name: "order-001", layout: "standard", output: "pdf" },
  { name: "order-002", layout: "standard", output: "pdf" },
  {
    name: "order-003",
    layout: "standard",
    output: "png",
    degrade: "scan",
    corrections: { "lines.0.quantity": "20", "lines.0.amount": "48000", total_amount: "174000" },
  },
  { name: "order-004", layout: "fax", output: "png", degrade: "fax" },
  { name: "order-005", layout: "compact", output: "pdf" },
];
