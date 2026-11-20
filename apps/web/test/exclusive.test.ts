import { test } from "node:test";
import assert from "node:assert/strict";
import { activeId, claim, release } from "../src/shared/exclusive";

test("aynı anda yalnızca bir kaynak: yeni claim öncekini durdurur", () => {
  const log: string[] = [];
  claim("a", () => log.push("a-stop"));
  claim("b", () => log.push("b-stop"));
  assert.deepEqual(log, ["a-stop"]); assert.equal(activeId(), "b");
  claim("b", () => log.push("b-stop")); // kendini durdurmaz
  assert.deepEqual(log, ["a-stop"]);
  release("a"); assert.equal(activeId(), "b"); // başkasının kaydını silmez
  release("b"); assert.equal(activeId(), null);
});

test("durdurma hatası yeni oynatıcıyı engellemez", () => {
  claim("x", () => { throw new Error("patladı"); });
  claim("y", () => {}); assert.equal(activeId(), "y"); release("y");
});
