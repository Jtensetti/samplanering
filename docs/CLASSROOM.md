# Vad vi tar med oss från Google Classroom

Studie och implementation: 28 september 2026. Underlaget är Googles egen dokumentation om startsida, uppgifter, material och navigering. Vi har inte utvärderat användares upplevelse empiriskt eller använt någon privat Classroom-miljö. Påståenden om varför strukturen hjälper är vår designbedömning.

## Observerad struktur → vårt designbeslut

| I Classroom                                                           | Princip vi använder                             | Förändring i Samplanering                                                                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startsidan visar angelägna uppgifter och ingångar till klasser.       | Hjälp användaren att hitta arbetet som väntar.  | På tur för dig ligger före planerna. Öppna, personligen tilldelade uppgifter sorteras efter slutdatum.                                            |
| Uppgifter, kommunikation och personer har tydliga platser.            | Ge varje plats ett begripligt syfte.            | Planens Uppgifter skiljs från Planverktyg. Teamsamtal och Team och delning har fasta ingångar.                                                    |
| Uppgifter har instruktioner, material och ett tydligt arbetsflöde.    | Samla det som behövs för att göra arbetet.      | Dokumentet står i centrum. Ansvariga och datum ligger bredvid på dator och kan fällas ut på mobil. Markera som klar är uppgiftens tydliga avslut. |
| Att-göra-vyn skiljer tilldelat, saknat och färdigt arbete.            | Visa läget på ett sätt som leder till handling. | Mina uppgifter har Att göra, Försenade och Klart. Öppna uppgifter grupperas efter datum.                                                          |
| Klasskort ger igenkännbara ingångar till samma återkommande struktur. | Behåll sammanhanget mellan översikt och detalj. | Planernas namn och färg följer med från översiktskort till planhuvud. Öppnade uppgifter visar vilken plan de hör till.                            |

Classrooms koppling till Google-dokument gör material till en del av uppgiften. Vår motsvarighet är det redan inbyggda arbetsdokumentet: text, checklistor, svar och bilagor stannar i uppgiften. Detta arbete lägger inte till någon Google-integration.

## Sparande och återkoppling

Text i befintliga block sparas efter 900 ms skrivpaus eller när fältet lämnas. Osparade ändringar, pågående sparning, sparat och fel har skilda statusar. Vid nätverksfel finns Försök igen; vid versionskonflikt finns senaste innehållet och ett uttryckligt versionsval. Automatiska försök stoppas vid fel så att en misslyckad sparning inte skapar en begärandeloop.

Ett tomt dokument låter användaren börja skriva direkt och lägga till den första texten med en tydlig knapp. Det utkastet ligger kvar även om en annan person hinner lägga till innehåll. Flytt- och raderingsknappar för block finns i Fler alternativ. Felmeddelanden och Ångra visas även inne i den aktiva dialogen, där användaren befinner sig.

## Kritisk granskning

- Klassrumsroller, bedömning och inlämning passar inte automatiskt ett jämbördigt arbetslag. Samplanering behåller teamets roller och gemensamma redigering.
- Bredden finns kvar, men avancerade verktyg är samlade. Användartestet behöver kontrollera att de fortfarande hittas.
- Texten i det första tomma dokumentet läggs till uttryckligen; befintliga block sparas automatiskt. Knapp och återkoppling gör skillnaden synlig, men detta bör särskilt observeras i piloten.
- En snyggare layout bevisar inte högre användbarhet. Be en ny användare hitta sin uppgift, skriva, sätta datum och markera klart utan instruktioner.
- Fem webbläsartester täcker det första flödet, mallar/vyer, samarbete, avancerade verktyg och den nya arbetsytan. De ersätter inte användartest eller kontroll i alla webbläsare.

## Primärkällor

- [Get started with Classroom for teachers](https://support.google.com/edu/classroom/answer/9582854?hl=en&co=GENIE.Platform%3DDesktop) – startsida, Stream, Classwork, People och arbetsstatus.
- [Find your Classwork](https://support.google.com/edu/classroom/answer/6020284?hl=en) – kommande arbete, tilldelat/saknat/klart och vägen till en uppgift.
- [Create an assignment](https://support.google.com/edu/classroom/answer/6020265?hl=en) – instruktioner, datum, material och dokument i uppgiftsflödet.
- [Navigate your Classroom homepage](https://support.google.com/edu/classroom/answer/17231999?hl=en) – startsida som prioriterar relevant arbete.
