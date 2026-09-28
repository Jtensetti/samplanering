import React, { useEffect, useRef, useState } from "react";
import { X, Plus, ChevronDown } from "lucide-react";
import { useApp } from "./store";
export function Button({
  children,
  icon: Icon,
  variant = "",
  className = "",
  ...props
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {Icon && <Icon size={17} />}
      <span>{children}</span>
    </button>
  );
}
export function IconButton({ label, icon: Icon, ...props }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      <Icon size={18} />
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  sheet = false,
  className = "",
  heading,
}) {
  const ref = useRef();
  const { notice, setNotice, act } = useApp();
  const close = () => {
    if (
      ref.current?.querySelector('[data-dirty="true"]') &&
      !confirm("Det finns osparade ändringar. Vill du stänga ändå?")
    )
      return;
    onClose();
  };
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    const cancel = (e) => {
      e.preventDefault();
      close();
    };
    d.addEventListener("cancel", cancel);
    return () => {
      d.removeEventListener("cancel", cancel);
      d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${wide ? "wide" : ""} ${sheet ? "sheet" : ""} ${className}`}
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <h2>{heading || title}</h2>
          <IconButton icon={X} label="Stäng" onClick={close} />
          {notice && (
            <div
              className={`dialog-notice ${notice.error ? "error" : ""}`}
              role={notice.error ? "alert" : "status"}
            >
              <span>{notice.text}</span>
              {notice.undo && (
                <Button onClick={() => act(notice.undo)}>Ångra</Button>
              )}
              <IconButton
                icon={X}
                label="Stäng meddelande"
                onClick={() => setNotice(null)}
              />
            </div>
          )}
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Field({ label, children, hint }) {
  const id = React.useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": hint ? id + "-hint" : undefined,
      })}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function Empty({ title, text, children }) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <Plus size={25} />
      </div>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
export function Avatar({ name }) {
  return (
    <span className="avatar" title={name}>
      {name
        ?.split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "?"}
    </span>
  );
}
export function NewName({ title, label = "Namn", onSave, onClose, children }) {
  const [value, set] = useState(""),
    [busy, setBusy] = useState(false);
  const { act } = useApp();
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await act(async () => {
            await onSave(value);
            onClose();
          });
          setBusy(false);
        }}
      >
        <Field label={label}>
          <input
            required
            maxLength={200}
            autoFocus
            value={value}
            onChange={(e) => set(e.target.value)}
          />
        </Field>
        {children}
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
export function DraftText({
  value = "",
  version,
  onSave,
  placeholder = "",
  multiline = false,
  className = "",
  label = "Text",
  disabled = false,
  type = "text",
}) {
  const [draft, setDraft] = useState(value),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState("");
  const base = useRef(version);
  const revision = useRef(0);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setDraft(value);
      base.current = version;
    }
  }, [value, version, dirty]);
  useEffect(() => {
    if (!dirty || saving || conflict || error || disabled) return;
    const timeout = setTimeout(() => save(), 900);
    return () => clearTimeout(timeout);
  }, [draft, dirty, saving, conflict, error, disabled]);
  useEffect(() => {
    if (!saved) return;
    const timeout = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(timeout);
  }, [saved]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(force = false) {
    if (!dirty || saving || disabled || (conflict && !force)) return;
    setSaving(true);
    setError("");
    const savingRevision = revision.current;
    try {
      const saved = await onSave(draft, force ? version : base.current);
      if (saved?.version) base.current = saved.version;
      if (revision.current === savingRevision) setDirty(false);
      setSaved(true);
      setConflict(false);
    } catch (e) {
      setError(e.message);
      if (e.status === 409) setConflict(true);
    } finally {
      setSaving(false);
    }
  }
  const props = {
    value: draft,
    placeholder,
    disabled,
    "aria-label": label,
    className,
    onChange: (e) => {
      if (!dirty) base.current = version;
      revision.current++;
      setSaved(false);
      if (!conflict) setError("");
      setDirty(true);
      setDraft(e.target.value);
    },
    onBlur: () => save(),
  };
  return (
    <div className="draft" data-dirty={dirty}>
      {multiline ? <textarea {...props} /> : <input type={type} {...props} />}
      <span className="save-status" aria-live="polite">
        {saving
          ? "Sparar…"
          : dirty && !conflict
            ? "Osparade ändringar"
            : saved
              ? "Sparat"
              : ""}
      </span>
      {error && (
        <div className="inline-error" role="alert">
          {error}
          {!conflict && <Button onClick={() => save()}>Försök igen</Button>}
          {conflict && (
            <>
              <p>
                Senaste sparade text: <q>{value || "(tomt)"}</q>
              </p>
              <Button onClick={() => save(true)}>Spara min text</Button>
              <Button
                onClick={() => {
                  setDraft(value);
                  setDirty(false);
                  setConflict(false);
                  setError("");
                }}
              >
                Använd senaste
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export function Tabs({ id, label, value, items, onChange }) {
  return (
    <div className="workspace-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          id={`${id}-${item.id}-tab`}
          role="tab"
          aria-selected={value === item.id}
          aria-controls={`${id}-${item.id}-panel`}
          tabIndex={value === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            let next;
            if (event.key === "ArrowRight") next = (index + 1) % items.length;
            if (event.key === "ArrowLeft")
              next = (index + items.length - 1) % items.length;
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = items.length - 1;
            if (next === undefined) return;
            event.preventDefault();
            onChange(items[next].id);
            document.getElementById(`${id}-${items[next].id}-tab`)?.focus();
          }}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="tab-count">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
export function Disclosure({ title, children, open = false }) {
  return (
    <details open={open || undefined} className="disclosure">
      <summary>
        {title}
        <ChevronDown size={16} />
      </summary>
      <div>{children}</div>
    </details>
  );
}
