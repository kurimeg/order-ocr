import { readFileSync } from "node:fs";
import { join, parse } from "node:path";
import { OrderSchema, type Order } from "./schema.js";

export interface Extractor {
  extract(path: string): Promise<Order>;
}

// 保存済みのJSONを返す（評価や、API を呼ばずに画面を確認したいとき）
export class FileExtractor implements Extractor {
  constructor(private dir: string) {} // 例：extracted/v1_gpt-6.1-terra

  async extract(path: string): Promise<Order> {
    const json = JSON.parse(readFileSync(join(this.dir, `${parse(path).name}.json`), "utf-8"));
    return OrderSchema.parse(json);
  }
}
