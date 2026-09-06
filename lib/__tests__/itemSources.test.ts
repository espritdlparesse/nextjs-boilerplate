import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLegacySource } from "../itemSources.ts";

test("обе записи одного источника сводятся к одной", () => {
  assert.equal(normalizeLegacySource("spotify"), normalizeLegacySource("import_spotify"));
  assert.equal(normalizeLegacySource("letterboxd"), normalizeLegacySource("import_letterboxd"));
});

test("яндекс не падает в manual: на этом расходились три копии", () => {
  assert.equal(normalizeLegacySource("yandex_music"), "import_yandex_music");
});

test("незнакомый источник становится manual", () => {
  assert.equal(normalizeLegacySource("tiktok"), "manual");
  assert.equal(normalizeLegacySource(null), "manual");
});
