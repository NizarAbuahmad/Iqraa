# scripts/data

## jordan-adm1-geoboundaries.geojson

- Source: geoBoundaries (https://www.geoboundaries.org), gbOpen, Jordan (JOR) ADM1,
  simplified. Release commit `9469f09` of wmgeolab/geoBoundaries.
- Licence: Creative Commons Attribution 2.5 Generic, derived from Wikimedia Commons.
- Data year: 2006. 12 features, the 12 governorates, keyed by `shapeISO`.
- What was done to it: nothing in this file (it is the downloaded file as published).
  `scripts/build-jordan-map.ts` projects and rounds it into
  `services/publicGames/jordanMapData.ts` (the SVG paths the game draws).
- The game shows the credit line (`playMapCredit` in `services/i18n.ts`).

Regenerate the paths after changing the source:

```
cd artifacts/mobile && node --experimental-strip-types scripts/build-jordan-map.ts
```

`services/__tests__/jordanMapData.test.ts` fails if the committed module differs from
the script's output.
