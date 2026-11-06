"use client";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Users,
  ScanLine,
  Settings,
  Wallet,
  LogOut,
  Coffee,
  Gift,
  ArrowUpRight,
  Plus,
  Download,
  Search,
  Ticket,
  CheckCircle2,
  Link as LinkIcon,
  Copy,
  Activity,
} from "lucide-react";
import {
  api,
  Badge,
  Brand,
  DateText,
  Empty,
  Notice,
  QR,
  Stamps,
} from "@/components/ui";
import Scanner from "@/components/scanner";
import type { Business, Customer, Me, StaffData, Reward } from "@/lib/types";
type Tab = "overview" | "customers" | "cashier" | "program" | "wallet";
const nav = [
  ["overview", "Resumen", BarChart3],
  ["customers", "Clientes", Users],
  ["cashier", "Caja y escáner", ScanLine],
  ["program", "Mi programa", Settings],
  ["wallet", "Wallet", Wallet],
] as const;
const initial = {
  name: "",
  slug: "",
  logo: "",
  color: "#194d3b",
  program: "Tu pausa tiene recompensa",
  goal: 8,
  reward: "Un café de la casa · demostración",
  terms: "Un sello por compra elegible. Recompensa ficticia de demostración.",
  privacy: "Demostración. No ingreses datos personales reales.",
  status: "draft",
  provider: "web",
  template_id: "",
} as Business;
export default function Dashboard() {
  const [resetOpen, setResetOpen] = useState(false),
    [resetConfirm, setResetConfirm] = useState("");
  const [me, setMe] = useState<Me | null>(null),
    [data, setData] = useState<StaffData | null>(null),
    [bid, setBid] = useState(""),
    [tab, setTab] = useState<Tab>("overview"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Customer | null>(null),
    [scanning, setScanning] = useState(false),
    [confirm, setConfirm] = useState<{
      kind: "stamp" | "redeem" | "reverse";
      key: string;
      reward?: string;
      reverse?: string;
    } | null>(null),
    [reason, setReason] = useState(""),
    [draft, setDraft] = useState<Business>(initial),
    [newBusiness, setNewBusiness] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [qrOpen, setQrOpen] = useState(false);
  const isAdmin =
    !!me &&
    (me.platform ||
      me.memberships.some((m) => m.business_id === bid && m.role === "admin"));
  async function load(id = bid) {
    const [m, d] = await Promise.all([
      api<Me>("me"),
      id ? api<StaffData>("business/" + id) : Promise.resolve(null),
    ]);
    setMe(m);
    if (d) {
      setData(d);
      setDraft(d.business);
      setSelected((s) =>
        s ? d.customers.find((c) => c.id === s.id) || null : null,
      );
    } else if (!id && m.businesses.length) setBid(m.businesses[0].id);
  }
  useEffect(() => {
    api<Me>("me")
      .then((m) => {
        setMe(m);
        setBid(m.businesses[0]?.id || "");
        if (m.memberships.every((x) => x.role === "cashier")) setTab("cashier");
      })
      .catch((e) => {
        if (e.message === "Sesión requerida") location.href = "/login";
        else setError(e.message);
      });
  }, []);
  useEffect(() => {
    if (bid) {
      setError("");
      setSelected(null);
      setScanning(false);
      setQuery("");
      api<StaffData>("business/" + bid)
        .then((d) => {
          setData(d);
          setDraft(d.business);
        })
        .catch((e) => setError(e.message));
    }
  }, [bid]);
  const b = data?.business;
  const dateAllowed = (date: string) => {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(date));
    return (!from || day >= from) && (!to || day <= to);
  };
  const movements =
    data?.movements.filter((m) => dateAllowed(m.created_at)) || [];
  const customerName = (id: string) =>
    data?.customers.find((c) => c.id === id)?.name || "Cliente";
  const matches = (data?.customers || []).filter((c) =>
    (c.name + " " + c.email + " " + c.phone)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const registrationUrl =
    typeof location === "undefined"
      ? ""
      : location.origin + "/registro/" + b?.slug;
  function chooseTab(t: Tab) {
    setTab(t);
    setError("");
    setMessage("");
    setConfirm(null);
    setNewBusiness(false);
  }
  async function mutate() {
    if (!selected || !confirm || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api("operation", {
        business: bid,
        scan: selected.scan_token,
        ...confirm,
        reason,
      });
      setMessage(
        r.replayed
          ? "La operación ya estaba registrada."
          : confirm.kind === "stamp"
            ? "Sello agregado. ¡Gracias por volver!"
            : confirm.kind === "redeem"
              ? "Recompensa canjeada."
              : "Corrección registrada en el historial.",
      );
      setConfirm(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const rewardList =
    data?.rewards.filter(
      (r) => r.customer_id === selected?.id && r.state === "available",
    ) || [];
  const emit = (
    kind: "stamp" | "redeem" | "reverse",
    reward?: string,
    reverse?: string,
  ) => {
    setReason("");
    setConfirm({ kind, key: crypto.randomUUID(), reward, reverse });
  };
  if (!me && !error)
    return <div className="skeleton">Preparando tu espacio…</div>;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div className="mobile-brand">
          <Brand />
          <Badge />
        </div>
        <div className="workspace">
          <div className="avatar">
            <Coffee size={20} />
          </div>
          <div>
            <strong className="small">{b?.name || "Mi negocio"}</strong>
            <p className="muted" style={{ fontSize: 10, margin: 0 }}>
              Programa de lealtad
            </p>
          </div>
        </div>
        <div className="eyebrow">Tu espacio</div>
        <nav>
          {nav
            .filter(([t]) => isAdmin || t === "cashier")
            .map(([t, label, Icon]) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => chooseTab(t)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
        </nav>
        <div className="side-bottom">
          <div className="info-box">
            <p style={{ margin: 0, fontWeight: 600 }}>
              Pequeños detalles.
              <br />
              Grandes conexiones.
            </p>
            <span className="muted" style={{ fontSize: 11 }}>
              Haz que quieran volver.
            </span>
          </div>
          <button
            className="ghost"
            style={{ marginTop: 15 }}
            onClick={async () => {
              await api("logout", {});
              location.href = "/login";
            }}
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            Tu negocio <span style={{ padding: "0 10px" }}>/</span>{" "}
            <strong style={{ color: "#344a3b" }}>
              {nav.find((n) => n[0] === tab)?.[1]}
            </strong>
          </span>
          <div className="topbar-right">
            <Badge />
            <span>
              {me?.platform ? "Plataforma" : isAdmin ? "Administrador" : "Caja"}
            </span>
            <div className="avatar">
              {me?.platform ? "P" : isAdmin ? "A" : "C"}
            </div>
          </div>
        </header>
        <div className="content">
          {me && me.businesses.length > 1 && (
            <label style={{ maxWidth: 300, marginBottom: 20 }}>
              Negocio
              <select value={bid} onChange={(e) => setBid(e.target.value)}>
                {me.businesses.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          {!b && !newBusiness && (
            <div className="panel">
              <h1>Tu comunidad empieza aquí</h1>
              <p>Configura tu primer negocio para comenzar.</p>
              {me?.platform && (
                <button
                  onClick={() => {
                    setDraft(initial);
                    setNewBusiness(true);
                    setTab("program");
                  }}
                >
                  Crear negocio
                </button>
              )}
            </div>
          )}
          {me?.platform && me.metrics && tab === "overview" && (
            <div className="panel">
              <p className="eyebrow">Visión de plataforma</p>
              <p style={{ margin: 0 }}>
                <strong>{me.metrics.businesses}</strong> negocios ·{" "}
                <strong>{me.metrics.active}</strong> activos ·{" "}
                <strong>{me.metrics.customers}</strong> clientes ·{" "}
                <strong>{me.metrics.stamps}</strong> sellos registrados
              </p>
            </div>
          )}
          {b && tab === "overview" && (
            <>
              <div className="page-head">
                <div>
                  <p className="eyebrow" style={{ marginBottom: 8 }}>
                    Cada visita, una conexión
                  </p>
                  <h1>Así va tu comunidad</h1>
                  <p className="muted">
                    Un vistazo a los pequeños momentos que hacen crecer {b.name}
                    .
                  </p>
                </div>
                <div className="actions">
                  <button className="secondary" onClick={() => setQrOpen(true)}>
                    <LinkIcon size={16} />
                    Compartir programa
                  </button>
                  <button onClick={() => chooseTab("cashier")}>
                    <Plus size={17} /> Agregar sello
                  </button>
                </div>
              </div>
              <DateFilters
                from={from}
                to={to}
                setFrom={setFrom}
                setTo={setTo}
              />
              <div className="stats">
                <Stat
                  label="Clientes registrados"
                  value={
                    data!.customers.filter((c) => dateAllowed(c.created_at))
                      .length
                  }
                  icon={<Users size={18} />}
                  note="Personas que forman parte"
                />
                <Stat
                  label="Sellos entregados"
                  value={movements.filter((m) => m.kind === "stamp").length}
                  icon={<Ticket size={18} />}
                  note="Compras elegibles confirmadas"
                />
                <Stat
                  label="Recompensas emitidas"
                  value={
                    data!.rewards.filter(
                      (r) =>
                        dateAllowed(r.created_at) && r.state !== "reversed",
                    ).length
                  }
                  icon={<Gift size={18} />}
                  note="Momentos para celebrar"
                />
                <Stat
                  label="Recompensas canjeadas"
                  value={movements.filter((m) => m.kind === "redeem").length}
                  icon={<CheckCircle2 size={18} />}
                  note="Canjes registrados en caja"
                />
              </div>
              <div className="columns">
                <div>
                  <div className="welcome-card">
                    <p className="eyebrow">Hecho para volver</p>
                    <h2>
                      Un buen café se disfruta.
                      <br />
                      Una buena experiencia se repite.
                    </h2>
                    <p>
                      Comparte tu programa y convierte la próxima visita en el
                      comienzo de algo bueno.
                    </p>
                    <a href={"/registro/" + b.slug} target="_blank">
                      Ver página de registro ↗
                    </a>
                  </div>
                  <div className="panel">
                    <div className="panel-head">
                      <h2>Actividad reciente</h2>
                      <span className="tag">
                        {movements.length} movimientos
                      </span>
                    </div>
                    {movements.slice(0, 6).map((m) => (
                      <div className="activity" key={m.id}>
                        <div className="avatar">
                          {m.kind === "stamp" ? (
                            <Coffee size={17} />
                          ) : (
                            <Gift size={17} />
                          )}
                        </div>
                        <div className="details">
                          <p>
                            <b>{customerName(m.customer_id)}</b> ·{" "}
                            {m.kind === "stamp"
                              ? "recibió un sello"
                              : m.kind === "redeem"
                                ? "canjeó una recompensa"
                                : "corrección registrada"}
                          </p>
                          <small>
                            <DateText value={m.created_at} />
                          </small>
                        </div>
                        <span className="tag">
                          {m.kind === "stamp"
                            ? "+1 sello"
                            : m.kind === "redeem"
                              ? "Canje"
                              : "Corrección"}
                        </span>
                      </div>
                    ))}
                    {!movements.length && (
                      <Empty text="Las próximas visitas aparecerán aquí." />
                    )}
                  </div>
                </div>
                <div>
                  <div className="panel">
                    <div className="panel-head">
                      <h2>Tu programa</h2>
                      <span
                        className={
                          "tag " + (b.status === "active" ? "" : "pending")
                        }
                      >
                        {b.status === "active"
                          ? "Activo"
                          : b.status === "draft"
                            ? "Borrador"
                            : "Suspendido"}
                      </span>
                    </div>
                    <div
                      className="card-preview"
                      style={{ background: b.color }}
                    >
                      <div className="card-brand">
                        <Coffee size={24} />
                        {b.name}
                      </div>
                      <h3>{b.program}</h3>
                      <p>{b.reward}</p>
                      <Stamps count={0} goal={b.goal} />
                      <div className="card-bottom">
                        <span>Un sello por visita elegible</span>
                        <span>{b.goal} sellos</span>
                      </div>
                    </div>
                    <p
                      className="small muted"
                      style={{ margin: "18px 0 12px" }}
                    >
                      Vista previa · No emite una tarjeta de Wallet.
                    </p>
                    <button
                      className="secondary"
                      style={{ width: "100%" }}
                      onClick={() => chooseTab("program")}
                    >
                      Ver mi programa <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="panel">
                    <h2>Relaciones que crecen</h2>
                    <div className="health">
                      <div>
                        <span>Con segunda compra</span>
                        <strong>
                          {
                            data!.customers.filter(
                              (c) =>
                                data!.movements.filter(
                                  (m) =>
                                    m.customer_id === c.id &&
                                    m.kind === "stamp" &&
                                    !data!.movements.some(
                                      (r) => r.reverses === m.id,
                                    ),
                                ).length >= 2,
                            ).length
                          }
                        </strong>
                      </div>
                      <div>
                        <span>Activos en últimos 30 días</span>
                        <strong>
                          {
                            new Set(
                              data!.movements
                                .filter(
                                  (m) =>
                                    new Date(m.created_at).getTime() >
                                    Date.now() - 30 * 86400000,
                                )
                                .map((m) => m.customer_id),
                            ).size
                          }
                        </strong>
                      </div>
                      <div>
                        <span>Tarjetas Wallet emitidas</span>
                        <strong>
                          {
                            new Set(
                              data!.wallet
                                .filter((w) => w.distribution_url)
                                .map((w) => w.customer_id),
                            ).size
                          }
                        </strong>
                      </div>
                    </div>
                    <p className="muted small" style={{ marginTop: 14 }}>
                      Una tarjeta emitida no implica que esté instalada.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
          {b && tab === "customers" && (
            <>
              <div className="page-head">
                <div>
                  <h1>Tu comunidad</h1>
                  <p className="muted">
                    Conoce a quienes hacen de tu negocio su lugar favorito.
                  </p>
                </div>
                {isAdmin && (
                  <a className="button secondary" href={"/api/export/" + bid}>
                    <Download size={16} />
                    Exportar CSV
                  </a>
                )}
              </div>
              <div className="searchbar">
                <input
                  aria-label="Buscar cliente"
                  placeholder="Buscar por nombre, correo o teléfono"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Search
                  size={19}
                  style={{ alignSelf: "center", color: "#7b827b" }}
                />
              </div>
              <div className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Progreso actual</th>
                      <th>Recompensas</th>
                      <th>Registro</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((c) => (
                      <tr
                        key={c.id}
                        className="row-link"
                        onClick={() => {
                          setSelected(c);
                          setTab("cashier");
                        }}
                      >
                        <td>
                          <strong>{c.name}</strong>
                          <small>{c.email}</small>
                        </td>
                        <td>
                          {c.stamps} de {c.cycle_goal} sellos
                          <div
                            className="progress-bar"
                            style={{ marginTop: 8, maxWidth: 110 }}
                          >
                            <div
                              style={{
                                width: (100 * c.stamps) / c.cycle_goal + "%",
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          {
                            data!.rewards.filter(
                              (r) =>
                                r.customer_id === c.id &&
                                r.state === "available",
                            ).length
                          }{" "}
                          disponibles
                        </td>
                        <td>
                          <DateText value={c.created_at} />
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => {
                              setSelected(c);
                              setTab("cashier");
                            }}
                          >
                            Ver ficha →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!matches.length && (
                  <Empty text="No encontramos clientes con esos datos." />
                )}
              </div>
            </>
          )}
          {b && tab === "cashier" && (
            <>
              <div className="page-head">
                <div>
                  <h1>Cada visita cuenta</h1>
                  <p className="muted">
                    Escanea, confirma la compra y regala un motivo para volver.
                  </p>
                </div>
                {selected && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setSelected(null);
                      setQuery("");
                      setMessage("");
                      setScanning(true);
                    }}
                  >
                    <ScanLine size={17} /> Siguiente cliente
                  </button>
                )}
              </div>
              <div className="cash-grid">
                <div className="panel">
                  <div className="panel-head">
                    <h2>Encuentra una tarjeta</h2>
                    <ScanLine size={19} />
                  </div>
                  {!scanning ? (
                    <button
                      style={{ width: "100%", marginBottom: 22 }}
                      onClick={() => {
                        setScanning(true);
                        setError("");
                      }}
                    >
                      <ScanLine size={19} />
                      Abrir cámara
                    </button>
                  ) : (
                    <Scanner
                      onScan={(text) => {
                        setScanning(false);
                        const token = text.startsWith("sello:")
                          ? text.slice(6)
                          : text;
                        const c = data!.customers.find(
                          (c) => c.scan_token === token,
                        );
                        if (!c) {
                          setError(
                            "QR inválido o perteneciente a otro negocio.",
                          );
                          return;
                        }
                        setSelected(c);
                        setMessage("");
                        setError("");
                      }}
                    />
                  )}
                  {scanning && (
                    <button
                      className="ghost"
                      onClick={() => setScanning(false)}
                    >
                      Cerrar cámara
                    </button>
                  )}
                  <p className="small muted">
                    También puedes buscar por correo o teléfono.
                  </p>
                  <input
                    aria-label="Buscar cliente en caja"
                    placeholder="Correo o teléfono del cliente"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div className="stack" style={{ marginTop: 15, gap: 9 }}>
                    {query &&
                      matches.slice(0, 8).map((c) => (
                        <button
                          className="customer-hit"
                          key={c.id}
                          onClick={() => {
                            setSelected(c);
                            setMessage("");
                            setError("");
                          }}
                        >
                          <span>
                            {c.name}
                            <small
                              style={{ display: "block", fontWeight: 400 }}
                            >
                              {c.email}
                            </small>
                          </span>
                          <span>
                            {c.stamps}/{c.cycle_goal}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
                <div>
                  {selected ? (
                    <>
                      <div className="panel">
                        <div className="panel-head">
                          <div>
                            <p className="eyebrow">Tarjeta del cliente</p>
                            <h2>{selected.name}</h2>
                            <span className="muted small">
                              {selected.email}
                            </span>
                          </div>
                          <div className="avatar">
                            <Coffee size={23} />
                          </div>
                        </div>
                        <div
                          className="card-preview"
                          style={{ background: b.color }}
                        >
                          <p>{selected.cycle_reward}</p>
                          <Stamps
                            count={selected.stamps}
                            goal={selected.cycle_goal}
                          />
                          <div className="card-bottom">
                            <span>Progreso de este ciclo</span>
                            <strong>
                              {selected.stamps}/{selected.cycle_goal}
                            </strong>
                          </div>
                        </div>
                        <button
                          style={{ width: "100%", marginTop: 20 }}
                          disabled={busy || b.status !== "active"}
                          onClick={() => emit("stamp")}
                        >
                          <Plus size={19} />
                          Confirmar compra y agregar sello
                        </button>
                        <p className="small muted" style={{ marginTop: 12 }}>
                          Confirma que hubo una compra elegible. No se procesa
                          ningún pago.
                        </p>
                        {rewardList.map((r) => (
                          <div className="reward-item" key={r.id}>
                            <h3>{r.description}</h3>
                            <p>{r.terms}</p>
                            <button
                              className="secondary"
                              style={{ marginTop: 12 }}
                              onClick={() => emit("redeem", r.id)}
                            >
                              <Gift size={16} />
                              Canjear recompensa
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="panel">
                        <h2>Historial</h2>
                        {data!.movements
                          .filter((m) => m.customer_id === selected.id)
                          .map((m) => (
                            <div key={m.id} className="activity">
                              <div className="details">
                                <p>
                                  {m.kind === "stamp"
                                    ? "Sello agregado"
                                    : m.kind === "redeem"
                                      ? "Recompensa canjeada"
                                      : "Corrección: " + m.reason}
                                </p>
                                <small>
                                  <DateText value={m.created_at} /> ·{" "}
                                  {data!.employees.find(
                                    (e) => e.user_id === m.employee_id,
                                  )?.email || "Empleado"}
                                </small>
                              </div>
                              {isAdmin &&
                                m.kind !== "reverse" &&
                                !data!.movements.some(
                                  (r) => r.reverses === m.id,
                                ) && (
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      emit("reverse", undefined, m.id)
                                    }
                                  >
                                    Corregir
                                  </button>
                                )}
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="panel">
                      <Empty text="Escanea una tarjeta o busca un cliente para comenzar." />
                      <p className="info-box">
                        El escaneo solo consulta la tarjeta. Los sellos y canjes
                        siempre necesitan tu confirmación.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {(b || newBusiness) && tab === "program" && isAdmin && (
            <>
              <div className="page-head">
                <div>
                  <h1>
                    {newBusiness
                      ? "Un nuevo negocio"
                      : "La esencia de tu programa"}
                  </h1>
                  <p className="muted">
                    Una experiencia que se siente tan tuya como tu negocio.
                  </p>
                </div>
                {me?.platform && !newBusiness && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setDraft(initial);
                      setNewBusiness(true);
                    }}
                  >
                    Crear otro negocio
                  </button>
                )}
              </div>
              <form
                className="panel form-grid"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    const id = await api<string>("save-business", {
                      ...draft,
                      id: newBusiness ? null : bid,
                    });
                    setNewBusiness(false);
                    setBid(id);
                    await load(id);
                    setMessage(
                      "Programa guardado. Las nuevas metas aplican al siguiente ciclo.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {(
                  [
                    ["name", "Nombre comercial"],
                    ["slug", "Identificador de registro"],
                    ["program", "Nombre del programa"],
                    ["reward", "Recompensa"],
                    ["logo", "URL del logo (HTTPS)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      value={draft[key] || ""}
                      disabled={key === "slug" && !newBusiness}
                      required={key !== "logo"}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  Color de marca
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) =>
                      setDraft({ ...draft, color: e.target.value })
                    }
                  />
                </label>
                <label>
                  Meta de sellos
                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={draft.goal}
                    onChange={(e) =>
                      setDraft({ ...draft, goal: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Estado
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        status: e.target.value as Business["status"],
                      })
                    }
                  >
                    <option value="draft">Borrador</option>
                    <option value="active">Activo</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                </label>
                <label className="wide">
                  Condiciones de compra y canje
                  <textarea
                    required
                    minLength={10}
                    value={draft.terms}
                    onChange={(e) =>
                      setDraft({ ...draft, terms: e.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  Aviso de privacidad o enlace
                  <textarea
                    required
                    minLength={10}
                    value={draft.privacy}
                    onChange={(e) =>
                      setDraft({ ...draft, privacy: e.target.value })
                    }
                  />
                </label>
                <div className="wide info-box">
                  Los ciclos iniciados conservan su meta y recompensa. Los
                  cambios aplican a nuevos ciclos; las recompensas emitidas
                  conservan sus condiciones.
                </div>
                <div className="actions wide">
                  <button disabled={busy}>
                    {busy ? "Guardando…" : "Guardar programa"}
                  </button>
                  {newBusiness && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setNewBusiness(false);
                        if (b) setDraft(b);
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
              {!newBusiness && b && (
                <div className="columns">
                  <div className="panel">
                    <h2>Un QR, muchas próximas visitas</h2>
                    <p className="muted small">
                      La misma URL funciona para tu etiqueta NFC. La etiqueta
                      solo abre el registro.
                    </p>
                    <QR value={registrationUrl} download />
                    <div
                      className="info-box"
                      style={{ marginTop: 18, overflowWrap: "anywhere" }}
                    >
                      {registrationUrl}
                    </div>
                    <button
                      className="text-button"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(registrationUrl)
                          .then(() => setMessage("URL copiada."))
                          .catch(() => setError("Copia la URL manualmente."))
                      }
                    >
                      <Copy size={15} />
                      Copiar URL para NFC
                    </button>
                  </div>
                  <div className="panel">
                    <h2>Tu equipo</h2>
                    {data!.employees.map((e) => (
                      <div className="activity" key={e.user_id}>
                        <div className="details">
                          <p>{e.email}</p>
                          <small>
                            {e.role === "admin" ? "Administrador" : "Cajero"}
                          </small>
                        </div>
                      </div>
                    ))}
                    <form
                      className="stack"
                      style={{ marginTop: 20 }}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setBusy(true);
                        const f = new FormData(e.currentTarget);
                        try {
                          await api("invite", {
                            business: bid,
                            email: f.get("email"),
                            role: f.get("role"),
                          });
                          await load();
                          setMessage("Invitación enviada.");
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <label>
                        Invitar por correo
                        <input type="email" name="email" required />
                      </label>
                      <label>
                        Rol
                        <select name="role">
                          <option value="cashier">Cajero</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </label>
                      <button className="secondary" disabled={busy}>
                        Enviar invitación
                      </button>
                    </form>
                    <p className="small muted" style={{ marginTop: 12 }}>
                      Las invitaciones requieren Supabase y correo configurados.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
          {b && tab === "wallet" && isAdmin && (
            <>
              <div className="page-head">
                <div>
                  <h1>Tu programa, en su bolsillo</h1>
                  <p className="muted">
                    Una tarjeta web lista para usar. Wallet se activa cuando
                    esté configurado.
                  </p>
                </div>
              </div>
              <Notice>
                Integración real pendiente: no se han emitido pases ni consumido
                créditos. La documentación oficial de Pass Studio aún debe
                verificarse.
              </Notice>
              <div className="stats">
                <Stat
                  label="Wallet emitidas"
                  value={data!.wallet.filter((w) => w.distribution_url).length}
                  icon={<Wallet size={18} />}
                  note="Instalación no verificada"
                />
                <Stat
                  label="Sincronizaciones pendientes"
                  value={
                    data!.wallet.filter((w) => w.status !== "synced").length
                  }
                  icon={<Activity size={18} />}
                  note="El saldo web se conserva"
                />
                <Stat
                  label="Operaciones externas"
                  value={data!.operations.length}
                  icon={<LinkIcon size={18} />}
                  note="Registro local"
                />
                <Stat
                  label="Unidades locales"
                  value={data!.operations
                    .filter((o) => o.status === "succeeded")
                    .reduce((s, o) => s + o.estimated_units, 0)}
                  icon={<Ticket size={18} />}
                  note="1 por operación; no son créditos"
                />
              </div>
              <div className="columns">
                <div className="panel">
                  <h2>Proveedor del negocio</h2>
                  <p className="small muted">
                    Cambiar el proveedor solo afecta nuevas emisiones. Las
                    tarjetas anteriores conservan su proveedor original.
                  </p>
                  <form
                    className="stack"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      try {
                        await api("save-business", draft);
                        await load();
                        setMessage(
                          "Preferencias guardadas. La emisión real sigue pendiente de activación.",
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Proveedor
                      <select
                        disabled={!me?.platform}
                        value={draft.provider}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            provider: e.target.value as Business["provider"],
                          })
                        }
                      >
                        <option value="web">Tarjeta web</option>
                        <option value="pass_studio">
                          Pass Studio · pendiente de integración
                        </option>
                      </select>
                    </label>
                    <label>
                      Identificador de plantilla externa
                      <input
                        disabled={!me?.platform}
                        value={draft.template_id || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, template_id: e.target.value })
                        }
                      />
                    </label>
                    {me?.platform && (
                      <button disabled={busy}>Guardar configuración</button>
                    )}
                  </form>
                </div>
                <div className="panel">
                  <h2>Antes de activar Wallet</h2>
                  <button
                    className="secondary"
                    style={{ marginBottom: 20 }}
                    onClick={async () => {
                      try {
                        await api("retry-wallet", { business: bid });
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Reintentar sincronización
                  </button>
                  <div className="health">
                    <div>
                      <span>Tarjeta web</span>
                      <span className="tag">Disponible</span>
                    </div>
                    <div>
                      <span>Contrato API oficial</span>
                      <span className="tag pending">Por verificar</span>
                    </div>
                    <div>
                      <span>Credenciales del servidor</span>
                      <span className="tag pending">Por configurar</span>
                    </div>
                    <div>
                      <span>Apple / Google directos</span>
                      <span className="tag pending">No disponibles</span>
                    </div>
                  </div>
                  <p className="small muted" style={{ marginTop: 18 }}>
                    Límites externos definidos en el servidor. No se realizan
                    emisiones al cargar páginas, escanear o crear datos de
                    ejemplo.
                  </p>
                </div>
              </div>
            </>
          )}
          {isAdmin &&
            bid === "10000000-0000-4000-8000-000000000001" &&
            tab === "program" && (
              <button className="ghost" onClick={() => setResetOpen(true)}>
                Reiniciar clientes de ejemplo
              </button>
            )}
          <div className="footer-note">
            sello. · Hecho para conectar · America/Mexico_City · Datos de
            demostración
          </div>
        </div>
      </main>
      {resetOpen && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true">
            <h2>Reiniciar datos de ejemplo</h2>
            <p>
              Se reemplazarán solo Mariana, Diego y Ana y sus movimientos
              ficticios. Los demás clientes se conservan. Si alguno tiene
              tarjeta externa, el reinicio se bloquea. Solo disponible en modo
              local.
            </p>
            <label>
              Escribe REINICIAR
              <input
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
              />
            </label>
            <div className="actions" style={{ marginTop: 20 }}>
              <button
                className="danger"
                disabled={busy || resetConfirm !== "REINICIAR"}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("reset-demo", { confirm: resetConfirm });
                    setResetOpen(false);
                    setResetConfirm("");
                    await load();
                    setMessage("Clientes de ejemplo reiniciados.");
                  } catch (e) {
                    setError((e as Error).message);
                    setResetOpen(false);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Reiniciar
              </button>
              <button className="secondary" onClick={() => setResetOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {qrOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Invita a tu comunidad</h2>
            <p className="muted">Escanea y crea tu tarjeta en {b?.name}.</p>
            <QR value={registrationUrl} download />
            <p
              className="small"
              style={{ overflowWrap: "anywhere", marginTop: 20 }}
            >
              {registrationUrl}
            </p>
            <button
              className="secondary"
              style={{ width: "100%" }}
              onClick={() => setQrOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation"
          >
            <h2 id="confirmation">
              {confirm.kind === "stamp"
                ? "¿Compra elegible confirmada?"
                : confirm.kind === "redeem"
                  ? "¿Canjear esta recompensa?"
                  : "Corregir un movimiento"}
            </h2>
            <p className="muted">
              {confirm.kind === "stamp"
                ? `Agregaremos un sello a la tarjeta de ${selected?.name}.`
                : confirm.kind === "redeem"
                  ? "Entrega la recompensa al cliente. El canje solo puede realizarse una vez."
                  : "La corrección quedará registrada. Revierte primero los movimientos posteriores."}
            </p>
            {confirm.kind === "reverse" && (
              <label>
                Motivo obligatorio
                <textarea
                  minLength={5}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <div className="actions" style={{ marginTop: 20 }}>
              <button
                disabled={
                  busy ||
                  (confirm.kind === "reverse" && reason.trim().length < 5)
                }
                onClick={mutate}
              >
                {busy ? "Registrando…" : "Confirmar"}
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Cancelar
              </button>
            </div>
            {error && (
              <p
                role="alert"
                className="notice error"
                style={{ marginTop: 15 }}
              >
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  note: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value.toLocaleString("es-MX")}</strong>
      <small>{note}</small>
    </div>
  );
}
function DateFilters({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <div className="filter">
      <label>
        Desde
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        Hasta
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      {(from || to) && (
        <button
          className="ghost"
          onClick={() => {
            setFrom("");
            setTo("");
          }}
        >
          Ver todo
        </button>
      )}
    </div>
  );
}
