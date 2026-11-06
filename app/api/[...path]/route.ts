import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  appUrl,
  db,
  hash,
  local,
  rateLimit,
  requireActor,
  rpc,
  service,
  supabase,
} from "@/lib/server";
import { business, operation, registration, uuid } from "@/lib/validation";
import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const runtime = "nodejs";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function safeError(e: unknown) {
  const m = e instanceof Error ? e.message : "Error inesperado";
  return /Sesión requerida/.test(m)
    ? m
    : /Demasiados intentos|Acceso denegado|Programa|QR inválido|Recompensa|Requiere|Revierte|Movimiento|Clave reutilizada|Wallet aún|Datos inválidos|Tarjeta inválida/.test(
          m,
        )
      ? m
      : e instanceof z.ZodError
        ? "Revisa los datos del formulario"
        : "No se pudo completar la operación. Revisa la configuración o inténtalo de nuevo.";
}
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const p = (await params).path;
    const u = req.nextUrl;
    if (p[0] === "program")
      return json(await rpc("public_program", { p_slug: p[1] }));
    if (p[0] === "card")
      return json(await rpc("read_card", { p_token: uuid.parse(p[1]) }));
    const user = await requireActor();
    if (p[0] === "me") {
      const me = await rpc("my_businesses", {}, user);
      if (me.platform) me.metrics = await rpc("platform_metrics", {}, user);
      return json(me);
    }
    if (p[0] === "business")
      return json(
        await rpc("staff_data", { p_business: uuid.parse(p[1]) }, user),
      );
    if (p[0] === "export") {
      const b = uuid.parse(p[1]);
      const me = await rpc("my_businesses", {}, user);
      if (
        !me.platform &&
        !me.memberships.some(
          (m: { business_id: string; role: string }) =>
            m.business_id === b && m.role === "admin",
        )
      )
        return json({ error: "Acceso denegado" }, 403);
      const d = await rpc("staff_data", { p_business: b }, user);
      const escape = (x: unknown) =>
        '"' +
        String(x ?? "")
          .replace(/^[=+@\-\t\r]/, "'" + "$&")
          .replaceAll('"', '""') +
        '"';
      const rows = [
        ["Nombre", "Correo", "Teléfono", "Sellos", "Meta", "Registro"],
        ...d.customers.map((c: Record<string, unknown>) => [
          c.name,
          c.email,
          c.phone,
          c.stamps,
          c.cycle_goal,
          c.created_at,
        ]),
      ];
      return new NextResponse(
        "\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="clientes.csv"',
            "Cache-Control": "no-store",
          },
        },
      );
    }
    if (p[0] === "recovery-cards") {
      if (local()) return json([]);
      const s = await supabase();
      const {
        data: { user: u },
      } = await s.auth.getUser();
      if (!u?.email_confirmed_at)
        return json({ error: "Verifica tu correo" }, 403);
      const { data, error } = await service()
        .from("customers")
        .select("access_token,businesses(name)")
        .eq("email", u.email!.toLowerCase());
      if (error) throw error;
      return json(data);
    }
    return json({ error: "No encontrado" }, 404);
  } catch (e) {
    return json(
      { error: safeError(e) },
      e instanceof Error && e.message === "Sesión requerida" ? 401 : 400,
    );
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    // Cookie-authenticated mutations are same-origin, including login and registration.
    if (req.headers.get("origin") !== new URL(appUrl()).origin)
      return json({ error: "Origen no permitido" }, 403);
    const p = (await params).path;
    if (Number(req.headers.get("content-length") || 0) > 24000)
      return json({ error: "Solicitud demasiado grande" }, 413);
    const text = await req.text();
    if (text.length > 24000)
      return json({ error: "Solicitud demasiado grande" }, 413);
    const body = JSON.parse(text);
    if (p[0] === "login") {
      const v = z
        .object({ email: z.email(), password: z.string().min(8).max(200) })
        .parse(body);
      await rateLimit("login:" + v.email.toLowerCase(), 12);
      if (local()) {
        const expected = process.env.DEMO_LOGIN_PASSWORD || "";
        const a = Buffer.from(hash(v.password)),
          b = Buffer.from(hash(expected));
        if (!expected || !timingSafeEqual(a, b))
          return json({ error: "Acceso incorrecto" }, 401);
        const [m] =
          await db()`select user_id from memberships where email=${v.email.toLowerCase()} limit 1`;
        if (!m) return json({ error: "Acceso incorrecto" }, 401);
        const token = randomBytes(32).toString("hex");
        await db()`insert into demo_sessions(token_hash,user_id,expires_at) values(${hash(token)},${m.user_id},now()+interval '8 hours')`;
        (await cookies()).set("demo_session", token, {
          httpOnly: true,
          sameSite: "strict",
          maxAge: 28800,
          path: "/",
        });
      } else {
        const s = await supabase();
        const { error } = await s.auth.signInWithPassword(v);
        if (error)
          return json({ error: "Correo o contraseña incorrectos" }, 401);
      }
      return json({ ok: true });
    }
    if (p[0] === "logout") {
      if (local()) {
        const jar = await cookies();
        const t = jar.get("demo_session")?.value;
        if (t)
          await db()`delete from demo_sessions where token_hash=${hash(t)}`;
        jar.delete("demo_session");
      } else await (await supabase()).auth.signOut();
      return json({ ok: true });
    }
    if (p[0] === "register") {
      const v = registration.parse(body);
      await rateLimit("register:" + v.slug + ":" + v.email, 8);
      return json(
        await rpc("register_customer", {
          p_slug: v.slug,
          p_name: v.name,
          p_email: v.email,
          p_phone: v.phone,
          p_marketing: v.marketing,
          p_accept: v.accept,
        }),
      );
    }
    if (p[0] === "wallet") {
      const token = uuid.parse(body.token);
      // Fail closed before reserving a paid external emission until official API is verified.
      const card = await rpc("read_card", { p_token: token });
      if (!card) return json({ error: "Tarjeta inválida" }, 404);
      if (card.business.provider === "pass_studio")
        return json(
          {
            error:
              "Wallet está pendiente de activación por el negocio. Tu tarjeta web sigue disponible.",
          },
          503,
        );
      return json(await rpc("request_wallet", { p_token: token }));
    }
    if (p[0] === "recover") {
      if (local())
        return json(
          {
            error:
              "La recuperación por correo requiere Supabase configurado. Conserva el enlace de tu tarjeta.",
          },
          503,
        );
      const email = z.email().parse(body.email);
      await rateLimit("recover:" + email.toLowerCase(), 3);
      const s = await supabase();
      const { error } = await s.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: appUrl() + "/auth/callback" },
      });
      if (error) throw error;
      return json({ ok: true });
    }
    const user = await requireActor();
    if (p[0] === "operation") {
      const v = operation.parse(body);
      return json(
        await rpc(
          "record_operation",
          {
            p_business: v.business,
            p_scan: v.scan,
            p_kind: v.kind,
            p_key: v.key,
            p_reward: v.reward ?? null,
            p_reverse: v.reverse ?? null,
            p_reason: v.reason ?? null,
          },
          user,
        ),
      );
    }
    if (p[0] === "save-business") {
      const v = business.parse(body);
      return json(
        await rpc("save_business", { p_id: v.id ?? null, p_data: v }, user),
      );
    }

    if (p[0] === "reset-demo") {
      if (!local() || body.confirm !== "REINICIAR")
        return json({ error: "Reinicio no disponible" }, 403);
      const businessId = "10000000-0000-4000-8000-000000000001";
      const me = await rpc("my_businesses", {}, user);
      if (
        !me.platform &&
        !me.memberships.some(
          (m: { business_id: string; role: string }) =>
            m.business_id === businessId && m.role === "admin",
        )
      )
        return json({ error: "Acceso denegado" }, 403);
      await db().begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(582031)`;
        const samples =
          await tx`select id from customers where business_id=${businessId} and email in ('mariana@example.test','diego@example.test','ana@example.test') for update`;
        for (const c of samples) {
          const external =
            await tx`select id from wallet_cards where customer_id=${c.id}`;
          if (external.length)
            throw Error(
              "No se reinician clientes con tarjetas externas; conserva sus registros.",
            );
          await tx`update movements set reverses=null where customer_id=${c.id}`;
          await tx`delete from movements where customer_id=${c.id}`;
          await tx`delete from rewards where customer_id=${c.id}`;
          await tx`delete from customers where id=${c.id}`;
        }
        await tx`select set_config('request.jwt.claim.sub',${user},true)`;
        for (const [name, email, n] of [
          ["Mariana López", "mariana@example.test", 7],
          ["Diego Torres", "diego@example.test", 10],
          ["Ana García", "ana@example.test", 2],
        ] as const) {
          await tx`select register_customer('bruma',${name},${email},'',false,true)`;
          const [c] =
            await tx`select scan_token from customers where business_id=${businessId} and email=${email}`;
          for (let i = 0; i < n; i++)
            await tx`select record_operation(${businessId},${c.scan_token},'stamp',gen_random_uuid())`;
        }
      });
      return json({ ok: true });
    }
    if (p[0] === "retry-wallet") {
      const v = z.object({ business: uuid }).parse(body);
      const me = await rpc("my_businesses", {}, user);
      if (
        !me.platform &&
        !me.memberships.some(
          (m: { business_id: string; role: string }) =>
            m.business_id === v.business && m.role === "admin",
        )
      )
        return json({ error: "Acceso denegado" }, 403);
      return json(
        {
          error:
            "Reintentos externos pendientes de activar el adaptador verificado. Tus saldos web están guardados.",
        },
        503,
      );
    }
    if (p[0] === "invite") {
      const v = z
        .object({
          business: uuid,
          email: z.email(),
          role: z.enum(["admin", "cashier"]),
        })
        .parse(body);
      const me = await rpc("my_businesses", {}, user);
      if (
        !me.platform &&
        !me.memberships.some(
          (m: { business_id: string; role: string }) =>
            m.business_id === v.business && m.role === "admin",
        )
      )
        return json({ error: "Acceso denegado" }, 403);
      if (local())
        return json(
          {
            error:
              "Las invitaciones por correo requieren Supabase configurado.",
          },
          503,
        );
      const { data, error } = await service().auth.admin.inviteUserByEmail(
        v.email,
        { redirectTo: appUrl() + "/auth/callback" },
      );
      if (error) throw error;
      await rpc(
        "add_employee",
        {
          p_business: v.business,
          p_user: data.user.id,
          p_email: v.email,
          p_role: v.role,
        },
        user,
      );
      return json({ ok: true });
    }
    return json({ error: "No encontrado" }, 404);
  } catch (e) {
    return json(
      { error: safeError(e) },
      e instanceof Error && e.message === "Sesión requerida" ? 401 : 400,
    );
  }
}
