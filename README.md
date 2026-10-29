# order-ocr

FAX・PDFの注文書を OpenAI API で読み取り、確認画面で修正して受注登録するデモ。
すべて架空のデータで作る（本物の顧客の注文書は使わない）。

## 準備

```bash
npm install
cp .env.example .env   # .env に OPENAI_API_KEY と OCR_MODEL を書く（.env はコミットしない）
```

## 使い方

| コマンド | 内容 |
|---|---|
| `npm run check:truth` | `ground-truth/` の正解データを検証する（数量×単価＝金額、明細の合計＝合計金額） |
| `npm run samples` | 正解データからダミー注文書（PDF・FAX風の画像など）を作り、`samples/` に保存する（作り方は `scripts/samples/specs.ts`） |
| `npm run samples -- --only order-004` | 指定した1枚だけ作る |
| `npm run extract` | `samples/` の注文書を読み取り、`extracted/<指示の版>_<モデル名>/` に保存する |
| `npm run extract -- --limit 5` | 最初の5枚だけ読み取る |
| `npm run extract -- --only order-001` | 指定した1枚だけ読み取る |
| `npm run extract -- --prompt v2` | `prompts/extract-v2.md` の指示で読み取る |
| `npm run evaluate` | `extracted/` のすべての条件を正解データと突き合わせ、項目ごとの正解率を出す。2条件以上あれば比較表も出す |
| `npm run evaluate -- v2_gpt-6.1-terra` | 指定した条件だけ評価する |
| `npm run typecheck` | 型チェック |

- 保存済みの注文書は飛ばすので、失敗したときはもう一度実行すればよい
- 使用トークン数は `results/usage.csv` に追記される（費用の見積もりに使う）

## 評価の出力（results/）

| ファイル | 内容 |
|---|---|
| `<条件>.csv` | 項目ごとの正解率、誤りのうちAIが concern で指摘していた件数、誤りの例 |
| `<条件>-details.csv` | 全項目の判定（正解、AIの値、AIの指摘、注文書の文字） |
| `comparison.csv` | 条件ごとの正解率の比較表 |

- 比較の前に、全角と半角、空白、カンマ、¥・円、㈱・㈲、日付の書き方（`/` や `.` 区切り）をそろえる
- 明細は品番で行を対応させる。品番が一致しなければ同じ位置の行と比べる。読み落とした行と余分な行も誤りとして数える
- CSV は Excel で開けるよう BOM 付きの UTF-8 で保存する

## フォルダ構成

```
samples/        ダミー注文書（PDF・PNG・JPG）。ファイル名は ground-truth/ とそろえる
ground-truth/   正解データ（注文書1枚につき1ファイル）
prompts/        読み取りの指示（版ごとに残す）とJSONの形の説明
extracted/      読み取り結果（条件ごとにフォルダを分ける）
results/        評価結果と API の使用量
server/
  schema.ts         JSONの型定義（zod）。構造化出力にも使う
  extractor.ts      読み取りの窓口と FileExtractor（保存済みのJSONを読む）
  api-extractor.ts  ApiExtractor（OpenAI API で読み取る）
  evaluate.ts       評価のロジック（正規化、明細の対応付け、集計）
scripts/
  extract-all.ts         まとめて読み取る
  evaluate.ts            評価を実行し、results/ に CSV を保存する
  generate-samples.ts    ダミー注文書を作る（Edge か Chrome を使う）
  samples/specs.ts       注文書ごとの書式・出力形式・加工・手書きの訂正
  samples/templates.ts   注文書の書式（標準・FAX向け・簡易）
  check-ground-truth.ts  正解データを検証する
```
