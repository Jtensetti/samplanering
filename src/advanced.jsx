import React, { useEffect, useRef, useState } from "react";
import {
  Workflow,
  StickyNote,
  ChartNoAxesCombined,
  CalendarRange,
  Plus,
  Trash2,
  Play,
  Square,
  Link2,
  ArrowUpRight,
  Check,
  MessageSquare,
  Target,
  Archive,
} from "lucide-react";
import { api, useApp, today } from "./store";
import {
  Button,
  IconButton,
  Modal,
  Field,
  DraftText,
  Disclosure,
  NewName,
  Empty,
  TextArea,
} from "./ui";
import { TaskList } from "./App";
import { Timeline } from "./views";
export function AdvancedPlan({ plan, onOpen }) {
  const [tool, setTool] = useState("");
  const choices = [
    [
      "report",
      "Följ upp",
      ChartNoAxesCombined,
      "Mål, kostnader och arbetsbelastning",
    ],
    [
      "sprints",
      "Planera arbetsperiod",
      CalendarRange,
      "Samla uppgifter för en bestämd period",
    ],
    [
      "rules",
      "Automatisera",
      Workflow,
      "Låt återkommande steg sköta sig själva",
    ],
    [
      "whiteboard",
      "Öppna whiteboard",
      StickyNote,
      "Samla idéer och koppla dem till uppgifter",
    ],
  ];
  return (
    <section className="advanced-tools">
      <h2>Planera och följ upp</h2>
      <div className="tool-grid">
        {choices.map(([id, label, Icon, text]) => (
          <button key={id} onClick={() => setTool(id)}>
            <Icon size={20} />
            <strong>{label}</strong>
            <small>{text}</small>
          </button>
        ))}
      </div>
      {tool && (
        <Modal
          title={choices.find((x) => x[0] === tool)[1]}
          wide
          onClose={() => setTool("")}
        >
          {tool === "rules" && <Rules plan={plan} />}{" "}
          {tool === "whiteboard" && <Whiteboard plan={plan} onOpen={onOpen} />}{" "}
          {tool === "report" && <Report plan={plan} />}{" "}
          {tool === "sprints" && <Sprints plan={plan} onOpen={onOpen} />}
        </Modal>
      )}
    </section>
  );
}
function Rules({ plan }) {
  const { childrenOf, all, state, create, patch, remove, act, writable } =
      useApp(),
    buckets = childrenOf(plan.id, "bucket"),
    rules = childrenOf(plan.id, "rule");
  const [bucket, setBucket] = useState(buckets[0]?.id || ""),
    [action, setAction] = useState("assign"),
    [target, setTarget] = useState(state.members[0]?.id || "");
  const targets =
    action === "template"
      ? all("template").map((t) => ({ id: t.id, name: t.body.title }))
      : state.members;
  const verb = {
    assign: "tilldela",
    notify: "meddela",
    template: "lägg till dokumentmallen",
  }[action];
  return (
    <>
      {rules.map((r) => (
        <div className="rule-row" key={r.id}>
          <label className="check-inline">
            <input
              type="checkbox"
              aria-label={"Aktivera " + r.body.title}
              checked={r.body.enabled}
              disabled={!writable}
              onChange={(e) =>
                act(() => patch(r, { enabled: e.target.checked }))
              }
            />
            {r.body.title}
          </label>
          {writable && (
            <IconButton
              variant="danger"
              label="Ta bort regel"
              icon={Trash2}
              onClick={() => act(() => remove(r))}
            />
          )}
        </div>
      ))}
      {writable && (
        <form
          className="rule-builder"
          onSubmit={(e) => {
            e.preventDefault();
            const b = buckets.find((b) => b.id === bucket),
              t = targets.find((t) => t.id === target);
            if (!b || !t) return;
            act(() =>
              create(
                "rule",
                {
                  title: `När kort flyttas till ${b.body.title}, ${verb} ${t.name}`,
                  bucketId: bucket,
                  action,
                  target,
                },
                plan.id,
              ),
            );
          }}
        >
          <h3>Skapa en regel</h3>
          <Field label="När en uppgift flyttas till">
            <select
              required
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
            >
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.body.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gör detta">
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setTarget(
                  e.target.value === "template"
                    ? all("template")[0]?.id || ""
                    : state.members[0]?.id || "",
                );
              }}
            >
              <option value="assign">Tilldela en kollega</option>
              <option value="notify">Skicka en notis till en kollega</option>
              <option value="template">Lägg till en dokumentmall</option>
            </select>
          </Field>
          <Field label={action === "template" ? "Dokumentmall" : "Kollega"}>
            <select
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Välj…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {action === "template" && (
            <p className="muted">
              Spara ett arbetsdokument som mall för att kunna välja det här.
              Mallen läggs till varje gång kortet går in i kolumnen.
            </p>
          )}
          <Button variant="primary" disabled={!bucket || !target}>
            Skapa regel
          </Button>
        </form>
      )}
    </>
  );
}
function Whiteboard({ plan, onOpen }) {
  const { childrenOf, create, patch, remove, act, writable } = useApp(),
    notes = childrenOf(plan.id, "sticky"),
    cards = childrenOf(plan.id, "card"),
    [selected, setSelected] = useState(""),
    [newNote, setNewNote] = useState(false);
  const drag = useRef(null),
    [position, setPosition] = useState(null);
  const chosen = notes.find((n) => n.id === selected);
  async function convert(n) {
    const first = childrenOf(plan.id, "bucket")[0];
    const c = await create(
      "card",
      { title: n.body.text.slice(0, 200) || "Ny idé", bucketId: first.id },
      plan.id,
    );
    await create("block", { type: "text", text: n.body.text }, c.id);
    await patch(n, { cardId: c.id });
    onOpen(c.id);
  }
  return (
    <>
      <div className="section-header">
        <p className="muted">
          Flytta lappar med handtaget eller piltangenterna.
        </p>
        {writable && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setNewNote(true)}
          >
            Ny lapp
          </Button>
        )}
      </div>
      <div className="whiteboard-scroll">
        <div className="whiteboard" style={{ width: 1800, height: 1100 }}>
          <svg
            aria-hidden="true"
            className="connections"
            width="1800"
            height="1100"
          >
            {notes.flatMap((n) =>
              n.body.connections.map((id) => {
                const other = notes.find((x) => x.id === id);
                return other ? (
                  <line
                    key={n.id + id}
                    x1={n.body.x + 105}
                    y1={n.body.y + 60}
                    x2={other.body.x + 105}
                    y2={other.body.y + 60}
                    stroke="#91a2ba"
                    strokeWidth="2"
                  />
                ) : null;
              }),
            )}
          </svg>
          {notes.map((n) => (
            <div
              key={n.id}
              className={`sticky ${n.body.color} ${selected === n.id ? "selected" : ""}`}
              style={{
                left: position?.id === n.id ? position.x : n.body.x,
                top: position?.id === n.id ? position.y : n.body.y,
              }}
            >
              <button
                className="sticky-handle"
                aria-label={"Flytta lapp: " + n.body.text.slice(0, 40)}
                disabled={!writable}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = {
                    id: n.id,
                    px: e.clientX,
                    py: e.clientY,
                    x: n.body.x,
                    y: n.body.y,
                  };
                  setSelected(n.id);
                }}
                onPointerMove={(e) => {
                  if (drag.current?.id !== n.id) return;
                  const d = drag.current;
                  setPosition({
                    id: n.id,
                    x: Math.max(0, Math.min(1560, d.x + e.clientX - d.px)),
                    y: Math.max(0, Math.min(900, d.y + e.clientY - d.py)),
                  });
                }}
                onPointerUp={(e) => {
                  if (drag.current?.id !== n.id) return;
                  const d = drag.current;
                  drag.current = null;
                  setPosition(null);
                  act(() =>
                    patch(n, {
                      x: Math.max(0, Math.min(1560, d.x + e.clientX - d.px)),
                      y: Math.max(0, Math.min(900, d.y + e.clientY - d.py)),
                    }),
                  );
                }}
                onKeyDown={(e) => {
                  if (
                    ![
                      "ArrowUp",
                      "ArrowDown",
                      "ArrowLeft",
                      "ArrowRight",
                    ].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  act(() =>
                    patch(n, {
                      x: Math.max(
                        0,
                        Math.min(
                          1560,
                          n.body.x +
                            (e.key === "ArrowLeft"
                              ? -20
                              : e.key === "ArrowRight"
                                ? 20
                                : 0),
                        ),
                      ),
                      y: Math.max(
                        0,
                        Math.min(
                          900,
                          n.body.y +
                            (e.key === "ArrowUp"
                              ? -20
                              : e.key === "ArrowDown"
                                ? 20
                                : 0),
                        ),
                      ),
                    }),
                  );
                }}
              >
                •••
              </button>
              <button
                className="sticky-content"
                onClick={() => setSelected(n.id)}
              >
                {n.body.text || "Tom lapp"}
              </button>
              {n.body.cardId && (
                <button
                  className="sticky-link"
                  onClick={() => onOpen(n.body.cardId)}
                >
                  <ArrowUpRight size={14} />
                  Öppna uppgift
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {!notes.length && (
        <p className="muted">
          Börja med en idé. Lappar kan bli uppgifter i planen.
        </p>
      )}
      {chosen && (
        <div className="sticky-editor">
          <h3>Redigera lapp</h3>
          <DraftText
            multiline
            maxLength={2000}
            label="Lappens text"
            value={chosen.body.text}
            version={chosen.version}
            disabled={!writable}
            onSave={(v, version) => patch(chosen, { text: v }, version)}
          />
          <div className="detail-meta">
            <Field label="Färg" width="short">
              <select
                disabled={!writable}
                value={chosen.body.color}
                onChange={(e) =>
                  act(() => patch(chosen, { color: e.target.value }))
                }
              >
                {[
                  ["yellow", "Gul"],
                  ["blue", "Blå"],
                  ["pink", "Rosa"],
                  ["green", "Grön"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Koppla till uppgift">
              <select
                disabled={!writable}
                value={chosen.body.cardId}
                onChange={(e) =>
                  act(() => patch(chosen, { cardId: e.target.value }))
                }
              >
                <option value="">Ingen koppling</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.body.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset className="connection-list">
            <legend>Koppla till andra lappar</legend>
            {notes
              .filter((n) => n.id !== chosen.id)
              .map((n) => (
                <label key={n.id}>
                  <input
                    type="checkbox"
                    disabled={!writable}
                    checked={chosen.body.connections.includes(n.id)}
                    onChange={(e) =>
                      act(() =>
                        patch(chosen, {
                          connections: e.target.checked
                            ? [...chosen.body.connections, n.id]
                            : chosen.body.connections.filter(
                                (id) => id !== n.id,
                              ),
                        }),
                      )
                    }
                  />
                  {n.body.text.slice(0, 70)}
                </label>
              ))}
          </fieldset>
          {writable && (
            <div className="actions">
              {!chosen.body.cardId && (
                <Button onClick={() => act(() => convert(chosen))}>
                  Gör till uppgift
                </Button>
              )}
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() =>
                  act(async () => {
                    await remove(chosen);
                    setSelected("");
                  })
                }
              >
                Ta bort lapp
              </Button>
            </div>
          )}
        </div>
      )}
      {newNote && (
        <NewName
          title="Ny lapp"
          label="Din idé"
          multiline
          onClose={() => setNewNote(false)}
          onSave={async (text) => {
            const n = await create(
              "sticky",
              {
                text,
                x: 30 + (notes.length % 5) * 250,
                y: 30 + Math.floor(notes.length / 5) * 190,
              },
              plan.id,
            );
            setSelected(n.id);
          }}
        />
      )}
    </>
  );
}
export function Report({ plan }) {
  const { state, childrenOf } = useApp(),
    cards = childrenOf(plan.id, "card"),
    done = cards.filter((c) => c.body.done),
    open = cards.filter((c) => !c.body.done),
    late = open.filter((c) => c.body.due && c.body.due < today()),
    time = cards
      .flatMap((c) => childrenOf(c.id, "time"))
      .reduce((s, t) => s + t.body.minutes, 0),
    work = state.members.map((m) => ({
      ...m,
      hours: open
        .filter((c) => c.body.assignees.includes(m.id))
        .reduce(
          (s, c) => s + c.body.estimate / Math.max(1, c.body.assignees.length),
          0,
        ),
    })),
    max = Math.max(1, ...work.map((m) => m.hours));
  const ratings = plan.body.fields.find((f) => f.label === "Skattning (0–10)");
  return (
    <>
      <div className="stats-grid">
        <Stat label="Uppgifter" value={cards.length} />
        <Stat label="Klara" value={done.length} />
        <Stat label="Försenade" value={late.length} />
        <Stat
          label="Registrerade timmar"
          value={(time / 60).toLocaleString("sv-SE", {
            maximumFractionDigits: 1,
          })}
        />
      </div>
      <h3 className="spaced">Fördelning av arbetet</h3>
      {childrenOf(plan.id, "bucket").map((b) => {
        const count = cards.filter((c) => c.body.bucketId === b.id).length;
        return (
          <div className="bar-row" key={b.id}>
            <span>{b.body.title}</span>
            <progress max={cards.length || 1} value={count} />
            <strong>{count}</strong>
          </div>
        );
      })}
      <h3 className="spaced">Återstående uppskattad tid</h3>
      <p className="muted">
        Uppgiftens uppskattning delas lika mellan ansvariga. Visar alla öppna
        uppgifter i planen.
      </p>
      {work.map((m) => (
        <div className="bar-row" key={m.id}>
          <span>{m.name}</span>
          <progress max={max} value={m.hours} />
          <strong>
            {m.hours.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} h
          </strong>
        </div>
      ))}
      <p className="muted">
        Utan ansvarig:{" "}
        {open
          .filter((c) => !c.body.assignees.length)
          .reduce((s, c) => s + c.body.estimate, 0)}{" "}
        h
      </p>
      {plan.body.fields.some((f) => f.type === "number") && (
        <>
          <h3 className="spaced">Summeringar</h3>
          {plan.body.fields
            .filter((f) => f.type === "number")
            .map((f) => {
              const values = cards
                  .map((c) => c.body.custom[f.id])
                  .filter((v) => typeof v === "number"),
                sum = values.reduce((a, b) => a + b, 0);
              return (
                <div className="sum-row" key={f.id}>
                  <span>{f.label}</span>
                  <strong>{sum.toLocaleString("sv-SE")}</strong>
                  <small>
                    {values.length} ifyllda · medel{" "}
                    {values.length
                      ? (sum / values.length).toLocaleString("sv-SE", {
                          maximumFractionDigits: 1,
                        })
                      : "–"}
                  </small>
                </div>
              );
            })}
        </>
      )}
      {ratings && <Radar cards={cards} field={ratings} />}
      <Goals plan={plan} />
    </>
  );
}
function Stat({ label, value }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
function Radar({ cards, field }) {
  const data = cards
    .filter((c) => typeof c.body.custom[field.id] === "number")
    .slice(0, 12);
  if (data.length < 3)
    return (
      <p className="muted">
        Fyll i minst tre skattningar för att visa översiktsdiagrammet.
      </p>
    );
  const point = (i, r) => {
      const a = (i / data.length) * Math.PI * 2 - Math.PI / 2;
      return [200 + Math.cos(a) * r, 200 + Math.sin(a) * r];
    },
    points = (r) => data.map((c, i) => point(i, r).join(",")).join(" ");
  return (
    <div className="radar">
      <h3>Skattning per område</h3>
      <svg
        viewBox="0 0 400 400"
        role="img"
        aria-label="Skattningar på en skala från noll till tio. Exakta värden står i tabellen."
      >
        {[30, 60, 90, 120, 150].map((r) => (
          <polygon key={r} points={points(r)} fill="none" stroke="#dce4f0" />
        ))}
        {data.map((c, i) => {
          const p = point(i, 150),
            t = point(i, 176);
          return (
            <g key={c.id}>
              <line x1="200" y1="200" x2={p[0]} y2={p[1]} stroke="#dce4f0" />
              <text x={t[0]} y={t[1]} textAnchor="middle" fontSize="11">
                {i + 1}
              </text>
            </g>
          );
        })}
        <polygon
          points={data
            .map((c, i) =>
              point(
                i,
                Math.max(0, Math.min(10, c.body.custom[field.id])) * 15,
              ).join(","),
            )
            .join(" ")}
          fill="#205bdb30"
          stroke="#205bdb"
          strokeWidth="2"
        />
      </svg>
      <ol>
        {data.map((c) => (
          <li key={c.id}>
            {c.body.title}: <strong>{c.body.custom[field.id]}</strong>
          </li>
        ))}
      </ol>
      <small>Diagrammet visar högst tolv områden och en skala 0–10.</small>
    </div>
  );
}
function Goals({ plan }) {
  const { childrenOf, create, patch, remove, act, writable } = useApp(),
    goals = childrenOf(plan.id, "goal");
  const [adding, setAdding] = useState(false),
    [title, setTitle] = useState(""),
    [target, setTarget] = useState(10),
    [unit, setUnit] = useState(""),
    [due, setDue] = useState("");
  return (
    <section>
      <div className="section-header">
        <h3>Mål</h3>
        {writable && (
          <Button icon={Plus} onClick={() => setAdding(!adding)}>
            Lägg till mål
          </Button>
        )}
      </div>
      {goals.map((g) => (
        <article className="goal" key={g.id}>
          <h3>{g.body.title}</h3>
          <progress max={g.body.target} value={g.body.current} />
          <div className="settings-row">
            <span>
              {g.body.current} av {g.body.target} {g.body.unit}
            </span>
            <time>{g.body.due}</time>
            {writable && (
              <IconButton
                variant="danger"
                label="Ta bort mål"
                icon={Trash2}
                onClick={() => act(() => remove(g))}
              />
            )}
          </div>
          <Field label="Uppnått hittills" width="short">
            <DraftText
              label="Uppnått hittills"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              disabled={!writable}
              value={String(g.body.current)}
              version={g.version}
              onSave={(value, version) => {
                if (
                  value === "" ||
                  !Number.isFinite(Number(value)) ||
                  Number(value) < 0
                )
                  throw new Error("Ange ett värde som är noll eller större.");
                return patch(g, { current: Number(value) }, version);
              }}
            />
          </Field>
        </article>
      ))}
      {adding && (
        <form
          className="inset-form"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await create(
                "goal",
                { title, target: Number(target), unit, due },
                plan.id,
              );
              setAdding(false);
              setTitle("");
            });
          }}
        >
          <Field label="Vad vill ni uppnå?">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <div className="detail-meta">
            <Field label="Målvärde" width="short">
              <input
                required
                type="number"
                min="0.01"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </Field>
            <Field label="Enhet">
              <input
                placeholder="Till exempel deltagare"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Slutdatum" width="date" optional>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>
          <Button variant="primary">Skapa mål</Button>
        </form>
      )}
    </section>
  );
}
function Sprints({ plan, onOpen }) {
  const { childrenOf, create, patch, act, writable } = useApp(),
    sprints = childrenOf(plan.id, "sprint"),
    cards = childrenOf(plan.id, "card"),
    [selected, setSelected] = useState(""),
    [adding, setAdding] = useState(false),
    [title, setTitle] = useState(""),
    [start, setStart] = useState(today()),
    [due, setDue] = useState(today()),
    [goal, setGoal] = useState("");
  const sprint = sprints.find((s) => s.id === selected);
  return (
    <>
      <div className="section-header">
        <select
          aria-label="Arbetsperiod"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Ej inplanerat</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.body.title}
            </option>
          ))}
        </select>
        {writable && (
          <Button icon={Plus} onClick={() => setAdding(!adding)}>
            Ny arbetsperiod
          </Button>
        )}
      </div>
      {sprint && (
        <div className="sprint-summary">
          <h3>{sprint.body.title}</h3>
          <p>{sprint.body.goal}</p>
          <small>
            {sprint.body.start} – {sprint.body.due}
          </small>
        </div>
      )}
      {cards
        .filter((c) => c.body.sprintId === selected)
        .map((c) => (
          <div className="sprint-card" key={c.id}>
            <button onClick={() => onOpen(c.id)}>
              {c.body.done && <Check size={16} />} {c.body.title}
            </button>
            {writable && (
              <select
                aria-label={"Planera " + c.body.title}
                value={c.body.sprintId}
                onChange={(e) =>
                  act(() => patch(c, { sprintId: e.target.value }))
                }
              >
                <option value="">Ej inplanerat</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.body.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      {!cards.filter((c) => c.body.sprintId === selected).length && (
        <p className="quiet-empty">Inga uppgifter i den här arbetsperioden.</p>
      )}
      {adding && (
        <form
          className="inset-form"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const s = await create(
                "sprint",
                { title, start, due, goal },
                plan.id,
              );
              setSelected(s.id);
              setAdding(false);
            });
          }}
        >
          <Field label="Namn på arbetsperiod">
            <input
              required
              placeholder="Till exempel Oktober, vecka 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <div className="detail-meta">
            <Field label="Startdatum" width="date">
              <input
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Slutdatum" width="date">
              <input
                type="date"
                required
                min={start}
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Gemensamt mål" optional>
            <TextArea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </Field>
          <Button variant="primary">Skapa arbetsperiod</Button>
        </form>
      )}
    </>
  );
}
export function CardAdvanced({ record: r, onOpen }) {
  const { all, get, childrenOf, create, patch, act, writable } = useApp(),
    others = childrenOf(r.parent_id, "card").filter((c) => c.id !== r.id),
    subtasks = others.filter((c) => c.body.parentCardId === r.id),
    [newSub, setNewSub] = useState(false);
  return (
    <>
      <section className="task-properties" aria-label="Fler uppgiftsdetaljer">
        <h3>Planering</h3>
        <div className="detail-meta">
          <Field label="Prioritet" width="short">
            <select
              disabled={!writable}
              value={r.body.priority}
              onChange={(e) =>
                act(() => patch(r, { priority: e.target.value }))
              }
            >
              <option value="low">Låg</option>
              <option value="normal">Normal</option>
              <option value="high">Hög</option>
            </select>
          </Field>
          <Field label="När uppgiften blir klar">
            <select
              disabled={!writable}
              value={r.body.repeat}
              onChange={(e) => act(() => patch(r, { repeat: e.target.value }))}
            >
              <option value="none">Upprepas inte</option>
              <option value="weekly">Skapa nästa vecka</option>
              <option value="monthly">Skapa nästa månad</option>
            </select>
          </Field>
          <Field label="Etiketter" hint="Separera med komma.">
            <DraftText
              label="Etiketter"
              value={r.body.tags.join(", ")}
              version={r.version}
              disabled={!writable}
              onSave={(v, version) =>
                patch(
                  r,
                  {
                    tags: [
                      ...new Set(
                        v
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      ),
                    ],
                  },
                  version,
                )
              }
            />
          </Field>
          <Field label="Uppskattad tid (timmar)" width="short">
            <DraftText
              label="Uppskattad tid, timmar"
              inputMode="decimal"
              value={String(r.body.estimate)}
              version={r.version}
              disabled={!writable}
              onSave={(v, version) => {
                const n = Number(v.replace(",", "."));
                if (!Number.isFinite(n) || n < 0)
                  throw new Error("Ange ett positivt antal timmar.");
                return patch(r, { estimate: n }, version);
              }}
            />
          </Field>
          <Field label="Arbetsperiod">
            <select
              disabled={!writable}
              value={r.body.sprintId}
              onChange={(e) =>
                act(() => patch(r, { sprintId: e.target.value }))
              }
            >
              <option value="">Ej inplanerat</option>
              {childrenOf(r.parent_id, "sprint").map((s) => (
                <option key={s.id} value={s.id}>
                  {s.body.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Del av uppgift">
            <select
              disabled={!writable}
              value={r.body.parentCardId}
              onChange={(e) =>
                act(() => patch(r, { parentCardId: e.target.value }))
              }
            >
              <option value="">Fristående uppgift</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.body.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <fieldset className="connection-list">
          <legend>Väntar på dessa uppgifter</legend>
          {others.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                disabled={!writable}
                checked={r.body.dependencies.includes(c.id)}
                onChange={(e) =>
                  act(() =>
                    patch(r, {
                      dependencies: e.target.checked
                        ? [...r.body.dependencies, c.id]
                        : r.body.dependencies.filter((id) => id !== c.id),
                    }),
                  )
                }
              />
              <span>
                {c.body.title} {c.body.done ? "· klar" : ""}
              </span>
            </label>
          ))}
          {!others.length && (
            <p className="muted">
              Skapa fler uppgifter för att koppla beroenden.
            </p>
          )}
        </fieldset>
      </section>
      {r.body.dependencies.some((id) => !get(id)?.body.done) && (
        <p className="dependency-note">
          Väntar på:{" "}
          {r.body.dependencies
            .map(get)
            .filter((c) => c && !c.body.done)
            .map((c) => c.body.title)
            .join(", ")}
        </p>
      )}
      <div className="section-header">
        <h3>Deluppgifter</h3>
        {writable && (
          <Button icon={Plus} onClick={() => setNewSub(true)}>
            Lägg till deluppgift
          </Button>
        )}
      </div>
      {subtasks.length > 0 && <TaskList cards={subtasks} onOpen={onOpen} />}
      <Disclosure title="Kopplade dokument">
        {r.body.linkedDocs.map((id) => {
          const d = get(id);
          return d ? (
            <Button key={id} icon={Link2} onClick={() => onOpen(id)}>
              {d.body.title}
            </Button>
          ) : null;
        })}
        {writable && (
          <select
            aria-label="Koppla dokument"
            value=""
            onChange={(e) =>
              act(() =>
                patch(r, {
                  linkedDocs: [...r.body.linkedDocs, e.target.value],
                }),
              )
            }
          >
            <option value="">Koppla ett gemensamt dokument…</option>
            {all("doc")
              .filter((d) => !r.body.linkedDocs.includes(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.body.title}
                </option>
              ))}
          </select>
        )}
      </Disclosure>
      <TimeTracking record={r} />
      {newSub && (
        <NewName
          title="Ny deluppgift"
          label="Vad behöver göras?"
          onClose={() => setNewSub(false)}
          onSave={(title) =>
            create(
              "card",
              { title, bucketId: r.body.bucketId, parentCardId: r.id },
              r.parent_id,
            )
          }
        />
      )}
    </>
  );
}
function TimeTracking({ record: r }) {
  const { state, childrenOf, create, remove, act, reload, writable, user } =
      useApp(),
    logs = childrenOf(r.id, "time"),
    timer = state.timer;
  const [stamp, setStamp] = useState(Date.now()),
    [minutes, setMinutes] = useState("30"),
    [date, setDate] = useState(today()),
    [note, setNote] = useState("");
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setStamp(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer?.started]);
  const seconds = timer
    ? Math.max(0, Math.floor((stamp - timer.started) / 1000))
    : 0;
  return (
    <Disclosure title="Tid på uppgiften">
      <p className="muted">
        Totalt{" "}
        {(logs.reduce((s, l) => s + l.body.minutes, 0) / 60).toLocaleString(
          "sv-SE",
          { maximumFractionDigits: 1 },
        )}{" "}
        timmar registrerade.
      </p>
      {timer && (
        <p>
          Tidtagning pågår{" "}
          {timer.card_id === r.id ? "här" : "på en annan uppgift"}:{" "}
          {Math.floor(seconds / 3600)} h {Math.floor(seconds / 60) % 60} min{" "}
          {seconds % 60} s
        </p>
      )}
      {writable && (
        <Button
          icon={timer ? Square : Play}
          onClick={() =>
            act(async () => {
              await api(timer ? "/timer/stop" : "/timer/start", {
                method: "POST",
                body: timer ? {} : { cardId: r.id },
              });
              await reload();
            })
          }
        >
          {timer ? "Stoppa tidtagning" : "Starta tidtagning"}
        </Button>
      )}
      <small className="block-hint">
        Tidtagningen fortsätter om du stänger sidan och stoppas automatiskt
        efter 24 timmar.
      </small>
      {writable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await create(
                "time",
                { minutes: Number(minutes), date, note },
                r.id,
              );
              setNote("");
            });
          }}
        >
          <div className="detail-meta spaced">
            <Field label="Minuter" width="short">
              <input
                type="number"
                min="1"
                max="1440"
                required
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </Field>
            <Field label="Datum" width="date">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Anteckning" optional>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button>Registrera tid</Button>
        </form>
      )}
      {logs.map((l) => (
        <div className="settings-row" key={l.id}>
          <span>
            {state.members.find((m) => m.id === l.created_by)?.name ||
              "Tidigare medlem"}{" "}
            · {l.body.minutes} min
            <br />
            <small>
              {l.body.date} {l.body.note}
            </small>
          </span>
          {writable && l.created_by === user.id && (
            <IconButton
              variant="danger"
              label="Ta bort tidsregistrering"
              icon={Trash2}
              onClick={() => act(() => remove(l))}
            />
          )}
        </div>
      ))}
    </Disclosure>
  );
}
export function Portfolio({ onPlan, onOpen }) {
  const { all, childrenOf, get } = useApp(),
    plans = all("plan"),
    cards = all("card").filter(
      (c) => get(c.parent_id) && !get(c.parent_id).body.archived,
    ),
    [mode, setMode] = useState("overview");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Överblick</h1>
        </div>
        <div className="segmented">
          <Button
            variant={mode === "overview" ? "selected" : ""}
            onClick={() => setMode("overview")}
          >
            Projektöversikt
          </Button>
          <Button
            variant={mode === "roadmap" ? "selected" : ""}
            onClick={() => setMode("roadmap")}
          >
            Färdplan
          </Button>
        </div>
      </div>
      {mode === "roadmap" ? (
        <Timeline cards={cards} onOpen={onOpen} />
      ) : (
        <div className="portfolio">
          {plans.map((p) => {
            const pc = childrenOf(p.id, "card"),
              done = pc.filter((c) => c.body.done).length;
            return (
              <button key={p.id} onClick={() => onPlan(p.id)}>
                <span className={"plan-dot " + p.body.color} />
                <strong>{p.body.title}</strong>
                <span>{pc.length} uppgifter</span>
                <progress max={pc.length || 1} value={done} />
                <span>{done} klara</span>
                <span className="overdue">
                  {
                    pc.filter(
                      (c) => !c.body.done && c.body.due && c.body.due < today(),
                    ).length
                  }{" "}
                  försenade
                </span>
              </button>
            );
          })}
          {!plans.length && (
            <Empty
              title="Era planer samlas här"
              text="Skapa en plan för att börja följa arbetet."
            />
          )}
        </div>
      )}
    </>
  );
}
export function Chat() {
  const { all, state, create, act, writable } = useApp(),
    [text, setText] = useState(""),
    [mention, setMention] = useState(""),
    [busy, setBusy] = useState(false),
    end = useRef();
  const messages = all("message");
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Teamsamtal</h1>
        </div>
      </div>
      <div className="chat-messages">
        {messages.map((m) => (
          <article className="comment" key={m.id}>
            <strong>
              {state.members.find((u) => u.id === m.created_by)?.name ||
                "Tidigare medlem"}
            </strong>
            <time>
              {new Date(m.updated_at).toLocaleString("sv-SE", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </time>
            <p>{m.body.text}</p>
          </article>
        ))}
        {!messages.length && (
          <Empty
            title="Vad behöver ni prata om?"
            text="Meddelanden här syns för hela teamet."
          />
        )}
        <div ref={end} />
      </div>
      {writable && (
        <form
          className="chat-compose"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim() || busy) return;
            setBusy(true);
            await act(async () => {
              await create("message", {
                text,
                mentions: mention ? [mention] : [],
              });
              setText("");
              setMention("");
            });
            setBusy(false);
          }}
        >
          <Field label="Meddelande till teamet">
            <TextArea
              rows={2}
              required
              disabled={busy}
              maxLength={10000}
              aria-label="Meddelande till teamet"
              placeholder="Skriv till teamet…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <div className="actions">
            <Field label="Uppmärksamma kollega" optional>
              <select
                disabled={busy}
                value={mention}
                aria-label="Uppmärksamma kollega"
                onChange={(e) => setMention(e.target.value)}
              >
                <option value="">Ingen</option>
                {state.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="primary" disabled={busy || !text.trim()}>
              {busy ? "Skickar…" : "Skicka meddelande"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
