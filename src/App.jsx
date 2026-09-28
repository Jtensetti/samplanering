import React, { useEffect, useState } from "react";
import {
  LayoutGrid,
  CheckSquare,
  BookOpen,
  Users,
  Plus,
  Search,
  LogOut,
  Menu,
  X,
  CalendarDays,
  MessageSquare,
  Archive,
  Check,
  Bell,
  PanelTop,
  ChartNoAxesCombined,
  History,
  ChevronDown,
} from "lucide-react";
import { api, useApp, today } from "./store";
import {
  Button,
  IconButton,
  Modal,
  Field,
  Empty,
  Avatar,
  NewName,
  DraftText,
  Disclosure,
} from "./ui";
import { CardAdvanced, Portfolio, Chat } from "./advanced";
import {
  Plan,
  CreatePlan,
  CustomFields,
  HistoryView,
  ArchiveView,
  Notifications,
} from "./views";
import { Document, Comments } from "./documents";
import { Home, MyTasks, dueLabel } from "./workspace";
export default function App() {
  const app = useApp(),
    {
      user,
      ready,
      setUser,
      teams,
      teamId,
      setTeamId,
      state,
      all,
      get,
      childrenOf,
      create,
      patch,
      act,
      refreshTeams,
      notice,
      setNotice,
      online,
      writable,
    } = app;
  const [page, setPage] = useState("plans"),
    [planId, setPlan] = useState(""),
    [selected, setSelected] = useState(""),
    [trail, setTrail] = useState([]),
    [newPlan, setNewPlan] = useState(false),
    [invite, setInvite] = useState(false),
    [teamModal, setTeamModal] = useState(false),
    [mobile, setMobile] = useState(false),
    [newDoc, setNewDoc] = useState(false),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false),
    [archive, setArchive] = useState(false);
  useEffect(() => {
    setPlan("");
    setSelected("");
    setTrail([]);
    setPage("plans");
  }, [teamId]);
  useEffect(() => {
    if (
      user &&
      teams.length &&
      new URLSearchParams(location.search).get("invite")
    )
      setInvite(true);
  }, [user, teams.length]);
  const go = (p, id = "") => {
    setPage(p);
    setPlan(id);
    setMobile(false);
    setQuery("");
    setTrail([]);
  };
  if (!ready) return <div className="loading">Öppnar Samplanering…</div>;
  if (!user) return <Auth />;
  if (!teams.length) return <Welcome />;
  if (!state)
    return (
      <div className="loading">
        {online ? "Öppnar teamet…" : "Kunde inte ansluta."}
        <Button onClick={() => act(app.reload)}>Försök igen</Button>
      </div>
    );
  const plan = get(planId),
    selection = get(selected),
    plans = all("plan"),
    cards = all("card").filter(
      (c) => get(c.parent_id) && !get(c.parent_id).body.archived,
    );
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Hoppa till innehåll
      </a>
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="brand">
          <span className="brand-symbol">
            <PanelTop size={22} />
          </span>
          Samplanering
          <IconButton
            label="Stäng meny"
            icon={X}
            onClick={() => setMobile(false)}
          />
        </div>
        <label className="team-switch">
          <span className="visually-hidden">Välj team</span>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Huvudmeny">
          <Nav
            icon={LayoutGrid}
            active={page === "plans"}
            onClick={() => go("plans")}
          >
            Planer
          </Nav>
          <Nav
            icon={CheckSquare}
            active={page === "mine"}
            onClick={() => go("mine")}
          >
            Mina uppgifter
          </Nav>
          <Nav
            icon={ChartNoAxesCombined}
            active={page === "portfolio"}
            onClick={() => go("portfolio")}
          >
            Överblick
          </Nav>
          <Nav
            icon={MessageSquare}
            active={page === "chat"}
            onClick={() => go("chat")}
          >
            Teamsamtal
          </Nav>
          <Nav
            icon={BookOpen}
            active={page === "docs"}
            onClick={() => go("docs")}
          >
            Dokument
          </Nav>
        </nav>
        <div className="side-caption">DINA PLANER</div>
        <nav aria-label="Planer">
          {plans.map((p) => (
            <button
              key={p.id}
              className={`plan-nav ${planId === p.id ? "active" : ""}`}
              onClick={() => go("plan", p.id)}
            >
              <span className={"plan-dot " + p.body.color} />
              <span>{p.body.title}</span>
            </button>
          ))}
        </nav>
        {writable && (
          <button className="subtle-add" onClick={() => setNewPlan(true)}>
            <Plus size={16} />
            Ny plan
          </button>
        )}
        <div className="sidebar-bottom">
          <Button icon={Users} onClick={() => setInvite(true)}>
            Team och delning
          </Button>
          <div className="account">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <small>
                {state.role === "owner"
                  ? "Teamägare"
                  : state.role === "viewer"
                    ? "Läsbehörighet"
                    : "Medlem"}
              </small>
            </div>
            <IconButton
              label="Logga ut"
              icon={LogOut}
              onClick={() =>
                act(async () => {
                  await api("/logout", { method: "POST" });
                  setUser(null);
                })
              }
            />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Stäng navigering"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <IconButton
            label="Öppna meny"
            icon={Menu}
            onClick={() => setMobile(true)}
          />
          <span className="workspace-location">
            {state.team.name}
            {page === "plan" && plan && (
              <>
                <span aria-hidden="true"> / </span>
                <strong>{plan.body.title}</strong>
              </>
            )}
          </span>
          <Button icon={Bell} onClick={() => setNotifications(true)}>
            Notiser
            {state.notifications.some((n) => !n.read)
              ? ` (${state.notifications.filter((n) => !n.read).length})`
              : ""}
          </Button>
          {!online && (
            <span className="connection" role="status">
              Återansluter… Dina utkast finns kvar.
            </span>
          )}
        </header>
        <main id="main" tabIndex={-1}>
          {page === "plans" && (
            <Home
              onPlan={(id) => go("plan", id)}
              onOpen={setSelected}
              onCreate={() => setNewPlan(true)}
              onMine={() => go("mine")}
              onArchive={() => setArchive(true)}
            />
          )}
          {page === "portfolio" && (
            <Portfolio onPlan={(id) => go("plan", id)} onOpen={setSelected} />
          )}{" "}
          {page === "chat" && <Chat />}{" "}
          {page === "mine" && (
            <MyTasks
              cards={cards.filter((c) => c.body.assignees.includes(user.id))}
              onOpen={setSelected}
            />
          )}
          {page === "plan" && plan && (
            <Plan
              key={plan.id}
              plan={plan}
              onOpen={setSelected}
              onBack={() => go("plans")}
            />
          )}{" "}
          {page === "docs" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Dokument</h1>
                </div>
                {writable && (
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => setNewDoc(true)}
                  >
                    Nytt dokument
                  </Button>
                )}
              </div>
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="Sök dokument"
                  placeholder="Sök dokument…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="doc-grid">
                {all("doc")
                  .filter((d) =>
                    (
                      d.body.title +
                      " " +
                      childrenOf(d.id, "block")
                        .map((b) => JSON.stringify(b.body))
                        .join(" ")
                    )
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((d) => (
                    <button
                      className="doc-tile"
                      key={d.id}
                      onClick={() => setSelected(d.id)}
                    >
                      <BookOpen size={22} />
                      <h2>{d.body.title}</h2>
                      <span>
                        {
                          {
                            document: "Dokument",
                            wiki: "Kunskapsartikel",
                            journal: "Arbetslogg",
                          }[d.body.category]
                        }
                      </span>
                    </button>
                  ))}
              </div>
              {!all("doc").length && (
                <Empty
                  title="En plats för det ni vet"
                  text="Samla rutiner, mötesanteckningar och gemensamma arbetsdokument."
                />
              )}
            </>
          )}
        </main>
      </div>
      {newPlan && (
        <CreatePlan
          onClose={() => setNewPlan(false)}
          onCreated={(p) => go("plan", p.id)}
        />
      )}
      {newDoc && (
        <NewName
          title="Nytt dokument"
          onClose={() => setNewDoc(false)}
          onSave={async (title) => {
            const d = await create("doc", { title });
            setSelected(d.id);
          }}
        />
      )}
      {teamModal && (
        <NewName
          title="Skapa team"
          onClose={() => setTeamModal(false)}
          onSave={async (name) => {
            const t = await api("/teams", { method: "POST", body: { name } });
            await refreshTeams();
            setTeamId(t.id);
          }}
        />
      )}
      {invite && (
        <TeamModal
          onClose={() => setInvite(false)}
          onNewTeam={() => {
            setInvite(false);
            setTeamModal(true);
          }}
        />
      )}{" "}
      {notifications && (
        <Notifications
          onClose={() => setNotifications(false)}
          onOpen={(id) => {
            setTrail([]);
            if (get(id)?.kind === "message") go("chat");
            else setSelected(id);
          }}
        />
      )}{" "}
      {archive && <ArchiveView onClose={() => setArchive(false)} />}{" "}
      {selection && ["card", "doc"].includes(selection.kind) && (
        <CardPanel
          key={selection.id}
          record={selection}
          onClose={() => {
            setSelected(trail[trail.length - 1] || "");
            setTrail((t) => t.slice(0, -1));
          }}
          onOpen={(id) => {
            if (
              document.querySelector('dialog[open] [data-dirty="true"]') &&
              !confirm(
                "Det finns osparade ändringar. Vill du byta uppgift ändå?",
              )
            )
              return;
            setTrail((t) => [...t, selected]);
            setSelected(id);
          }}
        />
      )}
    </div>
  );
}
function Nav({ icon: Icon, children, active, onClick }) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <Icon size={19} />
      {children}
    </button>
  );
}
function Auth() {
  const { setUser, refreshTeams } = useApp(),
    [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-symbol">
            <PanelTop />
          </span>
          Samplanering
        </div>
        <h1>{register ? "Välkommen till teamet" : "Välkommen tillbaka"}</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const u = await api(register ? "/register" : "/login", {
                method: "POST",
                body: { email, password, ...(register ? { name } : {}) },
              });
              setUser(u);
              const token = new URLSearchParams(location.search).get("invite");
              if (token) {
                await api("/join", { method: "POST", body: { token } });
                history.replaceState(null, "", location.pathname);
              }
              await refreshTeams();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <Field label="Ditt namn">
              <input
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          <Field label="E-post">
            <input
              type="email"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label="Lösenord"
            hint={register ? "Minst 12 tecken." : undefined}
          >
            <input
              type="password"
              minLength={register ? 12 : 1}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <Button variant="primary" disabled={busy}>
            {busy ? "Vänta…" : register ? "Skapa konto" : "Logga in"}
          </Button>
        </form>
        <Button
          variant="text"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Har du redan ett konto? Logga in"
            : "Ny här? Skapa konto"}
        </Button>
      </div>
    </div>
  );
}
function Welcome() {
  const { refreshTeams, setTeamId, act, user } = useApp(),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Hej {user.name.split(" ")[0]}.</h1>
        <p>Skapa ett team eller gå med via en inbjudan.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const t = await api("/teams", { method: "POST", body: { name } });
              await refreshTeams();
              setTeamId(t.id);
            });
          }}
        >
          <Field label="Teamets namn">
            <input
              autoFocus
              required
              maxLength={100}
              placeholder="Till exempel Digitalisering"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button variant="primary">Skapa team</Button>
        </form>
        <JoinTeam />
      </div>
    </div>
  );
}
function JoinTeam() {
  const { refreshTeams, setTeamId, act } = useApp();
  const [token, setToken] = useState(
    new URLSearchParams(location.search).get("invite") || "",
  );
  return (
    <details>
      <summary>Har du fått en inbjudan?</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act(async () => {
            let t = token;
            try {
              t = new URL(token).searchParams.get("invite") || token;
            } catch {}
            const r = await api("/join", {
              method: "POST",
              body: { token: t },
            });
            await refreshTeams();
            setTeamId(r.teamId);
            history.replaceState(null, "", location.pathname);
          });
        }}
      >
        <Field label="Inbjudningslänk">
          <input
            required
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Inbjudningslänk"
            placeholder="Klistra in inbjudningslänken"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </Field>
        <Button variant="primary">Gå med i teamet</Button>
      </form>
    </details>
  );
}
function TeamModal({ onClose, onNewTeam }) {
  const { state, teamId, act, reload } = useApp();
  const [role, setRole] = useState("editor"),
    [link, setLink] = useState(""),
    [copied, setCopied] = useState(false);
  return (
    <Modal title="Team och delning" onClose={onClose}>
      <div className="member-list">
        {state.members.map((m) => (
          <div className="member" key={m.id}>
            <Avatar name={m.name} />
            <strong>{m.name}</strong>
            <span>
              {
                { owner: "Ägare", editor: "Kan redigera", viewer: "Kan läsa" }[
                  m.role
                ]
              }
            </span>
            {state.role === "owner" && m.role !== "owner" && (
              <Button
                onClick={() => {
                  if (confirm(`Ta bort ${m.name} från teamet?`))
                    act(async () => {
                      await api(`/teams/${teamId}/members/${m.id}`, {
                        method: "DELETE",
                      });
                      await reload();
                    });
                }}
              >
                Ta bort
              </Button>
            )}
          </div>
        ))}
      </div>
      {state.role === "owner" && (
        <>
          <h3>Bjud in en kollega</h3>
          <Field label="Behörighet">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="editor">Kan redigera</option>
              <option value="viewer">Kan läsa</option>
            </select>
          </Field>
          <Button
            variant="primary"
            onClick={() =>
              act(async () => {
                const r = await api(`/teams/${teamId}/invites`, {
                  method: "POST",
                  body: { role },
                });
                setLink(location.origin + "/?invite=" + r.token);
                setCopied(false);
              })
            }
          >
            Skapa inbjudningslänk
          </Button>
          {link && (
            <div className="invite-result">
              <Field label="Inbjudningslänk">
                <input
                  aria-label="Inbjudningslänk"
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                />
              </Field>
              <Button
                onClick={() =>
                  act(async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  })
                }
              >
                {copied ? "Kopierad" : "Kopiera länk"}
              </Button>
              <small>Gäller en person i sju dagar.</small>
            </div>
          )}
        </>
      )}
      <JoinTeam />
      <div className="panel-footer">
        <Button icon={Plus} onClick={onNewTeam}>
          Skapa nytt team
        </Button>
      </div>
    </Modal>
  );
}
export function TaskList({ cards, onOpen }) {
  const { get, state, patch, act, writable } = useApp();
  if (!cards.length)
    return <p className="quiet-empty">Inga uppgifter här just nu.</p>;
  return (
    <div className="task-list">
      {cards.map((c) => (
        <div className="task-row" key={c.id}>
          <input
            type="checkbox"
            aria-label={"Markera " + c.body.title + " som klar"}
            checked={c.body.done}
            disabled={!writable}
            onChange={(e) => act(() => patch(c, { done: e.target.checked }))}
          />
          <button onClick={() => onOpen(c.id)}>
            <strong className={c.body.done ? "done" : ""}>
              {c.body.title}
            </strong>
            <small>{get(c.parent_id)?.body.title}</small>
          </button>
          <span
            className={
              c.body.due && c.body.due < today() && !c.body.done
                ? "overdue"
                : ""
            }
          >
            {c.body.due && c.body.due < today() && !c.body.done
              ? "Försenad · "
              : ""}
            {dueLabel(c.body.due)}
          </span>
          <div className="avatars">
            {c.body.assignees.map((id) => (
              <Avatar
                key={id}
                name={state.members.find((m) => m.id === id)?.name}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
export function TaskCard({ card: c, onOpen }) {
  const { state, childrenOf, writable } = useApp();
  const checks = childrenOf(c.id, "block").flatMap((b) => b.body.checked || []),
    comments = childrenOf(c.id, "comment");
  return (
    <button
      className={`task-card ${c.body.done ? "completed" : ""}`}
      draggable={writable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
      onClick={() => onOpen(c.id)}
    >
      <div className="card-title">
        {c.body.done ? <Check size={17} /> : <span className="empty-check" />}
        <h3>{c.body.title}</h3>
      </div>
      {c.body.tags.length > 0 && (
        <div className="tags">
          {c.body.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="card-meta">
        {c.body.due && (
          <span
            className={
              c.body.due && c.body.due < today() && !c.body.done
                ? "overdue"
                : ""
            }
          >
            <CalendarDays size={14} />
            {dueLabel(c.body.due)}
          </span>
        )}
        {checks.length > 0 && (
          <span>
            <CheckSquare size={14} />
            {checks.filter((x) => x.done).length}/{checks.length}
          </span>
        )}
        {comments.length > 0 && (
          <span>
            <MessageSquare size={14} />
            {comments.length}
          </span>
        )}
        <span className="avatars">
          {c.body.assignees.slice(0, 3).map((id) => (
            <Avatar
              key={id}
              name={state.members.find((m) => m.id === id)?.name}
            />
          ))}
        </span>
      </div>
    </button>
  );
}
export function CardPanel({ record: r, onClose, onOpen }) {
  const { state, childrenOf, get, patch, act, writable } = useApp();
  const isCard = r.kind === "card";
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(
    () => window.matchMedia("(min-width: 900px)").matches,
  );
  const parent = get(r.parent_id),
    bucket = get(r.body.bucketId);
  return (
    <Modal
      title={isCard ? "Uppgift" : "Dokument"}
      heading={isCard ? parent?.body.title : "Gemensamt dokument"}
      sheet
      wide
      className="task-workspace"
      onClose={onClose}
    >
      <div className="card-panel">
        <div className="task-heading">
          <DraftText
            className="detail-title"
            multiline
            rows={1}
            maxLength={200}
            label="Titel"
            value={r.body.title}
            version={r.version}
            disabled={!writable}
            onSave={(v, version) => patch(r, { title: v }, version)}
          />
          <div className="task-context">
            {isCard && (
              <>
                <span className={`task-status ${r.body.done ? "is-done" : ""}`}>
                  {r.body.done ? "Klar" : bucket?.body.title || "Öppen"}
                </span>
                <span>
                  {r.body.due
                    ? `Klart ${dueLabel(r.body.due).toLowerCase()}`
                    : "Inget slutdatum"}
                </span>
              </>
            )}
            <span>
              {writable
                ? childrenOf(r.id, "block").length
                  ? "Text sparas automatiskt"
                  : ""
                : "Du har läsbehörighet"}
            </span>
          </div>
        </div>
        <div className="task-layout">
          <aside
            className="task-details task-controls"
            aria-label={isCard ? "Om uppgiften" : "Om dokumentet"}
          >
            {isCard && (
              <>
                <div className="completion-card">
                  {writable && (
                    <Button
                      icon={Check}
                      variant={r.body.done ? "" : "primary"}
                      onClick={() =>
                        act(() => patch(r, { done: !r.body.done }))
                      }
                    >
                      {r.body.done ? "Öppna igen" : "Markera som klar"}
                    </Button>
                  )}
                </div>
                <details
                  className="disclosure assignment-details"
                  open={detailsOpen}
                  onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
                >
                  <summary>
                    Ansvariga och datum
                    <ChevronDown size={16} aria-hidden="true" />
                  </summary>
                  <div>
                    <Field label="Kolumn">
                      <select
                        disabled={!writable}
                        value={r.body.bucketId}
                        onChange={(e) => {
                          const b = get(e.target.value);
                          act(() =>
                            patch(r, { bucketId: b.id, done: b.body.done }),
                          );
                        }}
                      >
                        {childrenOf(r.parent_id, "bucket").map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.body.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <fieldset className="assignees">
                      <legend>Ansvariga</legend>
                      {state.members.map((m) => (
                        <label key={m.id}>
                          <input
                            type="checkbox"
                            disabled={!writable}
                            checked={r.body.assignees.includes(m.id)}
                            onChange={(e) =>
                              act(() =>
                                patch(r, {
                                  assignees: e.target.checked
                                    ? [...r.body.assignees, m.id]
                                    : r.body.assignees.filter(
                                        (id) => id !== m.id,
                                      ),
                                }),
                              )
                            }
                          />
                          <Avatar name={m.name} />
                          {m.name}
                        </label>
                      ))}
                    </fieldset>
                    <Field label="Startdatum" width="date">
                      <input
                        type="date"
                        max={r.body.due || undefined}
                        disabled={!writable}
                        value={r.body.start}
                        onChange={(e) =>
                          act(() => patch(r, { start: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Slutdatum" width="date">
                      <input
                        type="date"
                        disabled={!writable}
                        min={r.body.start || undefined}
                        value={r.body.due}
                        onChange={(e) =>
                          act(() => patch(r, { due: e.target.value }))
                        }
                      />
                    </Field>
                  </div>
                </details>
              </>
            )}
            {!isCard && (
              <Field label="Sorts dokument">
                <select
                  disabled={!writable}
                  value={r.body.category}
                  onChange={(e) =>
                    act(() => patch(r, { category: e.target.value }))
                  }
                >
                  <option value="document">Dokument</option>
                  <option value="wiki">Kunskapsartikel</option>
                  <option value="journal">Arbetslogg</option>
                </select>
              </Field>
            )}
          </aside>
          <div className="task-main">
            <Document record={r} />
            <Comments record={r} />
            {isCard && (
              <Disclosure title="Deluppgifter, kopplingar och tid">
                <CardAdvanced record={r} onOpen={onOpen} />
              </Disclosure>
            )}
          </div>
          <aside
            className="task-details task-extra"
            aria-label="Fler uppgiftsinställningar"
          >
            {isCard && (
              <>
                {parent?.body.fields.some((f) => !f.hidden) && (
                  <Disclosure title="Planens egna fält" open>
                    <CustomFields record={r} />
                  </Disclosure>
                )}
              </>
            )}
            <div className="task-secondary">
              <Button icon={History} onClick={() => setHistoryOpen(true)}>
                Ändringshistorik
              </Button>
              {writable && (
                <Disclosure title="Fler alternativ">
                  <Button
                    icon={Archive}
                    onClick={() =>
                      act(async () => {
                        await patch(r, { archived: true });
                        onClose();
                      })
                    }
                  >
                    Arkivera {isCard ? "uppgift" : "dokument"}
                  </Button>
                </Disclosure>
              )}
            </div>
          </aside>
        </div>
        {historyOpen && (
          <HistoryView record={r} onClose={() => setHistoryOpen(false)} />
        )}
      </div>
    </Modal>
  );
}
