import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Routes, Route, Navigate, Link, Outlet,
  useNavigate, useParams, useLocation, useSearchParams,
} from "react-router-dom";
import {
  Car, Search, Menu, X, ChevronLeft, ChevronRight, Heart, MessageCircle, Phone,
  Mail, MapPin, Plus, Pencil, Trash2, Lock, LogOut, FileText, Camera,
  ClipboardList, History, Settings, Filter, ArrowUpDown, Archive, CheckCircle2,
  Wallet, TrendingUp, Gauge, Fuel, Cog, Calendar, ShieldCheck, ChevronDown,
  LayoutDashboard, Users, BadgeDollarSign, Clock, Instagram, Facebook, Globe,
  AlertCircle, Save, ArrowRight, Sparkles, Handshake, Headphones, UserCircle,
  Shield, Upload, Video
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";

/* ============================================================
   THEME
   ============================================================ */
const C = {
  bg: "#0a0a0b",
  panel: "#141416",
  panel2: "#1c1c1f",
  line: "#2a2a2e",
  text: "#f2f0ea",
  dim: "#9a9893",
  gold: "#d3a44b",
  goldLight: "#e9c877",
};

const fmtBRL = (n) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("pt-BR");
};

const uid = () => Math.random().toString(36).slice(2, 10);

const todayStr = () => new Date().toISOString().slice(0, 10);

/* ============================================================
   ROUTING HELPERS
   ============================================================ */
function slugify(s) {
  return (s || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
// URLs use the short public `codigo` (a plain incrementing number), not the internal UUID `id`.
function vehicleSlug(v) {
  return `${slugify(`${v.marca} ${v.modelo} ${v.versao}`) || "veiculo"}-${v.codigo}`;
}
function vehiclePath(v) {
  return `/estoque/${vehicleSlug(v)}`;
}
function vehicleCodigoFromSlug(slug) {
  const match = (slug || "").match(/(\d+)$/);
  return match ? match[1] : null;
}

/* ============================================================
   SEED DATA
   ============================================================ */
// "Publicado" and "Reservado" used to be separate statuses, but they duplicated `publicado`
// (the site-visibility checkbox) and "Em negociação" respectively — merged away.
const STATUS_LIST = [
  { key: "preparacao", label: "Em preparação", color: "#e0a940" },
  { key: "disponivel", label: "Disponível", color: "#4ade80" },
  { key: "negociacao", label: "Em negociação", color: "#c084fc" },
  { key: "vendido", label: "Vendido", color: "#94a3b8" },
  { key: "arquivado", label: "Arquivado", color: "#57575c" },
];
const statusInfo = (k) => STATUS_LIST.find((s) => s.key === k) || STATUS_LIST[0];
// A vehicle counts as "em estoque" once it's sold or archived it's out, permanently (still visible in Estoque/Histórico for record-keeping).
const emEstoque = (v) => v.status !== "vendido" && v.status !== "arquivado";
function selectOnFocus(e) { e.target.select(); }
// Sanitizes typed text to a plain integer. Needed because <input type="number"> has a long-standing React
// quirk: React skips re-writing the DOM value when it's numerically equivalent to what's already there, so
// a leading zero the user types (e.g. "0" + "1" -> "01") can visually stick around forever. Using
// type="text" + inputMode="numeric" with this sanitizer sidesteps that entirely.
function sanitizeInt(raw) {
  const digits = String(raw).replace(/\D/g, "");
  return digits === "" ? 0 : Number(digits);
}

const CATEGORIAS_GASTO = [
  "Documentação", "Transferência", "Despachante", "Mecânica", "Funilaria",
  "Pintura", "Pneus", "Higienização", "Estética", "Guincho", "Chave",
  "Combustível", "Financiamento assumido", "Outros",
];

const OPCIONAIS_COMUNS = [
  "Airbag", "Alarme", "Ar condicionado", "Ar quente",
  "Bancos dianteiros com aquecimento", "Banco com regulagem de altura", "Bancos em couro",
  "Computador de bordo", "Controle de tração", "Controle automático de velocidade",
  "Desembaçador traseiro", "Encosto de cabeça traseiro", "Freio ABS", "Freios ABS com EBD", "Freios ABS com BAS",
  "Retrovisores elétricos", "Retrovisor fotocrômico", "Ajuste retrovisor elétrico",
  "Rodas de liga leve", "Sensor de chuva", "Sensor de estacionamento", "Sensor de pressão dos pneus",
  "Travas elétricas", "Vidros elétricos", "Volante com regulagem de altura", "Direção com Ajuste",
  "Farol de xênônio", "Faróis Full LED", "GPS", "Tela Multimídia", "Espelhamento com Smartphone",
  "Chave Inteligente/Presencial", "Botão de Ignição/Start button", "Alarme com acionamento a distância",
  "Assistente de mudança de faixa", "Alerta de colisão", "Teto solar", "Câmera 360°", "USB", "Bluetooth",
];

const SERVICOS = [
  { key: "consignacao", label: "Consignação", desc: "Deixe seu carro conosco e venda com segurança.", icon: Handshake, cta: "Avaliar meu carro", tipo: "Quero colocar meu carro em consignação" },
  { key: "testdrive", label: "Test-Drive", desc: "Agende um test-drive e experimente o veículo dos sonhos.", icon: Car, cta: "Agendar test-drive", tipo: "Quero agendar test-drive" },
  { key: "videochamada", label: "Agendar Videochamada", desc: "Conheça nossos veículos sem sair de casa.", icon: Video, cta: "Agendar videochamada", tipo: "Quero agendar videochamada" },
];

const CAR_IMG = "https://images.unsplash.com/photo-1550355291-bbee04a92027?q=80&w=900&auto=format&fit=crop";
const SUV_IMG = "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?q=80&w=900&auto=format&fit=crop";
const HATCH_IMG = "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=900&auto=format&fit=crop";
const SED_IMG = "https://images.unsplash.com/photo-1493238792000-8113da705763?q=80&w=900&auto=format&fit=crop";
const PICK_IMG = "https://images.unsplash.com/photo-1571607388263-1044f9ea01dd?q=80&w=900&auto=format&fit=crop";

function defaultCompra() { return { valorPago: 0, dataAquisicao: todayStr(), fornecedor: "" }; }
function defaultConsignacao() { return { proprietario: "", telefone: "", valorRepasse: 0, comissao: 0, dataEntrada: todayStr(), obs: "" }; }
function defaultTroca() { return { valorConsiderado: 0, negociacaoRelacionada: "", obs: "" }; }
function defaultFinanciamento() { return { saldo: 0, banco: "", parcelas: "", valorParcela: "", obs: "" }; }
function defaultDivulgacao() { return { instagramFeed: false, instagramStories: false, facebook: false, marketplace: false, outra: false, dataPostagem: "", obs: "", link: "" }; }

function seedVehicle(over) {
  const base = {
    id: uid(),
    marca: "", modelo: "", versao: "", anoFab: 2022, anoModelo: 2022,
    km: 0, cor: "", combustivel: "Flex", cambio: "Automático", portas: 4, placa: "",
    fotos: [CAR_IMG], fotoPrincipal: 0,
    origem: "compra",
    compra: defaultCompra(),
    consignacao: defaultConsignacao(),
    troca: defaultTroca(),
    financiamentoAssumido: false,
    financiamento: defaultFinanciamento(),
    gastos: [],
    status: "preparacao",
    publicado: false,
    margemTipo: "percent",
    margemValor: 12,
    fipe: 0,
    precoAnunciado: 0,
    precoMinimo: 0,
    descricao: "",
    opcionais: [],
    anotacoes: [],
    historico: [{ id: uid(), data: todayStr(), texto: "Veículo cadastrado." }],
    divulgacao: defaultDivulgacao(),
    negociacao: null,
    venda: null,
    dataCadastro: todayStr(),
  };
  return { ...base, ...over };
}

/* ============================================================
   SUPABASE <-> APP MAPPING
   veiculos table uses snake_case columns; the app uses camelCase everywhere else.
   ============================================================ */
function vehicleFromRow(r) {
  return {
    id: r.id,
    codigo: r.codigo,
    marca: r.marca || "", modelo: r.modelo || "", versao: r.versao || "",
    anoFab: r.ano_fab, anoModelo: r.ano_modelo,
    km: r.km || 0, cor: r.cor || "", combustivel: r.combustivel || "Flex",
    cambio: r.cambio || "Automático", portas: r.portas || 4, placa: r.placa || "",
    fotos: r.fotos && r.fotos.length ? r.fotos : [CAR_IMG],
    fotoPrincipal: r.foto_principal || 0,
    origem: r.origem || "compra",
    compra: { ...defaultCompra(), ...(r.compra || {}) },
    consignacao: { ...defaultConsignacao(), ...(r.consignacao || {}) },
    troca: { ...defaultTroca(), ...(r.troca || {}) },
    financiamentoAssumido: !!r.financiamento_assumido,
    financiamento: { ...defaultFinanciamento(), ...(r.financiamento || {}) },
    gastos: r.gastos || [],
    status: r.status || "preparacao",
    publicado: !!r.publicado,
    margemTipo: r.margem_tipo || "percent",
    margemValor: Number(r.margem_valor) || 0,
    fipe: Number(r.fipe) || 0,
    precoAnunciado: Number(r.preco_anunciado) || 0,
    precoMinimo: Number(r.preco_minimo) || 0,
    descricao: r.descricao || "",
    opcionais: r.opcionais || [],
    anotacoes: r.anotacoes || [],
    historico: r.historico || [],
    divulgacao: { ...defaultDivulgacao(), ...(r.divulgacao || {}) },
    negociacao: r.negociacao || null,
    venda: r.venda || null,
    dataCadastro: r.data_cadastro || todayStr(),
  };
}
function vehicleToRow(v) {
  return {
    marca: v.marca, modelo: v.modelo, versao: v.versao,
    ano_fab: v.anoFab, ano_modelo: v.anoModelo,
    km: v.km, cor: v.cor, combustivel: v.combustivel, cambio: v.cambio, portas: v.portas, placa: v.placa,
    fotos: v.fotos, foto_principal: v.fotoPrincipal,
    origem: v.origem,
    compra: v.compra, consignacao: v.consignacao, troca: v.troca,
    financiamento_assumido: v.financiamentoAssumido, financiamento: v.financiamento,
    gastos: v.gastos,
    status: v.status, publicado: v.publicado,
    margem_tipo: v.margemTipo, margem_valor: v.margemValor,
    fipe: v.fipe, preco_anunciado: v.precoAnunciado, preco_minimo: v.precoMinimo,
    descricao: v.descricao, opcionais: v.opcionais,
    anotacoes: v.anotacoes, historico: v.historico, divulgacao: v.divulgacao,
    negociacao: v.negociacao, venda: v.venda,
    data_cadastro: v.dataCadastro,
  };
}

// Vehicle demo data now lives in Supabase (see supabase/schema.sql) instead of an in-memory seed.

// Contact/lead demo data now lives in Supabase too (see supabase/schema.sql) instead of an in-memory seed —
// real submissions from the public "Tenho interesse" form need a real table to land in.
function contactFromRow(r) {
  return {
    id: r.id, nome: r.nome || "", telefone: r.telefone || "", email: r.email || "",
    veiculoId: r.veiculo_id || "", tipo: r.tipo || "", status: r.status || "Novo",
    mensagem: r.mensagem || "", data: r.data || todayStr(),
  };
}
function contactToRow(c) {
  return {
    nome: c.nome, telefone: c.telefone, email: c.email,
    veiculo_id: c.veiculoId || null, tipo: c.tipo, status: c.status,
    mensagem: c.mensagem || "", data: c.data,
  };
}

const SEED_CONFIG = {
  nome: "UAU Veículos",
  whatsapp: "(11) 96315-3625",
  telefone: "(11) 96315-3625",
  email: "vendas@uauveiculos.com",
  endereco: "Av. das Nações Unidas, 12.345 — São Paulo, SP",
  instagram: "@uauveiculos",
  horario: "Seg a Sex: 09h–19h · Sáb: 09h–16h · Dom: Fechado",
  margemPadrao: 10,
};

/* ============================================================
   CALC HELPERS
   ============================================================ */
function valorEntrada(v) {
  if (v.origem === "compra") return v.compra.valorPago || 0;
  if (v.origem === "consignacao") return v.consignacao.comissao || 0; // apenas comissão entra como "custo" da loja
  if (v.origem === "troca") return v.troca.valorConsiderado || 0;
  return 0;
}
function totalGastos(v) {
  return (v.gastos || []).reduce((s, g) => s + (Number(g.valor) || 0), 0);
}
function custoTotal(v) {
  const financ = v.financiamentoAssumido ? Number(v.financiamento.saldo) || 0 : 0;
  return valorEntrada(v) + totalGastos(v) + financ;
}
function precoSugerido(v) {
  const c = custoTotal(v);
  if (v.margemTipo === "valor") return c + (Number(v.margemValor) || 0);
  return c * (1 + (Number(v.margemValor) || 0) / 100);
}
function margemPercentReal(v) {
  const c = custoTotal(v);
  if (!c) return 0;
  return (((v.precoAnunciado || 0) - c) / c) * 100;
}
function diasEstoque(v) {
  const d1 = new Date(v.dataCadastro);
  const d2 = v.venda ? new Date(v.venda.data) : new Date();
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}
function pushHistorico(v, texto) {
  return { ...v, historico: [...v.historico, { id: uid(), data: todayStr(), texto }] };
}

/* ============================================================
   ROOT APP
   ============================================================ */
export default function App() {
  const [vehicles, setVehicles] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [config, setConfig] = useState(SEED_CONFIG);
  const [loaded, setLoaded] = useState(false);

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const authed = !!session;

  // real Supabase auth session — drives access to /admin/*
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // vehicles live in Supabase. Logged-out visitors read from the `veiculos_publicos` view, which
  // exposes only customer-facing columns (no cost, margin, preco_minimo, internal notes, etc.) — RLS
  // alone only filters rows, not columns, so this is the actual boundary keeping that data private.
  // Refetch on auth change so logging in reveals unpublished/sold vehicles (and every column) too.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // `codigo` (not created_at) since veiculos_publicos deliberately doesn't expose created_at,
      // and codigo is monotonically increasing anyway (an identity column), so it sorts the same way.
      const { data, error } = await supabase
        .from(authed ? "veiculos" : "veiculos_publicos")
        .select("*")
        .order("codigo", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error("Erro ao carregar veículos:", error.message);
        return;
      }
      setVehicles((data || []).map(vehicleFromRow));
    })();
    return () => { cancelled = true; };
  }, [session]);

  // contacts also live in Supabase; RLS blocks anon SELECT (they're PII), so the public site just
  // gets an empty list back, and logging in as admin reveals them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("contatos").select("*").order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error("Erro ao carregar contatos:", error.message);
        return;
      }
      setContacts((data || []).map(contactFromRow));
    })();
    return () => { cancelled = true; };
  }, [session]);

  // persistence for config only (vehicles/contacts are persisted in Supabase, not this local blob)
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("uau-data", false);
        if (r && r.value) {
          const d = JSON.parse(r.value);
          if (d.config) setConfig(d.config);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        await window.storage.set("uau-data", JSON.stringify({ config }), false);
      } catch (e) {}
    }, 400);
    return () => clearTimeout(t);
  }, [config, loaded]);

  function updateVehicle(id, updater) {
    const current = vehicles.find((v) => v.id === id);
    if (!current) return;
    const next = updater(current);
    setVehicles((prev) => prev.map((v) => (v.id === id ? next : v)));
    supabase.from("veiculos").update(vehicleToRow(next)).eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao salvar veículo:", error.message);
    });
  }
  async function addVehicle(draft) {
    const { data, error } = await supabase.from("veiculos").insert(vehicleToRow(draft)).select().single();
    if (error) {
      console.error("Erro ao criar veículo:", error.message);
      return null;
    }
    const created = vehicleFromRow(data);
    setVehicles((prev) => [created, ...prev]);
    return created;
  }
  function deleteVehicle(id) {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    supabase.from("veiculos").delete().eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao excluir veículo:", error.message);
    });
  }
  async function addContact(c) {
    // No .select() here: only authenticated (admin) can read contatos rows back (they're PII), so
    // an anonymous visitor's insert would fail if it also asked PostgREST to return the new row.
    // The public form doesn't need it back anyway — the admin's own contacts list refetches on login.
    const { error } = await supabase.from("contatos").insert(contactToRow(c));
    if (error) {
      console.error("Erro ao enviar contato:", error.message);
      return false;
    }
    return true;
  }
  function updateContactStatus(id, status) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    supabase.from("contatos").update({ status }).eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao atualizar contato:", error.message);
    });
  }

  const published = vehicles.filter((v) => v.publicado && emEstoque(v));

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <DemoSwitch />
      <Routes>
        <Route path="/" element={<Navigate to="/inicio" replace />} />

        <Route element={<PublicLayout config={config} />}>
          <Route path="/inicio" element={<HomePage vehicles={published} config={config} addContact={addContact} />} />
          <Route path="/estoque" element={<EstoquePage vehicles={published} />} />
          <Route
            path="/estoque/:slug"
            element={<VehicleDetailPage vehicles={vehicles} config={config} addContact={addContact} />}
          />
        </Route>

        <Route
          path="/admin/login"
          element={
            !authReady ? null : authed ? <Navigate to="/admin" replace /> : <AdminLogin />
          }
        />
        <Route
          path="/admin/*"
          element={
            !authReady ? null : authed ? (
              <AdminPanel
                vehicles={vehicles}
                contacts={contacts}
                config={config}
                setConfig={setConfig}
                updateVehicle={updateVehicle}
                addVehicle={addVehicle}
                deleteVehicle={deleteVehicle}
                updateContactStatus={updateContactStatus}
                onLogout={() => supabase.auth.signOut()}
              />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </div>
  );
}

/* small floating switch to jump between the public site and the admin panel — for demo/review only */
function DemoSwitch() {
  const location = useLocation();
  const inAdmin = location.pathname.startsWith("/admin");
  return (
    <div style={{
      position: "fixed", bottom: 16, right: 16, zIndex: 100,
      background: C.panel, border: `1px solid ${C.line}`, borderRadius: 999,
      display: "flex", padding: 4, gap: 4, boxShadow: "0 10px 30px rgba(0,0,0,.5)",
    }}>
      <Link to="/inicio" style={pillBtn(!inAdmin)}>Site público</Link>
      <Link to="/admin" style={pillBtn(inAdmin)}>Painel admin</Link>
    </div>
  );
}
function pillBtn(active) {
  return {
    padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
    border: "none", cursor: "pointer",
    background: active ? `linear-gradient(135deg, ${C.goldLight}, ${C.gold})` : "transparent",
    color: active ? "#171208" : C.dim,
  };
}

/* ============================================================
   SHARED UI BITS
   ============================================================ */
function Logo({ size = 30 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: size, height: size, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`,
      }}>
        <Car size={size * 0.6} color="#171208" strokeWidth={2.4} />
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: size * 0.55, letterSpacing: "0.03em" }}>UAU</div>
        <div style={{ fontSize: size * 0.22, letterSpacing: "0.25em", color: C.dim }}>VEÍCULOS</div>
      </div>
    </div>
  );
}
function Badge({ children, color }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
      padding: "4px 10px", borderRadius: 999, background: color + "22", color,
      border: `1px solid ${color}55`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
      {children}
    </span>
  );
}

/* ============================================================
   PUBLIC SITE
   ============================================================ */
function PublicLayout({ config }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo?.(0, 0);
  }, [location.pathname]);

  return (
    <div>
      <PublicHeader config={config} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <Outlet />
      <PublicFooter config={config} />
    </div>
  );
}

// Takes the actual destination phone number now (not the store config) — callers decide who the
// chat is with. Using config.whatsapp for every link was a bug: the admin's "WhatsApp" button next
// to a lead in Contatos was opening a chat with the store's own number instead of the client's.
function waLink(phone, text) {
  const digits = String(phone || "").replace(/\D/g, "");
  return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`;
}

function PublicHeader({ config, menuOpen, setMenuOpen }) {
  const location = useLocation();
  const links = [
    { to: "/inicio", label: "Início", active: (p) => p === "/inicio" },
    { to: "/estoque", label: "Estoque", active: (p) => p.startsWith("/estoque") },
    { to: "/inicio", label: "Sobre", active: () => false },
    { to: "/inicio", label: "Contato", active: () => false },
  ];
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(10,10,11,.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/inicio" style={{ cursor: "pointer" }}><Logo /></Link>
        <nav style={{ display: "flex", gap: 34, alignItems: "center" }} className="uau-desktop-nav">
          {links.map((l, i) => {
            const isActive = l.active(location.pathname);
            return (
              <Link key={i} to={l.to}
                style={{ cursor: "pointer", fontSize: 14.5, color: isActive ? C.text : C.dim, position: "relative", padding: "4px 0" }}>
                {l.label}
                {isActive && <span style={{ position: "absolute", left: 0, right: 0, bottom: -6, height: 2, background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})` }} />}
              </Link>
            );
          })}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }} className="uau-desktop-nav">
          <div style={{ width: 38, height: 38, borderRadius: 99, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, cursor: "pointer" }}>
            <Heart size={16} />
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 99, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, cursor: "pointer" }}>
            <UserCircle size={17} />
          </div>
          <a href={waLink(config.whatsapp, "Olá! Gostaria de falar com um consultor da UAU Veículos.")} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 5, background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: "#171208", fontWeight: 700, fontSize: 13.5 }}>
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>
        <div style={{ display: "none" }} className="uau-mobile-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </div>
      </div>
    </header>
  );
}

function PublicFooter({ config }) {
  const social = [Instagram, Facebook, MessageCircle];
  return (
    <footer style={{ borderTop: `1px solid ${C.line}`, padding: "56px 24px 24px", marginTop: 40 }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.15fr", gap: 36 }} className="uau-footer-grid">
        <div>
          <Logo />
          <p style={{ color: C.dim, fontSize: 13.5, marginTop: 16, maxWidth: 280 }}>
            Referência em veículos premium com qualidade, procedência e atendimento de excelência.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {social.map((Icon, i) => (
              <div key={i} style={{ width: 34, height: 34, borderRadius: 99, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim }}>
                <Icon size={14} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 style={ftitle()}>Navegação</h4>
          <Link to="/inicio" style={{ ...flink(), display: "block" }}>Início</Link>
          <Link to="/estoque" style={{ ...flink(), display: "block" }}>Estoque</Link>
          <Link to="/inicio" style={{ ...flink(), display: "block" }}>Sobre nós</Link>
          <Link to="/inicio" style={{ ...flink(), display: "block" }}>Contato</Link>
        </div>
        <div>
          <h4 style={ftitle()}>Institucional</h4>
          <div style={flink()}>Quem somos</div>
          <div style={flink()}>Política de privacidade</div>
          <div style={flink()}>Termos de uso</div>
          <div style={flink()}>Perguntas frequentes</div>
        </div>
        <div>
          <h4 style={ftitle()}>Fale conosco</h4>
          <div style={{ display: "flex", gap: 8, color: C.dim, fontSize: 13.5, marginBottom: 12 }}><Phone size={14} color={C.goldLight} />{config.telefone}</div>
          <div style={{ display: "flex", gap: 8, color: C.dim, fontSize: 13.5, marginBottom: 12 }}><MessageCircle size={14} color={C.goldLight} />{config.whatsapp}</div>
          <div style={{ display: "flex", gap: 8, color: C.dim, fontSize: 13.5, marginBottom: 12 }}><Mail size={14} color={C.goldLight} />{config.email}</div>
          <div style={{ display: "flex", gap: 8, color: C.dim, fontSize: 13.5 }}><MapPin size={14} color={C.goldLight} style={{ flexShrink: 0, marginTop: 2 }} />{config.endereco}</div>
        </div>
      </div>
      <div style={{ maxWidth: 1240, margin: "40px auto 0", borderTop: `1px solid ${C.line}`, paddingTop: 18, fontSize: 12, color: C.dim, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <span>© 2026 {config.nome}. Todos os direitos reservados.</span>
        <span>Desenvolvido com ♥</span>
      </div>
    </footer>
  );
}
function ftitle() { return { fontSize: 12.5, letterSpacing: ".08em", textTransform: "uppercase", color: C.dim, marginBottom: 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }; }
function flink() { return { cursor: "pointer", color: C.dim, fontSize: 14, marginBottom: 12 }; }

const BRANDS = ["BMW", "Mercedes-Benz", "Audi", "Volvo", "Land Rover", "Porsche", "Jeep", "Toyota", "Volkswagen"];

function HomePage({ vehicles, config, addContact }) {
  const [termo, setTermo] = useState("");
  const [focused, setFocused] = useState(false);
  const [modalServico, setModalServico] = useState(null);
  const navigate = useNavigate();
  const destaques = vehicles.slice(0, 4);

  const termoLower = termo.trim().toLowerCase();
  const sugestoes = termoLower
    ? vehicles.filter((v) => `${v.marca} ${v.modelo} ${v.versao}`.toLowerCase().includes(termoLower)).slice(0, 6)
    : [];

  function irParaEstoque() {
    navigate(termo.trim() ? `/estoque?q=${encodeURIComponent(termo.trim())}` : "/estoque");
  }

  return (
    <div>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 20, alignItems: "center", minHeight: 560 }} className="uau-hero-grid">
          <div style={{ padding: "60px 0" }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(38px,4.8vw,58px)", lineHeight: 1.05, marginBottom: 22 }}>
              Seu próximo<br />carro está<br />
              <span style={{ background: `linear-gradient(120deg, ${C.goldLight}, ${C.gold})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>aqui.</span>
            </h1>
            <p style={{ color: C.dim, fontSize: 16.5, maxWidth: 440, marginBottom: 30 }}>
              Encontre veículos premium com qualidade, procedência e as melhores condições do mercado.
            </p>
            <div style={{ marginBottom: 30 }}>
              <Link to="/estoque" style={btnGold()}>Ver estoque <ArrowRight size={15} /></Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex" }}>
                {["RM", "JS", "TP", "+"].map((t, i) => (
                  <span key={i} style={{
                    width: 34, height: 34, borderRadius: 99, border: `2px solid ${C.bg}`, marginLeft: i ? -10 : 0,
                    fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#171208",
                    background: ["#c8a25a", "#8b8f9b", "#a8834a", "#6f7280"][i],
                  }}>{t}</span>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: C.dim }}>+2.500 clientes satisfeitos</div>
                <div style={{ color: C.goldLight, fontSize: 12, letterSpacing: 2 }}>★★★★★</div>
              </div>
            </div>
          </div>
          <div style={{ position: "relative", height: "100%", minHeight: 560, display: "flex", alignItems: "center" }}>
            <img src={SUV_IMG} alt="Carro premium UAU Veículos" style={{
              width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%",
              maskImage: "linear-gradient(90deg, transparent, black 12%)", WebkitMaskImage: "linear-gradient(90deg, transparent, black 12%)",
            }} className="uau-hero-img" />
          </div>
        </div>
      </section>

      {/* SEARCH — overlaps hero. Live autocomplete against the vehicles already loaded from Supabase;
          brand/category stay as filters on /estoque instead of duplicating them here. */}
      <section style={{ maxWidth: 1240, margin: "-46px auto 0", padding: "0 24px", position: "relative", zIndex: 5 }}>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "26px 28px", display: "flex", gap: 16, alignItems: "end", boxShadow: "0 30px 60px -30px rgba(0,0,0,.7)" }} className="uau-search-grid">
          <div style={{ flex: 1, position: "relative" }}>
            <label style={lbl()}>Buscar veículo</label>
            <input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); irParaEstoque(); } }}
              placeholder="Ex: BMW X1, Corolla..."
              style={inp()}
            />
            {focused && sugestoes.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", zIndex: 20, boxShadow: "0 20px 40px rgba(0,0,0,.5)" }}>
                {sugestoes.map((v) => (
                  <div key={v.id} onMouseDown={() => navigate(vehiclePath(v))} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.panel)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <img src={v.fotos[0]} style={{ width: 44, height: 32, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v.marca} {v.modelo}</div>
                      <div style={{ fontSize: 11.5, color: C.dim }}>{v.anoFab} · {v.km.toLocaleString("pt-BR")} km</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.goldLight, whiteSpace: "nowrap" }}>{fmtBRL(v.precoAnunciado)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={irParaEstoque} style={{ ...btnGold(), height: 44, whiteSpace: "nowrap" }}><Search size={15} /> Buscar veículos</button>
        </div>
      </section>

      {/* DESTAQUES */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "90px 24px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 30 }}>
          <div>
            <div style={eyebrow()}>Destaques</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, marginTop: 10 }}>Veículos em destaque</h2>
          </div>
          <Link to="/estoque" style={{ cursor: "pointer", fontSize: 14, color: C.dim, border: `1px solid ${C.line}`, padding: "10px 16px", borderRadius: 4, whiteSpace: "nowrap" }}>Ver todos os veículos →</Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }} className="uau-grid-4">
          {destaques.map((v) => <VehicleCard key={v.id} v={v} />)}
        </div>
      </section>

      {/* NOSSOS SERVIÇOS */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px 90px" }}>
        <div style={eyebrow()}>Nossos serviços</div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, margin: "10px 0 30px" }}>Soluções completas para você</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="uau-grid-3">
          {SERVICOS.map((s) => (
            <div key={s.key} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 26, display: "flex", flexDirection: "column" }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(211,164,75,.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, color: C.goldLight }}>
                <s.icon size={19} />
              </div>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>{s.label}</h3>
              <p style={{ fontSize: 13, color: C.dim, marginBottom: 20, flex: 1 }}>{s.desc}</p>
              <button onClick={() => setModalServico(s)} style={{ ...btnGhost(), justifyContent: "center" }}>{s.cta}</button>
            </div>
          ))}
        </div>
      </section>

      {modalServico && (
        <ServicoFormModal servico={modalServico} vehicles={vehicles} addContact={addContact} onClose={() => setModalServico(null)} />
      )}

      {/* BRANDS MARQUEE */}
      <section style={{ background: C.panel, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "60px 0" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", ...eyebrow(), justifyContent: "center", marginBottom: 30 }}>
            <span style={{ display: "none" }} />As melhores marcas
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
            {BRANDS.map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7, fontSize: 13.5 }}>
                <div style={{ width: 34, height: 34, borderRadius: 99, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Car size={15} color={C.silverDim || C.dim} />
                </div>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: C.dim }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "90px 24px 40px" }}>
        <div style={eyebrow()}>Por que comprar conosco?</div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px,3vw,32px)", margin: "14px 0 34px", maxWidth: 560 }}>
          Segurança, transparência e as melhores condições.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }} className="uau-grid-4">
          {[
            { icon: Shield, t: "Procedência garantida", d: "Todos os veículos são vistoriados e aprovados." },
            { icon: FileText, t: "Documentação 100%", d: "Tudo revisado para você comprar sem preocupações." },
            { icon: Handshake, t: "Melhores condições", d: "Financiamento facilitado e taxas competitivas." },
            { icon: Headphones, t: "Atendimento premium", d: "Nossa equipe está pronta para te ajudar sempre." },
          ].map((f, i) => (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 26 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(211,164,75,.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, color: C.goldLight }}>
                <f.icon size={19} />
              </div>
              <h3 style={{ fontSize: 15, marginBottom: 6 }}>{f.t}</h3>
              <p style={{ fontSize: 13, color: C.dim }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SELL YOUR CAR */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 24px 100px" }}>
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.line}`, display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 320 }} className="uau-sell-grid">
          <div style={{ padding: "50px 50px", display: "flex", flexDirection: "column", justifyContent: "center", zIndex: 2 }}>
            <div style={eyebrow()}>Venda seu carro</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px,3vw,32px)", margin: "14px 0 14px" }}>Quer vender seu carro?</h2>
            <p style={{ color: C.dim, fontSize: 14.5, maxWidth: 380, marginBottom: 26 }}>Compramos seu veículo com segurança, rapidez e a melhor avaliação do mercado.</p>
            <a href={waLink(config.whatsapp, "Olá! Quero avaliar meu carro para venda.")} target="_blank" rel="noreferrer" style={{ ...btnGold(), width: "fit-content" }}>Avaliar meu carro <ArrowRight size={15} /></a>
          </div>
          <div style={{ position: "relative" }} className="uau-sell-img-wrap">
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${C.bg} 0%, transparent 40%)`, zIndex: 1 }} />
            <img src={SED_IMG} alt="Venda seu carro" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "80% center" }} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Modal({ title, icon: Icon, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 460, maxHeight: "90vh", overflow: "auto", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 17, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
            {Icon && <Icon size={19} color={C.goldLight} />} {title}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", display: "flex" }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ServicoFormModal({ servico, vehicles, addContact, onClose }) {
  const isConsignacao = servico.key === "consignacao";
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", veiculoId: "", marca: "", modelo: "", anoFab: "", km: "", valor: "", quando: "", obs: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setErr("");

    let mensagem;
    if (isConsignacao) {
      const partes = [];
      if (form.marca || form.modelo) partes.push(`Veículo do cliente: ${form.marca} ${form.modelo} ${form.anoFab}`.trim());
      if (form.km) partes.push(`KM: ${form.km}`);
      if (form.valor) partes.push(`Valor desejado: R$ ${form.valor}`);
      if (form.obs) partes.push(form.obs);
      mensagem = partes.join(" · ");
    } else {
      const partes = [];
      if (form.quando) partes.push(`Melhor dia/horário: ${form.quando}`);
      if (form.obs) partes.push(form.obs);
      mensagem = partes.join(" · ");
    }

    const ok = await addContact({
      nome: form.nome, telefone: form.telefone, email: form.email,
      veiculoId: isConsignacao ? "" : form.veiculoId,
      tipo: servico.tipo, mensagem, data: todayStr(), status: "Novo",
    });
    setSending(false);
    if (ok) setSent(true);
    else setErr("Não deu pra enviar agora. Tenta de novo ou fala com a gente pelo WhatsApp.");
  }

  return (
    <Modal title={servico.label} icon={servico.icon} onClose={onClose}>
      {sent ? (
        <div style={{ color: "#4ade80", fontSize: 14, display: "flex", gap: 8, alignItems: "center", padding: "12px 0" }}>
          <CheckCircle2 size={18} /> Recebemos seu pedido! Em breve entraremos em contato.
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" style={inp()} />
          <input required value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="WhatsApp / Telefone" style={inp()} />
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail" style={inp()} />

          {isConsignacao ? (
            <>
              <div style={{ display: "flex", gap: 10 }}>
                <input required value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} placeholder="Marca" style={inp()} />
                <input required value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Modelo" style={inp()} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input value={form.anoFab} onChange={(e) => setForm({ ...form, anoFab: e.target.value })} placeholder="Ano" style={inp()} inputMode="numeric" />
                <input value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} placeholder="Quilometragem" style={inp()} inputMode="numeric" />
              </div>
              <input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="Valor desejado (R$)" style={inp()} inputMode="numeric" />
            </>
          ) : (
            <>
              <select value={form.veiculoId} onChange={(e) => setForm({ ...form, veiculoId: e.target.value })} style={inp()}>
                <option value="">Veículo de interesse (opcional)</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.marca} {v.modelo}</option>)}
              </select>
              <input value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })} placeholder="Melhor dia/horário (opcional)" style={inp()} />
            </>
          )}

          <input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} placeholder="Observações (opcional)" style={inp()} />

          {err && <div style={{ color: "#f87171", fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={14} />{err}</div>}
          <button type="submit" disabled={sending} style={{ ...btnGold(), justifyContent: "center", opacity: sending ? 0.7 : 1 }}>{sending ? "Enviando..." : servico.cta}</button>
        </form>
      )}
    </Modal>
  );
}

function VehicleCard({ v }) {
  return (
    <Link to={vehiclePath(v)} style={{ display: "block", textDecoration: "none", color: "inherit", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.goldLight)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.line)}>
      <div style={{ position: "relative", aspectRatio: "4/3", background: C.panel2 }}>
        <img src={v.fotos[v.fotoPrincipal] || v.fotos[0]} alt={v.modelo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 99, background: "rgba(10,10,11,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Heart size={14} />
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600 }}>{v.marca} {v.modelo}</div>
        <div style={{ fontSize: 12, color: C.dim, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10, minHeight: 30 }}>{v.versao}</div>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.dim, marginBottom: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{v.anoFab}/{v.anoModelo}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Gauge size={12} />{v.km.toLocaleString("pt-BR")} km</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: C.goldLight }}>{fmtBRL(v.precoAnunciado)}</div>
          <ArrowRight size={15} color={C.dim} />
        </div>
      </div>
    </Link>
  );
}

function EstoquePage({ vehicles }) {
  const [searchParams] = useSearchParams();
  const [filtros, setFiltros] = useState({ marca: "Todas", combustivel: "Todos", cambio: "Todos" });
  const [busca, setBusca] = useState(searchParams.get("q") || "");
  const [ordenar, setOrdenar] = useState("recentes");

  const marcas = ["Todas", ...Array.from(new Set(vehicles.map((v) => v.marca)))];

  let list = vehicles.filter((v) => {
    if (filtros.marca !== "Todas" && v.marca !== filtros.marca) return false;
    if (filtros.combustivel !== "Todos" && v.combustivel !== filtros.combustivel) return false;
    if (filtros.cambio !== "Todos" && v.cambio !== filtros.cambio) return false;
    if (busca && !(`${v.marca} ${v.modelo} ${v.versao}`.toLowerCase().includes(busca.toLowerCase()))) return false;
    return true;
  });
  if (ordenar === "menorPreco") list = [...list].sort((a, b) => a.precoAnunciado - b.precoAnunciado);
  if (ordenar === "maiorPreco") list = [...list].sort((a, b) => b.precoAnunciado - a.precoAnunciado);
  if (ordenar === "menorKm") list = [...list].sort((a, b) => a.km - b.km);
  if (ordenar === "recentes") list = [...list].sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 100px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 32 }} className="uau-estoque-grid">
        <aside>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 20, position: "sticky", top: 90 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, fontWeight: 600 }}><Filter size={15} color={C.goldLight} /> Filtros</div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl()}>Buscar</label>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Marca, modelo, versão..." style={inp()} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl()}>Marca</label>
              <select value={filtros.marca} onChange={(e) => setFiltros({ ...filtros, marca: e.target.value })} style={inp()}>
                {marcas.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl()}>Combustível</label>
              <select value={filtros.combustivel} onChange={(e) => setFiltros({ ...filtros, combustivel: e.target.value })} style={inp()}>
                <option>Todos</option><option>Flex</option><option>Gasolina</option><option>Híbrido</option><option>Diesel</option>
              </select>
            </div>
            <div>
              <label style={lbl()}>Câmbio</label>
              <select value={filtros.cambio} onChange={(e) => setFiltros({ ...filtros, cambio: e.target.value })} style={inp()}>
                <option>Todos</option><option>Manual</option><option>Automática</option>
              </select>
            </div>
          </div>
        </aside>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <div style={{ color: C.dim, fontSize: 14 }}>{list.length} veículos encontrados</div>
            <select value={ordenar} onChange={(e) => setOrdenar(e.target.value)} style={{ ...inp(), width: 200 }}>
              <option value="recentes">Mais recentes</option>
              <option value="menorPreco">Menor preço</option>
              <option value="maiorPreco">Maior preço</option>
              <option value="menorKm">Menor quilometragem</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="uau-grid-3">
            {list.map((v) => <VehicleCard key={v.id} v={v} />)}
            {list.length === 0 && <div style={{ color: C.dim, gridColumn: "1/-1", padding: 40, textAlign: "center" }}>Nenhum veículo encontrado com esses filtros.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function VehicleDetailPage({ vehicles, config, addContact }) {
  const { slug } = useParams();
  const codigo = vehicleCodigoFromSlug(slug);
  const vehicle = vehicles.find((v) => String(v.codigo) === codigo);
  const published = vehicles.filter((v) => v.publicado && emEstoque(v));
  const related = vehicle ? published.filter((v) => v.id !== vehicle.id).slice(0, 4) : [];

  const [photoIdx, setPhotoIdx] = useState(0);
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", tipo: "Quero mais informações" });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setPhotoIdx(0);
    setSent(false);
  }, [vehicle?.id]);

  if (!vehicle) return <div style={{ padding: 80, textAlign: "center", color: C.dim }}>Veículo não encontrado. <Link to="/estoque" style={{ color: C.goldLight, cursor: "pointer" }}>Voltar ao estoque</Link></div>;

  const [sendErr, setSendErr] = useState("");
  async function submitForm(e) {
    e.preventDefault();
    setSendErr("");
    const ok = await addContact({
      nome: form.nome, telefone: form.telefone, email: form.email,
      veiculoId: vehicle.id, tipo: form.tipo, data: todayStr(), status: "Novo",
    });
    if (ok) setSent(true);
    else setSendErr("Não deu pra enviar agora. Tenta de novo ou fala com a gente pelo WhatsApp.");
  }

  const msg = `Olá, tenho interesse no ${vehicle.marca} ${vehicle.modelo} ${vehicle.anoFab} anunciado no site da ${config.nome}.`;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 24px 100px" }}>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>
        <Link to="/inicio" style={{ cursor: "pointer" }}>Início</Link> / <Link to="/estoque" style={{ cursor: "pointer" }}>Estoque</Link> / {vehicle.marca} {vehicle.modelo}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 32 }} className="uau-detail-grid">
        <div>
          <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.line}`, aspectRatio: "4/3", position: "relative" }}>
            <img src={vehicle.fotos[photoIdx]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {vehicle.fotos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx((photoIdx - 1 + vehicle.fotos.length) % vehicle.fotos.length)} style={navBtn("left")}><ChevronLeft size={18} /></button>
                <button onClick={() => setPhotoIdx((photoIdx + 1) % vehicle.fotos.length)} style={navBtn("right")}><ChevronRight size={18} /></button>
              </>
            )}
          </div>
          {vehicle.fotos.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {vehicle.fotos.map((f, i) => (
                <div key={i} onClick={() => setPhotoIdx(i)} style={{ width: 64, height: 48, borderRadius: 4, overflow: "hidden", border: `2px solid ${i === photoIdx ? C.goldLight : C.line}`, cursor: "pointer" }}>
                  <img src={f} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 22, marginTop: 24, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
            <Spec icon={Calendar} label="Ano" value={`${vehicle.anoFab}/${vehicle.anoModelo}`} />
            <Spec icon={Gauge} label="KM" value={`${vehicle.km.toLocaleString("pt-BR")} km`} />
            <Spec icon={Fuel} label="Combustível" value={vehicle.combustivel} />
            <Spec icon={Cog} label="Câmbio" value={vehicle.cambio} />
            <Spec icon={Car} label="Cor" value={vehicle.cor} />
            <Spec icon={ShieldCheck} label="Portas" value={vehicle.portas} />
          </div>

          {vehicle.descricao && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Descrição</h3>
              <p style={{ color: C.dim, fontSize: 14.5, lineHeight: 1.7 }}>{vehicle.descricao}</p>
            </div>
          )}
          {vehicle.opcionais.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 14 }}>Itens do veículo</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px 18px" }} className="uau-grid-3">
                {vehicle.opcionais.map((o, i) => (
                  <span key={i} style={{ fontSize: 13.5, color: C.text }}>{o}</span>
                ))}
              </div>
            </div>
          )}

          {vehicle.fipe > 0 && (
            <div style={{ marginTop: 24, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: 22 }}>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 18 }}>Compare os preços</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="uau-grid-2">
                <div>
                  <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 6 }}>Valor anunciado ({config.nome})</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: C.text }}>{fmtBRL(vehicle.precoAnunciado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 6 }}>Tabela FIPE</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: C.goldLight }}>{fmtBRL(vehicle.fipe)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: C.goldLight, fontFamily: "'JetBrains Mono', monospace", letterSpacing: ".08em", textTransform: "uppercase" }}>{vehicle.marca}</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, margin: "6px 0" }}>{vehicle.modelo}</h1>
          <div style={{ color: C.dim, fontSize: 14, marginBottom: 14 }}>{vehicle.versao}</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 30, color: C.goldLight, marginBottom: 20 }}>{fmtBRL(vehicle.precoAnunciado)}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            <a href={waLink(config.whatsapp, msg)} target="_blank" rel="noreferrer" style={{ ...btnGold(), justifyContent: "center" }}>
              <MessageCircle size={16} /> Falar sobre este veículo no WhatsApp
            </a>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 22 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><FileText size={15} color={C.goldLight} /> Tenho interesse</h3>
            {sent ? (
              <div style={{ color: "#4ade80", fontSize: 14, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle2 size={18} /> Recebemos seu contato! Em breve falaremos com você.</div>
            ) : (
              <form onSubmit={submitForm} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" style={inp()} />
                <input required value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="WhatsApp / Telefone" style={inp()} />
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail" style={inp()} />
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={inp()}>
                  <option>Quero mais informações</option>
                  <option>Quero financiar</option>
                  <option>Quero negociar</option>
                  <option>Quero dar meu veículo na troca</option>
                </select>
                {sendErr && <div style={{ color: "#f87171", fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={14} />{sendErr}</div>}
                <button type="submit" style={btnGold()}>Enviar</button>
              </form>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ marginTop: 60 }}>
          <h3 style={{ fontSize: 18, marginBottom: 20 }}>Outros veículos</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }} className="uau-grid-4">
            {related.map((v) => <VehicleCard key={v.id} v={v} />)}
          </div>
        </div>
      )}
    </div>
  );
}
function Spec({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icon size={16} color={C.goldLight} style={{ marginTop: 2 }} />
      <div>
        <div style={{ fontSize: 11.5, color: C.dim }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}
function navBtn(side) {
  return {
    position: "absolute", top: "50%", [side]: 10, transform: "translateY(-50%)",
    width: 36, height: 36, borderRadius: 99, background: "rgba(10,10,11,.7)", border: `1px solid ${C.line}`,
    color: C.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  };
}

/* shared style helpers */
function lbl() { return { display: "block", fontSize: 11.5, color: C.dim, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }; }
function inp() { return { width: "100%", background: C.panel2, border: `1px solid ${C.line}`, color: C.text, padding: "10px 12px", borderRadius: 5, fontSize: 13.5 }; }
function btnGold() { return { display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 5, background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: "#171208", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }; }
function btnGhost() { return { display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 5, background: "transparent", color: C.text, fontWeight: 600, fontSize: 14, border: `1px solid ${C.line}`, cursor: "pointer" }; }
function eyebrow() { return { display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, letterSpacing: ".14em", textTransform: "uppercase", color: C.goldLight }; }

/* ============================================================
   ADMIN LOGIN
   ============================================================ */
function AdminLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    // on success, App's onAuthStateChange listener flips `authed` and this route redirects itself
    if (error) setErr("E-mail ou senha inválidos.");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 380, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 36 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}><Logo size={36} /></div>
        <h1 style={{ textAlign: "center", fontSize: 18, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 4 }}>Painel Administrativo</h1>
        <p style={{ textAlign: "center", fontSize: 12.5, color: C.dim, marginBottom: 26 }}>Acesso restrito à equipe UAU Veículos</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl()}>E-mail</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@uauveiculos.com" style={inp()} />
          </div>
          <div>
            <label style={lbl()}>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" style={inp()} />
          </div>
          {err && <div style={{ color: "#f87171", fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={14} />{err}</div>}
          <button type="submit" disabled={loading} style={{ ...btnGold(), justifyContent: "center", marginTop: 6, opacity: loading ? 0.7 : 1 }}>
            <Lock size={15} /> {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <div style={{ marginTop: 20, fontSize: 11.5, color: C.dim, textAlign: "center", lineHeight: 1.6 }}>
          Acesso via Supabase Auth. Crie o usuário admin em Authentication &gt; Users no painel do Supabase.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ADMIN PANEL
   ============================================================ */
function AdminPanel({ vehicles, contacts, config, setConfig, updateVehicle, addVehicle, deleteVehicle, updateContactStatus, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menu = [
    { to: "/admin", label: "Visão Geral", icon: LayoutDashboard, active: (p) => p === "/admin" },
    { to: "/admin/estoque", label: "Estoque", icon: Car, active: (p) => p.startsWith("/admin/estoque") || p.startsWith("/admin/veiculo") },
    { to: "/admin/vendidos", label: "Vendidos", icon: Archive, active: (p) => p.startsWith("/admin/vendidos") },
    { to: "/admin/contatos", label: "Contatos", icon: Users, active: (p) => p.startsWith("/admin/contatos") },
    { to: "/admin/config", label: "Configurações", icon: Settings, active: (p) => p.startsWith("/admin/config") },
  ];

  function openVehicle(id) { navigate(`/admin/veiculo/${id}`); }
  async function newVehicle() {
    const draft = seedVehicle({ marca: "", modelo: "", versao: "", fotos: [CAR_IMG] });
    const created = await addVehicle(draft);
    if (created) navigate(`/admin/veiculo/${created.id}`, { state: { isNew: true } });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", minHeight: "100vh" }} className="uau-admin-shell">
      <aside style={{ background: C.panel, borderRight: `1px solid ${C.line}`, padding: "22px 16px", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 8px 26px" }}><Logo /></div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {menu.map((m) => {
            const active = m.active(location.pathname);
            return (
              <button key={m.to} onClick={() => navigate(m.to)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 6, border: "none",
                background: active ? "rgba(211,164,75,.12)" : "transparent",
                color: active ? C.goldLight : C.dim, fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left",
              }}>
                <m.icon size={16} /> {m.label}
              </button>
            );
          })}
        </nav>
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 6, border: "none", background: "transparent", color: C.dim, fontSize: 13, cursor: "pointer" }}>
          <LogOut size={15} /> Sair
        </button>
      </aside>
      <main style={{ padding: 28, overflow: "auto" }}>
        <Routes>
          <Route index element={<Dashboard vehicles={vehicles} onOpen={openVehicle} />} />
          <Route path="estoque" element={<EstoqueAdmin vehicles={vehicles} onOpen={openVehicle} onNew={newVehicle} />} />
          <Route path="vendidos" element={<VendidosAdmin vehicles={vehicles} onOpen={openVehicle} onDelete={deleteVehicle} />} />
          <Route path="veiculo/:id" element={<VehicleAdmin vehicles={vehicles} updateVehicle={updateVehicle} deleteVehicle={deleteVehicle} />} />
          <Route path="contatos" element={<ContatosAdmin contacts={contacts} vehicles={vehicles} updateContactStatus={updateContactStatus} config={config} />} />
          <Route path="config" element={<ConfigAdmin config={config} setConfig={setConfig} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, highlight }) {
  return (
    <div style={{ background: highlight ? "rgba(211,164,75,.08)" : C.panel, border: `1px solid ${highlight ? C.gold + "66" : C.line}`, borderRadius: 8, padding: 18 }}>
      <div style={{ width: 34, height: 34, borderRadius: 7, background: "rgba(211,164,75,.14)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: C.goldLight }}>
        <Icon size={17} />
      </div>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Dashboard({ vehicles, onOpen }) {
  const ativos = vehicles.filter(emEstoque); // vendido/arquivado are out of stock, for good
  const valorInvestido = ativos.reduce((s, v) => s + custoTotal(v), 0);
  const fipeTotal = ativos.reduce((s, v) => s + (v.fipe || 0), 0);
  const potencialVenda = ativos.reduce((s, v) => s + (v.precoAnunciado || 0), 0);
  const lucroProjetado = ativos.reduce((s, v) => s + ((v.precoAnunciado || 0) - custoTotal(v)), 0);

  const statusCounts = STATUS_LIST.map((s) => ({ ...s, count: vehicles.filter((v) => v.status === s.key).length }))
    .filter((s) => ["disponivel", "preparacao", "negociacao", "vendido"].includes(s.key));

  // vendidos/arquivados have their own board — keep them out of the main recent list so it doesn't pile up
  const recentes = vehicles.filter(emEstoque).sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro)).slice(0, 8);

  return (
    <div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, marginBottom: 2 }}>Visão Geral</h1>
      <p style={{ color: C.dim, fontSize: 13.5, marginBottom: 24 }}>Acompanhe o desempenho do seu estoque</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 26 }} className="uau-grid-5">
        <StatCard icon={Car} label="Total em estoque" value={`${ativos.length} veículos`} />
        <StatCard icon={Wallet} label="Valor investido" value={fmtBRL(valorInvestido)} sub="Custo total dos veículos" />
        <StatCard icon={Gauge} label="FIPE total do estoque" value={fmtBRL(fipeTotal)} />
        <StatCard icon={TrendingUp} label="Potencial de venda" value={fmtBRL(potencialVenda)} />
        <StatCard icon={BadgeDollarSign} label="Lucro projetado" value={fmtBRL(lucroProjetado)} highlight />
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 20, marginBottom: 26 }}>
        <h3 style={{ fontSize: 14, marginBottom: 16 }}>Status do estoque</h3>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {statusCounts.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: s.color }} />
              <span style={{ fontSize: 13, color: C.dim }}>{s.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.line}`, fontSize: 14, fontWeight: 600 }}>Veículos recentes</div>
        <VehicleTable vehicles={recentes} onOpen={onOpen} compact />
      </div>
    </div>
  );
}

function EstoqueAdmin({ vehicles, onOpen, onNew }) {
  const [busca, setBusca] = useState("");
  // vendido/arquivado live in the Vendidos board instead, so they don't pile up here.
  const list = vehicles.filter((v) => emEstoque(v) && `${v.marca} ${v.modelo} ${v.versao}`.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22 }}>Estoque</h1>
          <p style={{ color: C.dim, fontSize: 13.5 }}>{list.length} veículos</p>
        </div>
        <button onClick={onNew} style={btnGold()}><Plus size={16} /> Novo veículo</button>
      </div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar veículo, marca, versão..." style={{ ...inp(), maxWidth: 340, marginBottom: 18 }} />
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
        <VehicleTable vehicles={list} onOpen={onOpen} />
      </div>
    </div>
  );
}

function VendidosAdmin({ vehicles, onOpen, onDelete }) {
  const [busca, setBusca] = useState("");
  const list = vehicles
    .filter((v) => !emEstoque(v) && `${v.marca} ${v.modelo} ${v.versao}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22 }}>Vendidos</h1>
        <p style={{ color: C.dim, fontSize: 13.5 }}>
          {list.length} veículos vendidos ou arquivados — saem do Estoque automaticamente, mas o histórico fica guardado aqui até você excluir.
        </p>
      </div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar veículo, marca, versão..." style={{ ...inp(), maxWidth: 340, marginBottom: 18 }} />
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
        <VehicleTable vehicles={list} onOpen={onOpen} onDelete={onDelete} />
      </div>
    </div>
  );
}

function VehicleTable({ vehicles, onOpen, compact, onDelete }) {
  const cols = ["Veículo", "Ano", "Situação", "Publicado", "Custo total", "FIPE", "Preço anunciado", "Margem", "Dias"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.line}` }}>
            {cols.map((c) => <th key={c} style={{ textAlign: "left", padding: "10px 16px", color: C.dim, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{c}</th>)}
            {onDelete && <th style={{ padding: "10px 16px" }} />}
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const ct = custoTotal(v);
            const margem = ct ? (((v.precoAnunciado || 0) - ct) / ct) * 100 : 0;
            const st = statusInfo(v.status);
            return (
              <tr key={v.id} onClick={() => onOpen(v.id)} style={{ borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "10px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={v.fotos[0]} style={{ width: 42, height: 32, objectFit: "cover", borderRadius: 4 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{v.marca} {v.modelo}</div>
                      <div style={{ fontSize: 11.5, color: C.dim }}>{v.versao}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "10px 16px" }}>{v.anoFab}/{v.anoModelo}</td>
                <td style={{ padding: "10px 16px" }}><Badge color={st.color}>{st.label}</Badge></td>
                <td style={{ padding: "10px 16px" }}>{v.publicado ? <span style={{ color: "#4ade80" }}>Sim</span> : <span style={{ color: C.dim }}>Não</span>}</td>
                <td style={{ padding: "10px 16px" }}>{fmtBRL(ct)}</td>
                <td style={{ padding: "10px 16px" }}>{fmtBRL(v.fipe)}</td>
                <td style={{ padding: "10px 16px", fontWeight: 600 }}>{fmtBRL(v.precoAnunciado)}</td>
                <td style={{ padding: "10px 16px", color: margem >= 0 ? "#4ade80" : "#f87171" }}>{v.status === "vendido" ? "—" : `${margem.toFixed(1)}%`}</td>
                <td style={{ padding: "10px 16px", color: C.dim }}>{diasEstoque(v)}d</td>
                {onDelete && (
                  <td style={{ padding: "10px 16px" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { if (window.confirm(`Excluir permanentemente ${v.marca} ${v.modelo}? Essa ação não pode ser desfeita.`)) onDelete(v.id); }}
                      style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", display: "flex" }}
                      title="Excluir veículo"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
          {vehicles.length === 0 && (
            <tr><td colSpan={onDelete ? 10 : 9} style={{ padding: 30, textAlign: "center", color: C.dim }}>Nenhum veículo encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- VEHICLE ADMIN DETAIL ---------- */
function VehicleAdmin({ vehicles, updateVehicle, deleteVehicle }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const vehicle = vehicles.find((v) => v.id === id);
  const isNew = !!location.state?.isNew;
  const [tab, setTab] = useState("resumo");
  if (!vehicle) return null;

  function cancelarCadastro() {
    deleteVehicle(vehicle.id);
    navigate("/admin/estoque");
  }

  const tabs = [
    { k: "resumo", label: "Resumo", icon: LayoutDashboard },
    { k: "dados", label: "Dados", icon: FileText },
    { k: "fotos", label: "Fotos", icon: Camera },
    { k: "gastos", label: "Gastos", icon: Wallet },
    { k: "precificacao", label: "Precificação", icon: BadgeDollarSign },
    { k: "anotacoes", label: "Anotações", icon: ClipboardList },
    { k: "historico", label: "Histórico", icon: History },
  ];

  function patch(fields, historicoTxt) {
    updateVehicle(vehicle.id, (v) => {
      let nv = { ...v, ...fields };
      if (historicoTxt) nv = pushHistorico(nv, historicoTxt);
      return nv;
    });
  }

  // Publishing on the site only makes sense while the car is actually sellable.
  const podePublicar = vehicle.status === "preparacao" || vehicle.status === "disponivel";

  function setStatus(newStatus) {
    const fields = { status: newStatus };
    const aindaPodePublicar = newStatus === "preparacao" || newStatus === "disponivel";
    if (!aindaPodePublicar && vehicle.publicado) fields.publicado = false;
    patch(fields, `Status alterado para ${statusInfo(newStatus).label}.`);
    if (newStatus === "vendido") setTab("resumo"); // surface the sale-details card right away
  }
  function setPublicado(checked) {
    patch({ publicado: checked }, checked ? "Veículo publicado no site." : "Veículo despublicado do site.");
  }

  return (
    <div>
      <button onClick={() => navigate("/admin/estoque")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.dim, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
        <ChevronLeft size={15} /> Voltar ao estoque
      </button>

      {isNew && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", background: "rgba(211,164,75,.08)", border: `1px solid ${C.gold}55`, borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: C.dim }}>Cadastro em andamento — cada campo já é salvo automaticamente ao alterar.</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={cancelarCadastro} style={{ ...btnGhost(), padding: "8px 14px" }}><Trash2 size={14} /> Cancelar cadastro</button>
            <button onClick={() => navigate("/admin/estoque")} style={{ ...btnGold(), padding: "8px 14px" }}><CheckCircle2 size={14} /> Concluir cadastro</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22 }}>
              {vehicle.marca || "Novo"} {vehicle.modelo} {isNew && <span style={{ color: C.dim, fontWeight: 400, fontSize: 14 }}>(cadastro)</span>}
            </h1>
            <Badge color={statusInfo(vehicle.status).color}>{statusInfo(vehicle.status).label}</Badge>
          </div>
          <p style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>{vehicle.versao}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={vehicle.status} onChange={(e) => setStatus(e.target.value)} style={{ ...inp(), width: 180 }}>
            {STATUS_LIST.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <label title={podePublicar ? "" : "Só pode publicar com status Em preparação ou Disponível"} style={{
            display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.dim, background: C.panel,
            border: `1px solid ${C.line}`, padding: "9px 14px", borderRadius: 6,
            cursor: podePublicar ? "pointer" : "not-allowed", opacity: podePublicar ? 1 : 0.5,
          }}>
            <input type="checkbox" checked={vehicle.publicado && podePublicar} disabled={!podePublicar} onChange={(e) => setPublicado(e.target.checked)} />
            Publicado no site
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.line}`, marginBottom: 22, overflowX: "auto" }}>
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", background: "none", border: "none",
            borderBottom: `2px solid ${tab === t.k ? C.goldLight : "transparent"}`,
            color: tab === t.k ? C.goldLight : C.dim, fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" && <TabResumo vehicle={vehicle} patch={patch} />}
      {tab === "dados" && <TabDados vehicle={vehicle} patch={patch} />}
      {tab === "fotos" && <TabFotos vehicle={vehicle} patch={patch} />}
      {tab === "gastos" && <TabGastos vehicle={vehicle} patch={patch} updateVehicle={updateVehicle} />}
      {tab === "precificacao" && <TabPrecificacao vehicle={vehicle} patch={patch} />}
      {tab === "anotacoes" && <TabAnotacoes vehicle={vehicle} updateVehicle={updateVehicle} />}
      {tab === "historico" && <TabHistorico vehicle={vehicle} />}
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={lbl()}>{label}</label>{children}</div>;
}
function SectionTitle({ children }) {
  return <h3 style={{ fontSize: 14, fontWeight: 700, margin: "22px 0 14px", color: C.goldLight }}>{children}</h3>;
}
function Panel({ children, style }) {
  return <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 22, ...style }}>{children}</div>;
}

// Same leading-zero problem as sanitizeInt, but percent-style fields (10.5%) need to allow a trailing "."
// while typing — which a purely value-derived string can't represent — so this keeps its own text buffer
// and only resyncs from the outside value when the field isn't focused.
function DecimalField({ value, onCommit, style }) {
  const [text, setText] = useState(String(value ?? 0));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(String(value ?? 0)); }, [value]);
  return (
    <input
      type="text" inputMode="decimal" style={style} value={text}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={() => { focused.current = false; setText(String(value ?? 0)); }}
      onChange={(e) => {
        let raw = e.target.value.replace(/[^\d.]/g, "");
        const dot = raw.indexOf(".");
        if (dot !== -1) raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, "");
        setText(raw);
        const num = raw === "" || raw === "." ? 0 : Number(raw);
        if (!Number.isNaN(num)) onCommit(num);
      }}
    />
  );
}

function TabResumo({ vehicle, patch }) {
  const ct = custoTotal(vehicle);
  const margem = ct ? (((vehicle.precoAnunciado || 0) - ct) / ct) * 100 : 0;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 22 }} className="uau-resumo-grid">
        <Panel style={{ padding: 0, overflow: "hidden" }}>
          <img src={vehicle.fotos[vehicle.fotoPrincipal] || vehicle.fotos[0]} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
        </Panel>
        <Panel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            <ResumoItem label="Situação"><Badge color={statusInfo(vehicle.status).color}>{statusInfo(vehicle.status).label}</Badge></ResumoItem>
            <ResumoItem label="Dias em estoque" value={`${diasEstoque(vehicle)} dias`} />
            <ResumoItem label="Origem" value={{ compra: "Compra própria", consignacao: "Consignação", troca: "Troca" }[vehicle.origem]} />
            <ResumoItem label="Valor de entrada" value={fmtBRL(valorEntrada(vehicle))} />
            <ResumoItem label="Total de gastos" value={fmtBRL(totalGastos(vehicle))} />
            <ResumoItem label="Custo total" value={fmtBRL(ct)} strong />
            <ResumoItem label="FIPE" value={fmtBRL(vehicle.fipe)} />
            <ResumoItem label="Preço anunciado" value={fmtBRL(vehicle.precoAnunciado)} strong />
            <ResumoItem label="Margem atual" value={`${margem.toFixed(1)}%`} color={margem >= 0 ? "#4ade80" : "#f87171"} />
            <ResumoItem label="Publicado no site" value={vehicle.publicado ? "Sim" : "Não"} />
            <ResumoItem label="KM" value={`${vehicle.km.toLocaleString("pt-BR")} km`} />
            <ResumoItem label="Cadastrado em" value={fmtDate(vehicle.dataCadastro)} />
          </div>
        </Panel>
      </div>
      {vehicle.status === "vendido" && <VendaPanel vehicle={vehicle} patch={patch} />}
    </div>
  );
}

function VendaPanel({ vehicle, patch }) {
  const venda = vehicle.venda || { data: todayStr(), valor: vehicle.precoAnunciado || 0, comprador: "", vendedor: "", obs: "" };
  const ct = custoTotal(vehicle);
  const margemGanha = (venda.valor || 0) - ct;
  function setVenda(fields) {
    patch({ venda: { ...venda, ...fields } });
  }
  return (
    <Panel style={{ marginTop: 22 }}>
      <SectionTitle>Detalhes da venda</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="uau-form-grid-4">
        <Field label="Valor de venda"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={venda.valor} onChange={(e) => setVenda({ valor: sanitizeInt(e.target.value) })} /></Field>
        <Field label="Comprador"><input style={inp()} value={venda.comprador} onChange={(e) => setVenda({ comprador: e.target.value })} /></Field>
        <Field label="Vendedor"><input style={inp()} value={venda.vendedor} onChange={(e) => setVenda({ vendedor: e.target.value })} /></Field>
        <Field label="Data da venda"><input type="date" style={inp()} value={venda.data} onChange={(e) => setVenda({ data: e.target.value })} /></Field>
      </div>
      <Field label="Observações"><input style={inp()} value={venda.obs} onChange={(e) => setVenda({ obs: e.target.value })} /></Field>
      <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: margemGanha >= 0 ? "rgba(74,222,128,.1)" : "rgba(248,113,113,.1)", border: `1px solid ${margemGanha >= 0 ? "#4ade80" : "#f87171"}55` }}>
        <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 4 }}>Margem ganha (valor de venda − custo total)</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: margemGanha >= 0 ? "#4ade80" : "#f87171", fontFamily: "'Space Grotesk', sans-serif" }}>{fmtBRL(margemGanha)}</div>
      </div>
    </Panel>
  );
}
function ResumoItem({ label, value, strong, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: strong ? 700 : 500, color: color || C.text }}>{value}</div>
    </div>
  );
}

function TabDados({ vehicle, patch }) {
  const v = vehicle;
  const set = (obj) => patch(obj);
  const [customOpcional, setCustomOpcional] = useState("");
  const opcionaisExtra = v.opcionais.filter((o) => !OPCIONAIS_COMUNS.includes(o));

  function toggleOpcional(o) {
    set({ opcionais: v.opcionais.includes(o) ? v.opcionais.filter((x) => x !== o) : [...v.opcionais, o] });
  }
  function addCustomOpcional() {
    const val = customOpcional.trim();
    if (!val || v.opcionais.includes(val)) return;
    set({ opcionais: [...v.opcionais, val] });
    setCustomOpcional("");
  }

  return (
    <Panel>
      <SectionTitle>Dados do veículo</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="uau-form-grid-3">
        <Field label="Marca"><input style={inp()} value={v.marca} onChange={(e) => set({ marca: e.target.value })} /></Field>
        <Field label="Modelo"><input style={inp()} value={v.modelo} onChange={(e) => set({ modelo: e.target.value })} /></Field>
        <Field label="Versão"><input style={inp()} value={v.versao} onChange={(e) => set({ versao: e.target.value })} /></Field>
        <Field label="Ano fabricação"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.anoFab} onChange={(e) => set({ anoFab: sanitizeInt(e.target.value) })} /></Field>
        <Field label="Ano modelo"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.anoModelo} onChange={(e) => set({ anoModelo: sanitizeInt(e.target.value) })} /></Field>
        <Field label="Quilometragem"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.km} onChange={(e) => set({ km: sanitizeInt(e.target.value) })} /></Field>
        <Field label="Cor"><input style={inp()} value={v.cor} onChange={(e) => set({ cor: e.target.value })} /></Field>
        <Field label="Combustível">
          <select style={inp()} value={v.combustivel} onChange={(e) => set({ combustivel: e.target.value })}>
            <option>Flex</option><option>Gasolina</option><option>Híbrido</option><option>Diesel</option><option>Elétrico</option>
          </select>
        </Field>
        <Field label="Câmbio">
          <select style={inp()} value={v.cambio} onChange={(e) => set({ cambio: e.target.value })}>
            <option>Manual</option><option>Automática</option>
          </select>
        </Field>
        <Field label="Portas"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.portas} onChange={(e) => set({ portas: sanitizeInt(e.target.value) })} /></Field>
        <Field label="Placa"><input style={inp()} value={v.placa} onChange={(e) => set({ placa: e.target.value })} /></Field>
      </div>
      <Field label="Descrição"><textarea rows={3} style={{ ...inp(), resize: "vertical" }} value={v.descricao} onChange={(e) => set({ descricao: e.target.value })} /></Field>
      <Field label="Opcionais">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {OPCIONAIS_COMUNS.map((o) => {
            const active = v.opcionais.includes(o);
            return (
              <button key={o} type="button" onClick={() => toggleOpcional(o)} style={{
                padding: "7px 13px", borderRadius: 99, fontSize: 12.5, cursor: "pointer",
                border: `1px solid ${active ? C.goldLight : C.line}`,
                background: active ? "rgba(211,164,75,.12)" : "transparent",
                color: active ? C.goldLight : C.dim,
              }}>
                {o}
              </button>
            );
          })}
        </div>
        {opcionaisExtra.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {opcionaisExtra.map((o) => (
              <span key={o} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 8px 7px 13px", borderRadius: 99, fontSize: 12.5, border: `1px solid ${C.goldLight}`, background: "rgba(211,164,75,.12)", color: C.goldLight }}>
                {o}
                <button type="button" onClick={() => toggleOpcional(o)} style={{ display: "flex", background: "none", border: "none", color: C.goldLight, cursor: "pointer", padding: 2 }}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={customOpcional} onChange={(e) => setCustomOpcional(e.target.value)} placeholder="Outro opcional (não listado acima)..." style={inp()}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomOpcional(); } }} />
          <button type="button" onClick={addCustomOpcional} style={btnGold()}><Plus size={15} /></button>
        </div>
      </Field>

      <SectionTitle>Origem do veículo</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {["compra", "consignacao", "troca"].map((o) => (
          <button key={o} onClick={() => set({ origem: o })} style={{
            padding: "9px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer",
            border: `1px solid ${v.origem === o ? C.goldLight : C.line}`,
            background: v.origem === o ? "rgba(211,164,75,.1)" : "transparent",
            color: v.origem === o ? C.goldLight : C.dim,
          }}>
            {{ compra: "Compra própria", consignacao: "Consignação", troca: "Troca" }[o]}
          </button>
        ))}
      </div>

      {v.origem === "compra" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="uau-form-grid-4">
          <Field label="Valor pago"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.compra.valorPago} onChange={(e) => set({ compra: { ...v.compra, valorPago: sanitizeInt(e.target.value) } })} /></Field>
          <Field label="FIPE"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.fipe} onChange={(e) => set({ fipe: sanitizeInt(e.target.value) })} /></Field>
          <Field label="Data de aquisição"><input type="date" style={inp()} value={v.compra.dataAquisicao} onChange={(e) => set({ compra: { ...v.compra, dataAquisicao: e.target.value } })} /></Field>
          <Field label="Fornecedor (opcional)"><input style={inp()} value={v.compra.fornecedor} onChange={(e) => set({ compra: { ...v.compra, fornecedor: e.target.value } })} /></Field>
        </div>
      )}
      {v.origem === "consignacao" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="uau-form-grid-3">
          <Field label="Nome do proprietário"><input style={inp()} value={v.consignacao.proprietario} onChange={(e) => set({ consignacao: { ...v.consignacao, proprietario: e.target.value } })} /></Field>
          <Field label="Telefone"><input style={inp()} value={v.consignacao.telefone} onChange={(e) => set({ consignacao: { ...v.consignacao, telefone: e.target.value } })} /></Field>
          <Field label="Valor de repasse"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.consignacao.valorRepasse} onChange={(e) => set({ consignacao: { ...v.consignacao, valorRepasse: sanitizeInt(e.target.value) } })} /></Field>
          <Field label="Comissão / margem combinada"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.consignacao.comissao} onChange={(e) => set({ consignacao: { ...v.consignacao, comissao: sanitizeInt(e.target.value) } })} /></Field>
          <Field label="Data de entrada"><input type="date" style={inp()} value={v.consignacao.dataEntrada} onChange={(e) => set({ consignacao: { ...v.consignacao, dataEntrada: e.target.value } })} /></Field>
          <Field label="Observações"><input style={inp()} value={v.consignacao.obs} onChange={(e) => set({ consignacao: { ...v.consignacao, obs: e.target.value } })} /></Field>
          <div style={{ gridColumn: "1/-1", fontSize: 12, color: C.dim, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> O valor de repasse não entra como valor investido pela loja — apenas a comissão é considerada no custo.
          </div>
        </div>
      )}
      {v.origem === "troca" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="uau-form-grid-3">
          <Field label="Valor considerado na troca"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.troca.valorConsiderado} onChange={(e) => set({ troca: { ...v.troca, valorConsiderado: sanitizeInt(e.target.value) } })} /></Field>
          <Field label="Negociação relacionada (opcional)"><input style={inp()} value={v.troca.negociacaoRelacionada} onChange={(e) => set({ troca: { ...v.troca, negociacaoRelacionada: e.target.value } })} /></Field>
          <Field label="Observações"><input style={inp()} value={v.troca.obs} onChange={(e) => set({ troca: { ...v.troca, obs: e.target.value } })} /></Field>
        </div>
      )}

      <SectionTitle>Financiamento assumido</SectionTitle>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={v.financiamentoAssumido} onChange={(e) => set({ financiamentoAssumido: e.target.checked })} />
        <span style={{ fontSize: 13.5 }}>Este veículo possuía saldo/dívida assumida</span>
      </label>
      {v.financiamentoAssumido && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="uau-form-grid-4">
          <Field label="Saldo assumido"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.financiamento.saldo} onChange={(e) => set({ financiamento: { ...v.financiamento, saldo: sanitizeInt(e.target.value) } })} /></Field>
          <Field label="Banco"><input style={inp()} value={v.financiamento.banco} onChange={(e) => set({ financiamento: { ...v.financiamento, banco: e.target.value } })} /></Field>
          <Field label="Parcelas (opcional)"><input style={inp()} value={v.financiamento.parcelas} onChange={(e) => set({ financiamento: { ...v.financiamento, parcelas: e.target.value } })} /></Field>
          <Field label="Valor da parcela (opcional)"><input style={inp()} value={v.financiamento.valorParcela} onChange={(e) => set({ financiamento: { ...v.financiamento, valorParcela: e.target.value } })} /></Field>
        </div>
      )}

      <SectionTitle>Divulgação</SectionTitle>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 6 }}>
        {[["instagramFeed", "Instagram Feed"], ["instagramStories", "Instagram Stories"], ["facebook", "Facebook"], ["marketplace", "Marketplace"], ["outra", "Outra divulgação"]].map(([k, label]) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={v.divulgacao[k]} onChange={(e) => set({ divulgacao: { ...v.divulgacao, [k]: e.target.checked } })} />
            {label}
          </label>
        ))}
      </div>
    </Panel>
  );
}

function TabFotos({ vehicle, patch }) {
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  function addFoto() {
    if (!url.trim()) return;
    patch({ fotos: [...vehicle.fotos, url.trim()] });
    setUrl("");
  }
  function removeFoto(i) {
    const fotos = vehicle.fotos.filter((_, idx) => idx !== i);
    patch({ fotos: fotos.length ? fotos : [CAR_IMG], fotoPrincipal: 0 });
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    setUploadErr("");
    const uploaded = [];
    for (const file of files) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${vehicle.id}/${uid()}.${ext}`;
      const { error } = await supabase.storage.from("veiculos-fotos").upload(path, file);
      if (error) { setUploadErr(error.message); continue; }
      uploaded.push(supabase.storage.from("veiculos-fotos").getPublicUrl(path).data.publicUrl);
    }
    if (uploaded.length) patch({ fotos: [...vehicle.fotos, ...uploaded] });
    setUploading(false);
  }

  return (
    <Panel>
      <SectionTitle>Fotos do veículo</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ ...btnGold(), opacity: uploading ? 0.7 : 1 }}>
          <Upload size={15} /> {uploading ? "Enviando..." : "Enviar do dispositivo"}
        </button>
        <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploading} style={{ ...btnGhost(), opacity: uploading ? 0.7 : 1 }}>
          <Camera size={15} /> Tirar foto
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {uploadErr && <div style={{ color: "#f87171", fontSize: 12.5, marginBottom: 12 }}>{uploadErr}</div>}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="...ou cole a URL de uma imagem" style={inp()} />
        <button onClick={addFoto} style={btnGhost()}><Plus size={15} /> Adicionar link</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }} className="uau-grid-4">
        {vehicle.fotos.map((f, i) => (
          <div key={i} style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: `2px solid ${i === vehicle.fotoPrincipal ? C.goldLight : C.line}` }}>
            <img src={f} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", gap: 4, padding: 6, background: "rgba(10,10,11,.75)" }}>
              <button onClick={() => patch({ fotoPrincipal: i })} style={{ flex: 1, fontSize: 10.5, padding: "5px 4px", borderRadius: 4, border: "none", cursor: "pointer", background: i === vehicle.fotoPrincipal ? C.gold : C.panel2, color: i === vehicle.fotoPrincipal ? "#171208" : C.dim }}>
                {i === vehicle.fotoPrincipal ? "Principal" : "Definir"}
              </button>
              <button onClick={() => removeFoto(i)} style={{ padding: "5px 8px", borderRadius: 4, border: "none", cursor: "pointer", background: C.panel2, color: "#f87171" }}><Trash2 size={11} /></button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TabGastos({ vehicle, patch }) {
  const [form, setForm] = useState({ categoria: CATEGORIAS_GASTO[0], descricao: "", valor: "", data: todayStr(), status: "Pendente", obs: "" });
  function addGasto() {
    if (!form.valor) return;
    const novo = { id: uid(), ...form, valor: +form.valor };
    patch({ gastos: [...vehicle.gastos, novo] }, `Adicionado gasto de ${fmtBRL(+form.valor)} em ${form.categoria}.`);
    setForm({ categoria: CATEGORIAS_GASTO[0], descricao: "", valor: "", data: todayStr(), status: "Pendente", obs: "" });
  }
  function removeGasto(id) {
    patch({ gastos: vehicle.gastos.filter((g) => g.id !== id) });
  }
  return (
    <div>
      <Panel style={{ marginBottom: 18 }}>
        <SectionTitle>Adicionar gasto</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end" }} className="uau-gasto-grid">
          <Field label="Categoria">
            <select style={inp()} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {CATEGORIAS_GASTO.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Descrição"><input style={inp()} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
          <Field label="Valor"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value === "" ? "" : String(sanitizeInt(e.target.value)) })} /></Field>
          <Field label="Data"><input type="date" style={inp()} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
          <Field label="Status">
            <select style={inp()} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Pendente</option><option>Pago</option>
            </select>
          </Field>
          <button onClick={addGasto} style={{ ...btnGold(), height: 40, marginBottom: 14 }}><Plus size={15} /></button>
        </div>
      </Panel>

      <Panel style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.line}` }}>
              {["Categoria", "Descrição", "Valor", "Data", "Status", ""].map((c) => (
                <th key={c} style={{ textAlign: "left", padding: "10px 16px", color: C.dim, fontSize: 11, textTransform: "uppercase" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicle.gastos.map((g) => (
              <tr key={g.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td style={{ padding: "10px 16px" }}>{g.categoria}</td>
                <td style={{ padding: "10px 16px", color: C.dim }}>{g.descricao || "—"}</td>
                <td style={{ padding: "10px 16px", fontWeight: 600 }}>{fmtBRL(g.valor)}</td>
                <td style={{ padding: "10px 16px", color: C.dim }}>{fmtDate(g.data)}</td>
                <td style={{ padding: "10px 16px" }}><Badge color={g.status === "Pago" ? "#4ade80" : "#e0a940"}>{g.status}</Badge></td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                  <button onClick={() => removeGasto(g.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {vehicle.gastos.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.dim }}>Nenhum gasto registrado.</td></tr>}
          </tbody>
          {vehicle.gastos.length > 0 && (
            <tfoot>
              <tr><td colSpan={2} style={{ padding: "12px 16px", fontWeight: 700 }}>Total de gastos</td><td style={{ padding: "12px 16px", fontWeight: 700, color: C.goldLight }}>{fmtBRL(totalGastos(vehicle))}</td><td colSpan={3}></td></tr>
            </tfoot>
          )}
        </table>
      </Panel>
    </div>
  );
}

function TabPrecificacao({ vehicle, patch }) {
  const ct = custoTotal(vehicle);
  const sugerido = precoSugerido(vehicle);
  const lucroEsperado = (vehicle.precoAnunciado || 0) - ct;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="uau-preco-grid">
      <Panel>
        <SectionTitle>Sugestão de preço</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
          <RowKV label="Valor de aquisição" value={fmtBRL(valorEntrada(vehicle))} />
          <RowKV label="Total de gastos" value={fmtBRL(totalGastos(vehicle))} />
          <RowKV label="Custo total" value={fmtBRL(ct)} strong />
          <RowKV label="FIPE" value={fmtBRL(vehicle.fipe)} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button onClick={() => patch({ margemTipo: "percent" })} style={{
            flex: 1, padding: "9px", borderRadius: 6, cursor: "pointer", fontSize: 13,
            border: `1px solid ${vehicle.margemTipo === "percent" ? C.goldLight : C.line}`,
            background: vehicle.margemTipo === "percent" ? "rgba(211,164,75,.1)" : "transparent",
            color: vehicle.margemTipo === "percent" ? C.goldLight : C.dim,
          }}>Margem em %</button>
          <button onClick={() => patch({ margemTipo: "valor" })} style={{
            flex: 1, padding: "9px", borderRadius: 6, cursor: "pointer", fontSize: 13,
            border: `1px solid ${vehicle.margemTipo === "valor" ? C.goldLight : C.line}`,
            background: vehicle.margemTipo === "valor" ? "rgba(211,164,75,.1)" : "transparent",
            color: vehicle.margemTipo === "valor" ? C.goldLight : C.dim,
          }}>Margem em R$</button>
        </div>
        <Field label={vehicle.margemTipo === "percent" ? "Margem desejada (%)" : "Lucro desejado (R$)"}>
          <DecimalField style={inp()} value={vehicle.margemValor} onCommit={(n) => patch({ margemValor: n })} />
        </Field>
        <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "rgba(211,164,75,.1)", border: `1px solid ${C.gold}55` }}>
          <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 4 }}>Preço sugerido</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.goldLight, fontFamily: "'Space Grotesk', sans-serif" }}>{fmtBRL(sugerido)}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>Referência — o preço de anúncio pode ser definido manualmente.</div>
        </div>
      </Panel>
      <Panel>
        <SectionTitle>Preço de anúncio</SectionTitle>
        <Field label="Preço anunciado"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={vehicle.precoAnunciado} onChange={(e) => { const n = sanitizeInt(e.target.value); patch({ precoAnunciado: n }, `Preço alterado para ${fmtBRL(n)}.`); }} /></Field>
        <Field label="Preço mínimo desejado"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={vehicle.precoMinimo} onChange={(e) => patch({ precoMinimo: sanitizeInt(e.target.value) })} /></Field>
        <Field label="FIPE de referência"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={vehicle.fipe} onChange={(e) => patch({ fipe: sanitizeInt(e.target.value) })} /></Field>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
          <RowKV label="Lucro esperado" value={fmtBRL(lucroEsperado)} color={lucroEsperado >= 0 ? "#4ade80" : "#f87171"} strong />
        </div>
      </Panel>
    </div>
  );
}
function RowKV({ label, value, strong, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: color || C.text }}>{value}</span>
    </div>
  );
}

function TabAnotacoes({ vehicle, updateVehicle }) {
  const [texto, setTexto] = useState("");
  function add() {
    if (!texto.trim()) return;
    updateVehicle(vehicle.id, (v) => ({ ...v, anotacoes: [{ id: uid(), texto, data: todayStr(), usuario: "Admin" }, ...v.anotacoes] }));
    setTexto("");
  }
  return (
    <Panel>
      <SectionTitle>Anotações</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex: Trocar dois pneus antes das fotos." style={inp()} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} style={btnGold()}><Plus size={15} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vehicle.anotacoes.map((a) => (
          <div key={a.id} style={{ padding: 14, borderRadius: 6, background: C.panel2, border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 13.5 }}>{a.texto}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>{fmtDate(a.data)} · {a.usuario}</div>
          </div>
        ))}
        {vehicle.anotacoes.length === 0 && <div style={{ color: C.dim, fontSize: 13, textAlign: "center", padding: 20 }}>Nenhuma anotação ainda.</div>}
      </div>
    </Panel>
  );
}

function TabHistorico({ vehicle }) {
  const items = [...vehicle.historico].sort((a, b) => new Date(b.data) - new Date(a.data));
  return (
    <Panel>
      <SectionTitle>Histórico do veículo</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((h, i) => (
          <div key={h.id} style={{ display: "flex", gap: 14, paddingBottom: 18, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: C.goldLight, marginTop: 4 }} />
              {i < items.length - 1 && <div style={{ width: 1, flex: 1, background: C.line, marginTop: 4 }} />}
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: C.dim }}>{fmtDate(h.data)}</div>
              <div style={{ fontSize: 13.5 }}>{h.texto}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---------- CONTATOS ---------- */
function ContatosAdmin({ contacts, vehicles, updateContactStatus, config }) {
  const statusColor = { Novo: "#60a5fa", Contatado: "#e0a940", Finalizado: "#4ade80" };
  return (
    <div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, marginBottom: 4 }}>Contatos</h1>
      <p style={{ color: C.dim, fontSize: 13.5, marginBottom: 22 }}>Interesses recebidos pelo site</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {contacts.map((c) => {
          const v = vehicles.find((x) => x.id === c.veiculoId);
          return (
            <Panel key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{c.nome}</span>
                  <Badge color={statusColor[c.status]}>{c.status}</Badge>
                </div>
                <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>{c.telefone} · {c.email}</div>
                <div style={{ fontSize: 13 }}>Veículo: <strong>{v ? `${v.marca} ${v.modelo}` : "—"}</strong> · Interesse: {c.tipo}</div>
                {c.mensagem && <div style={{ fontSize: 12.5, color: C.dim, marginTop: 4, fontStyle: "italic" }}>"{c.mensagem}"</div>}
                <div style={{ fontSize: 11.5, color: C.dim, marginTop: 4 }}>{fmtDate(c.data)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={c.status} onChange={(e) => updateContactStatus(c.id, e.target.value)} style={{ ...inp(), width: 130 }}>
                  <option>Novo</option><option>Contatado</option><option>Finalizado</option>
                </select>
                <a href={waLink(c.telefone, `Olá ${c.nome}, aqui é da ${config.nome}! Vi seu interesse${v ? ` no ${v.marca} ${v.modelo}` : ""}.`)} target="_blank" rel="noreferrer" style={{ ...btnGold(), padding: "9px 14px" }}>
                  <MessageCircle size={14} /> WhatsApp
                </a>
              </div>
            </Panel>
          );
        })}
        {contacts.length === 0 && <div style={{ color: C.dim, textAlign: "center", padding: 40 }}>Nenhum contato recebido ainda.</div>}
      </div>
    </div>
  );
}

/* ---------- CONFIG ---------- */
function ConfigAdmin({ config, setConfig }) {
  const [form, setForm] = useState(config);
  const [saved, setSaved] = useState(false);
  function save() {
    setConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, marginBottom: 20 }}>Configurações</h1>
      <Panel>
        <SectionTitle>Dados da loja</SectionTitle>
        <Field label="Nome"><input style={inp()} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
        <Field label="WhatsApp"><input style={inp()} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
        <Field label="Telefone"><input style={inp()} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
        <Field label="E-mail"><input style={inp()} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Endereço"><input style={inp()} value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></Field>
        <Field label="Instagram"><input style={inp()} value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></Field>
        <Field label="Horário de funcionamento"><input style={inp()} value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} /></Field>
        <Field label="Margem padrão sugerida (%)"><DecimalField style={inp()} value={form.margemPadrao} onCommit={(n) => setForm({ ...form, margemPadrao: n })} /></Field>
        <button onClick={save} style={{ ...btnGold(), marginTop: 8 }}><Save size={15} /> Salvar alterações</button>
        {saved && <span style={{ marginLeft: 12, color: "#4ade80", fontSize: 13 }}>Salvo!</span>}
      </Panel>
    </div>
  );
}
