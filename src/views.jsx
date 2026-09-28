import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  ArrowLeft,
  LayoutGrid,
  List,
  CalendarDays,
  ChartNoAxesGantt,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Archive,
  History,
  Bell,
  Save,
} from "lucide-react";
import { api, useApp, today } from "./store";
import {
  Button,
  IconButton,
  Modal,
  Field,
  NewName,
  DraftText,
  Disclosure,
  Empty,
} from "./ui";
import { TaskList, TaskCard } from "./App";
import { AdvancedPlan } from "./advanced";
import { presets } from "../shared/presets.mjs";
export function CreatePlan({ onClose, onCreated }) {
  const { teamId, act, reload } = useApp(),
    [name, setName] = useState(""),
    [preset, setPreset] = useState("blank"),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Skapa plan" wide onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await act(async () => {
            const p = await api("/plans/preset", {
              method: "POST",
              body: { title: name, teamId, preset },
            });
            await reload();
            onCreated(p);
            onClose();
          });
          setBusy(false);
        }}
      >
        <Field label="Vad heter planen?">
          <input
            autoFocus
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Till exempel Införa bokningssystem"
          />
        </Field>
        <fieldset className="preset-list">
          <legend>Välj en startpunkt</legend>
          {Object.entries(presets).map(([k, p]) => (
            <label key={k} className={preset === k ? "selected" : ""}>
              <input
                type="radio"
                name="preset"
                value={k}
                checked={preset === k}
                onChange={() => setPreset(k)}
              />
              <div>
                <strong>{p.name}</strong>
                <small>{p.description}</small>
              </div>
            </label>
          ))}
        </fieldset>
        <div className="actions">
          <Button type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" disabled={busy}>
            {busy ? "Skapar…" : "Skapa"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Plan({ plan, onOpen, onBack }) {
  const { state, childrenOf, create, patch, act, writable, records, get } =
      useApp(),
    [newTask, setNewTask] = useState(""),
    [query, setQuery] = useState(""),
    [mode, setMode] = useState("board"),
    [assignee, setAssignee] = useState(""),
    [tag, setTag] = useState(""),
    [group, setGroup] = useState("bucket"),
    [settings, setSettings] = useState(false),
    [saveView, setSaveView] = useState(false),
    [filters, setFilters] = useState(false),
    [archive, setArchive] = useState(false);
  const buckets = childrenOf(plan.id, "bucket"),
    source = childrenOf(plan.id, "card"),
    cards = source.filter(
      (c) =>
        (
          JSON.stringify(c.body) +
          " " +
          records
            .filter((r) => r.parent_id === c.id)
            .map((r) => JSON.stringify(r.body))
            .join(" ")
        )
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!assignee || assignee === "none"
          ? !assignee || !c.body.assignees.length
          : c.body.assignees.includes(assignee)) &&
        (!tag || c.body.tags.includes(tag)),
    ),
    views = childrenOf(plan.id, "view");
  const groups =
    group === "bucket"
      ? buckets.map((b) => ({
          id: b.id,
          name: b.body.title,
          done: b.body.done,
          cards: cards.filter((c) => c.body.bucketId === b.id),
        }))
      : group === "priority"
        ? ["high", "normal", "low"].map((id) => ({
            id,
            name: {
              high: "Hög prioritet",
              normal: "Normal prioritet",
              low: "Låg prioritet",
            }[id],
            cards: cards.filter((c) => c.body.priority === id),
          }))
        : [...state.members, { id: "none", name: "Utan ansvarig" }].map(
            (m) => ({
              id: m.id,
              name: m.name,
              cards: cards.filter((c) =>
                m.id === "none"
                  ? !c.body.assignees.length
                  : c.body.assignees.includes(m.id),
              ),
            }),
          );
  async function drop(e, g) {
    e.preventDefault();
    const c = source.find((c) => c.id === e.dataTransfer.getData("text/plain"));
    if (!c || !writable) return;
    await patch(
      c,
      group === "bucket"
        ? { bucketId: g.id, done: g.done }
        : group === "priority"
          ? { priority: g.id }
          : { assignees: g.id === "none" ? [] : [g.id] },
    );
  }
  return (
    <>
      <button className="back" onClick={onBack}>
        <ArrowLeft size={15} />
        Alla planer
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAN</p>
          <DraftText
            className="title-input"
            label="Planens namn"
            disabled={!writable}
            value={plan.body.title}
            version={plan.version}
            onSave={(v, version) => patch(plan, { title: v }, version)}
          />
        </div>
        <div className="heading-actions">
          <Button icon={SlidersHorizontal} onClick={() => setSettings(true)}>
            Anpassa plan
          </Button>
          {writable && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setNewTask(buckets[0]?.id)}
            >
              Lägg till uppgift
            </Button>
          )}
        </div>
      </div>
      <div className="view-toolbar">
        <div className="segmented">
          {[
            ["board", "Tavla", LayoutGrid],
            ["list", "Lista", List],
            ["calendar", "Kalender", CalendarDays],
            ["timeline", "Tidslinje", ChartNoAxesGantt],
          ].map(([id, label, icon]) => (
            <Button
              key={id}
              variant={mode === id ? "selected" : ""}
              icon={icon}
              onClick={() => setMode(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button onClick={() => setFilters(!filters)} aria-expanded={filters}>
          Filtrera{assignee || tag ? " •" : ""}
        </Button>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Sök uppgifter"
            placeholder="Sök i kort och dokument…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {filters && (
        <div className="filter-row">
          <Field label="Ansvarig">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Alla personer</option>
              <option value="none">Utan ansvarig</option>
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Etikett">
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Alla etiketter</option>
              {[...new Set(source.flatMap((c) => c.body.tags))].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Gruppera tavlan efter">
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="bucket">Kolumn</option>
              <option value="assignee">Ansvarig</option>
              <option value="priority">Prioritet</option>
            </select>
          </Field>
          <Button
            onClick={() => {
              setQuery("");
              setAssignee("");
              setTag("");
              setGroup("bucket");
            }}
          >
            Rensa filter
          </Button>
          {writable && (
            <Button icon={Save} onClick={() => setSaveView(true)}>
              Spara vy
            </Button>
          )}
        </div>
      )}
      {views.length > 0 && (
        <div className="saved-views">
          <span>Sparade vyer</span>
          {views.map((v) => (
            <Button
              key={v.id}
              onClick={() => {
                setMode(v.body.mode);
                setQuery(v.body.query);
                setAssignee(v.body.assignee);
                setTag(v.body.tag);
                setGroup(v.body.group);
              }}
            >
              {v.body.title}
            </Button>
          ))}
        </div>
      )}
      {mode === "list" && <TaskList cards={cards} onOpen={onOpen} />}{" "}
      {mode === "calendar" && <Calendar cards={cards} onOpen={onOpen} />}{" "}
      {mode === "timeline" && <Timeline cards={cards} onOpen={onOpen} />}{" "}
      {mode === "board" && (
        <div className="board">
          {groups.map((g) => (
            <section
              key={g.id}
              className="bucket"
              onDragOver={(e) => {
                if (writable) e.preventDefault();
              }}
              onDrop={(e) => act(() => drop(e, g))}
            >
              <div className="bucket-title">
                <span className={"status-dot " + (g.done ? "green" : "")} />
                <h2>{g.name}</h2>
                <span className="count">{g.cards.length}</span>
              </div>
              {g.cards.map((c) => (
                <TaskCard key={c.id} card={c} onOpen={onOpen} />
              ))}
              {writable && group === "bucket" && (
                <button className="add-card" onClick={() => setNewTask(g.id)}>
                  <Plus size={16} />
                  Lägg till uppgift
                </button>
              )}
            </section>
          ))}
          {writable && group === "bucket" && (
            <button className="add-bucket" onClick={() => setSettings(true)}>
              <Plus size={17} />
              Lägg till kolumn
            </button>
          )}
        </div>
      )}
      <div className="plan-bottom">
        <span>
          {cards.length} uppgifter · {cards.filter((c) => c.body.done).length}{" "}
          klara
        </span>
        <Button icon={Archive} onClick={() => setArchive(true)}>
          Arkiverade uppgifter
        </Button>
      </div>
      <AdvancedPlan plan={plan} onOpen={onOpen} />
      {newTask && (
        <NewName
          title="Ny uppgift"
          label="Vad behöver göras?"
          onClose={() => setNewTask("")}
          onSave={async (title) => {
            const c = await create(
              "card",
              { title, bucketId: newTask },
              plan.id,
            );
            onOpen(c.id);
          }}
        />
      )}
      {settings && (
        <PlanSettings
          plan={plan}
          onClose={() => setSettings(false)}
          onBack={onBack}
        />
      )}{" "}
      {saveView && (
        <NewName
          title="Spara vy"
          onClose={() => setSaveView(false)}
          onSave={(title) =>
            create(
              "view",
              { title, mode, query, assignee, tag, group },
              plan.id,
            )
          }
        />
      )}{" "}
      {archive && (
        <ArchiveView parentId={plan.id} onClose={() => setArchive(false)} />
      )}
    </>
  );
}
export function Calendar({ cards, onOpen }) {
  const [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    first = new Date(month),
    offset = (first.getDay() + 6) % 7;
  first.setDate(1 - offset);
  const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      return d;
    }),
    date = (d) => d.toLocaleDateString("sv-SE");
  return (
    <>
      <div className="calendar-heading">
        <IconButton
          icon={ChevronLeft}
          label="Föregående månad"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        />
        <h2>
          {month.toLocaleDateString("sv-SE", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <IconButton
          icon={ChevronRight}
          label="Nästa månad"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        />
        <Button
          onClick={() =>
            setMonth(
              new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            )
          }
        >
          Idag
        </Button>
      </div>
      <div className="calendar-grid">
        {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
          <strong className="weekday" key={d}>
            {d}
          </strong>
        ))}
        {days.map((d) => (
          <div
            key={date(d)}
            className={`calendar-day ${d.getMonth() !== month.getMonth() ? "outside" : ""} ${date(d) === today() ? "is-today" : ""}`}
          >
            <time>{d.getDate()}</time>
            {cards
              .filter(
                (c) =>
                  (c.body.start || c.body.due) <= date(d) &&
                  (c.body.due || c.body.start) >= date(d),
              )
              .map((c) => (
                <button
                  key={c.id}
                  className={c.body.done ? "done" : ""}
                  onClick={() => onOpen(c.id)}
                >
                  {c.body.title}
                </button>
              ))}
          </div>
        ))}
      </div>
      <h3 className="spaced">Utan datum</h3>
      <TaskList
        cards={cards.filter((c) => !c.body.start && !c.body.due)}
        onOpen={onOpen}
      />
    </>
  );
}
export function Timeline({ cards, onOpen }) {
  const dated = cards
    .filter((c) => c.body.start || c.body.due)
    .sort((a, b) =>
      (a.body.start || a.body.due).localeCompare(b.body.start || b.body.due),
    );
  const time = (s) => Date.parse(s + "T12:00:00Z"),
    min = dated.length
      ? Math.min(...dated.map((c) => time(c.body.start || c.body.due)))
      : Date.now(),
    max = dated.length
      ? Math.max(...dated.map((c) => time(c.body.due || c.body.start)))
      : min + 86400000,
    span = Math.max(86400000, max - min + 86400000);
  return (
    <>
      <div className="timeline">
        <div className="timeline-scale">
          <span>{new Date(min).toLocaleDateString("sv-SE")}</span>
          <span>{new Date(max).toLocaleDateString("sv-SE")}</span>
        </div>
        {dated.map((c) => {
          const start = time(c.body.start || c.body.due),
            end = time(c.body.due || c.body.start);
          return (
            <div className="timeline-row" key={c.id}>
              <button className="timeline-label" onClick={() => onOpen(c.id)}>
                {c.body.title}
              </button>
              <div className="timeline-track">
                <button
                  className={`timeline-bar ${c.body.done ? "complete" : ""}`}
                  style={{
                    left: ((start - min) / span) * 100 + "%",
                    width:
                      Math.max(2, ((end - start + 86400000) / span) * 100) +
                      "%",
                  }}
                  title={`${c.body.title}: ${c.body.start || c.body.due} – ${c.body.due || c.body.start}`}
                  onClick={() => onOpen(c.id)}
                  aria-label={`${c.body.title}, ${c.body.start || c.body.due} till ${c.body.due || c.body.start}`}
                />
              </div>
            </div>
          );
        })}
        {!dated.length && (
          <Empty
            title="Lägg till datum för att se tidslinjen"
            text="Öppna en uppgift och ange start- eller slutdatum."
          />
        )}
      </div>
      <h3 className="spaced">Utan datum</h3>
      <TaskList
        cards={cards.filter((c) => !c.body.start && !c.body.due)}
        onOpen={onOpen}
      />
    </>
  );
}
export function PlanSettings({ plan, onClose, onBack }) {
  const { all, childrenOf, patch, create, remove, act, writable } = useApp(),
    [name, setName] = useState(""),
    [label, setLabel] = useState(""),
    [type, setType] = useState("text"),
    [options, setOptions] = useState("");
  return (
    <Modal title="Anpassa plan" wide onClose={onClose}>
      <Field label="Färg">
        <select
          disabled={!writable}
          value={plan.body.color}
          onChange={(e) => act(() => patch(plan, { color: e.target.value }))}
        >
          {[
            ["blue", "Blå"],
            ["teal", "Grön"],
            ["purple", "Lila"],
            ["amber", "Gul"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <h3>Kolumner</h3>
      {childrenOf(plan.id, "bucket").map((b) => (
        <div className="settings-row" key={b.id}>
          <DraftText
            label="Kolumnens namn"
            value={b.body.title}
            version={b.version}
            disabled={!writable}
            onSave={(v, version) => patch(b, { title: v }, version)}
          />
          <label className="check-inline">
            <input
              type="checkbox"
              checked={b.body.done}
              disabled={!writable}
              onChange={(e) => act(() => patch(b, { done: e.target.checked }))}
            />
            Markerar klart
          </label>
          {writable && (
            <Button
              onClick={() => act(() => patch(b, { order: b.body.order - 1.5 }))}
            >
              Flytta upp
            </Button>
          )}
        </div>
      ))}
      {writable && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await create(
                "bucket",
                { title: name, order: childrenOf(plan.id, "bucket").length },
                plan.id,
              );
              setName("");
            });
          }}
        >
          <input
            required
            aria-label="Ny kolumn"
            placeholder="Namn på ny kolumn"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button icon={Plus}>Lägg till kolumn</Button>
        </form>
      )}
      <h3 className="spaced">Egna fält på uppgifterna</h3>
      {plan.body.fields.map((f) => (
        <div className="settings-row" key={f.id}>
          <DraftText
            value={f.label}
            label="Fältnamn"
            version={plan.version}
            disabled={!writable}
            onSave={(v, version) =>
              patch(
                plan,
                {
                  fields: plan.body.fields.map((x) =>
                    x.id === f.id ? { ...x, label: v } : x,
                  ),
                },
                version,
              )
            }
          />
          <span className="muted">
            {
              {
                text: "Text",
                number: "Tal",
                date: "Datum",
                select: "Val",
                checkbox: "Kryssruta",
              }[f.type]
            }
          </span>
          {writable && (
            <Button
              onClick={() =>
                act(() =>
                  patch(plan, {
                    fields: plan.body.fields.map((x) =>
                      x.id === f.id ? { ...x, hidden: !x.hidden } : x,
                    ),
                  }),
                )
              }
            >
              {f.hidden ? "Visa" : "Dölj"}
            </Button>
          )}
        </div>
      ))}
      {writable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await patch(plan, {
                fields: [
                  ...plan.body.fields,
                  {
                    id: crypto.randomUUID(),
                    label,
                    type,
                    options:
                      type === "select"
                        ? options
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [],
                  },
                ],
              });
              setLabel("");
              setOptions("");
            });
          }}
        >
          <div className="detail-meta spaced">
            <Field label="Nytt fält">
              <input
                required
                maxLength={200}
                placeholder="Till exempel Budget"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
            <Field label="Sorts svar">
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="text">Text</option>
                <option value="number">Tal</option>
                <option value="date">Datum</option>
                <option value="select">Välj ett alternativ</option>
                <option value="checkbox">Kryssruta</option>
              </select>
            </Field>
          </div>
          {type === "select" && (
            <Field label="Alternativ, separerade med komma">
              <input
                required
                value={options}
                onChange={(e) => setOptions(e.target.value)}
              />
            </Field>
          )}
          <Button>Lägg till fält</Button>
        </form>
      )}
      <h3 className="spaced">Arbetsdokument för nya kort</h3>
      <select
        aria-label="Standardmall"
        disabled={!writable}
        value={plan.body.defaultTemplateId}
        onChange={(e) =>
          act(() => patch(plan, { defaultTemplateId: e.target.value }))
        }
      >
        <option value="">Tomt dokument</option>
        {all("template").map((t) => (
          <option key={t.id} value={t.id}>
            {t.body.title}
          </option>
        ))}
      </select>
      {childrenOf(plan.id, "view").length > 0 && (
        <>
          <h3 className="spaced">Sparade vyer</h3>
          {childrenOf(plan.id, "view").map((v) => (
            <div className="settings-row" key={v.id}>
              {v.body.title}
              {writable && (
                <Button onClick={() => act(() => remove(v))}>Ta bort</Button>
              )}
            </div>
          ))}
        </>
      )}
      {writable && (
        <div className="panel-footer">
          <Button
            icon={Archive}
            onClick={() => {
              if (confirm("Arkivera planen? Den kan återställas från arkivet."))
                act(async () => {
                  await patch(plan, { archived: true });
                  onClose();
                  onBack();
                });
            }}
          >
            Arkivera plan
          </Button>
        </div>
      )}
    </Modal>
  );
}
export function CustomFields({ record: r }) {
  const { get, patch, act, writable } = useApp(),
    plan = get(r.parent_id);
  if (!plan?.body.fields.length) return null;
  return (
    <div className="custom-fields">
      <h3>Uppgifter för den här planen</h3>
      <div className="detail-meta">
        {plan.body.fields
          .filter((f) => !f.hidden)
          .map((f) => (
            <div key={f.id} className="field">
              <label>{f.label}</label>
              {f.type === "text" || f.type === "number" ? (
                <DraftText
                  value={String(r.body.custom[f.id] ?? "")}
                  label={f.label}
                  version={r.version}
                  disabled={!writable}
                  onSave={(v, version) => {
                    const val =
                      f.type === "number" && v !== ""
                        ? Number(v.replace(",", "."))
                        : v;
                    if (typeof val === "number" && !Number.isFinite(val))
                      throw new Error("Ange ett tal.");
                    return patch(
                      r,
                      { custom: { ...r.body.custom, [f.id]: val } },
                      version,
                    );
                  }}
                />
              ) : f.type === "select" ? (
                <select
                  aria-label={f.label}
                  disabled={!writable}
                  value={r.body.custom[f.id] || ""}
                  onChange={(e) =>
                    act(() =>
                      patch(r, {
                        custom: { ...r.body.custom, [f.id]: e.target.value },
                      }),
                    )
                  }
                >
                  <option value="">Välj…</option>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={f.label}
                  disabled={!writable}
                  type={f.type === "checkbox" ? "checkbox" : "date"}
                  {...(f.type === "checkbox"
                    ? { checked: !!r.body.custom[f.id] }
                    : { value: r.body.custom[f.id] || "" })}
                  onChange={(e) =>
                    act(() =>
                      patch(r, {
                        custom: {
                          ...r.body.custom,
                          [f.id]:
                            f.type === "checkbox"
                              ? e.target.checked
                              : e.target.value,
                        },
                      }),
                    )
                  }
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
export function HistoryView({ record, onClose }) {
  const { get, patch, act, writable } = useApp(),
    [entries, setEntries] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/records/" + record.id + "/history")
      .then(setEntries)
      .catch((e) => setError(e.message));
  }, [record.id]);
  return (
    <Modal title="Ändringshistorik" wide onClose={onClose}>
      {error && <p role="alert">{error}</p>}
      {!entries && !error && <p>Läser historik…</p>}
      {entries?.map((e) => {
        const r = get(e.record_id);
        return (
          <article className="history-entry" key={e.id}>
            <div>
              <strong>{e.name}</strong>{" "}
              {{
                created: "skapade",
                updated: "ändrade",
                deleted: "tog bort",
                restored: "återställde",
                automation: "automatiserade",
              }[e.action] || e.action}
              <time>{new Date(e.at).toLocaleString("sv-SE")}</time>
            </div>
            <p>
              {e.body.title ||
                e.body.text?.slice(0, 250) ||
                e.body.type ||
                "Innehåll"}
            </p>
            <details>
              <summary>Visa innehåll</summary>
              <div className="revision-preview">
                {Object.entries({
                  Titel: e.body.title,
                  Text: e.body.text,
                  Svar: e.body.value,
                  Startdatum: e.body.start,
                  Slutdatum: e.body.due,
                })
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <p key={k}>
                      <strong>{k}: </strong>
                      {v}
                    </p>
                  ))}
                {e.body.checked?.map((c) => (
                  <p key={c.id}>
                    {c.done ? "✓" : "○"} {c.text}
                  </p>
                ))}
                {e.body.rows?.map((row, i) => (
                  <p key={i}>{row.join(" · ")}</p>
                ))}
                {!e.body.text &&
                  !e.body.title &&
                  !e.body.value &&
                  !e.body.checked?.length &&
                  !e.body.rows?.length && (
                    <p>Ändring av uppgiftens inställningar.</p>
                  )}
              </div>
            </details>
            {writable && r && e.action !== "deleted" && (
              <Button
                onClick={() => {
                  if (
                    confirm(
                      "Återställa detta innehåll till den sparade versionen?",
                    )
                  )
                    act(async () => {
                      await patch(r, e.body);
                      onClose();
                    });
                }}
              >
                Återställ version
              </Button>
            )}
          </article>
        );
      })}
    </Modal>
  );
}
export function ArchiveView({ parentId, onClose }) {
  const { records, patch, act, writable } = useApp();
  const archived = records.filter(
    (r) => r.body.archived && (!parentId || r.parent_id === parentId),
  );
  return (
    <Modal title="Arkiv" onClose={onClose}>
      {archived.length ? (
        archived.map((r) => (
          <div className="settings-row" key={r.id}>
            <span>{r.body.title}</span>
            {writable && (
              <Button onClick={() => act(() => patch(r, { archived: false }))}>
                Återställ
              </Button>
            )}
          </div>
        ))
      ) : (
        <p className="muted">Arkivet är tomt.</p>
      )}
    </Modal>
  );
}
export function Notifications({ onClose, onOpen }) {
  const { state, teamId, act, reload } = useApp();
  return (
    <Modal title="Notiser" onClose={onClose}>
      <Button
        onClick={() =>
          act(async () => {
            await api("/notifications/read", {
              method: "POST",
              body: { teamId },
            });
            await reload();
          })
        }
      >
        Markera alla som lästa
      </Button>
      <div className="notifications">
        {state.notifications.map((n) => (
          <button
            key={n.id}
            className={n.read ? "read" : ""}
            onClick={() => {
              if (n.record_id) onOpen(n.record_id);
              onClose();
            }}
          >
            <span>{n.text}</span>
            <time>{new Date(n.at).toLocaleString("sv-SE")}</time>
          </button>
        ))}
      </div>
      {!state.notifications.length && (
        <p className="quiet-empty">Du har inga notiser ännu.</p>
      )}
    </Modal>
  );
}
