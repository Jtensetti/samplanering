# Pilot på Cloudflare med Firebase-inloggning

Appen kan köras på Cloudflare Workers Free. Firebase-projektet är **planner-tensetti**, projektnummer **817306734982**. Webbappen **Samplanering pilot** är registrerad; projekt-id och app-id finns i `wrangler.jsonc`. API-nyckeln anges via `.dev.vars` eller miljön vid publicering. Ingen publik instans har ännu verifierats. Email/Password är aktiverat. Cloudflare-åtkomst och kontroll av nyckelns API-begränsningar återstår.

## Vad körs var?

| Del                                                 | Tjänst                                          |
| --------------------------------------------------- | ----------------------------------------------- |
| React-gränssnitt och API                            | Cloudflare Worker med statiska filer            |
| Teamets planer, dokument, behörigheter och historik | Ett SQLite-baserat Durable Object per team      |
| Personens teamlista                                 | Ett separat Durable Object per person           |
| Direktuppdateringar och påminnelser                 | Vilande WebSockets och Durable Object-alarms    |
| Privata bilagor                                     | Workers KV, med behörighetskontroll genom API:t |
| Konto och lösenordsåterställning                    | Firebase Authentication med e-post och lösenord |

Samma verksamhetslogik används i Node-servern och Cloudflare-versionen. Firestore, Firebase Storage, Cloud Functions och R2 används inte. Firebase-lösenord hamnar aldrig i appens databas. Firebase-token kontrolleras mot Googles signeringsnycklar, projekt och giltighetstid. Teambehörighet kontrolleras vid varje API-anrop.

## Aktivera och publicera

1. I [Firebase Console](https://console.firebase.google.com/project/planner-tensetti/overview): registrera en webbapp under projektinställningarna om ingen finns. Kopiera dess publika `apiKey` och `appId`. Projektnumret är inte ett app-id.
2. Aktivera **Authentication → Sign-in method → Email/Password**. Appen använder lösenord med minst 12 tecken; sätt samma minimilängd i Firebase Auths lösenordspolicy. E-postverifiering krävs inte i den här piloten. Google-inloggning och SMS används inte.
3. Logga in på Cloudflare med `npx wrangler login`. Välj avsett konto med **Workers Free**. Om du har flera konton kan `CLOUDFLARE_ACCOUNT_ID` sättas i din lokala miljö. Skriptet uppgraderar ingen betalplan.
4. Kopiera `.dev.vars.example` till `.dev.vars` och fyll i `FIREBASE_API_KEY`, eller sätt den som miljövariabel. `.dev.vars` ignoreras av Git. `FIREBASE_APP_ID` finns redan i `wrangler.jsonc` och kan vid behov åsidosättas på samma sätt. Kontrollera före publicering nyckelns **API restrictions** i [Google Cloud → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=planner-tensetti): tillåt de Firebase-API:er som appen behöver, utan andra API:er som exempelvis Generative Language API.
5. Kör följande med Node.js 24:

```sh
npm ci
npm run deploy:pilot -- --dry-run
npm run deploy:pilot
```

Skriptet bygger rätt frontend och blockerar emulatorinställningar. Wrangler skapar Worker, SQLite-namnrymder och KV-bindning. Behåll eventuella resurs-id:n som Wrangler skriver till `wrangler.jsonc` inför nästa publicering. Konton och teamdata ligger kvar vid en vanlig koduppdatering.

6. Lägg den faktiska `planner-tensetti.<ditt-konto>.workers.dev`-domänen i **Authentication → Settings → Authorized domains**. En eventuell egen domän behöver också läggas till. Lägg inte till protokoll eller sökväg.
7. Kontrollera `/api/health`, `/api/config`, registrering, inloggning och lösenordsåterställning på den publicerade adressen. Skapa ett team, bjud in en kollega och prova samtidig redigering och en bilaga. En lyckad health-kontroll bevisar inte att Firebase är konfigurerat.

## API-nyckel och säkerhetslarm

Firebase-webbappens API-nyckel är publik klientkonfiguration och skickas till webbläsaren via `/api/config`. Att läsa den från miljön håller den utanför nya kodändringar men gör den inte hemlig i appen. Den ger inte administratörsbehörighet. Korrekt begränsning till Firebase-API:er är fortfarande nödvändig; se [Firebases dokumentation om API-nycklar](https://firebase.google.com/docs/projects/api-keys). Appens API skyddas separat med verifierade Firebase-token och teambehörigheter.

Nyckeln fanns i tidigare commit och är kvar i Git-historiken. [GitHubs säkerhetslarm #1](https://github.com/Jtensetti/samplanering/security/secret-scanning/1) har inte kunnat granskas i den tillgängliga sessionen och har inte stängts. Nyckelns faktiska API-begränsningar är ännu inte verifierade. Kontrollera att larmet avser denna klientnyckel och granska begränsningarna innan larmet klassificeras eller stängs. Om nyckeln också kan användas för andra tjänster behöver den begränsas och eventuell rotation bedömas utifrån exponeringen och övriga appar som använder den.

## Gratisnivå och pilotens gränser

Kontrollerat mot leverantörernas dokumentation den 29 september 2026. Kvoter delas med andra appar på samma konto; noll kostnad förutsätter att kontot använder rätt plan och håller sig inom relevanta gränser.

| Resurs                      | Cloudflare Free                                                         |
| --------------------------- | ----------------------------------------------------------------------- |
| Worker-anrop                | 100 000 per dag; 10 ms CPU per anrop                                    |
| Durable Object-anrop        | 100 000 per dag                                                         |
| Aktiv Durable Object-körtid | 13 000 GB-sekunder per dag                                              |
| SQLite                      | 5 GB totalt, 5 miljoner radläsningar och 100 000 radskrivningar per dag |
| KV                          | 1 GB totalt, 100 000 läsningar och 1 000 skrivningar per dag            |

Överskridna Free-kvoter ger fel tills kvoten återställs eller utrymme frigörs. Detta är inte en garanti för kostnader på ett Workers Paid-konto. I denna konfiguration passerar även statiska filer Workern för att få säkerhetsheaders och räknas därför som Worker-anrop.

Firebase har kostnadsfri e-post/lösenordsinloggning; om projektet har Identity Platform gäller dess kvoter, med 50 000 kostnadsfria månatligt aktiva användare för dessa inloggningsmetoder. Befintlig Blaze-koppling ändras inte. Andra tjänster eller appar i projektet kan fortfarande medföra kostnader.

Appen begränsar bilagor till 10 MB per fil och 100 MB per team, samt teamskapande till 20 registrerade team per person. Detta ersätter inte kontots totala kvoter. KV kan behöva en stund för att göra en ny bilaga tillgänglig; gränssnittet erbjuder **Försök igen**. Borttaget dokumentinnehåll ligger kvar i historiken; bilagor rensas inte automatiskt ur KV. Använd små testfiler och följ faktisk lagring i Cloudflare.

## Lokal kontroll utan riktiga konton

```sh
npm run build
npm test
npm run test:worker
npx playwright install chromium
npm run test:ui
npm run build:pilot:test
npm run test:pilot:ui
npm run build:pilot
npm run check:pilot
```

Pilottestet startar Firebase Auth-emulatorn och Cloudflares lokala körmiljö, skapar två oberoende konton och provar inbjudan, dokumentändringar, privat bilaga och kvarvarande inloggning efter omladdning. Ingen riktig Firebase-konfiguration behövs. `wrangler.pilot-test.json` och `tests/pilot/worker.mjs` är endast testkonfiguration; publicera dem aldrig.

## Kvar inför skarpt pilottest

Verifiera faktisk kontoplan, Firebase-konfiguration och den publicerade adressen. Belastning och Cloudflares CPU-gräns är inte verifierade i produktion. Varje förändring hämtar teamets aktuella poster, så piloten är avsedd för en liten grupp. Samtidig redigering fungerar per dokumentblock med konfliktval.

Det finns ännu inget automatiserat export-/återställningsflöde för Cloudflare-databaserna och KV tillsammans. En återställning av kod återställer inte data. Node-versionens konton och data migreras inte automatiskt till Firebase/Cloudflare. Starta denna pilot med nya konton och testdata.

Källor: [Workers-gränser](https://developers.cloudflare.com/workers/platform/limits/), [Durable Objects-priser](https://developers.cloudflare.com/durable-objects/platform/pricing/), [KV-priser](https://developers.cloudflare.com/kv/platform/pricing/), [Firebase-priser](https://firebase.google.com/pricing).
