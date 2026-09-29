import React, { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Paperclip,
  MoreHorizontal,
} from "lucide-react";
import { api, useApp, firebaseMode } from "./store";
import { Button, IconButton, DraftText, TextArea, Field } from "./ui";
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
      <TextArea
        rows={4}
        aria-label="Börja skriva i dokumentet"
        placeholder="Skriv instruktioner eller anteckningar…"
        value={text}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        maxLength={50000}
      />
      {text && (
        <div className="first-note-actions">
          <span>Inte sparat ännu</span>
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
        <Button
          variant="danger"
          icon={Trash2}
          onClick={() => act(() => remove(b))}
        >
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
          multiline
          rows={d.type === "heading" ? 1 : 3}
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
                  <Field
                    label="Svarsalternativ"
                    hint="Ett alternativ per rad. Svaret rensas bara om det valda alternativet tas bort."
                  >
                    <DraftText
                      value={d.options.join("\n")}
                      multiline
                      label="Svarsalternativ"
                      autoSave={false}
                      saveLabel="Spara alternativ"
                      version={b.version}
                      onSave={(v, version) => {
                        const options = [
                          ...new Set(
                            v
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          ),
                        ];
                        if (
                          options.length > 30 ||
                          options.some((o) => o.length > 100)
                        )
                          throw new Error(
                            "Använd högst 30 alternativ med högst 100 tecken vardera.",
                          );
                        return save(
                          {
                            options,
                            value: options.includes(d.value) ? d.value : "",
                          },
                          version,
                        );
                      }}
                    />
                  </Field>
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
                <label className="check-option">
                  <input
                    aria-label={c.text || "Checklistpunkt"}
                    type="checkbox"
                    checked={c.done}
                    disabled={!writable}
                    onChange={(e) =>
                      act(() =>
                        save({
                          checked: d.checked.map((x) =>
                            x.id === c.id
                              ? { ...x, done: e.target.checked }
                              : x,
                          ),
                        }),
                      )
                    }
                  />
                  <span className={c.done ? "done" : ""}>{c.text}</span>
                </label>
                {writable && (
                  <IconButton
                    variant="danger"
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
              <Field label="Ny checklistpunkt">
                <input
                  value={newItem}
                  maxLength={1000}
                  aria-label="Ny checklistpunkt"
                  placeholder="Vad behöver göras?"
                  onChange={(e) => setNewItem(e.target.value)}
                />
              </Field>
              <Button icon={Plus} disabled={!newItem.trim()}>
                Lägg till
              </Button>
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
          <Field label="Webbadress">
            <DraftText
              type="url"
              autoComplete="url"
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
          </Field>
          {/^https?:\/\//i.test(d.value) && (
            <a href={d.value} target="_blank" rel="noopener noreferrer">
              Öppna länken ↗
            </a>
          )}
        </>
      )}
      {["file", "image"].includes(d.type) && <Attachment block={b} />}
    </div>
  );
}
function Attachment({ block }) {
  const { body: d } = block;
  const [url, setUrl] = useState(firebaseMode ? "" : "/api/files/" + d.fileId);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!firebaseMode) return;
    let live = true,
      objectUrl;
    setUrl("");
    setError("");
    import("./firebase-client.mjs")
      .then(async (adapter) => {
        const response = await adapter.response(
          "/files/" + d.fileId,
          {},
          block.team_id,
        );
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Filen kunde inte öppnas.",
          );
        objectUrl = URL.createObjectURL(await response.blob());
        if (live) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [d.fileId, block.team_id, retry]);
  if (error)
    return (
      <div role="alert">
        {error}{" "}
        <Button variant="ghost" onClick={() => setRetry((x) => x + 1)}>
          Försök igen
        </Button>
      </div>
    );
  if (!url) return <span role="status">Hämtar bilaga…</span>;
  return (
    <>
      {d.type === "image" && (
        <img className="attachment-image" src={url} alt={d.title} />
      )}
      <a
        href={url}
        download={firebaseMode ? d.title || "Bilaga" : undefined}
        target="_blank"
        rel="noopener noreferrer"
      >
        {d.title || "Öppna bilaga"}
      </a>
    </>
  );
}
export function Comments({ record }) {
  const { childrenOf, create, act, state, writable } = useApp(),
    [text, setText] = useState(""),
    [mention, setMention] = useState(""),
    [busy, setBusy] = useState(false);
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
      {!comments.length && !writable && (
        <p className="muted">Inga kommentarer ännu.</p>
      )}
      {writable && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim() || busy) return;
            setBusy(true);
            await act(async () => {
              await create(
                "comment",
                { text, mentions: mention ? [mention] : [] },
                record.id,
              );
              setText("");
              setMention("");
            });
            setBusy(false);
          }}
        >
          <Field label="Kommentar">
            <TextArea
              rows={2}
              aria-label="Kommentar"
              required
              disabled={busy}
              maxLength={10000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <div className="actions">
            <Field label="Uppmärksamma kollega" optional>
              <select
                aria-label="Uppmärksamma kollega"
                value={mention}
                onChange={(e) => setMention(e.target.value)}
                disabled={busy}
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
              {busy ? "Skickar…" : "Skicka"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
