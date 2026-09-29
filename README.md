# Samplanering

Planera tillsammans och gör arbetet direkt i uppgiftens dokument. Svenska, avskalade vyer med fler verktyg när de behövs.

Tre etapper är implementerade: gemensam tavla och arbetsdokument; mallar, egna fält och vyer; samordning, automation och uppföljning. Detta är en fungerande prototyp för en testgrupp, med riktig inloggning och gemensam serverlagring.

## Gratis molnpilot

[Cloudflare + Firebase Auth](docs/PILOT.md) kör appen, teamdata och bilagor på Cloudflare och inloggningen i Firebase-projektet `planner-tensetti`. Piloten är publicerad på [planner-tensetti.jonatan-tensetti.workers.dev](https://planner-tensetti.jonatan-tensetti.workers.dev). Webbappen är registrerad; dess API-nyckel anges via `.dev.vars` eller miljön vid publicering. Email/Password är aktiverat. Nyckelns inställningar är granskade via skärmbilder; rekommenderad begränsning för pilotens inloggning finns i driftguiden. Registrering, inloggning och samarbete på den publicerade adressen återstår att prova med riktiga konton.

## Starta på din dator

Kräver Node.js 24.

```sh
npm ci
npm run build
npm start
```

Öppna **http://localhost:3000**. Skapa ett konto, ett team och en plan. Databas och bilagor sparas i `data/` och finns kvar efter omstart. Ingen extern databastjänst eller API-nyckel behövs.

Alternativ med Docker Compose:

```sh
docker compose up --build -d
```

## Testa tillsammans

Alla använder **samma serveradress**. Teamägaren öppnar **Team och delning**, skapar en länk och delar den med en kollega. Kollegan skapar ett eget konto och accepterar inbjudan. Varje länk kan användas en gång och gäller i sju dagar. Välj om kollegan får redigera eller bara läsa.

Se [drift och gemensam testadress](docs/DRIFT.md) för lokalt nätverk eller HTTPS på egen server, och [testupplägg](docs/TESTA.md) för ett första användartest.

## Det som finns

- Planer, kolumner, uppgifter, ansvariga, datum, deluppgifter och beroenden.
- Arbetsdokument inne i kortet: text, checklistor, svarsfält, val, tabeller, länkar och bilagor.
- Team, roller, kommentarer, omnämnanden, teamsamtal och notiser.
- Dokumentmallar och planmallar för bland annat införande, CRM och självskattning.
- Egna fält, sökning, filter, sparade vyer, kalender och tidslinje.
- Kunskapsartiklar, arbetslogg, whiteboard, backlog och arbetsperioder.
- Regler, återkommande uppgifter, datum-påminnelser, mål, diagram, tidtagning och arbetsbelastning.
- Historik, återställning och arkiv.

[Funktionsöversikt och gränser](docs/FUNKTIONER.md) beskriver vad varje del gör. [Granskningen efter varje etapp](docs/REVIEW.md) redovisar tester, rättningar och kvarstående begränsningar.

[Designbesluten från Classroom-studien](docs/CLASSROOM.md) beskriver den förenklade startsidan, arbetsytan och det automatiska sparandet, med källor och kritisk granskning.

## Viktiga gränser i prototypen

Ändringar syns hos andra användare via serverhändelser. Olika dokumentblock kan redigeras parallellt. Om två personer ändrar **samma block** behålls utkastet och användaren får välja version. Det är inte teckenvis samskrivning som i Google Docs.

Inloggning använder lösenord. Firebase-varianten har lösenordsåterställning via e-post. Node-varianten saknar lösenordsåterställning. E-postverifiering, SSO, övriga e-postutskick och externa integrationer ingår inte. Notiser finns inne i appen. Ingen AI-tjänst är inkopplad. Node-varianten kör en serverinstans med beständig SQLite-lagring. Cloudflare-varianten använder en SQLite-arbetsyta per team. Kapaciteten är inte belastningstestad för stora organisationer.

## Utveckling och verifiering

```sh
npm run dev
# I en andra terminal:
npm run dev:ui
```

Öppna http://localhost:5173. Vite skickar API-anrop till servern på port 3000.

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:ui
npm run format:check
```

Testerna använder egna databaser och konton. `tests/*.test.mjs` verifierar bland annat teamisolering, roller, konflikter, inbjudningar, återkommande datum och serverregler. Playwright verifierar det sammanhängande användarflödet, mobilnavigation, mallar, vyer, samtidiga användare och avancerade verktyg. CI är konfigurerat att köra dessa kontroller och ett separat starttest av Docker-avbildningen.

## Struktur

`src/` innehåller React-gränssnittet. `server/` innehåller Express-API, validering, SQLite-lagring och schemaläggning. `shared/presets.mjs` innehåller planmallarna. Versioner kontrolleras med `If-Match`; behörighet och teamkopplingar kontrolleras på servern. Sessionskakor är HttpOnly, och i produktion även Secure. Databas, uppladdningar, lösenord och sessionsdata ska inte checkas in i Git.

[Fältgranskning och designregler](docs/UX-REVIEW.md) dokumenterar varje fälttyp, storlekar, färgroller, copy och användarflöden utifrån Apples och Googles riktlinjer.
