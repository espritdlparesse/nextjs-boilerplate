import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImportedFile } from "../fileImports.ts";

const titles = (csv: string) => parseImportedFile("letterboxd", csv).map((item) => item.title);

test("перенос строки внутри кавычек остается одним фильмом", () => {
  assert.deepEqual(titles('Name,Year\n"Хороший, плохой,\nзлой",1966\nМатрица,1999'), [
    "хороший, плохой, злой (1966)",
    "матрица (1999)",
  ]);
});

test("точка с запятой читается как разделитель", () => {
  assert.deepEqual(titles("Name;Year\nМатрица;1999"), ["матрица (1999)"]);
});

test("BOM не приклеивается к первому заголовку", () => {
  assert.deepEqual(titles("\uFEFFName,Year\nМатрица,1999"), ["матрица (1999)"]);
});

test("экранированная кавычка сохраняется", () => {
  assert.deepEqual(titles('Name,Year\n"Фильм ""в кавычках""",2001'), ['фильм "в кавычках" (2001)']);
});
