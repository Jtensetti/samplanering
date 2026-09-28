import { z } from "zod";
const text = z.string().max(50000);
const title = z.string().trim().min(1).max(200);
const id = z.string().uuid();
const date = z.union([
  z.literal(""),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (s) =>
        !Number.isNaN(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s,
      "Ogiltigt datum",
    ),
]);
const base = {
  title,
  archived: z.boolean().default(false),
  order: z.number().finite().default(0),
};
const field = z
  .object({
    id,
    label: title,
    type: z.enum(["text", "number", "date", "select", "checkbox"]),
    hidden: z.boolean().default(false),
    options: z.array(z.string().max(100)).max(30).default([]),
  })
  .strict();
const check = z
  .object({ id, text: z.string().max(1000), done: z.boolean() })
  .strict();
export const schemas = {
  plan: z
    .object({
      ...base,
      description: text.default(""),
      defaultTemplateId: z.union([id, z.literal("")]).default(""),
      color: z.enum(["blue", "teal", "purple", "amber"]).default("blue"),
      fields: z.array(field).max(30).default([]),
    })
    .strict(),
  bucket: z.object({ ...base, done: z.boolean().default(false) }).strict(),
  card: z
    .object({
      ...base,
      bucketId: id,
      assignees: z.array(id).max(30).default([]),
      start: date.default(""),
      due: date.default(""),
      done: z.boolean().default(false),
      priority: z.enum(["normal", "high", "low"]).default("normal"),
      tags: z.array(z.string().max(40)).max(20).default([]),
      description: text.default(""),
      linkedDocs: z.array(id).max(30).default([]),
      estimate: z.number().min(0).max(100000).default(0),
      custom: z
        .record(
          z.string(),
          z.union([z.string().max(5000), z.number().finite(), z.boolean()]),
        )
        .default({}),
      dependencies: z.array(id).max(50).default([]),
      parentCardId: z.union([id, z.literal("")]).default(""),
      sprintId: z.union([id, z.literal("")]).default(""),
      repeat: z.enum(["none", "weekly", "monthly"]).default("none"),
    })
    .strict()
    .refine((x) => !x.start || !x.due || x.start <= x.due, {
      message: "Slutdatum måste vara efter startdatum",
    }),
  block: z
    .object({
      type: z.enum([
        "text",
        "heading",
        "checklist",
        "input",
        "select",
        "table",
        "link",
        "file",
        "image",
      ]),
      title: z.string().max(200).default(""),
      text: text.default(""),
      checked: z.array(check).max(300).default([]),
      options: z.array(z.string().max(200)).max(50).default([]),
      value: text.default(""),
      rows: z
        .array(z.array(z.string().max(2000)).max(12))
        .max(200)
        .default([]),
      fileId: z.union([id, z.literal("")]).default(""),
      order: z.number().finite().default(0),
    })
    .strict(),
  comment: z
    .object({
      text: z.string().trim().min(1).max(10000),
      mentions: z.array(id).max(30).default([]),
    })
    .strict(),
  doc: z
    .object({
      ...base,
      description: text.default(""),
      category: z.enum(["document", "wiki", "journal"]).default("document"),
    })
    .strict(),
  template: z
    .object({
      ...base,
      blocks: z.array(z.record(z.string(), z.unknown())).max(100).default([]),
    })
    .strict(),
  view: z
    .object({
      ...base,
      mode: z.enum(["board", "list", "calendar", "timeline"]),
      query: z.string().max(200).default(""),
      assignee: z.string().max(100).default(""),
      tag: z.string().max(40).default(""),
      group: z.enum(["bucket", "assignee", "priority"]).default("bucket"),
    })
    .strict(),
  rule: z
    .object({
      ...base,
      bucketId: id,
      action: z.enum(["assign", "notify", "template"]),
      target: z.string().max(200),
      enabled: z.boolean().default(true),
    })
    .strict(),
  sticky: z
    .object({
      text: z.string().max(2000),
      x: z.number().min(0).max(4000),
      y: z.number().min(0).max(4000),
      color: z.enum(["yellow", "blue", "pink", "green"]).default("yellow"),
      cardId: z.union([id, z.literal("")]).default(""),
      connections: z.array(id).max(50).default([]),
    })
    .strict(),
  sprint: z
    .object({ ...base, start: date, due: date, goal: text.default("") })
    .strict()
    .refine((x) => !x.start || !x.due || x.start <= x.due, {
      message: "Kontrollera datumen",
    }),
  goal: z
    .object({
      ...base,
      target: z.number().positive().max(1e12),
      current: z.number().min(0).max(1e12).default(0),
      unit: z.string().max(30).default(""),
      due: date.default(""),
    })
    .strict(),
  time: z
    .object({
      minutes: z.number().min(1).max(1440),
      note: z.string().max(500).default(""),
      date,
    })
    .strict(),
  message: z
    .object({
      text: z.string().trim().min(1).max(10000),
      mentions: z.array(id).max(30).default([]),
    })
    .strict(),
};
export const parentKinds = {
  plan: null,
  bucket: ["plan"],
  card: ["plan"],
  block: ["card", "doc"],
  comment: ["card", "doc"],
  doc: null,
  template: null,
  view: ["plan"],
  rule: ["plan"],
  sticky: ["plan"],
  sprint: ["plan"],
  goal: ["plan"],
  time: ["card"],
  message: null,
};
export const credentials = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((x) => x.toLowerCase()),
    password: z.string().min(12).max(128),
    name: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
