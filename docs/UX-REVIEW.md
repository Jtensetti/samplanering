# Fält, färger och användarflöden

Granskning och implementation: 28 september 2026. Omfattar samtliga formulär i App, views, documents och advanced, de gemensamma komponenterna och navigationen. Upprepade instanser, exempelvis tabellceller, granskas som en fälttyp. Datamodellens interna fält omfattas inte.

## Principer och beslut

Apples riktlinjer för textfält rekommenderar storlek efter förväntad textmängd, jämna avstånd, begripliga etiketter och logisk tangentbordsordning. Dess UX-skribenter prioriterar begriplighet framför minsta möjliga textmängd. Material skiljer mellan färgroller för handling, yta, avgränsning och fel. Det är dessa principer vi tillämpar. Måtten nedan är våra val för en webbapp, inte en översättning av Apples punkter eller Googles dp, och inte ett påstående om formell certifiering.

- Vanliga inmatningsfält och knappar: minst 44 CSS-pixlar höga, 48 vid grov pekare. Samma grundhöjd i varje rad. Inmatningstext är minst 16 px, också på mobil.
- Korta värden: upp till 12 rem. Datum: samma bredd som andra datum, upp till 14 rem på dator och 16 rem på mobil. Namn och längre svar får den tillgängliga kolumnbredden. Relaterade fält delar rutnät och etikettlinje.
- Fritext börjar med två till fyra rader och växer till innehållet, upp till 480 px. Därefter går texten att rulla. Uppgiftstitlar och rubriker radbryts. Vi döljer inte lång text i ett smalt enradigt fält.
- Etiketter ligger kvar när användaren börjar skriva. Platshållare används som exempel eller för tomma dokument, inte som enda identifiering av inställningsfält. Etikett, hjälp och fel är kopplade till den faktiska kontrollen.
- En mindre ruta får aldrig innebära en mindre träffyta. Kryssrutornas etiketter är klickbara. Menyer och ikonknappar har samma minsta träffyta som andra kontroller.
- Vanlig text sparas automatiskt. Publicering av kommentarer och strukturella ändringar av svarsalternativ kräver en uttrycklig handling. Misstag ska gå att upptäcka och rätta utan att förlora utkastet.

## Färger har roller

| Roll                      | Färg                             | Användning                                                     |
| ------------------------- | -------------------------------- | -------------------------------------------------------------- |
| Text                      | `#202124`                        | Innehåll och etiketter                                         |
| Sekundär text             | `#5f6368`                        | Hjälp, datum och sparstatus                                    |
| Inmatning                 | Vit, ram `#80868b`               | Samma utseende oavsett datatyp                                 |
| Neutral yta               | `#f6f7f8`                        | Gruppering, läsläge och inaktiva kontroller                    |
| Primär handling och fokus | `#1967d2`                        | Skapa, spara, skicka och fokusmarkering                        |
| Vald navigation           | `#e8f0fe`, text `#174ea6`        | Aktuell plats eller valt alternativ                            |
| Klart                     | `#137333`, yta `#e6f4ea`         | Avslutat arbete, alltid med text eller symbol                  |
| Fel/destruktiv handling   | `#b3261e`, yta `#fceeee`         | Felmeddelanden, ogiltiga fält och borttagning                  |
| Uppmärksamhet             | `#7a4d00`, yta `#fff4db`         | Exempelvis beroenden som väntar                                |
| Identitet                 | Planens eller lappens valda färg | Igenkänning, ingen inbyggd betydelse om status eller prioritet |

Avgränsande linjer är ljusare än inmatningsramar. Därmed behöver inte varje informationsyta se ut som ett redigerbart fält. Vanlig status är neutral; blått ska inte påstå att en öppen uppgift är en knapp. Rött kompletteras med feltext, och färdig status med ordet Klar eller en bock.

Beräknad kontrast för färgparen ovan: huvudtext 16,10:1, sekundär text 6,05:1, vit knapptext på blått 5,37:1, klart 5,24:1, fel 5,79:1 och uppmärksamhet 6,65:1. Inmatningsram mot vitt: 3,68:1. Siffrorna gäller dessa färgpar, inte varje möjlig kombination av användarvald färg och innehåll.

## Fält för fält · 90 bedömningar

### Konto, team och navigation

| Fält                           | Bedömning och ändring                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Ditt namn                      | Behåll full formulärbredd. Synlig etikett och namnkomplettering.                                         |
| E-post                         | Samma bredd som namn/lösenord. E-posttangentbord, ingen automatisk versal eller stavningskontroll.       |
| Lösenord                       | Samma bredd. Behåll dolt innehåll, lösenordshanterarstöd och kravet på minst 12 tecken vid registrering. |
| Teamets namn                   | Full bredd i den korta startdialogen. Ett konkret exempel hjälper första användningen.                   |
| Nytt teams namn                | Samma namnfält och skapa/avbryt-ordning som andra dialoger.                                              |
| Inbjudningslänk för att gå med | Full bredd, synlig etikett. Ingen versalisering eller stavningskontroll av token.                        |
| Behörighet vid inbjudan        | Samma vanliga valfält. Behåll skillnaden mellan läsa och redigera; den påverkar åtkomst.                 |
| Genererad inbjudningslänk      | Läsläge, full tillgänglig bredd, separat Kopiera länk. Knappen flyttar till egen rad på smal skärm.      |
| Teamväljare                    | Fyll sidomenyn. Samma kontrollhöjd som resten av appen och större inmatningstext.                        |
| Sök uppgifter/innehåll         | Tydligare avgränsat sökfält, upp till 360 px på dator och tillgänglig bredd på mobil.                    |
| Sök dokument                   | Samma geometri och fokusmarkering som uppgiftssökningen.                                                 |
| Filter: ansvarig               | Fyll sin kolumn; etiketten ligger kvar.                                                                  |
| Filter: etikett                | Matcha ansvarig i höjd och etikettlinje.                                                                 |
| Filter: gruppering             | Matcha övriga filter. Rensa/Spara vy linjerar med kontrollerna, inte rubrikerna.                         |
| Namn på sparad vy              | Behåll ett namnfält med tydlig skapaåtgärd.                                                              |

### Plan och inställningar

| Fält                         | Bedömning och ändring                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Namn vid skapande av plan    | Full dialogbredd, fokus direkt i fältet.                                                                 |
| Startpunkt för plan          | Behåll radioval i klickbara kort. Beskrivningarna hjälper valet av arbetsstruktur.                       |
| Planens namn i inställningar | Ge mer plats än planfärgen. Koppla synlig etikett till textfältet.                                       |
| Planfärg                     | Korta alternativ behöver mindre bredd. Namnet beskriver att färgen hör till planen.                      |
| Befintlig kolumns namn       | Flexibel bredd; samma höjd som dess kryssruta och flyttknapp.                                            |
| Kolumn markerar klart        | Behåll kryssruta med klickbar etikett. Inställningen påverkar uppgifterna, så betydelsen måste stå kvar. |
| Ny kolumn                    | Synlig etikett och växande bredd i samma rad som Lägg till kolumn. Knappen är inaktiv vid tom text.      |
| Befintligt eget fältnamn     | Behåll redigering i listan. Typ och Visa/Dölj hör till samma rad.                                        |
| Namn på nytt eget fält       | Längre än typvalet; konkret exempel, inte en instruktion om hela funktionen.                             |
| Sorts svar                   | Samma höjd som namnet. Visa alternativen först när Välj ett alternativ väljs.                            |
| Nya svarsalternativ          | Full bredd. Flytta kommaseparering till kopplad hjälptext.                                               |
| Mall för nya uppgifter       | Synlig etikett och full bredd. Behåll Tomt dokument som ett tydligt val.                                 |

### Uppgift och gemensamt dokument

| Fält                         | Bedömning och ändring                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Ny uppgifts titel            | Kort startdialog; inga onödiga inställningar före första uppgiften.                             |
| Uppgiftens/dokumentets titel | Väx från en till flera rader så hela titeln kan läsas. Diskret ram visar att den kan redigeras. |
| Kolumn                       | Fyll sidospalten; samma kontrollhöjd som datum.                                                 |
| Ansvariga                    | Klickbara rader med namn, avatar och kryssruta. Färg behövs inte för att beskriva ansvar.       |
| Startdatum                   | Smalare, samma bredd som slutdatum. Datumväljaren får slutdatum som övre gräns.                 |
| Slutdatum                    | Matcha startdatum. Startdatum anges som nedre gräns; serverns validering finns kvar.            |
| Prioritet                    | Kort val behöver mindre bredd. Texten Låg/Normal/Hög bär betydelsen.                            |
| Återkommande uppgift         | Etiketten När uppgiften blir klar ger tidpunkten; alternativen beskriver vad som sker.          |
| Etiketter                    | Full tillgänglig bredd. Behåll kommaseparering som kort hjälptext, med riktig etikettkoppling.  |
| Uppskattad tid               | Kort fält med decimalinmatning. Svenskt decimalkomma stöds; fel visas vid fältet.               |
| Arbetsperiod                 | Full bredd för periodnamn. Ej inplanerat ersätter Backlog.                                      |
| Del av uppgift               | Full bredd för uppgiftstitlar. Fristående uppgift är tydligt standardval.                       |
| Väntar på uppgifter          | Klickbara kryssrader. Behåll uppgiftstiteln och eventuell klarstatus.                           |
| Ny deluppgift                | Samma skapaflöde som andra uppgifter.                                                           |
| Kopplat dokument             | Full bredd för dokumentnamn; öppningsknappar och väljare hålls tillsammans.                     |
| Nytt gemensamt dokument      | Samma namndialog som övriga objekt.                                                             |
| Sorts dokument               | Samma neutralform som övriga val. Kategorin behöver inget eget färgspråk.                       |
| Eget textfält                | Två rader som växer. Tidigare kunde längre svar döljas i ett smalt enradigt fält.               |
| Eget talfält                 | Kortare bredd och decimaltangentbord. Ingen extra färg för siffervärden.                        |
| Eget datumfält               | Samma datumgeometri som övriga datum.                                                           |
| Eget valfält                 | Full tillgänglig bredd och synlig, kopplad etikett.                                             |
| Egen kryssruta               | Etikett och kontroll på samma rad. Hela etiketten aktiverar rutan.                              |

### Arbetsdokument och samtal

| Fält                              | Bedömning och ändring                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Första texten i ett tomt dokument | Fyra rader från början, växer med innehållet. Kortare platshållare; Inte sparat ännu och Lägg till text förklarar den första sparningen. |
| Textblock                         | Tre rader från början; växer till innehållet. Neutral inmatning med synligt fokus och sparstatus.                                        |
| Rubrikblock                       | Radbryt lång rubrik. Behåll större text som visar dess strukturella roll.                                                                |
| Rubrik på svarsfält               | Fet text skiljer frågan från svaret. Ge alternativmenyn egen yta så den inte täcker texten.                                              |
| Fritextsvar                       | Flera rader som växer. Samma ram som textblock.                                                                                          |
| Rubrik på flervalsfält            | Samma utseende som rubriken på fritextsvar.                                                                                              |
| Valt svar                         | Full bredd under frågan, neutral färg och tydligt tomt val.                                                                              |
| Ändra svarsalternativ             | Flera rader, ett alternativ per rad. Spara alternativ krävs; ett befintligt svar bevaras om det fortfarande är giltigt.                  |
| Checklistans kryssrutor           | Hela texten går att trycka på. Bock och överstrykning visar klart.                                                                       |
| Ny checklistpunkt                 | Beständig etikett, full tillgänglig bredd; knappen linjerar med fältet och flyttar ned vid behov.                                        |
| Tabellcell                        | Behåll kompakt rutnät men större inmatningstext. Breda tabeller rullas inne i dokumentet.                                                |
| Webbadress                        | Synlig etikett, URL-typ och URL-komplettering. Behåll protokollvalideringen och länken för att öppna adressen.                           |
| Fil/bild                          | Behåll systemets filväljare. Bifoga fil får synligt fokus även när den underliggande kontrollen är visuellt dold.                        |
| Lägg till från mall               | Behåll nära dokumentets rubrik. Större text och bredd; flyttar till ny rad om utrymmet kräver det.                                       |
| Kommentar                         | Två rader som växer, synlig etikett. Tomt innehåll kan inte skickas.                                                                     |
| Uppmärksamma kollega i kommentar  | Synlig etikett och valfritt-markering. Ligger i samma handlingsrad som Skicka.                                                           |
| Meddelande till teamet            | Samma skriv- och sändbeteende som kommentarer; högst 10 000 tecken.                                                                      |
| Uppmärksamma kollega i teamsamtal | Samma utseende och logik som i kommentarer.                                                                                              |

### Planverktyg

| Fält                           | Bedömning och ändring                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Regel: kolumn                  | Första steget i en vertikal, avgränsad regelbyggare.                                                     |
| Regel: åtgärd                  | Andra steget; ändrar vilka mottagare/mallar som är relevanta.                                            |
| Regel: kollega/dokumentmall    | Tredje steget. Behåll hjälp om mallar där det annars saknas ett val.                                     |
| Aktivera regel                 | Klickbar kryssrad med hela regelns betydelse.                                                            |
| Ny whiteboardlapp              | Flera rader i stället för enradig titel; högst 2 000 tecken enligt datamodellen.                         |
| Lappens text                   | Växande skrivyta med samma gräns.                                                                        |
| Lappfärg                       | Behåll fria kategorifärger utan att koppla dem till systemstatus.                                        |
| Lappens uppgiftskoppling       | Bredare än ett kort färgval; visa uppgiftstitlar.                                                        |
| Koppling till andra lappar     | Klickbara textrader; behåll markeringen vid samtidiga uppdateringar.                                     |
| Uppnått målvärde               | Kort sifferfält med decimaler, korrekt etikettkoppling och validering av negativa tal.                   |
| Nytt måls namn                 | Full formulärbredd.                                                                                      |
| Målvärde                       | Kortare än målnamnet, samma höjd som enheten intill.                                                     |
| Enhet                          | Behåll ett konkret exempel; talet behöver en begriplig enhet.                                            |
| Målets slutdatum               | Samma datumkontroll som övriga flöden; tydligt valfri.                                                   |
| Vald arbetsperiod              | Tydligt Ej inplanerat-alternativ. Tillgänglig bredd för periodnamn.                                      |
| Arbetsperiod per uppgift       | Bredd begränsad till 240 px på dator; radbryter till egen rad på mobil.                                  |
| Ny arbetsperiods namn          | Full bredd och konkret exempel.                                                                          |
| Arbetsperiodens startdatum     | Matchar slutdatum i höjd och bredd.                                                                      |
| Arbetsperiodens slutdatum      | Samma datumrad, med lägsta giltiga datum från startfältet.                                               |
| Arbetsperiodens gemensamma mål | Växande fritextyta och tydlig valfritt-markering.                                                        |
| Tidsregistrering: minuter      | Kort sifferfält. Behåll gränserna 1–1 440.                                                               |
| Tidsregistrering: datum        | Samma datumgeometri som andra datum.                                                                     |
| Tidsregistrering: anteckning   | Full bredd och valfritt-markering. Behåll informationen om hur tidtagningen fortsätter när sidan stängs. |

## Copy som kortats eller tagits bort

Vi har tagit bort upprepade hälsnings- och introduktionstexter på Planer och Mina uppgifter, dekorativa överrubriker, den konstanta texten Gemensam arbetsyta och instruktionen som förklarade Markera som klar. Anslutningsproblem, läsbehörighet och sparstatus visas fortfarande när de hjälper användaren.

Kommentarernas tomma introduktion upprepade skrivytans syfte och är borttagen för den som kan skriva. Teamsamtal behåller däremot att meddelandet syns för hela teamet; det påverkar vad man vill dela. Inbjudan behåller giltighet och antal användare. Lösenordskrav, formatregler, konflikter, återställning och timerbeteende behålls.

## Logiska steg

1. **Kom igång:** skapa konto → skapa/gå med i team → namnge plan och välj startpunkt → skapa uppgift. Vi kräver inte detaljkonfiguration före första arbetsobjektet.
2. **Arbeta:** hitta uppgiften → läs titel/status → ändra ansvar/datum vid behov → arbeta i dokumentet → lämna kommentar eller markera klart. På mobil följer DOM- och fokusordningen samma ordning som den synliga layouten.
3. **Anpassa:** öppna Anpassa plan → ändra identitet/kolumner → lägg till egna fält/mall. Gemensamma fälttyper behåller samma utseende i inställningar och användning.
4. **Fördjupa:** öppna Planverktyg eller uppgiftens detaljer. Ett extra lager med Fler detaljer inne i redan utfällda detaljer är borttaget. Avancerade funktioner finns kvar där de hör hemma.
5. **Återhämta:** fel visas i aktiv dialog och vid textfältet. Kommentarer bevaras vid misslyckad sändning. Samtidig textredigering behåller utkast och kräver versionsval vid konflikt.

## Verifiering och begränsningar

Automatiska flödestester täcker skapande, samarbete, planverktyg, mallar, mobilvy samt fältgranskningens beteenden: långa texter, likadana datumfält, kopplade etiketter, svensk decimalinmatning, bevarat flervalssvar, misslyckad kommentarsändning och smal pekskärm. Kontrollera resultatet från senaste CI-körningen tillsammans med ändringen.

En källkodsgranskning och webbläsartester är inte en full tillgänglighetscertifiering. Riktiga användartester, VoiceOver/Safari och TalkBack på fysisk hårdvara återstår. Färgerna för planer/lappar är avsiktligt fria; användarnas egen betydelse kan inte garanteras. Första dokumenttexten läggs fortfarande till uttryckligen medan befintlig text sparas automatiskt, vilket bör observeras i piloten.

## Primärkällor

- [Apple HIG: Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields) – storlek, etiketter, avstånd, tangentbordsordning och validering. Innehållet läst via Apples publika dokumentationsdata.
- [Apple: Q&A with the UX writing team](https://developer.apple.com/news/?id=5mcfho5g) – kort text med bibehållen tydlighet och hjälp i rätt sammanhang.
- [Material 3: Color roles](https://m3.material.io/styles/color/roles) – roller för primärfärg, ytor, avgränsning och fel.
- [Material 3: Text fields](https://m3.material.io/components/text-fields/guidelines) – kontrollernas tillstånd och synlig återkoppling.
