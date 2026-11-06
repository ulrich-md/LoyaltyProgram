import type postgres from "postgres";
import {
  WalletError,
  providerForCard,
  retryPolicy,
  type WalletProvider,
  type WalletState,
} from "./wallet";
/** One global advisory lock serializes external usage and state writes. No real provider is enabled yet.
 * Keep the lock across the external request. An uncertain timeout blocks for reconciliation, not blind reissue.
 */
export async function processOne(
  sql: ReturnType<typeof postgres>,
  providers: WalletProvider[],
  limits: { issue: number; update: number },
) {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(582031)`;
    const [job] =
      await tx`select j.*,c.customer_id,c.business_id,c.provider,c.external_pass_id,c.external_instance_id,c.distribution_url,c.synced_version from wallet_jobs j join wallet_cards c on c.id=j.card_id where j.status='pending' and j.run_after<=now() order by j.created_at,j.id limit 1 for update of j,c`;
    if (!job) return { processed: false };
    const [c] =
      await tx`select c.*,b.template_id from customers c join businesses b on b.id=c.business_id where c.id=${job.customer_id} for update of c`;
    if (
      Number(job.version) < Number(c.version) ||
      Number(job.version) <= Number(job.synced_version)
    ) {
      await tx`update wallet_jobs set status='superseded' where id=${job.id}`;
      await tx`insert into wallet_jobs(card_id,version,kind) values(${job.card_id},${c.version},${job.external_instance_id ? "update" : "issue"}) on conflict do nothing`;
      return { processed: true, superseded: true };
    }
    const kind = job.external_instance_id ? "update" : "issue";
    const [usage] =
      await tx`select count(*)::int as n from wallet_operations where kind=${kind} and status in ('reserved','succeeded','uncertain')`;
    if (usage.n >= limits[kind]) {
      await tx`update wallet_jobs set status='blocked',error='Límite local de demostración' where id=${job.id}`;
      await tx`update wallet_cards set status='pending',last_error='Límite local de demostración' where id=${job.card_id}`;
      return { processed: true, limited: true };
    }
    const [count] =
      await tx`select count(*)::int as n from rewards where customer_id=${c.id} and state='available'`;
    const state: WalletState = {
      customerId: c.id,
      version: Number(c.version),
      name: c.name,
      stamps: c.stamps,
      goal: c.cycle_goal,
      reward: c.cycle_reward,
      availableRewards: count.n,
      scanToken: c.scan_token,
      templateId: c.template_id,
    };
    const provider = providerForCard(job.provider, providers);
    await tx`insert into wallet_operations(job_id,business_id,kind,status) values(${job.id},${job.business_id},${kind},'reserved') on conflict(job_id) do update set status='reserved'`;
    try {
      let pass = {
        passId: job.external_pass_id,
        instanceId: job.external_instance_id,
        distributionUrl: job.distribution_url,
      };
      if (kind === "issue") pass = await provider.issue(state, job.id);
      else await provider.update(pass, state, job.id);
      await tx`update wallet_cards set external_pass_id=${pass.passId},external_instance_id=${pass.instanceId},distribution_url=${pass.distributionUrl},status='synced',synced_version=${c.version},synced_at=now(),attempts=attempts+1,last_error=null where id=${job.card_id}`;
      await tx`update wallet_jobs set status='done',attempts=attempts+1,error=null where id=${job.id}`;
      await tx`update wallet_operations set status='succeeded' where job_id=${job.id}`;
      return { processed: true, ok: true };
    } catch (e) {
      const err =
        e instanceof WalletError
          ? e
          : new WalletError(
              "Resultado externo incierto: requiere conciliación",
              "uncertain",
            );
      const policy = retryPolicy(err, job.attempts + 1);
      await tx`update wallet_jobs set status=${policy.status},attempts=attempts+1,error=${err.message},run_after=now()+${policy.delaySeconds}*interval '1 second' where id=${job.id}`;
      await tx`update wallet_cards set status='pending',last_error=${err.message},attempts=attempts+1 where id=${job.card_id}`;
      await tx`update wallet_operations set status=${err.category === "uncertain" ? "uncertain" : "failed"} where job_id=${job.id}`;
      return { processed: true, error: err.category };
    }
  });
}
