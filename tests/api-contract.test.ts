import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { API_OPERATIONS, API_SCOPES, matchOperation } from "../lib/api-catalog";
const spec = JSON.parse(
  readFileSync(new URL("../docs/openapi.json", import.meta.url), "utf8"),
);
test("OpenAPI and Postman artifacts cover every versioned operation and resolve local schema references", () => {
  const collection = JSON.parse(
    readFileSync(
      new URL("../docs/ErvisioTodo.postman_collection.json", import.meta.url),
      "utf8",
    ),
  );
  const requests = collection.item.flatMap((folder: any) => folder.item);
  assert.equal(requests.length, API_OPERATIONS.length);
  const unique = new Set();
  for (const operation of API_OPERATIONS) {
    const key = operation.method + " " + operation.path;
    assert.ok(!unique.has(key), key);
    unique.add(key);
    const documented =
      spec.paths["/api/v1" + operation.path]?.[operation.method.toLowerCase()];
    assert.ok(documented, key);
    assert.equal(documented["x-required-scope"], operation.scope);
    assert.equal(
      matchOperation(
        operation.path.replace(/\{[^}]+\}/g, "test-id"),
        operation.method,
      ).operation?.path,
      operation.path,
    );
    if (operation.scope)
      assert.ok((API_SCOPES as readonly string[]).includes(operation.scope));
    if (operation.body)
      assert.ok(documented.requestBody, `${key} payload must be documented`);
  }
  function check(value: any) {
    if (!value || typeof value !== "object") return;
    if (value.$ref) {
      const target = value.$ref
        .split("/")
        .slice(1)
        .reduce((parent: any, key: string) => parent?.[key], spec);
      assert.ok(target, `Unresolved ${value.$ref}`);
    }
    for (const next of Object.values(value)) check(next);
  }
  check(spec);
});
