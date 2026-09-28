import React, { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Paperclip,
  MoreHorizontal,
} from "lucide-react";
import { api, useApp } from "./store";
import { Button, IconButton, DraftText } from "./ui";
export const blockNames = {
  text: "Text",
  heading: "Rubrik",
  checklist: "Checklista",
  input: "Svarsfält",
  select: "Flervalsfält",
  table: "Tabell",
  link: "Länk",
  file: "Bilaga",
  image: "Bild",
};
export function Document({ record }) {
  const { childrenOf, create, act, all, writable, reload, setNotice } =
      useApp(),
    blocks = childrenOf(record.id, "block");
  const [adding, setAdding] = useState(false),
    [uploading, setUploading] = useState(false),
    [firstDraft, setFirstDraft] = useState("");
  async function add(type) {
    await create(
      "block",
      {
        type,
        title:
          type === "input"
            ? "Fråga"
            : type === "select"
              ? "Välj ett alternativ"
              : "",
        options: type === "select" ? ["Ja", "Nej", "Vet inte"] : [],
        rows:
          type === "table"
            ? [
                ["Rubrik", "Rubrik"],
                ["", ""],
              ]
            : [],
        order: blocks.length
          ? Math.max(...blocks.map((b) => b.body.order)) + 1
          : 0,
      },
      record.id,
    );
    setAdding(false);
  }
  async function upload(file) {
    if (!file) return;
    setUploading(true);
    await act(async () => {
      const f = await api(
        "/files?team=" +
          record.team_id +
          "&name=" +
          encodeURIComponent(file.name) +
          "&mime=" +
          encodeURIComponent(file.type),
        {
          method: "POST",
          raw: true,
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        },
      );
      await create(
        "block",
        {
          type: f.mime.startsWith("image/") ? "image" : "file",
          title: f.name,
          fileId: f.id,
          order: blocks.length + 1,
        },
        record.id,
      );
    });
    setUploading(false);
  }
  return (
    <section className="document">
      <div className="section-header">
        <h3>Arbetsdokument</h3>
        {writable && all("template").length > 0 && (
          <select
            aria-label="Lägg till från mall"
            value=""
            onChange={(e) =>
              act(async () => {
                await api("/records/" + record.id + "/template", {
                  method: "POST",
                  body: { templateId: e.target.value },
                });
                await reload();
              })
            }
          >
            <option value="">Använd mall…</option>
            {all("template").map((t) => (
              <option key={t.id} value={t.id}>
                {t.body.title}
              </option>
            ))}
          </select>
        )}
      </div>
      {blocks.map((b, i) => (
        <Block
          key={b.id}
          block={b}
          previous={blocks[i - 1]}
          next={blocks[i + 1]}
        />
      ))}
      {(!blocks.length || firstDraft) &&
        (writable ? (
          <FirstNote
            record={record}
            text={firstDraft}
            onChange={setFirstDraft}
            order={
              blocks.length
                ? Math.max(...blocks.map((b) => b.body.order)) + 1
                : 0
            }
          />
        ) : (
          <p className="muted document-hint">Inget dokumentinnehåll ännu.</p>
        ))}
      {writable && (
        <div className="document-add">
          <Button
            icon={Plus}
            onClick={() => setAdding(!adding)}
            aria-expanded={adding}
          >
            Lägg till innehåll
          </Button>
          <label className="button">
            <Paperclip size={17} />
            {uploading ? "Laddar upp…" : "Bifoga fil"}
            <input
              className="visually-hidden"
              type="file"
              disabled={uploading}
              onChange={(e) => {
                upload(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
          {blocks.length > 0 && (
            <Button
              onClick={() =>
                act(async () => {
                  await create("template", {
                    title: record.body.title,
                    blocks: blocks.map((b) => b.body),
                  });
                  setNotice({ text: "Dokumentet har sparats som mall." });
                })
              }
            >
              Spara som mall
            </Button>
          )}
        </div>
      )}
      {adding && (
        <div className="block-menu">
          {Object.entries(blockNames)
            .filter(([k]) => !["file", "image"].includes(k))
            .map(([k, v]) => (
              <Button key={k} onClick={() => act(() => add(k))}>
                {v}
              </Button>
            ))}
        </div>
      )}
    </section>
  );
}
function FirstNote({ record, text, onChange, order }) {
  const { create, act } = useApp();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!text) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [text]);
  return (
    <form
      className="first-note"
      data-dirty={Boolean(text)}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
        await act(async () => {
          await create("block", { type: "text", text, order }, record.id);
          onChange("");
        });
        setBusy(false);
      }}
    >
      <textarea
        aria-label="Börja skriva i dokumentet"
        placeholder="Vad behöver göras? Skriv instruktioner eller börja anteckna här…"
        value={text}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        maxLength={50000}
      />
      {text && (
        <div className="first-note-actions">
          <span>Lägg till för att spara</span>
          <Button variant="primary" disabled={busy || !text.trim()}>
            {busy ? "Lägger till…" : "Lägg till text"}
          </Button>
        </div>
      )}
    </form>
  );
}
function Block({ block: b, previous, next }) {
  const { patch, remove, act, writable } = useApp();
  const d = b.body;
  const [newItem, setNewItem] = useState("");
  const save = (body, version) => patch(b, body, version);
  const tools = writable && (
    <details className="block-options">
      <summary
        aria-label={`${blockNames[d.type]}: fler alternativ`}
        title="Fler alternativ"
      >
        <MoreHorizontal size={19} />
      </summary>
      <div className="block-option-list">
        <Button
          icon={ArrowUp}
          disabled={!previous}
          onClick={() => act(() => save({ order: previous.body.order - 0.5 }))}
        >
          Flytta upp
        </Button>
        <Button
          icon={ArrowDown}
          disabled={!next}
          onClick={() => act(() => save({ order: next.body.order + 0.5 }))}
        >
          Flytta ned
        </Button>
        <Button icon={Trash2} onClick={() => act(() => remove(b))}>
          Ta bort block
        </Button>
      </div>
    </details>
  );
  return (
    <div className={`document-block block-${d.type}`}>
      {tools}
      {["text", "heading"].includes(d.type) && (
        <DraftText
          value={d.text}
          version={b.version}
          label={blockNames[d.type]}
          disabled={!writable}
          multiline={d.type === "text"}
          placeholder={d.type === "text" ? "Skriv här…" : "Rubrik"}
          className={d.type === "heading" ? "heading-input" : "text-input"}
          onSave={(v, version) => save({ text: v }, version)}
        />
      )}
      {["input", "select"].includes(d.type) && (
        <>
          <DraftText
            value={d.title}
            label="Fältets rubrik"
            version={b.version}
            disabled={!writable}
            onSave={(v, version) => save({ title: v }, version)}
          />
          {d.type === "input" ? (
            <DraftText
              multiline
              value={d.value}
              label={d.title}
              placeholder="Skriv ditt svar…"
              version={b.version}
              disabled={!writable}
              onSave={(v, version) => save({ value: v }, version)}
            />
          ) : (
            <>
              <select
                aria-label={d.title}
                disabled={!writable}
                value={d.value}
                onChange={(e) => act(() => save({ value: e.target.value }))}
              >
                <option value="">Välj…</option>
                {d.options.map((o, i) => (
                  <option key={i}>{o}</option>
                ))}
              </select>
              {writable && (
                <details>
                  <summary>Ändra svarsalternativ</summary>
                  <DraftText
                    value={d.options.join("\n")}
                    multiline
                    label="Ett alternativ per rad"
                    version={b.version}
                    onSave={(v, version) =>
                      save(
                        {
                          options: [
                            ...new Set(
                              v
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            ),
                          ],
                          value: "",
                        },
                        version,
                      )
                    }
                  />
                </details>
              )}
            </>
          )}
        </>
      )}
      {d.type === "checklist" && (
        <>
          <div className="checklist">
            {d.checked.map((c) => (
              <div key={c.id} className="check-row">
                <input
                  aria-label={c.text || "Checklistpunkt"}
                  type="checkbox"
                  checked={c.done}
                  disabled={!writable}
                  onChange={(e) =>
                    act(() =>
                      save({
                        checked: d.checked.map((x) =>
                          x.id === c.id ? { ...x, done: e.target.checked } : x,
                        ),
                      }),
                    )
                  }
                />
                <span className={c.done ? "done" : ""}>{c.text}</span>
                {writable && (
                  <IconButton
                    label={"Ta bort " + c.text}
                    icon={Trash2}
                    onClick={() =>
                      act(() =>
                        save({
                          checked: d.checked.filter((x) => x.id !== c.id),
                        }),
                      )
                    }
                  />
                )}
              </div>
            ))}
          </div>
          {writable && (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newItem.trim()) return;
                act(async () => {
                  await save({
                    checked: [
                      ...d.checked,
                      {
                        id: crypto.randomUUID(),
                        text: newItem.trim(),
                        done: false,
                      },
                    ],
                  });
                  setNewItem("");
                });
              }}
            >
              <input
                value={newItem}
                maxLength={1000}
                aria-label="Ny checklistpunkt"
                placeholder="Lägg till en punkt…"
                onChange={(e) => setNewItem(e.target.value)}
              />
              <Button icon={Plus}>Lägg till</Button>
            </form>
          )}
        </>
      )}
      {d.type === "table" && (
        <>
          <div className="table-wrap">
            <table className="edit-table">
              <tbody>
                {d.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => (
                      <td key={j}>
                        <DraftText
                          value={v}
                          label={`Rad ${i + 1}, kolumn ${j + 1}`}
                          version={b.version}
                          disabled={!writable}
                          onSave={(text, version) =>
                            save(
                              {
                                rows: d.rows.map((r, a) =>
                                  a === i
                                    ? r.map((c, k) => (k === j ? text : c))
                                    : r,
                                ),
                              },
                              version,
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {writable && (
            <div className="actions">
              <Button
                onClick={() =>
                  act(() =>
                    save({
                      rows: [...d.rows, Array(d.rows[0]?.length || 2).fill("")],
                    }),
                  )
                }
              >
                Lägg till rad
              </Button>
              <Button
                onClick={() =>
                  act(() => save({ rows: d.rows.map((r) => [...r, ""]) }))
                }
              >
                Lägg till kolumn
              </Button>
            </div>
          )}
        </>
      )}
      {d.type === "link" && (
        <>
          <DraftText
            label="Webbadress"
            value={d.value}
            placeholder="https://…"
            version={b.version}
            disabled={!writable}
            onSave={(v, version) => {
              if (v && !/^https?:\/\//i.test(v))
                throw new Error("Använd en adress som börjar med https://");
              return save({ value: v }, version);
            }}
          />
          {/^https?:\/\//i.test(d.value) && (
            <a href={d.value} target="_blank" rel="noopener noreferrer">
              Öppna länken ↗
            </a>
          )}
        </>
      )}
      {["file", "image"].includes(d.type) && (
        <>
          {d.type === "image" && (
            <img
              className="attachment-image"
              src={"/api/files/" + d.fileId}
              alt={d.title}
            />
          )}
          <a
            href={"/api/files/" + d.fileId}
            target="_blank"
            rel="noopener noreferrer"
          >
            {d.title || "Öppna bilaga"}
          </a>
        </>
      )}
    </div>
  );
}
export function Comments({ record }) {
  const { childrenOf, create, act, state, writable } = useApp(),
    [text, setText] = useState(""),
    [mention, setMention] = useState("");
  const comments = childrenOf(record.id, "comment");
  return (
    <section className="comments">
      <h3>Samtal</h3>
      {comments.map((c) => (
        <article className="comment" key={c.id}>
          <strong>
            {state.members.find((m) => m.id === c.created_by)?.name ||
              "Tidigare medlem"}
          </strong>
          <time>
            {new Date(c.updated_at).toLocaleString("sv-SE", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>
          <p>{c.body.text}</p>
        </article>
      ))}
      {!comments.length && (
        <p className="muted">Frågor och överlämningar samlas här.</p>
      )}
      {writable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await create(
                "comment",
                { text, mentions: mention ? [mention] : [] },
                record.id,
              );
              setText("");
              setMention("");
            });
          }}
        >
          <textarea
            aria-label="Kommentar"
            required
            placeholder="Skriv en kommentar…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="actions">
            <select
              aria-label="Uppmärksamma kollega"
              value={mention}
              onChange={(e) => setMention(e.target.value)}
            >
              <option value="">Uppmärksamma kollega…</option>
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <Button variant="primary">Skicka</Button>
          </div>
        </form>
      )}
    </section>
  );
}
