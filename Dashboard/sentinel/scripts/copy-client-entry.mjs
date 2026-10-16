import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve("index.html");
const destination = resolve("dist/client/index.html");

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
