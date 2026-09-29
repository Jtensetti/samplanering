export class Router {
  routes = [];
  add(method, path, fn) {
    const names = [];
    const pattern = path.replace(/:([a-z]+)/g, (_, name) => {
      names.push(name);
      return "([^/]+)";
    });
    this.routes.push({
      method,
      pattern: new RegExp(`^${pattern}$`),
      names,
      fn,
    });
  }
  get(path, fn) {
    this.add("GET", path, fn);
  }
  post(path, fn) {
    this.add("POST", path, fn);
  }
  patch(path, fn) {
    this.add("PATCH", path, fn);
  }
  delete(path, fn) {
    this.add("DELETE", path, fn);
  }
  handle({ method, path, body = {}, user, headers = {} }) {
    const url = new URL(path, "https://internal.invalid");
    for (const route of this.routes) {
      const match =
        route.method === method && url.pathname.match(route.pattern);
      if (!match) continue;
      let status = 200,
        data;
      const req = {
        method,
        body,
        user,
        query: Object.fromEntries(url.searchParams),
        params: Object.fromEntries(
          route.names.map((name, i) => [
            name,
            decodeURIComponent(match[i + 1]),
          ]),
        ),
        get: (name) => headers[name.toLowerCase()],
      };
      const res = {
        status(code) {
          status = code;
          return this;
        },
        json(value) {
          data = value;
        },
      };
      const result = route.fn(req, res);
      if (result?.then)
        throw new Error("Workspace transactions must stay synchronous");
      return { status, data };
    }
    return { status: 404, data: { error: "Adressen finns inte." } };
  }
}
