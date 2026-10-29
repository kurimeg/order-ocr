import { z } from "zod";

// 構造化出力（strict モード）では、すべての項目が必須。
// 値がない場合は .optional() ではなく .nullable() で null を許す。
const Field = z.object({
  value: z.string().nullable(), // 読み取った値（正規化後）
  source_text: z.string().nullable(), // 注文書に書かれていたそのままの文字
  concern: z.string().nullable(), // 気になった点（かすれ、手書きの訂正など）
});

const Line = z.object({
  item_code: Field,
  item_name: Field,
  quantity: Field,
  unit: Field,
  unit_price: Field,
  amount: Field,
});

// AI の読み取り結果
export const OrderSchema = z.object({
  customer_name: Field,
  order_no: Field,
  order_date: Field,
  delivery_date: Field,
  ship_to: Field,
  lines: z.array(Line),
  total_amount: Field,
  remarks: Field,
});

export type Order = z.infer<typeof OrderSchema>;
export type OrderField = z.infer<typeof Field>;

// 正解データ（ground-truth/）。値だけを持つ
const Value = z.string().nullable();

const TruthLine = z.object({
  item_code: Value,
  item_name: Value,
  quantity: Value,
  unit: Value,
  unit_price: Value,
  amount: Value,
});

export const GroundTruthSchema = z.object({
  customer_name: Value,
  order_no: Value,
  order_date: Value,
  delivery_date: Value,
  ship_to: Value,
  lines: z.array(TruthLine),
  total_amount: Value,
  remarks: Value,
});

export type GroundTruth = z.infer<typeof GroundTruthSchema>;
