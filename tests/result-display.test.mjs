import assert from "node:assert/strict";
import test from "node:test";
import { getGameName, getResultGameName } from "../js/result-display.js";

test("shows the public Grammar Shooter name instead of its technical id", () => {
  assert.equal(getGameName("grammar-shooter", "grammar-shooter"), "Grammar Shooter");
});

test("shows a Grammar Shooter mission topic when it is present", () => {
  assert.equal(
    getResultGameName({ gameId: "grammar-shooter", topic: "TO BE" }),
    "Grammar Shooter · TO BE"
  );
});

test("keeps old results without topic compatible", () => {
  assert.equal(
    getResultGameName({ gameId: "grammar-shooter" }),
    "Grammar Shooter"
  );
});

test("keeps registered names for other games", () => {
  const gameNames = new Map([["forest-trails", "Forest Trails"]]);
  assert.equal(
    getResultGameName({ gameId: "forest-trails" }, gameNames),
    "Forest Trails"
  );
});
