// These are starting structures, never fabricated team activity.
export const presets = {
  blank: {
    name: "Tom plan",
    description: "Börja med Att göra, Pågår och Klart.",
    buckets: ["Att göra", "Pågår", "Klart"],
    fields: [],
    blocks: [],
  },
  implementation: {
    name: "Införa ett system",
    description: "Från behov till införande och uppföljning.",
    buckets: [
      "Behov och idé",
      "Utredning",
      "Beslut",
      "Införande",
      "Uppföljning",
      "Klart",
    ],
    fields: [
      ["Verksamhet", "text"],
      ["Beslutsdatum", "date"],
    ],
    blocks: [
      { type: "heading", text: "Behov och önskat resultat" },
      { type: "input", title: "Vilket problem ska vi lösa?" },
      {
        type: "checklist",
        items: [
          "Beskriv behovet",
          "Utse ansvarig",
          "Bedöm risker",
          "Planera uppföljning",
        ],
      },
      { type: "input", title: "Vad behöver nästa person veta?" },
    ],
  },
  crm: {
    name: "Kontakter och affärer",
    description: "Följ kontakter från första samtal till överenskommelse.",
    buckets: ["Ny kontakt", "Samtal pågår", "Förslag", "Överenskommet"],
    fields: [
      ["Organisation", "text"],
      ["Kontaktperson", "text"],
      ["E-post", "text"],
      ["Värde (kr)", "number"],
    ],
    blocks: [
      { type: "input", title: "Bakgrund och behov" },
      { type: "text", text: "Anteckningar från samtalet" },
      { type: "input", title: "Nästa steg" },
    ],
  },
  travel: {
    name: "Reseplanering",
    description: "Resmål, datum, bokningar och saker att komma ihåg.",
    buckets: ["Att boka", "Bokat", "Under resan", "Klart"],
    fields: [
      ["Plats", "text"],
      ["Kostnad (kr)", "number"],
      ["Bokningsreferens", "text"],
    ],
    blocks: [
      { type: "input", title: "Tid och plats" },
      { type: "link", title: "Bokning eller vägbeskrivning" },
      {
        type: "checklist",
        items: ["Kontrollera bokningen", "Samla biljetter"],
      },
    ],
  },
  subscriptions: {
    name: "Prenumerationer",
    description: "Samla abonnemang, kostnader och förnyelsedatum.",
    buckets: ["Att utvärdera", "Aktiva", "Avslutade"],
    fields: [
      ["Leverantör", "text"],
      ["Månadskostnad (kr)", "number"],
      ["Förnyas", "date"],
      ["Kategori", "select", ["Arbete", "Utbildning", "Övrigt"]],
    ],
    blocks: [
      { type: "input", title: "Vad använder vi tjänsten till?" },
      { type: "input", title: "Villkor och uppsägning" },
    ],
  },
  content: {
    name: "Innehållskalender",
    description: "Arbeta från idé och utkast till publicering.",
    buckets: ["Idéer", "Utkast", "Granskning", "Planerat", "Publicerat"],
    fields: [
      ["Kanal", "select", ["Webb", "Nyhetsbrev", "Sociala medier", "Övrigt"]],
      ["Ämne", "text"],
      ["Länk till publicering", "text"],
    ],
    blocks: [
      { type: "input", title: "Målgrupp och budskap" },
      { type: "text", text: "Skriv ditt utkast här." },
      {
        type: "checklist",
        items: ["Kontrollera fakta", "Granska språk", "Godkänn publicering"],
      },
    ],
  },
  journal: {
    name: "Arbetslogg",
    description: "Anteckningar, reflektioner och lärdomar över tid.",
    buckets: ["Anteckningar", "Att följa upp", "Avslutat"],
    fields: [
      ["Datum", "date"],
      ["Område", "text"],
    ],
    blocks: [
      { type: "input", title: "Vad hände?" },
      { type: "input", title: "Vad lärde vi oss?" },
      { type: "input", title: "Vad tar vi vidare?" },
    ],
  },
  assessment: {
    name: "Självskattning",
    description: "Bedöm områden och följ förändringen.",
    buckets: ["Att bedöma", "Åtgärd behövs", "Följs upp", "Klart"],
    fields: [
      ["Område", "text"],
      ["Skattning (0–10)", "number"],
      ["Målvärde", "number"],
    ],
    blocks: [
      { type: "input", title: "Vad ligger bakom bedömningen?" },
      { type: "input", title: "Vad vill vi förbättra?" },
      { type: "checklist", items: ["Bestäm nästa steg", "Boka uppföljning"] },
    ],
  },
};
