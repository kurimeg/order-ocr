import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { OrderSchema, type Order } from "./schema.js";
import type { Extractor } from "./extractor.js";

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export type Usage = { input_tokens: number; output_tokens: number };

// OpenAI API で注文書を読み取る
export class ApiExtractor implements Extractor {
  private client: OpenAI;
  lastUsage: Usage | null = null; // 費用の見積もり用に、直前の呼び出しの使用トークン数を残す

  constructor(
    readonly model = process.env.OCR_MODEL ?? "",
    private promptPath = "prompts/extract-v1.md",
  ) {
    if (!model) throw new Error("OCR_MODEL が設定されていません（.env を確認してください）");
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY が設定されていません（.env を確認してください）");
    this.client = new OpenAI(); // APIキーは環境変数 OPENAI_API_KEY から読む
  }

  async extract(path: string): Promise<Order> {
    const ext = extname(path).toLowerCase();
    const data = readFileSync(path).toString("base64");

    let fileBlock: OpenAI.Responses.ResponseInputContent;
    if (ext === ".pdf") {
      fileBlock = { type: "input_file", filename: basename(path), file_data: `data:application/pdf;base64,${data}` };
    } else if (IMAGE_TYPES[ext]) {
      // FAX画像の細かい文字を読むため、縮小させない
      fileBlock = { type: "input_image", image_url: `data:${IMAGE_TYPES[ext]};base64,${data}`, detail: "high" };
    } else {
      throw new Error(`対応していないファイル形式です: ${path}`);
    }

    const response = await this.client.responses.parse({
      model: this.model,
      instructions: readFileSync(this.promptPath, "utf-8"),
      input: [{
        role: "user",
        content: [fileBlock, { type: "input_text", text: "この注文書を読み取ってください。" }],
      }],
      text: { format: zodTextFormat(OrderSchema, "order") }, // 構造化出力：JSONの形を守らせる
    });

    this.lastUsage = response.usage
      ? { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }
      : null;

    if (!response.output_parsed) {
      throw new Error(`読み取り失敗: ${response.status} ${response.incomplete_details?.reason ?? ""}`);
    }
    return response.output_parsed;
  }
}
