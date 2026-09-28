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

**Slutlig lokal verifiering:** tre Node-testfall med flera API-/lagringsassertioner och fyra Playwright-testfall godkända. Produktionsbygget godkänt. `npm audit --omit=dev` rapporterade inga kända sårbarheter vid kontrollen den 28 september 2026. Kod och dokument är formaterade med Prettier. Skärmbilder av desktop, dokument, mobil, tidslinje och uppföljning har granskats.

**Kritisk slutsats:** bredden är stor för en prototyp. Nästa prioritet bör vara observerade användartester och förenkling, inte fler funktioner. Att alla verktyg använder samma kort minskar dubbelarbete, men enkelheten är ännu inte verifierad med nya användare. Funktionerna är grundversioner: whiteboard är en idétavla, beroenden är kopplingar och belastning är en summering av uppskattningar. E-post/SSO, anonym formulärpublicering, integrationsmotor, avancerad Gantt och teckenvis samskrivning återstår. Offlinearbete och större datamängder är inte verifierade; klienten hämtar teamets aktuella poster vid förändring.

**Driftgräns:** Docker/Caddy är förberett med beständig volym och HTTPS-konfiguration. Docker saknades i den lokala arbetsmiljön, så containerkontrollen ligger i GitHub Actions. Ingen publik instans har driftsatts. Instruktioner för start, gemensam testadress och säkerhetskopiering finns i DRIFT.md.
