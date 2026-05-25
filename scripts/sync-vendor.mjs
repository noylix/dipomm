import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();

const files = [
  ["node_modules/react/umd/react.production.min.js", "static/vendor/react.production.min.js"],
  ["node_modules/react-dom/umd/react-dom.production.min.js", "static/vendor/react-dom.production.min.js"],
  ["node_modules/bootstrap/dist/css/bootstrap.min.css", "static/vendor/bootstrap.min.css"],
  ["node_modules/lucide/dist/umd/lucide.min.js", "static/vendor/lucide.min.js"],
  [
    "node_modules/@fontsource/marmelad/files/marmelad-cyrillic-400-normal.woff2",
    "static/vendor/fonts/marmelad-cyrillic-400-normal.woff2"
  ],
  [
    "node_modules/@fontsource/marmelad/files/marmelad-latin-400-normal.woff2",
    "static/vendor/fonts/marmelad-latin-400-normal.woff2"
  ]
];

for (const [from, to] of files) {
  const source = join(root, from);
  const target = join(root, to);
  if (!existsSync(source)) {
    throw new Error(`Missing vendor source: ${from}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`${from} -> ${to}`);
}
