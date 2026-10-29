# 読み取り結果のJSONの形

JSONの形は `server/schema.ts` の `OrderSchema` で定義し、構造化出力で API に指定する。このファイルは説明用。

各項目は次の3つを持つ。

| キー | 内容 |
|---|---|
| `value` | 読み取った値。日付は YYYY-MM-DD、数値はカンマなしの半角数字 |
| `source_text` | 注文書に書かれていたそのままの文字 |
| `concern` | 気になった点（かすれ、手書きの訂正など）。なければ null |

```json
{
  "customer_name": { "value": "山田飲料株式会社", "source_text": "山田飲料㈱", "concern": null },
  "order_no":      { "value": "PO-2026-1015", "source_text": "PO-2026-1015", "concern": null },
  "order_date":    { "value": "2026-10-15", "source_text": "令和8年10月15日", "concern": null },
  "delivery_date": { "value": "2026-11-05", "source_text": "11/5", "concern": "日付の一部がかすれている" },
  "ship_to":       { "value": "...", "source_text": "...", "concern": null },
  "lines": [
    {
      "item_code":  { "value": "A-1001", "source_text": "A-1001", "concern": null },
      "item_name":  { "value": "緑茶500ml", "source_text": "緑茶500", "concern": null },
      "quantity":   { "value": "120", "source_text": "100→120（手書き）", "concern": "手書きで訂正されている" },
      "unit":       { "value": "ケース", "source_text": "cs", "concern": null },
      "unit_price": { "value": "2400", "source_text": "2,400", "concern": null },
      "amount":     { "value": "288000", "source_text": "288,000", "concern": null }
    }
  ],
  "total_amount": { "value": "288000", "source_text": "288,000", "concern": null },
  "remarks":      { "value": null, "source_text": null, "concern": null }
}
```

正解データ（`ground-truth/`）は、各項目の `value` だけを持つ形（`GroundTruthSchema`）にする。
