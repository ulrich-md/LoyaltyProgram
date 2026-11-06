import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PassStudioWalletProvider,
  WebWalletProvider,
  WalletError,
  providerForCard,
  retryPolicy,
  futureProviders,
} from "../lib/wallet";
test("Pass Studio fails closed without a verified transport", async () => {
  await assert.rejects(
    new PassStudioWalletProvider().issue({} as never, "k"),
    /pendientes/,
  );
});
test("old cards keep their original provider", () => {
  const old = new WebWalletProvider("https://example.test");
  assert.equal(
    providerForCard("web", [new PassStudioWalletProvider(), old]),
    old,
  );
  assert.throws(() => providerForCard("apple_direct", [old]));
  assert.equal(futureProviders.apple_direct.available, false);
});
test("credit and uncertain errors never retry automatically; temporary retries are bounded", () => {
  for (const category of ["credits", "uncertain", "configuration"] as const)
    assert.equal(
      retryPolicy(new WalletError("error", category), 1).status,
      "blocked",
    );
  assert.equal(
    retryPolicy(new WalletError("error", "temporary"), 1).status,
    "pending",
  );
  assert.equal(
    retryPolicy(new WalletError("error", "temporary"), 4).status,
    "blocked",
  );
});
