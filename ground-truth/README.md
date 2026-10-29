# 正解データ

注文書1枚につき1ファイル。ファイル名（拡張子を除く）を `samples/` の注文書とそろえる（例：`order-001.json` ↔ `samples/order-001.pdf`）。
形は `server/schema.ts` の `GroundTruthSchema`。すべて架空のデータ。

| ファイル | 想定する注文書の種類 |
|---|---|
| order-001 | きれいなPDF |
| order-002 | きれいなPDF（備考あり） |
| order-003 | 手書きの訂正入り（印刷後に数量を手で書き直す） |
| order-004 | FAX風の画像（明細5行） |
| order-005 | レイアウト違い |
