# Kör Samplanering för en testgrupp

## En gemensam server

Alla deltagare ska öppna samma adress. Att var och en startar appen på sin dator ger separata databaser. Kör en enda appinstans med beständig disk. Säkerhetskopiera både databas och bilagor.

## Lokalt test med Node.js 24

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Öppna http://localhost:3000. För test på samma lokala nätverk: ändra `APP_ORIGIN` i `.env` till datorns riktiga adress, exempelvis `http://192.168.1.25:3000`. Starta om servern och låt alla använda den adressen. Brandväggen behöver tillåta port 3000 från det lokala nätverket. Detta HTTP-läge är till för lokala tester.

## Lokalt test med Docker

```sh
cp .env.example .env
docker compose up --build -d
```

Standardadressen är http://localhost:3000. För lokalt nätverk: sätt `BIND_ADDRESS=0.0.0.0` och samma `APP_ORIGIN` som deltagarna använder i `.env`, och kör kommandot igen. Data sparas i volymen `samplanering-data`. Vanlig omstart eller `docker compose down` behåller volymen. `down -v` tar bort data och ska inte användas vid vanlig uppdatering.

## HTTPS på egen server

Förutsätter en Linux-server med Docker Compose, ett domännamn vars DNS pekar på servern samt öppna portar 80 och 443. DNS, domän och server skapas inte av detta repository.

Sätt `DOMAIN` i `.env` till er riktiga adress, exempelvis `plan.ertforetag.se`. Kör sedan den separata konfigurationen:

```sh
docker compose -f compose.production.yaml up --build -d
docker compose -f compose.production.yaml logs --tail=50 app caddy
```

Caddy hanterar HTTPS och skickar trafik till appen. Appens port publiceras inte direkt i denna konfiguration. `APP_ORIGIN` sätts automatiskt från `DOMAIN`. Servern kräver HTTPS i produktionsläge och använder Secure-sessionskakor. SSE-uppdateringar strömmas genom proxyn. Tidszonen för påminnelser är Europe/Stockholm och kan ändras med `TIME_ZONE`.

Appens inbyggda anropsgräns räknar IP-adressen den ser. Bakom Caddy delar deltagarna därför proxyadressens gräns. Det är en dokumenterad begränsning för större grupper; ändra inte Express `trust proxy` utan att anpassa det till den faktiska nätverkskedjan.

## Bjud in och prova

1. Skapa ägarens konto och ett team.
2. Välj **Team och delning → Skapa inbjudningslänk**. Välj redigerings- eller läsbehörighet.
3. Dela länken med en person. Skapa en ny länk för nästa person.
4. Kollegan skapar eget konto eller loggar in och accepterar inbjudan.
5. Öppna samma kort på två datorer. Ändra olika block och kontrollera att ändringarna kommer fram.

Konton har inte verifierad e-post eller automatiserad lösenordsåterställning. Använd en avgränsad pilotgrupp. Alla medlemmar i ett team kan läsa alla teamets planer och bilagor; det finns ingen separat behörighetsnivå per plan.

## Säkerhetskopiering och uppdatering

För Node-drift: stoppa processen, kopiera hela katalogen `DATA_DIR` (standard `data/`) till en säker plats och starta sedan igen. En återställning görs med servern stoppad genom att ersätta hela datakatalogen med säkerhetskopian. Bevara filägare och läsrättigheter.

För Docker-drift, gör en kall säkerhetskopia av volymen innan uppdatering:

```sh
docker compose stop app
docker compose run --rm --no-deps --entrypoint tar app czf - -C /app/data . > samplanering-backup.tar.gz
docker compose start app
```

Använd `docker compose -f compose.production.yaml` i alla tre kommandona vid HTTPS-drift. Kopian innehåller konton, sessionsdata, historik och bilagor och ska förvaras privat. Testa återställning till en separat tom datavolym innan den behöver användas skarpt.

Uppdatera koden och kör `docker compose up --build -d` (med produktionsfilen när den används). För Node: stoppa servern, kör `npm ci && npm run build`, starta igen. Denna första version skapar sitt databasschema automatiskt; framtida schemaändringar behöver versionsstyrda migrationer.

## Verifieringsstatus

Node-server, databas, byggd frontend och webbläsarflöden har körts lokalt. Docker och Caddy kunde inte köras i utvecklingsmiljön eftersom Docker saknades. GitHub Actions är konfigurerat med Docker-byggning och startkontroll; kontrollera resultatet före driftsättning. Ingen publik instans är driftsatt av denna leverans.
