import { createApp } from "./app.mjs";
const instance = createApp();
const server = instance.app.listen(
  Number(process.env.PORT || 3000),
  "0.0.0.0",
  () => console.log(`Samplanering körs på port ${process.env.PORT || 3000}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    instance.close();
    server.close(() => {
      process.exit(0);
    });
  });
