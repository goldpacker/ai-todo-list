import { run } from "./program";

run(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
