import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
export async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body && !options.raw
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
    body:
      options.body && !options.raw
        ? JSON.stringify(options.body)
        : options.body,
  });
  const data = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(data.error || "Anropet misslyckades."), {
      status: res.status,
    });
  return data;
}
const Context = createContext(null);
export const useApp = () => useContext(Context);
export const order = (a, b) => (a.body.order || 0) - (b.body.order || 0);
export const today = () => new Date().toLocaleDateString("sv-SE");
export function Provider({ children }) {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [teams, setTeams] = useState([]),
    [teamId, setTeamId] = useState(localStorage.getItem("sam-team") || ""),
    [state, setState] = useState(null),
    [notice, setNotice] = useState(null),
    [online, setOnline] = useState(true);
  const seq = useRef(0);
  const refreshTeams = useCallback(async () => {
    const t = await api("/teams");
    setTeams(t);
    setTeamId((v) => (t.some((x) => x.id === v) ? v : t[0]?.id || ""));
    return t;
  }, []);
  useEffect(() => {
    api("/me")
      .then((u) => {
        setUser(u);
        return refreshTeams();
      })
      .catch((e) => {
        if (e.status !== 401) setNotice({ text: e.message, error: true });
      })
      .finally(() => setReady(true));
  }, [refreshTeams]);
  const reload = useCallback(async () => {
    if (!teamId) return;
    const n = ++seq.current;
    try {
      const next = await api("/state?team=" + teamId);
      if (n === seq.current) {
        setState(next);
        setOnline(true);
      }
    } catch (e) {
      setOnline(false);
      if (e.status === 401) {
        setUser(null);
        setState(null);
      }
      if (e.status === 403) {
        setState(null);
        await refreshTeams();
      }
      throw e;
    }
  }, [teamId, refreshTeams]);
  useEffect(() => {
    setState(null);
    if (teamId && user) {
      localStorage.setItem("sam-team", teamId);
      reload().catch(() => {});
    }
  }, [teamId, user, reload]);
  useEffect(() => {
    if (!teamId || !user) return;
    const s = new EventSource("/api/events?team=" + teamId);
    let timer;
    const change = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reload().catch(() => {}), 80);
    };
    s.addEventListener("ready", () => {
      setOnline(true);
      change();
    });
    s.addEventListener("change", change);
    s.onerror = () => setOnline(false);
    const poll = setInterval(change, 20000);
    return () => {
      s.close();
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [teamId, user, reload]);
  const act = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      setNotice({ text: e.message, error: true });
      return null;
    }
  };
  const create = async (kind, body, parentId = null) => {
    const r = await api("/records", {
      method: "POST",
      body: { teamId, kind, parentId, body },
    });
    await reload();
    return r;
  };
  const patch = async (r, body, version = r.version) => {
    try {
      const n = await api("/records/" + r.id, {
        method: "PATCH",
        headers: { "If-Match": String(version) },
        body,
      });
      await reload();
      return n;
    } catch (e) {
      if (e.status === 409) await reload();
      throw e;
    }
  };
  const remove = async (r) => {
    const n = await api("/records/" + r.id, {
      method: "DELETE",
      headers: { "If-Match": String(r.version) },
    });
    await reload();
    setNotice({
      text: "Borttaget",
      undo: async () => {
        await api("/records/" + r.id + "/restore", {
          method: "POST",
          headers: { "If-Match": String(n.version) },
        });
        await reload();
        setNotice(null);
      },
    });
  };
  const records = state?.records || [],
    all = (kind) =>
      records.filter((r) => r.kind === kind && !r.body.archived).sort(order),
    childrenOf = (id, kind) => all(kind).filter((r) => r.parent_id === id),
    get = (id) => records.find((r) => r.id === id),
    writable = state?.role !== "viewer";
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        ready,
        teams,
        teamId,
        setTeamId,
        state,
        records,
        all,
        get,
        childrenOf,
        create,
        patch,
        remove,
        act,
        reload,
        refreshTeams,
        notice,
        setNotice,
        online,
        writable,
      }}
    >
      {children}
    </Context.Provider>
  );
}
