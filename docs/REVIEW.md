# Kritisk granskning

## Etapp 1

**Kontrollerat:** ett riktigt API med SQLite, inloggade användare, skilda team och roller. Integrationstestet verifierar att en utomstående inte kan läsa/ändra ett team, att läsare inte kan skriva, att inbjudningar bara går att använda en gång och att gamla blockversioner ger konflikt utan att skriva över senaste text. Databasen öppnas igen för att verifiera lagring.

**Fynd och rättningar:**

- Introduktionens felmeddelanden hamnade först utanför vyn. Notiser är nu gemensamma även före teamskapandet.
- Hjälptext ingick i fältens tillgängliga namn. Etikett och beskrivning är nu separata och kopplade med id/aria-describedby.
- Stängning kunde dölja ett osparat utkast. Dialogen frågar nu vid osparade ändringar.
- Oväntade serverfel kunde läcka intern feltext. De ger nu ett generiskt fel och loggas på servern.

**Webbläsarkontroll:** registrering → team → plan → kort → textblock → omladdning → återöppning samt mobilnavigation fungerar. Skärmbilder av tavla och öppet dokument har granskats. Ett problem med inmatning isolerades till testwebbläsarens typsnittsmiljö, inte produkten.

**Begränsning:** samarbete sker per block med versionskontroll. Två personer kan arbeta i olika block. Samtidig redigering av exakt samma block kräver ett uttryckligt konfliktval; detta är inte teckenvis Google Docs-samskrivning. Konton använder lösenord; e-postadressen är inte verifierad och ingen e-posttjänst kopplas in.

## Etapp 2

**Kontrollerat:** mall för systeminförande skapar kolumner, typade fält och dokumentstruktur. Ett fältsvar skrivs genom gränssnittet, återfinns genom sökning och bevaras i API:t. Samma daterade uppgift syns i kalender och tidslinje. Ett separat test med två oberoende webbläsarsessioner verifierar att ett osparat utkast bevaras när en kollega skriver samma block; användaren kan därefter välja senaste versionen.

**Fynd och rättningar:**

- Att ta bort fält skulle också kunna förstöra tidigare svar. Anpassningen använder nu Dölj/Visa och bevarar data.
- Sparade filter kunde följa med till fel plan. Planvyn får nu en egen komponentidentitet per plan.
- Historiken visade först teknisk JSON. Den visar nu begripligt innehåll och stödjer återställning också till första versionen.
- Teambyte kunde lämna huvudytan på en plan som tillhörde det förra teamet. Teambyte återgår nu till planöversikten.

**Kvarvarande gräns:** tidslinjen är en Gantt-vy över uppgifternas start/slutdatum. Datum redigeras i kortet; den flyttar inte automatiskt efterföljande uppgifters datum. En publicerad anonym enkät är inte en del av denna version; formulären fylls i av teamets inloggade medlemmar.

## Etapp 3

**Kontrollerat:** serverregler tilldelar rätt person vid kolumnbyte, påminnelser dubbleras inte, återkommande uppgifter hanterar månadsslut/skottår och samma klarmarkering skapar högst en efterföljare. Tidtagning har en aktiv timer per person. Kopplingar mellan olika team avvisas. Webbläsartestet skapar regel, whiteboardlapp, uppgift från lappen, arbetsperiod, mål och teamsamtal genom gränssnittet.

**Fynd och rättningar:**

- Ny text som skrevs medan ett tidigare sparanrop väntade kunde skrivas över av svaret. Sparningen jämför nu utkastets revision och lämnar fortsatt skrivning kvar. Ett fördröjt nätverkssvar i webbläsartestet verifierar detta.
- Whiteboardkopplingar kunde peka på en borttagen lapp och hindra fortsatt redigering. Inkommande kopplingar rensas nu i samma databastransaktion. Testet redigerar den kvarvarande lappen efter radering.
- Timer kunde inte stoppas om uppgiften arkiverats. Tidsloggen kan nu avslutas på en arkiverad uppgift, vilket också testas.
- Ändring av fält via API kunde förstöra tolkningen av tidigare svar. Servern avvisar borttagning/typbyte när sparade värden påverkas; Dölj finns kvar.
- En borttagen medlem kunde lämna uppgifter och regler som inte gick att redigera. Ansvar rensas och personens regler stängs av vid borttagning.
- Uppnått målvärde skickades först vid varje tangenttryckning. Det sparas nu när fältet lämnas och har samma konflikthantering som texten.
- Chattomnämnanden länkar nu till teamsamtalet. Dialogens rubrik och stängknapp följer med när innehållet rullas.
- Öppna serverströmmar kunde fördröja normal avstängning. De stängs nu innan processen väntar på avslut.
- Den första Docker-startkontrollen i CI avbröts vid en återställd anslutning under uppstart. Kontrollen försöker nu igen även vid detta uppstartsfall och visar containerloggen vid kvarstående fel.

**Slutlig lokal verifiering:** tre Node-testfall med flera API-/lagringsassertioner och fyra Playwright-testfall godkända. Produktionsbygget godkänt. `npm audit --omit=dev` rapporterade inga kända sårbarheter vid kontrollen den 28 september 2026. Kod och dokument är formaterade med Prettier. Skärmbilder av desktop, dokument, mobil, tidslinje och uppföljning har granskats.

**Kritisk slutsats:** bredden är stor för en prototyp. Nästa prioritet bör vara observerade användartester och förenkling, inte fler funktioner. Att alla verktyg använder samma kort minskar dubbelarbete, men enkelheten är ännu inte verifierad med nya användare. Funktionerna är grundversioner: whiteboard är en idétavla, beroenden är kopplingar och belastning är en summering av uppskattningar. E-post/SSO, anonym formulärpublicering, integrationsmotor, avancerad Gantt och teckenvis samskrivning återstår. Offlinearbete och större datamängder är inte verifierade; klienten hämtar teamets aktuella poster vid förändring.

**Driftgräns:** Docker/Caddy är förberett med beständig volym och HTTPS-konfiguration. Docker saknades i den lokala arbetsmiljön, så containerkontrollen ligger i GitHub Actions. Ingen publik instans har driftsatts. Instruktioner för start, gemensam testadress och säkerhetskopiering finns i DRIFT.md.

## Frontend efter Classroom-studien

Startsidan prioriterar nu personens nästa uppgifter. Planen skiljer arbete från planverktyg, och öppnade uppgifter ger dokumentet huvudutrymmet. Ansvariga och datum är samlade i sidospalten och infällbara på mobil. Mina uppgifter skiljer öppna, försenade och klara uppgifter. Planens namn redigeras i Anpassa plan. Text i befintliga block sparas efter en kort paus.

Granskningen hittade två problem att rätta: ett första osparat utkast kunde döljas när en kollega lade till ett block, och globala felmeddelanden kunde hamna bakom en öppen dialog. Utkastet bevaras nu vid serveruppdateringar och aktiv dialog visar fel och Ångra. Båda flödena ingår i det nya webbläsartestet. En pilikon ersatte även ett plustecken som inte visades korrekt i testwebbläsarens mobilläge.

Fem Playwright-testfall passerar lokalt, inklusive sparande utan att lämna fältet, konfliktval, fortsatt skrivning under långsam sparning, tangentbordsnavigation mellan flikar, mobil datumredigering, felåterkoppling och bevarat första utkast vid samtidig ändring. Desktop- och mobilbilder har granskats. Principer, primärkällor och återstående användbarhetsfrågor finns i CLASSROOM.md.

Den första CI-körningen upptäckte ett intermittent fel i simuleringen av långsamt nätverk. Spårningen visade att avregistrering av testets engångsinterceptor kunde lämna en samtidig tillståndshämtning pausad. Interceptorn ligger nu kvar under testet och fördröjer endast den första sparningen. Samma scenario passerade därefter sex lokala körningar i följd.

## Fältgranskning enligt Apple och Material

90 fält och fälttyper har bedömts i UX-REVIEW.md. Gemensamma regler styr kontrollhöjd, textstorlek, korta värden, datum, växande fritext och färgroller. Överflödig introduktionstext är borttagen, medan behörighet, sparande, formatkrav och konsekvenser behålls. Etiketter pekar på faktiska kontroller, textfel kopplas till fältet och mobilens synliga ordning följer fokusordningen. En överflödig nivå med Fler detaljer är borttagen.

Granskningen hittade att redigering av flervalsalternativ nollställde ett befintligt svar. Alternativ redigeras nu med uttrycklig sparning och svaret behålls om det fortfarande finns i listan. Kommentarer och teamsamtal blockerar dubbelsändning medan ett anrop väntar och behåller text vid fel.

Sex Playwright-testfall passerar lokalt. Det nya testet verifierar bland annat långa texter, validering vid rätt fält, svenska decimaler, bibehållet flervalssvar, misslyckad kommentarsändning och 320 px pekskärm. Visuell kontroll omfattar arbetsyta, mobil, planinställningar och namnfältens/färgvalets inbördes geometri. Beräknad kontrast för systempalettens textpar är minst 5,24:1; inmatningsram mot vitt är 3,68:1. Det är en kontroll av dessa färgpar, inte en full certifiering av hela appen.

## Cloudflare-pilot med Firebase Auth

Den gemensamma verksamhetslogiken har lyfts ut från Express och återanvänds i en SQLite-arbetsyta per team på Cloudflare. Firebase hanterar konto och lösenord, medan dokument, behörigheter, regler, påminnelser och bilagor stannar på Cloudflare. Node-/Docker-versionen finns kvar.

**Kritiska fynd och rättningar:**

- En enda gemensam arbetsyta hade samlat alla team i samma databas. Varje team har nu ett separat Durable Object och en serverkontrollerad medlemslista.
- Cloudflare RPC bevarar inte egna statusfält på undantag. Ett uttryckligt svarskontrakt bevarar bland annat 403, 409 och 410 så att konflikt- och behörighetsflöden fungerar.
- En inbjudan kunde förbrukas innan teamlistan hunnit uppdateras. Samma mottagare kan säkert försöka igen, medan andra mottagare nekas återanvändning.
- Teamskapande kan skickas dubbelt vid långsamt nätverk. Knappen visar vänteläge och återförsök använder samma anrops-id.
- Firebase-token ska inte ligga i WebSocket-adressen. Anslutningen får i stället en engångsbiljett, kontrollerar medlemskap och kopplas från när åtkomsten tas bort.
- Bilagor kan inte längre öppnas med en oskyddad statisk URL. Klienten hämtar dem med Firebase-token och skapar en tillfällig lokal länk. Uppladdning kontrollerar behörighet och reserverar utrymme före väntan på KV.
- Normal utloggning kan stänga en WebSocket utan statuskod. Servern svarar nu med en giltig stängningskod i stället för att försöka skicka den reserverade koden 1005.
- Produktionsbygget blockerar testprojekt/emulatoradress. Publiceringsskriptet tolkar JSONC, inklusive kommentarer och avslutande kommatecken. Docker-bygget inkluderar den gemensamma validering som frontend använder.

**Verifiering:** tre Node-testfall och sex befintliga webbläsartestfall passerar. Fyra testfall i Cloudflares riktiga lokala körmiljö verifierar bland annat teamisolering, roller, versionskonflikter, återöppnad lagring, signerade token, engångsinbjudningar, indragen direktåtkomst, regler, återkommande datum, larm, timer och privata bilagor. Ett separat webbläsartest med två Firebase-emulatorkonton verifierar registrering, inbjudan, inloggning, begäran om lösenordsåterställning, nedladdning av bilaga, dokumentändringar mellan användare och inloggning efter omladdning. Testerna skickar inga riktiga mejl.

**Kvar:** faktisk driftsättning, projektets inloggningsinställningar, leverans av återställningsmejl och prestanda inom Workers Free har inte verifierats. Cloudflare- och Firebase-kontona är inte tillgängliga i utvecklingsmiljön. Piloten saknar samordnad export/återställning av SQLite och KV och automatisk rensning av historiska bilagor. Dessa gränser och kostnadskvoter beskrivs i PILOT.md. Ingen migrering av befintliga Node-konton eller data har gjorts.
