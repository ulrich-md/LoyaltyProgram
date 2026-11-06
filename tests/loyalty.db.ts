import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import {
  PassStudioWalletProvider,
  WalletError,
  type WalletState,
} from "../lib/wallet";
import { processOne } from "../lib/worker";
const sql = postgres(
  process.env.TEST_DATABASE_URL ||
    "postgres://loyalty:local-demo-only@127.0.0.1:54322/loyalty",
  { max: 12 },
);
const admin = randomUUID(),
  cashier = randomUUID(),
  b1 = randomUUID(),
  b2 = randomUUID(),
  slug = "test-" + randomUUID();
const call = (user: string | null, name: string, args: unknown[] = []) =>
  sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${user || ""},true)`;
    const [r] = await tx.unsafe(
      `select ${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
      args as never[],
    );
    return r.result;
  });
test("PostgreSQL transactional loyalty and persistent Wallet jobs", async (t) => {
  let scan: string, token: string, cid: string, reward: string;
  try {
    await sql`insert into businesses(id,name,slug,program,goal,reward,terms,privacy,status) values(${b1},'Test',${slug},'Café',2,'Café original','Condiciones originales','Aviso de privacidad','active'),(${b2},'Otro',${slug + "-other"},'Otro',8,'Otro','Condiciones','Privacidad','active')`;
    await sql`insert into memberships(user_id,business_id,role,email) values(${admin},${b1},'admin','test-admin@example.test'),(${cashier},${b1},'cashier','test-cashier@example.test')`;
    const c = await call(null, "register_customer", [
      slug,
      "Test Cliente",
      "unique@example.test",
      "",
      false,
      true,
    ]);
    token = c.token;
    const d = await call(null, "read_card", [token]);
    scan = d.customer.scan_token;
    cid = d.customer.id;
    await t.test(
      "registration is isolated and does not disclose an existing card",
      async () => {
        assert.deepEqual(
          await call(null, "register_customer", [
            slug,
            "Otro nombre",
            "unique@example.test",
            "",
            true,
            true,
          ]),
          { existing: true },
        );
        const other = await call(null, "register_customer", [
          slug + "-other",
          "Otro Cliente",
          "unique@example.test",
          "",
          false,
          true,
        ]);
        assert.notEqual(other.token, token);
      },
    );
    await t.test(
      "tenant separation and cashier restrictions enforced in SQL",
      async () => {
        await assert.rejects(
          call(cashier, "staff_data", [b2]),
          /Acceso denegado/,
        );
        await assert.rejects(
          call(cashier, "save_business", [
            JSON.stringify({ name: "Hacked" }),
            b1,
          ]),
          /Acceso denegado/,
        );
        await assert.rejects(
          call(null, "record_operation", [b1, scan, "stamp", randomUUID()]),
          /Acceso denegado/,
        );
      },
    );
    await t.test("concurrent retries give exactly one stamp", async () => {
      const key = randomUUID();
      await Promise.all(
        Array.from({ length: 8 }, () =>
          call(cashier, "record_operation", [b1, scan, "stamp", key]),
        ),
      );
      const [row] = await sql`select stamps from customers where id=${cid}`;
      assert.equal(row.stamps, 1);
      const [count] =
        await sql`select count(*)::int as n from movements where customer_id=${cid}`;
      assert.equal(count.n, 1);
    });
    await t.test(
      "one reward exactly and new cycles pick up updated rules",
      async () => {
        await sql`update businesses set goal=3,reward='Nueva recompensa' where id=${b1}`;
        const key = randomUUID();
        await Promise.all(
          Array.from({ length: 5 }, () =>
            call(cashier, "record_operation", [b1, scan, "stamp", key]),
          ),
        );
        const [c] = await sql`select * from customers where id=${cid}`;
        assert.equal(c.stamps, 0);
        assert.equal(c.cycle_goal, 3);
        const rows = await sql`select * from rewards where customer_id=${cid}`;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].description, "Café original");
        reward = rows[0].id;
      },
    );
    await t.test("concurrent redemptions cannot double-spend", async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          call(cashier, "record_operation", [
            b1,
            scan,
            "redeem",
            randomUUID(),
            reward,
          ]),
        ),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const [r] =
        await sql`select count(*)::int as n from movements where customer_id=${cid} and kind='redeem'`;
      assert.equal(r.n, 1);
    });
    await t.test(
      "cashier cannot reverse; admin reversal is append-only and reasoned",
      async () => {
        const [m] =
          await sql`select id from movements where customer_id=${cid} and kind='redeem'`;
        await assert.rejects(
          call(cashier, "record_operation", [
            b1,
            scan,
            "reverse",
            randomUUID(),
            null,
            m.id,
            "Error de caja",
          ]),
          /Requiere/,
        );
        await call(admin, "record_operation", [
          b1,
          scan,
          "reverse",
          randomUUID(),
          null,
          m.id,
          "Error de caja",
        ]);
        const [r] = await sql`select state from rewards where id=${reward}`;
        assert.equal(r.state, "available");
        const [count] =
          await sql`select count(*)::int as n from movements where id=${m.id}`;
        assert.equal(count.n, 1);
      },
    );
    await sql`update businesses set provider='pass_studio',template_id='mock-template' where id=${b1}`;
    await t.test(
      "issuance request is idempotent under concurrency",
      async () => {
        await Promise.all(
          Array.from({ length: 6 }, () =>
            call(null, "request_wallet", [token]),
          ),
        );
        const [n] =
          await sql`select count(*)::int as n from wallet_cards where customer_id=${cid}`;
        assert.equal(n.n, 1);
      },
    );
    const states: WalletState[] = [];
    let failure = false;
    const mock = new PassStudioWalletProvider({
      async issue(s, key) {
        assert.ok(key);
        states.push(s);
        if (failure) throw new WalletError("Sin créditos", "credits");
        return {
          passId: "mock-pass",
          instanceId: "mock-instance",
          distributionUrl: "https://example.test/mock-wallet",
        };
      },
      async update(p, s) {
        assert.equal(p.instanceId, "mock-instance");
        states.push(s);
        if (failure) throw new WalletError("Sin créditos", "credits");
      },
    });
    await t.test(
      "local budget prevents external calls without losing web balances",
      async () => {
        const r = await processOne(sql, [mock], { issue: 0, update: 0 });
        assert.equal(r.limited, true);
        assert.equal(states.length, 0);
        const web = await call(null, "read_card", [token]);
        assert.equal(web.customer.stamps, 0);
      },
    );
    await sql`update wallet_jobs set status='pending' where card_id in(select id from wallet_cards where customer_id=${cid})`;
    await t.test("out-of-order jobs coalesce to latest state", async () => {
      await call(cashier, "record_operation", [
        b1,
        scan,
        "stamp",
        randomUUID(),
      ]);
      for (let i = 0; i < 5; i++)
        await processOne(sql, [mock], { issue: 10, update: 10 });
      assert.equal(states.length, 1);
      assert.equal(states[0].stamps, 1);
      const [c] =
        await sql`select synced_version from wallet_cards where customer_id=${cid}`;
      assert.equal(Number(c.synced_version), states[0].version);
    });
    await t.test(
      "provider failure preserves confirmed operations and stops credit retries",
      async () => {
        failure = true;
        await call(cashier, "record_operation", [
          b1,
          scan,
          "stamp",
          randomUUID(),
        ]);
        const result = await processOne(sql, [mock], { issue: 10, update: 10 });
        assert.equal(result.error, "credits");
        const web = await call(null, "read_card", [token]);
        assert.equal(web.customer.stamps, 2);
        const [job] =
          await sql`select status from wallet_jobs where card_id in(select id from wallet_cards where customer_id=${cid}) order by version desc limit 1`;
        assert.equal(job.status, "blocked");
        const before = states.length;
        await processOne(sql, [mock], { issue: 10, update: 10 });
        assert.equal(states.length, before);
      },
    );
    await t.test(
      "RLS denies cross-tenant reads using a non-owner role",
      async () => {
        await sql.unsafe(
          "do $$begin if not exists(select 1 from pg_roles where rolname='loyalty_rls_test') then create role loyalty_rls_test; end if; end$$",
        );
        await sql.unsafe(
          "grant usage on schema public to loyalty_rls_test; grant select on customers,businesses to loyalty_rls_test; grant execute on function can_access(uuid,boolean),actor_id(),is_platform() to loyalty_rls_test",
        );
        await sql.begin(async (tx) => {
          await tx`select set_config('request.jwt.claim.sub',${cashier},true)`;
          await tx.unsafe("set local role loyalty_rls_test");
          const rows =
            await tx`select * from customers where business_id=${b2}`;
          assert.equal(rows.length, 0);
          const own = await tx`select * from customers where business_id=${b1}`;
          assert.equal(own.length, 1);
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`delete from customers where business_id=${b1}`;
            }),
            /permission denied/,
          );
        });
      },
    );
  } finally {
    await sql`delete from wallet_operations where business_id in (${b1},${b2})`;
    await sql`delete from wallet_jobs where card_id in(select id from wallet_cards where business_id in (${b1},${b2}))`;
    await sql`delete from wallet_cards where business_id in (${b1},${b2})`;
    await sql`update movements set reverses=null where business_id in (${b1},${b2})`;
    await sql`delete from movements where business_id in (${b1},${b2})`;
    await sql`delete from rewards where business_id in (${b1},${b2})`;
    await sql`delete from customers where business_id in (${b1},${b2})`;
    await sql`delete from memberships where business_id in (${b1},${b2})`;
    await sql`delete from businesses where id in (${b1},${b2})`;
    await sql.end();
  }
});
