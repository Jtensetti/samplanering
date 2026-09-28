import React, { useState } from "react";
import {
  Plus,
  ArrowRight,
  Archive,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { useApp, today } from "./store";
import { Button, Empty, Tabs } from "./ui";
import { TaskList } from "./App";

const dueOrder = (a, b) =>
  (a.body.due || "9999").localeCompare(b.body.due || "9999");
export function dueLabel(date) {
  if (!date) return "Utan slutdatum";
  if (date === today()) return "Idag";
  return new Date(date + "T12:00:00").toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: date.slice(0, 4) !== today().slice(0, 4) ? "numeric" : undefined,
  });
}
export function Home({ onPlan, onOpen, onCreate, onMine, onArchive }) {
  const { all, user, writable, get } = useApp();
  const plans = all("plan"),
    cards = all("card").filter((c) => !get(c.parent_id)?.body.archived);
  const upcoming = cards
    .filter((c) => !c.body.done && c.body.assignees.includes(user.id))
    .sort(dueOrder);
  return (
    <div className="home-page">
      <div className="page-heading">
        <div>
          <h1>Planer</h1>
        </div>
        {writable && plans.length > 0 && (
          <Button variant="primary" icon={Plus} onClick={onCreate}>
            Skapa plan
          </Button>
        )}
      </div>
      {plans.length > 0 && (
        <section className="up-next" aria-labelledby="up-next-title">
          <div className="section-header">
            <h2 id="up-next-title">På tur för dig</h2>
            <Button icon={ArrowRight} onClick={onMine}>
              Mina uppgifter
            </Button>
          </div>
          {upcoming.length ? (
            <TaskList cards={upcoming.slice(0, 4)} onOpen={onOpen} />
          ) : (
            <p className="up-next-empty">
              <CheckCircle2 size={19} />
              Inga tilldelade uppgifter just nu.
            </p>
          )}
        </section>
      )}
      {!plans.length ? (
        <Empty
          title="Vad vill ni göra tillsammans?"
          text="Börja med en plan och er första uppgift."
        >
          {writable && (
            <Button variant="primary" icon={Plus} onClick={onCreate}>
              Skapa er första plan
            </Button>
          )}
        </Empty>
      ) : (
        <>
          <div className="section-header">
            <h2>Alla planer</h2>
            <Button icon={Archive} onClick={onArchive}>
              Arkiv
            </Button>
          </div>
          <div className="plan-grid">
            {plans.map((p) => {
              const items = cards.filter((c) => c.parent_id === p.id),
                done = items.filter((c) => c.body.done).length;
              const next = items
                .filter((c) => !c.body.done && c.body.due)
                .sort(dueOrder)[0];
              return (
                <button
                  key={p.id}
                  className={`plan-tile ${p.body.color}`}
                  onClick={() => onPlan(p.id)}
                >
                  <div className="plan-tile-cover">
                    <h2>{p.body.title}</h2>
                    <span>
                      {p.body.description || `${items.length} uppgifter`}
                    </span>
                  </div>
                  <div className="plan-tile-body">
                    <div className="plan-next">
                      <CalendarDays size={16} />
                      <span>
                        {next
                          ? `${dueLabel(next.body.due)} · ${next.body.title}`
                          : "Inga slutdatum"}
                      </span>
                    </div>
                    <div className="plan-progress">
                      <progress
                        aria-label={`Framsteg för ${p.body.title}`}
                        max={items.length || 1}
                        value={done}
                      />
                      <span>
                        {done} av {items.length} klara
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
export function MyTasks({ cards, onOpen }) {
  const [filter, setFilter] = useState("open");
  const open = cards.filter((c) => !c.body.done).sort(dueOrder);
  const late = open.filter((c) => c.body.due && c.body.due < today());
  const done = cards.filter((c) => c.body.done).sort(dueOrder);
  const visible = filter === "late" ? late : filter === "done" ? done : open;
  const groups =
    filter === "open"
      ? [
          ["Försenade", late],
          ["Idag", open.filter((c) => c.body.due === today())],
          ["Kommande", open.filter((c) => c.body.due > today())],
          ["Utan slutdatum", open.filter((c) => !c.body.due)],
        ]
      : [
          [
            filter === "late" ? "Försenade uppgifter" : "Avslutade uppgifter",
            visible,
          ],
        ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Mina uppgifter</h1>
        </div>
      </div>
      <Tabs
        id="my-tasks"
        label="Visa mina uppgifter"
        value={filter}
        onChange={setFilter}
        items={[
          { id: "open", label: "Att göra", count: open.length },
          { id: "late", label: "Försenade", count: late.length },
          { id: "done", label: "Klart", count: done.length },
        ]}
      />
      <section
        className="my-task-groups"
        id="my-tasks-panel"
        role="tabpanel"
        aria-labelledby={`my-tasks-${filter}-tab`}
      >
        {visible.length ? (
          groups
            .filter(([, items]) => items.length)
            .map(([title, items]) => (
              <section key={title}>
                <h2>{title}</h2>
                <TaskList cards={items} onOpen={onOpen} />
              </section>
            ))
        ) : (
          <Empty
            title={
              filter === "late"
                ? "Inga försenade uppgifter"
                : filter === "done"
                  ? "Inga avslutade uppgifter ännu"
                  : "Du är ikapp"
            }
            text={
              filter === "open"
                ? "När du tilldelas en uppgift dyker den upp här."
                : undefined
            }
          />
        )}
      </section>
    </>
  );
}
