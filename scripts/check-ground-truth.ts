// ground-truth/ の正解データを検証する（形式、数量×単価＝金額、明細の合計＝合計金額）
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GroundTruthSchema } from "../server/schema.js";

const dir = "ground-truth";
let errors = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const before = errors;
  const truth = GroundTruthSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf-8")));
  let sum = 0;
  for (const line of truth.lines) {
    const amount = Number(line.quantity) * Number(line.unit_price);
    if (amount !== Number(line.amount)) {
      console.error(`${file} ${line.item_code}: 数量×単価=${amount} と金額=${line.amount} が一致しません`);
      errors++;
    }
    sum += Number(line.amount);
  }
  if (sum !== Number(truth.total_amount)) {
    console.error(`${file}: 明細の合計=${sum} と合計金額=${truth.total_amount} が一致しません`);
    errors++;
  }
  if (errors === before) console.log(`${file}: OK`);
}

if (errors > 0) process.exit(1);
