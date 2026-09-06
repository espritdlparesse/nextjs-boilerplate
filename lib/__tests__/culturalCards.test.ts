import { test } from "node:test";
import assert from "node:assert/strict";
import { cardFlaws, isUsableCard } from "../culturalCards.ts";

const card = (context_note: string, roast_angles: string[] = ["опора"]) => ({ context_note, roast_angles });

test("годная карточка проходит", () => {
  assert.ok(isUsableCard(card(
    "Российский рэпер, для которого прорывом стал «Dragonborn»: тяжелый бас, трэп, игровые отсылки."
  )));
});

test("пустая похвала не проходит", () => {
  assert.deepEqual(
    cardFlaws(card("Американский рэпер, известный своими провокационными высказываниями.")),
    ["empty_praise"]
  );
});

test("новостной повод не проходит", () => {
  assert.deepEqual(
    cardFlaws(card("В 2017 году Мария Степанова выпустила книгу «Памяти памяти».")),
    ["news_item"]
  );
});

test("карточка без опор не проходит", () => {
  assert.deepEqual(cardFlaws(card("Режиссерка «Трудностей перевода».", [])), ["no_angles"]);
});
