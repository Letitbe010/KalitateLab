# KalitateLab – arau nagusiak
Espezifikazio osoa: `../KalitateLab_argibideak.md`.

- Zehaztasuna > dena. core/-n akats batek erabiltzailearen ikaskuntza hondatzen du.
- Aritmetika: hamartarrak arrazional zehatz gisa (src/core/decimal.ts); √ eta Φ amaieran. s (n − 1) vs σ (n): ariketak zehazten du; bestela biak onartu, diagnostikoarekin.
- % laginean ≠ % populazioan. LCL negatiboa → 0. Kontrol-mugak ≠ espezifikazio-mugak.
- SPC konstanteak taulatik (3 hamartar, ikasleak erabiltzen dituenak) ETA lehen printzipioetatik egiaztatuta; bat ez badatoz, testak huts. Ebazleak taulako balioak erabiltzen ditu; D₃ eta D₄ lehen printzipioetako balio zehatzak dira, 3 hamartarrera biribilduta (erabiltzaileak erabakia, 2026-11-19; IMH apunteetako taulak berresten du). IMH taulak akatsak ditu: ikus `../KalitateLab_iturri_berriak.md`.
- Bi ebazle independente (A eta B) + Python orakulua. Bat ez badatoz → ariketa ez da erakusten.
- Erantzun zuzena erakutsitako datuetatik kalkulatzen da beti.
- Kanpoko iturrien soluzioak ez dira inoiz egiatzat hartzen: beti berriz ebatzi.
- Golden testak (tests/golden) ez dira inoiz aldatzen inplementazioari egokitzeko.
- Zuzenketan ez da AArik erabiltzen. Teoriako eta ebatzietako zenbakiak ebazletik txertatzen dira.
- UI elebiduna: eu (lehenetsia) / es. Terminologia: espezifikazioko §13.3; gaztelaniaz ISO 3534-2: LES/LEI, LCS/LCI/LC, CpkS/CpkI.
- GitHub: biltegia sortu edo push egin aurretik, erabiltzaileari baieztapena eskatu. Despliegea, CI berde badago soilik.
- Fase bat ez da amaitutzat jotzen bere test guztiak berde egon arte.
- core/-k ez du UIren ezer inportatzen (ESLint-ek debekatzen du).
- Kodea, iruzkinak eta commit-mezuak ingelesez. Commit-egilea: Letitbe010 noreply helbidearekin.
