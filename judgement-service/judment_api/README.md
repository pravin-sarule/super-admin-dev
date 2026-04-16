# Judment API

External search API module for `judgement-service`.

Routes:

- `POST /api/judment-api/search/semantic`
- `POST /api/judment-api/search/full-text`
- `POST /api/judment-api/search/hybrid`
- `GET /api/judment-api/analytics`

Authentication:

- `x-api-key: <JUDMENT_API_KEY>`
- or `Authorization: Bearer <JUDMENT_API_KEY>`

Example payload:

```json
{
  "query": "demolition of the building",
  "chunkLimit": 8,
  "judgmentLimit": 5,
  "scoreThreshold": 0.35,
  "phraseMatch": false,
  "filters": {
    "courtCode": "SC",
    "year": 2023
  }
}
```
curl -X POST http://localhost:8095/api/judment-api/search/hybrid \
  -H "Content-Type: application/json" \
  -H "x-api-key: ICJ0eZpY2VfYWNjb3VudCIsCiAgInByfaWQiOiAib" \
  -d '{
    "query": "demolition of the building",
    "chunkLimit": 8,
    "judgmentLimit": 5,
    "scoreThreshold": 0.35,
    "phraseMatch": false
  }'
