import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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
export function IconButton({ label, icon: Icon, variant = "", ...props }) {
  return (
    <button
      className={`icon-button ${variant}`}
      aria-label={label}
      title={label}
      {...props}
    >
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
export function Field({ label, children, hint, width = "", optional = false }) {
  const id = React.useId();
  const checkbox = children.props.type === "checkbox";
  return (
    <div
      className={`field ${width ? `field-${width}` : ""} ${checkbox ? "field-check" : ""}`}
    >
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional"> (valfritt)</span>}
      </label>
      {React.cloneElement(children, {
        id,
        "aria-describedby":
          [children.props["aria-describedby"], hint && id + "-hint"]
            .filter(Boolean)
            .join(" ") || undefined,
      })}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function TextArea({ value, rows = 3, ...props }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const field = ref.current;
    const resize = () => {
      // Hidden disclosures are measured again when their available width changes.
      if (!field.clientWidth) return;
      field.style.height = "auto";
      field.style.height = Math.min(field.scrollHeight + 2, 480) + "px";
    };
    resize();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width !== field.clientWidth) {
        width = field.clientWidth;
        resize();
      }
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [value, rows]);
  return <textarea {...props} ref={ref} value={value} rows={rows} />;
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
export function NewName({
  title,
  label = "Namn",
  onSave,
  onClose,
  children,
  multiline = false,
}) {
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
          {React.createElement(multiline ? TextArea : "input", {
            required: true,
            disabled: busy,
            maxLength: multiline ? 2000 : 200,
            autoFocus: true,
            value,
            onChange: (e) => set(e.target.value),
          })}
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
  rows = 3,
  autoSave = true,
  saveLabel = "Spara",
  id,
  "aria-describedby": describedBy,
  ...inputProps
}) {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
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
    if (!autoSave || !dirty || saving || conflict || error || disabled) return;
    const timeout = setTimeout(() => save(), 900);
    return () => clearTimeout(timeout);
  }, [draft, dirty, saving, conflict, error, disabled, autoSave]);
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
    ...inputProps,
    id: fieldId,
    value: draft,
    placeholder,
    disabled,
    "aria-label": label,
    "aria-invalid": Boolean(error),
    "aria-describedby":
      [describedBy, error && fieldId + "-error"].filter(Boolean).join(" ") ||
      undefined,
    className,
    onChange: (e) => {
      if (!dirty) base.current = version;
      revision.current++;
      setSaved(false);
      if (!conflict) setError("");
      setDirty(true);
      setDraft(e.target.value);
    },
    onBlur: () => autoSave && save(),
  };
  return (
    <div className="draft" data-dirty={dirty}>
      {multiline ? (
        <TextArea {...props} rows={rows} />
      ) : (
        <input type={type} {...props} />
      )}
      <span className="save-status" aria-live="polite">
        {saving
          ? "Sparar…"
          : dirty && !conflict
            ? "Osparade ändringar"
            : saved
              ? "Sparat"
              : ""}
      </span>
      {!autoSave && dirty && !error && (
        <div className="actions">
          <Button
            disabled={saving}
            onClick={() => {
              setDraft(value);
              setDirty(false);
              setError("");
              setConflict(false);
            }}
          >
            Avbryt
          </Button>
          <Button variant="primary" disabled={saving} onClick={() => save()}>
            {saving ? "Sparar…" : saveLabel}
          </Button>
        </div>
      )}
      {error && (
        <div id={fieldId + "-error"} className="inline-error" role="alert">
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
          aria-controls={`${id}-panel`}
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
