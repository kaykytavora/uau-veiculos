import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Routes, Route, Navigate, Link, Outlet,
  useNavigate, useParams, useLocation, useSearchParams,
} from "react-router-dom";
import {
  Car, Search, Menu, X, ChevronLeft, ChevronRight, MessageCircle, Phone,
  Mail, MapPin, Plus, Pencil, Trash2, Lock, LogOut, FileText, Camera,
  ClipboardList, History, Settings, Filter, ArrowUpDown, Archive, CheckCircle2,
  Wallet, TrendingUp, Gauge, Fuel, Cog, Calendar, ShieldCheck, ChevronDown,
  LayoutDashboard, Users, BadgeDollarSign, Clock, Instagram, Facebook, Globe,
  AlertCircle, Save, ArrowRight, Sparkles, Handshake, Headphones, UserCircle,
  Shield, Upload, Video, MoreVertical
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { fipeGetBrands, fipeGetModels, fipeGetYears, fipeGetDetail, parseFipePrice } from "./lib/fipe";
import { brandLogoUrl } from "./lib/motomarks";
import { Card, CardContent } from "@/components/ui/card";
import logoUrl from "./imagens/logo-cropped.png";
import heroBgUrl from "./imagens/backgorund.png";
import ctaBgUrl from "./imagens/background2naoencontrou.png";
import sobreBgUrl from "./imagens/backgorund3.png";

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
// The public site is a hybrid: dark "shell" (header, hero, footer, CTA strips) wrapping light
// content sections (listings, feature grids). Gold stays the one accent in both registers.
const L = {
  bg: "#f6f4ef",
  panel: "#ffffff",
  panel2: "#efece3",
  line: "#e5e0d3",
  text: "#1a1712",
  dim: "#6f6a5c",
};

const fmtBRL = (n) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Compact "R$ 31k" / "230 mil km" style formatting for range-filter option labels.
const fmtPrecoK = (n) => (n >= 1000 ? `R$ ${Math.round(n / 1000)}k` : fmtBRL(n));
const fmtKmK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} mil km` : `${n} km`);
// Evenly-spaced option values between min/max (inclusive) for a min/max range filter — bounds come
// from whatever's actually in stock, not a hardcoded guess at a "typical" price/km/year range.
function rangeSteps(min, max, steps = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return [min].filter(Number.isFinite);
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(Math.round(min + ((max - min) * i) / steps));
  return [...new Set(out)];
}

// "2026-08" -> "agosto de 2026"
function formatMesLabel(ym) {
  const [ano, mes] = ym.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

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
  "Combustível", "Outros",
  // No "Financiamento assumido" here on purpose: that value is already added to custoTotal()
  // automatically from the toggle below, so listing it as a gasto category would double-count it.
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
const HATCH_IMG = "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=900&auto=format&fit=crop";
const PICK_IMG = "https://images.unsplash.com/photo-1571607388263-1044f9ea01dd?q=80&w=900&auto=format&fit=crop";

function defaultCompra() { return { valorPago: 0, dataAquisicao: todayStr(), fornecedor: "" }; }
// comissaoTipo defaults to "valor" (flat R$) — not "percentual" — because this is also the fallback
// merged onto vehicles saved before the %/R$ toggle existed, whose stored `comissao` was always a flat
// R$ amount. Defaulting to "percentual" here would silently reinterpret old commissions as percentages.
function defaultConsignacao() { return { proprietario: "", telefone: "", valorRepasse: 0, comissaoTipo: "valor", comissao: 0, dataEntrada: todayStr(), obs: "" }; }
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
  endereco: "Av. Mateo Bei, 872 — São Paulo, SP",
  instagram: "@uauveiculos.sp",
  horario: "Seg a Sex: 09h–19h · Sáb: 09h–16h · Dom: Fechado",
  margemPadrao: 10,
};

/* ============================================================
   CALC HELPERS
   ============================================================ */
function valorEntrada(v) {
  if (v.origem === "compra") return v.compra.valorPago || 0;
  if (v.origem === "consignacao") {
    // apenas comissão entra como "custo" da loja — quando a comissão é combinada em %, ela incide
    // sobre o valor de repasse definido pelo dono do veículo, não sobre um valor de aquisição fixo.
    const c = v.consignacao;
    if (c.comissaoTipo === "percentual") return (c.valorRepasse || 0) * (c.comissao || 0) / 100;
    return c.comissao || 0;
  }
  if (v.origem === "troca") return v.troca.valorConsiderado || 0;
  return 0;
}
function labelValorEntrada(v) {
  if (v.origem === "consignacao") return "Comissão (custo)";
  if (v.origem === "troca") return "Valor considerado na troca";
  return "Valor de aquisição";
}
function totalGastos(v) {
  return (v.gastos || []).reduce((s, g) => s + (Number(g.valor) || 0), 0);
}
// "Custo" for investment-tracking (Dashboard's "Valor investido", the "Custo total" figure shown in
// the UI) — for consignação this is deliberately just the commission, since the repasse passes
// through to the owner and was never the store's own money. Do NOT use this for pricing/profit math
// below — for that, custoVendaBase() is the right one, since it needs the full repasse.
function custoTotal(v) {
  const financ = v.financiamentoAssumido ? Number(v.financiamento.saldo) || 0 : 0;
  return valorEntrada(v) + totalGastos(v) + financ;
}
// The real floor a sale has to clear before the store makes anything — for consignação that's the
// full repasse combinado com o dono (has to be paid out regardless of the deal's outcome), not just
// the commission. Using custoTotal() here would count the owner's repasse as if it were store
// profit, wildly overstating "Lucro esperado"/"Margem atual" for consigned vehicles.
function custoVendaBase(v) {
  const financ = v.financiamentoAssumido ? Number(v.financiamento.saldo) || 0 : 0;
  if (v.origem === "consignacao") return (v.consignacao.valorRepasse || 0) + totalGastos(v) + financ;
  return custoTotal(v);
}
function comissaoConsignacaoRS(v) {
  const c = v.consignacao;
  if (!c) return 0;
  if (c.comissaoTipo === "percentual") return (c.valorRepasse || 0) * (c.comissao || 0) / 100;
  return c.comissao || 0;
}
function precoSugerido(v) {
  if (v.origem === "consignacao") {
    // a comissão combinada já É o lucro-alvo da loja — o preço sugerido cobre o repasse ao dono,
    // os gastos, e a comissão, sem aplicar uma margem % adicional em cima da comissão.
    return custoVendaBase(v) + comissaoConsignacaoRS(v);
  }
  const c = custoTotal(v);
  if (v.margemTipo === "valor") return c + (Number(v.margemValor) || 0);
  return c * (1 + (Number(v.margemValor) || 0) / 100);
}
function margemPercentReal(v) {
  const c = custoVendaBase(v);
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
  function deleteContact(id) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    supabase.from("contatos").delete().eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao excluir contato:", error.message);
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
          <Route path="/contato" element={<ContatoPage config={config} />} />
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
                deleteContact={deleteContact}
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
  return <img src={logoUrl} alt="UAU Veículos" style={{ height: size, width: "auto", display: "block" }} />;
}
// Brand logo from the Motomarks API. Falls back to a generic car icon when there's no API key
// configured, no usable brand name, or the image 404s (unmapped/misspelled brand) — never shows
// a broken-image glyph.
function BrandLogo({ marca, size = 20, color }) {
  const [failed, setFailed] = useState(false);
  const url = brandLogoUrl(marca);
  if (!url || failed) return <Car size={size} color={color} style={{ flexShrink: 0 }} />;
  return (
    <img
      src={url} alt={marca} width={size} height={size}
      // Motomarks serves a mix of icon-only marks and full lockups (icon + wordmark) on a padded
      // square canvas — a full lockup shrunk to a ~16-30px badge is illegible either way, but
      // cropping into the top of the frame (where the icon mark usually sits, wordmark below)
      // reads far better than squeezing the whole lockup in with objectFit:"contain".
      style={{ objectFit: "cover", objectPosition: "center 25%", display: "block", flexShrink: 0, borderRadius: "inherit" }}
      onError={() => setFailed(true)}
    />
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
    { to: "/contato", label: "Contato", active: (p) => p.startsWith("/contato") },
  ];
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 40, background: C.bg, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ borderBottom: `1px solid ${C.line}` }} className="uau-desktop-nav">
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "8px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: C.dim }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Clock size={12} color={C.goldLight} /> {config.horario}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <a href={`tel:${config.telefone.replace(/\D/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 6, color: C.dim }}><Phone size={12} color={C.goldLight} /> {config.telefone}</a>
            <a href={waLink(config.whatsapp, "Olá! Gostaria de falar com um consultor da " + config.nome + ".")} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: C.dim }}><MessageCircle size={12} color={C.goldLight} /> WhatsApp</a>
          </span>
        </div>
      </div>
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
          <a href={waLink(config.whatsapp, "Olá! Gostaria de falar com um consultor da UAU Veículos.")} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 5, background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: "#171208", fontWeight: 700, fontSize: 13.5 }}>
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>
        <div style={{ display: "none" }} className="uau-mobile-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </div>
      </div>
      {menuOpen && (
        <div className="uau-mobile-menu" style={{ borderTop: `1px solid ${C.line}`, padding: "10px 24px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
          {links.map((l, i) => {
            const isActive = l.active(location.pathname);
            return (
              <Link key={i} to={l.to} onClick={() => setMenuOpen(false)}
                style={{ cursor: "pointer", padding: "10px 4px", fontSize: 15, color: isActive ? C.goldLight : C.text, borderBottom: `1px solid ${C.line}` }}>
                {l.label}
              </Link>
            );
          })}
          <a href={waLink(config.whatsapp, "Olá! Gostaria de falar com um consultor da UAU Veículos.")} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, padding: "12px 18px", borderRadius: 5, background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: "#171208", fontWeight: 700, fontSize: 14 }}>
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>
      )}
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
          <Link to="/contato" style={{ ...flink(), display: "block" }}>Contato</Link>
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
      {/* HERO — dark, full-bleed showroom photo with the negative space reserved for copy */}
      <section className="uau-hero-banner" style={{ position: "relative", minHeight: 480, display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={heroBgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "68% 55%" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(10,10,11,.97) 0%, rgba(10,10,11,.82) 38%, rgba(10,10,11,.35) 68%, rgba(10,10,11,.05) 100%)" }} />
        </div>
        <div className="uau-hero-banner-content" style={{ position: "relative", maxWidth: 1240, margin: "0 auto", padding: "48px 24px", width: "100%" }}>
          <div style={{ maxWidth: 540 }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(30px,4.4vw,48px)", lineHeight: 1.08, marginBottom: 18, color: "#fff" }}>
              Seu próximo carro<br />começa{" "}
              <span style={{ background: `linear-gradient(120deg, ${C.goldLight}, ${C.gold})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>aqui.</span>
            </h1>
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              <div style={{ width: 3, borderRadius: 2, background: `linear-gradient(${C.goldLight}, ${C.gold})`, flexShrink: 0 }} />
              <p style={{ color: "rgba(242,240,234,.8)", fontSize: 15.5, lineHeight: 1.6 }}>
                Veículos selecionados, procedência garantida e atendimento próximo para você fazer a melhor escolha.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/estoque" style={btnGold()}>Ver estoque <ArrowRight size={15} /></Link>
              <a href={waLink(config.whatsapp, "Olá! Gostaria de falar com um consultor da " + config.nome + ".")} target="_blank" rel="noreferrer"
                style={{ ...btnGhost(), color: "#fff", borderColor: "rgba(255,255,255,.32)" }}>
                <MessageCircle size={15} /> Falar com um consultor
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH — dark bar under the hero. Live autocomplete against vehicles already loaded from
          Supabase; brand/category stay as filters on /estoque instead of duplicating them here. */}
      <section style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 24px", display: "flex", gap: 16, alignItems: "end", position: "relative" }} className="uau-search-grid">
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
          <button onClick={irParaEstoque} style={{ ...btnGold(), height: 44, whiteSpace: "nowrap" }}><Search size={15} /> Buscar veículo</button>
        </div>
      </section>

      {/* DESTAQUES — light content section */}
      <section style={{ background: L.bg }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "44px 24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={eyebrow()}>Veículos em destaque</div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, marginTop: 10, color: L.text }}>Os melhores para você</h2>
            </div>
            <Link to="/estoque" style={{ cursor: "pointer", fontSize: 14, color: L.text, border: `1px solid ${L.line}`, padding: "10px 16px", borderRadius: 4, whiteSpace: "nowrap" }}>Ver todos os veículos →</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }} className="uau-grid-4">
            {destaques.map((v) => <VehicleCard key={v.id} v={v} light />)}
          </div>
        </div>
      </section>

      {/* NOSSOS SERVIÇOS — light content section */}
      <section style={{ background: L.bg, borderTop: `1px solid ${L.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 44px" }}>
          <div style={eyebrow()}>Nossos serviços</div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, margin: "8px 0 22px", color: L.text }}>Soluções completas para você</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="uau-grid-3">
            {SERVICOS.map((s) => (
              <div key={s.key} style={{ background: L.panel, border: `1px solid ${L.line}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column" }}>
                <div style={{ width: 36, height: 36, borderRadius: 99, background: "#171208", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: C.goldLight }}>
                  <s.icon size={16} />
                </div>
                <h3 style={{ fontSize: 15.5, marginBottom: 6, color: L.text }}>{s.label}</h3>
                <p style={{ fontSize: 13, color: L.dim, marginBottom: 14, flex: 1 }}>{s.desc}</p>
                <button onClick={() => setModalServico(s)} style={{ justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 5, background: "transparent", color: L.text, fontWeight: 600, fontSize: 13.5, border: `1px solid ${L.line}`, cursor: "pointer" }}>{s.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {modalServico && (
        <ServicoFormModal servico={modalServico} vehicles={vehicles} addContact={addContact} onClose={() => setModalServico(null)} />
      )}

      {/* WHY US — light content section, black circular icon badges */}
      <section style={{ background: L.bg, borderTop: `1px solid ${L.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px 48px", textAlign: "center" }}>
          <div style={{ ...eyebrow(), justifyContent: "center" }}>Por que escolher a {config.nome}?</div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(22px,2.8vw,28px)", margin: "10px auto 22px", maxWidth: 560, color: L.text }}>
            Segurança, qualidade e confiança.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }} className="uau-grid-4">
            {[
              { icon: Shield, t: "Procedência", d: "Todos os veículos passam por análise rigorosa e têm procedência garantida." },
              { icon: UserCircle, t: "Atendimento personalizado", d: "Nossa equipe está pronta para ouvir você e encontrar o carro ideal." },
              { icon: Wallet, t: "Compra facilitada", d: "Oferecemos as melhores condições de pagamento e financiamento." },
              { icon: ShieldCheck, t: "Veículos selecionados", d: "Selecionamos os melhores veículos para entregar mais qualidade a você." },
            ].map((f, i) => (
              <div key={i} style={{ background: L.panel, border: `1px solid ${L.line}`, borderRadius: 8, padding: "20px 16px" }}>
                <div style={{ width: 36, height: 36, borderRadius: 99, background: "#171208", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: C.goldLight, marginLeft: "auto", marginRight: "auto" }}>
                  <f.icon size={16} />
                </div>
                <h3 style={{ fontSize: 14.5, marginBottom: 6, color: L.text }}>{f.t}</h3>
                <p style={{ fontSize: 12.5, color: L.dim, lineHeight: 1.5 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DARK CTA STRIP */}
      <section className="uau-cta-banner" style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={ctaBgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(10,10,11,.7) 0%, rgba(10,10,11,.35) 55%, rgba(10,10,11,.75) 100%)" }} />
        </div>
        <div className="uau-cta-banner-content uau-sell-grid" style={{ position: "relative", maxWidth: 1240, margin: "0 auto", padding: "44px 24px", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 40, alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(22px,2.6vw,28px)", lineHeight: 1.25, marginBottom: 6, color: "#fff" }}>
              Não encontrou o carro que procura?<br />
              <span style={{ color: C.goldLight }}>Fale com a gente.</span>
            </h2>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,.25)" }} className="uau-desktop-nav" />
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <p style={{ color: "rgba(242,240,234,.8)", fontSize: 14, maxWidth: 300 }}>Nosso time pode encontrar o veículo ideal para você, com segurança e transparência.</p>
            <a href={waLink(config.whatsapp, "Olá! Estou procurando um veículo específico, vocês podem me ajudar?")} target="_blank" rel="noreferrer" style={{ ...btnGold(), whiteSpace: "nowrap" }}>
              <MessageCircle size={15} /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* SOBRE — light/dark split photo carries the section's own background */}
      <section className="uau-sobre-banner" style={{ position: "relative", minHeight: 360, display: "flex", alignItems: "center", overflow: "hidden", background: L.bg }}>
        <img src={sobreBgUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "left center" }} />
        <div className="uau-sobre-banner-content" style={{ position: "relative", maxWidth: 1240, margin: "0 auto", padding: "44px 24px", width: "100%" }}>
          <div style={{ maxWidth: 440 }}>
            <div style={eyebrow()}>Sobre a {config.nome}</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px,3vw,32px)", margin: "14px 0 16px", color: L.text }}>
              Referência em veículos seminovos com procedência garantida.
            </h2>
            <p style={{ color: L.dim, fontSize: 14.5, lineHeight: 1.7 }}>
              Cada veículo do nosso estoque passa por uma avaliação criteriosa antes de chegar até você.
              Trabalhamos com transparência do primeiro contato à entrega das chaves — para que comprar
              ou vender seu carro seja simples, seguro e sem surpresas.
            </p>
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
              <div>
                <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 6 }}>Busque seu carro na tabela FIPE (preenche os campos abaixo automaticamente)</div>
                <FipeSelector compact onSelect={({ marca, modelo, anoFab }) => setForm((f) => ({ ...f, marca, modelo, anoFab: String(anoFab) }))} />
              </div>
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

/* ============================================================
   FIPE — cascading Marca > Modelo > Ano select, backed by fipe.api.br.
   Fetches lazily at each step; on picking a year it also pulls the FIPE price and
   reports { marca, modelo, versao, anoFab, fipeValor, combustivel } via onSelect.
   ============================================================ */
// The Fipe API doesn't return door count or transmission as separate fields — but Brazilian FIPE
// model names conventionally spell the door count out (e.g. "...16V 3P", "...FLEXPOWER 5P") and
// flag automatic transmission explicitly (e.g. "Aut.", "CVT") when it's not the plain/manual trim.
// Parsing these out of the model text beats silently defaulting every new vehicle to "4 portas,
// Automática" regardless of what it actually is.
function inferPortasFromFipeText(text) {
  const m = String(text || "").match(/(\d)\s*p\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 2 && n <= 5 ? n : null;
}
function inferCambioFromFipeText(text) {
  return /\baut\.?(om[aá]tic[oa])?\b|\bcvt\b|\btiptronic\b|\bautomatizad[oa]\b/i.test(String(text || "")) ? "Automática" : "Manual";
}
function FipeSelector({ onSelect, compact }) {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [brandCode, setBrandCode] = useState("");
  const [modelCode, setModelCode] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [modelFocused, setModelFocused] = useState(false);
  const [yearCode, setYearCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setErr("");
    fipeGetBrands()
      .then(setBrands)
      .catch(() => setErr("Não deu pra carregar as marcas da FIPE agora."))
      .finally(() => setLoading(false));
  }, []);

  function pickBrand(code) {
    setBrandCode(code);
    setModels([]); setModelCode(""); setModelQuery("");
    setYears([]); setYearCode("");
    setApplied(false);
    if (!code) return;
    setLoading(true);
    setErr("");
    fipeGetModels(code)
      .then(setModels)
      .catch(() => setErr("Não deu pra carregar os modelos dessa marca."))
      .finally(() => setLoading(false));
  }

  function pickModel(m) {
    setModelCode(m.code);
    setModelQuery(m.name);
    setModelFocused(false);
    setYears([]); setYearCode("");
    setApplied(false);
    setLoading(true);
    setErr("");
    fipeGetYears(brandCode, m.code)
      .then(setYears)
      .catch(() => setErr("Não deu pra carregar os anos desse modelo."))
      .finally(() => setLoading(false));
  }

  async function pickYear(code) {
    setYearCode(code);
    if (!code) return;
    setLoading(true);
    setErr("");
    try {
      const detail = await fipeGetDetail(brandCode, modelCode, code);
      onSelect({
        marca: detail.brand,
        modelo: detail.model,
        versao: detail.model,
        anoFab: detail.modelYear && detail.modelYear < 32000 ? detail.modelYear : new Date().getFullYear(),
        fipeValor: parseFipePrice(detail.price),
        combustivel: detail.fuel,
      });
      setApplied(true);
    } catch {
      setErr("Não deu pra buscar o valor FIPE agora. Você ainda pode preencher os campos manualmente.");
    } finally {
      setLoading(false);
    }
  }

  const selStyle = compact ? { ...inp(), fontSize: 13 } : inp();
  const selectedBrand = brands.find((b) => b.code === brandCode);
  const modelQueryLower = modelQuery.trim().toLowerCase();
  const modelosFiltrados = modelQueryLower
    ? models.filter((m) => m.name.toLowerCase().includes(modelQueryLower))
    : models;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }} className="uau-form-grid-3">
        <div>
          {!compact && <label style={lbl()}>1. Marca</label>}
          <div style={{ position: "relative" }}>
            {selectedBrand && (
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
                <BrandLogo marca={selectedBrand.name} size={15} color={C.dim} />
              </span>
            )}
            <select value={brandCode} onChange={(e) => pickBrand(e.target.value)} style={selectedBrand ? { ...selStyle, paddingLeft: 32 } : selStyle}>
              <option value="">{compact ? "Marca (FIPE)" : "Selecione a marca"}</option>
              {brands.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          {!compact && <label style={lbl()}>2. Modelo</label>}
          <div style={{ position: "relative" }}>
            <Search size={14} color={C.dim} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={modelQuery}
              disabled={!brandCode}
              onFocus={() => setModelFocused(true)}
              onBlur={() => setTimeout(() => setModelFocused(false), 150)}
              onChange={(e) => { setModelQuery(e.target.value); setModelCode(""); setApplied(false); }}
              placeholder={brandCode ? "Buscar modelo..." : "Selecione a marca antes"}
              style={{ ...selStyle, paddingLeft: 32 }}
            />
            {modelFocused && brandCode && modelosFiltrados.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", zIndex: 20, maxHeight: 260, overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,.5)" }}>
                {modelosFiltrados.slice(0, 40).map((m) => (
                  <div key={m.code} onMouseDown={() => pickModel(m)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", cursor: "pointer", fontSize: 13 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.panel)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <span>{m.name}</span>
                    {modelCode === m.code && <CheckCircle2 size={13} color={C.goldLight} style={{ flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          {!compact && <label style={lbl()}>3. Ano</label>}
          <select value={yearCode} onChange={(e) => pickYear(e.target.value)} disabled={!modelCode} style={selStyle}>
            <option value="">{compact ? "Ano" : "Selecione o ano"}</option>
            {years.map((y) => <option key={y.code} value={y.code}>{y.name}</option>)}
          </select>
        </div>
      </div>
      {loading && <div style={{ fontSize: 11.5, color: C.dim, marginTop: 8 }}>Carregando...</div>}
      {err && <div style={{ fontSize: 11.5, color: "#f87171", marginTop: 8 }}>{err}</div>}
      {!compact && applied && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 14px", borderRadius: 6, background: "rgba(74,222,128,.1)", border: "1px solid #4ade8055", fontSize: 12.5, color: "#4ade80" }}>
          <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
          Dados preenchidos pela FIPE — você pode editar qualquer campo se necessário.
        </div>
      )}
      {!compact && !applied && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, fontSize: 11.5, color: C.dim, alignItems: "flex-start" }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          Selecionamos os dados da tabela FIPE e preenchemos automaticamente marca, versão, ano, portas, câmbio e combustível.
        </div>
      )}
    </div>
  );
}

function VehicleCard({ v, light }) {
  const T = light ? L : C;
  const goldAccent = light ? C.gold : C.goldLight;
  return (
    <Link to={vehiclePath(v)} style={{ display: "block", textDecoration: "none", color: "inherit", background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = goldAccent)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.line)}>
      <div style={{ position: "relative", aspectRatio: "4/3", background: T.panel2 }}>
        <img src={v.fotos[v.fotoPrincipal] || v.fotos[0]} alt={v.modelo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: T.text }}>{v.marca} {v.modelo}</div>
        <div style={{ fontSize: 12, color: T.dim, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10, minHeight: 30 }}>{v.versao}</div>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: T.dim, marginBottom: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{v.anoFab}/{v.anoModelo}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Gauge size={12} />{v.km.toLocaleString("pt-BR")} km</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: goldAccent }}>{fmtBRL(v.precoAnunciado)}</div>
          <ArrowRight size={15} color={T.dim} />
        </div>
      </div>
    </Link>
  );
}

const FILTROS_VAZIOS = { marca: "Todas", combustivel: "Todos", cambio: "Todos", anoMin: "", anoMax: "", precoMin: "", precoMax: "", kmMin: "", kmMax: "" };

function EstoquePage({ vehicles }) {
  const [searchParams] = useSearchParams();
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [busca, setBusca] = useState(searchParams.get("q") || "");
  const [ordenar, setOrdenar] = useState("recentes");
  const [marcasExpandidas, setMarcasExpandidas] = useState(false);

  const marcas = Array.from(new Set(vehicles.map((v) => v.marca))).map(String);
  const marcasVisiveis = marcasExpandidas ? marcas : marcas.slice(0, 9);

  // Faixas vêm do estoque real (não de um "range típico" chutado), e ficam fixas mesmo enquanto
  // outros filtros reduzem a lista — senão as opções de Ano/Preço/Km ficariam pulando a cada clique.
  const anos = vehicles.map((v) => v.anoFab).filter(Boolean);
  const precos = vehicles.map((v) => v.precoAnunciado).filter((p) => p > 0);
  const kms = vehicles.map((v) => v.km).filter((k) => k >= 0);
  const anoSteps = rangeSteps(anos.length ? Math.min(...anos) : new Date().getFullYear(), anos.length ? Math.max(...anos) : new Date().getFullYear(), 6);
  const precoSteps = rangeSteps(precos.length ? Math.min(...precos) : 0, precos.length ? Math.max(...precos) : 0, 6);
  const kmSteps = rangeSteps(kms.length ? Math.min(...kms) : 0, kms.length ? Math.max(...kms) : 0, 6);

  const filtrosAtivos = Object.keys(FILTROS_VAZIOS).filter((k) => filtros[k] !== FILTROS_VAZIOS[k]).length + (busca ? 1 : 0);

  let list = vehicles.filter((v) => {
    if (filtros.marca !== "Todas" && v.marca !== filtros.marca) return false;
    if (filtros.combustivel !== "Todos" && v.combustivel !== filtros.combustivel) return false;
    if (filtros.cambio !== "Todos" && v.cambio !== filtros.cambio) return false;
    if (filtros.anoMin !== "" && v.anoFab < Number(filtros.anoMin)) return false;
    if (filtros.anoMax !== "" && v.anoFab > Number(filtros.anoMax)) return false;
    if (filtros.precoMin !== "" && v.precoAnunciado < Number(filtros.precoMin)) return false;
    if (filtros.precoMax !== "" && v.precoAnunciado > Number(filtros.precoMax)) return false;
    if (filtros.kmMin !== "" && v.km < Number(filtros.kmMin)) return false;
    if (filtros.kmMax !== "" && v.km > Number(filtros.kmMax)) return false;
    if (busca && !(`${v.marca} ${v.modelo} ${v.versao}`.toLowerCase().includes(busca.toLowerCase()))) return false;
    return true;
  });
  if (ordenar === "menorPreco") list = [...list].sort((a, b) => a.precoAnunciado - b.precoAnunciado);
  if (ordenar === "maiorPreco") list = [...list].sort((a, b) => b.precoAnunciado - a.precoAnunciado);
  if (ordenar === "menorKm") list = [...list].sort((a, b) => a.km - b.km);
  if (ordenar === "recentes") list = [...list].sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));

  function setFiltro(k, v) { setFiltros((f) => ({ ...f, [k]: v })); }
  function limparFiltros() { setFiltros(FILTROS_VAZIOS); setBusca(""); }

  return (
    <div style={{ background: L.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 100px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 32 }} className="uau-estoque-grid">
          <aside>
            <div style={{ background: L.panel, border: `1px solid ${L.line}`, borderRadius: 8, padding: 20, position: "sticky", top: 90 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: L.text }}><Filter size={15} color={C.gold} /> Filtros</div>
                  {filtrosAtivos > 0 && <div style={{ fontSize: 11.5, color: L.dim, marginTop: 2 }}>{filtrosAtivos} ativo{filtrosAtivos > 1 ? "s" : ""}</div>}
                </div>
                {filtrosAtivos > 0 && (
                  <button type="button" onClick={limparFiltros} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.gold, fontSize: 12.5, cursor: "pointer", padding: 0 }}>
                    <X size={12} /> Limpar
                  </button>
                )}
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={lblLight()}>Buscar</label>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Marca, modelo, versão..." style={inpLight()} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={lblLight()}>Marca</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {marcasVisiveis.map((m) => {
                    const active = filtros.marca === m;
                    return (
                      <button
                        key={m} type="button" onClick={() => setFiltro("marca", active ? "Todas" : m)}
                        title={m}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 6px",
                          borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${active ? C.gold : L.line}`,
                          background: active ? "rgba(211,164,75,.08)" : L.bg,
                        }}
                      >
                        <span style={{ width: 44, height: 44, borderRadius: 99, background: "#fff", border: `1px solid ${L.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                          <BrandLogo marca={m} size={30} color="#171208" />
                        </span>
                        <span style={{ fontSize: 10, color: active ? C.gold : L.dim, textAlign: "center", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{m.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
                {marcas.length > 9 && (
                  <button type="button" onClick={() => setMarcasExpandidas(!marcasExpandidas)} style={{ width: "100%", marginTop: 10, padding: "8px", borderRadius: 6, border: `1px solid ${L.line}`, background: "transparent", color: L.text, fontSize: 12, cursor: "pointer" }}>
                    {marcasExpandidas ? "Ver menos marcas" : "Ver todas as marcas"}
                  </button>
                )}
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={lblLight()}>Ano</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <LightSelect value={filtros.anoMin} onChange={(v) => setFiltro("anoMin", v)} style={{ fontSize: 12.5 }}
                    options={[{ value: "", label: "Ano mínimo" }, ...anoSteps.map((a) => ({ value: a, label: a }))]} />
                  <LightSelect value={filtros.anoMax} onChange={(v) => setFiltro("anoMax", v)} style={{ fontSize: 12.5 }}
                    options={[{ value: "", label: "Ano máximo" }, ...anoSteps.map((a) => ({ value: a, label: a }))]} />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={lblLight()}>Preço</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <LightSelect value={filtros.precoMin} onChange={(v) => setFiltro("precoMin", v)} style={{ fontSize: 12.5 }}
                    options={[{ value: "", label: "Preço mínimo" }, ...precoSteps.map((p) => ({ value: p, label: fmtPrecoK(p) }))]} />
                  <LightSelect value={filtros.precoMax} onChange={(v) => setFiltro("precoMax", v)} style={{ fontSize: 12.5 }}
                    options={[{ value: "", label: "Preço máximo" }, ...precoSteps.map((p) => ({ value: p, label: fmtPrecoK(p) }))]} />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={lblLight()}>Quilometragem</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <LightSelect value={filtros.kmMin} onChange={(v) => setFiltro("kmMin", v)} style={{ fontSize: 12.5 }}
                    options={[{ value: "", label: "Km mínimo" }, ...kmSteps.map((k) => ({ value: k, label: fmtKmK(k) }))]} />
                  <LightSelect value={filtros.kmMax} onChange={(v) => setFiltro("kmMax", v)} style={{ fontSize: 12.5 }}
                    options={[{ value: "", label: "Km máximo" }, ...kmSteps.map((k) => ({ value: k, label: fmtKmK(k) }))]} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={lblLight()}>Combustível</label>
                <LightSelect value={filtros.combustivel} onChange={(v) => setFiltro("combustivel", v)}
                  options={["Todos", "Flex", "Gasolina", "Híbrido", "Diesel"].map((o) => ({ value: o, label: o }))} />
              </div>
              <div>
                <label style={lblLight()}>Câmbio</label>
                <LightSelect value={filtros.cambio} onChange={(v) => setFiltro("cambio", v)}
                  options={["Todos", "Manual", "Automática"].map((o) => ({ value: o, label: o }))} />
              </div>
            </div>
          </aside>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div style={{ color: L.dim, fontSize: 14 }}>{list.length} veículos encontrados</div>
              <div style={{ width: 200 }}>
                <LightSelect value={ordenar} onChange={setOrdenar} options={[
                  { value: "recentes", label: "Mais recentes" },
                  { value: "menorPreco", label: "Menor preço" },
                  { value: "maiorPreco", label: "Maior preço" },
                  { value: "menorKm", label: "Menor quilometragem" },
                ]} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="uau-grid-3">
              {list.map((v) => <VehicleCard key={v.id} v={v} light />)}
              {list.length === 0 && <div style={{ color: L.dim, gridColumn: "1/-1", padding: 40, textAlign: "center" }}>Nenhum veículo encontrado com esses filtros.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContatoPage({ config }) {
  const mapQuery = encodeURIComponent(config.endereco);
  const mapEmbedUrl = `https://maps.google.com/maps?q=${mapQuery}&z=15&output=embed`;
  const horarios = config.horario.split("·").map((s) => s.trim());
  const whatsMsg = "Olá! Gostaria de falar com um consultor da " + config.nome + ".";

  return (
    <div style={{ background: L.bg }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 24px 0" }}>
        <div style={{ fontSize: 13, color: L.dim }}>
          <Link to="/inicio" style={{ cursor: "pointer" }}>Início</Link> / Contato
        </div>
      </div>

      {/* HERO */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 24px 50px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 40, alignItems: "center" }} className="uau-contato-hero">
        <div>
          <div style={eyebrow()}>Fale com a gente</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(30px,4vw,44px)", margin: "14px 0 16px", lineHeight: 1.1, color: L.text }}>
            Entre em contato com a{" "}
            <span style={{ background: `linear-gradient(120deg, ${C.goldLight}, ${C.gold})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{config.nome}</span>
          </h1>
          <p style={{ color: L.dim, fontSize: 15.5, maxWidth: 440 }}>
            Atendimento próximo, transparência e a experiência certa para você encontrar seu próximo veículo.
          </p>
        </div>
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${L.line}`, aspectRatio: "16/10" }}>
          <img src={heroBgUrl} alt={config.nome} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "70% 55%" }} />
          <a href={waLink(config.whatsapp, whatsMsg)} target="_blank" rel="noreferrer"
            style={{ position: "absolute", bottom: 16, left: 16, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 6, background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: "#171208", fontWeight: 700, fontSize: 13.5 }}>
            <MessageCircle size={15} /> Falar no WhatsApp
          </a>
        </div>
      </section>

      {/* MAP + CONTACT CARDS */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px 24px" }}>
        <div style={{ background: L.panel, border: `1px solid ${L.line}`, borderRadius: 10, padding: 20, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }} className="uau-contato-grid">
          <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${L.line}`, minHeight: 320 }}>
            <iframe
              title="Mapa" src={mapEmbedUrl} width="100%" height="100%" loading="lazy"
              style={{ border: 0, minHeight: 320, display: "block" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="uau-contato-cards">
            <ContatoCard icon={Phone} label="Telefone" value={config.telefone} action={{ label: "Ligar agora", href: `tel:${config.telefone.replace(/\D/g, "")}` }} />
            <ContatoCard icon={MessageCircle} label="WhatsApp" value={config.whatsapp} action={{ label: "Falar no WhatsApp", href: waLink(config.whatsapp, whatsMsg), external: true }} highlight />
            <ContatoCard icon={Mail} label="E-mail" value={config.email} action={{ label: "Enviar e-mail", href: `mailto:${config.email}` }} />
            <ContatoCard icon={MapPin} label="Endereço" value={config.endereco} action={{ label: "Como chegar", href: `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`, external: true }} />
          </div>
        </div>

        <div style={{ background: L.panel, border: `1px solid ${L.line}`, borderRadius: 10, padding: 24, marginTop: 20, maxWidth: 460 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontWeight: 600, fontSize: 15, color: L.text }}>
            <Clock size={16} color={C.gold} /> Horário de atendimento
          </div>
          {horarios.map((h, i) => {
            const idx = h.indexOf(":");
            const dia = idx === -1 ? h : h.slice(0, idx).trim();
            const hora = idx === -1 ? "" : h.slice(idx + 1).trim();
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: i > 0 ? `1px solid ${L.line}` : "none", fontSize: 13.5 }}>
                <span style={{ color: L.dim }}>{dia}</span>
                <span style={{ fontWeight: 600, color: L.text }}>{hora}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* CONVERSE DO SEU JEITO */}
      <section style={{ background: L.panel2, borderTop: `1px solid ${L.line}`, borderBottom: `1px solid ${L.line}`, padding: "60px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, marginBottom: 10, color: L.text }}>Converse com a {config.nome} do seu jeito</h2>
          <p style={{ color: L.dim, fontSize: 14.5, marginBottom: 26 }}>Escolha o canal mais fácil pra você — respondemos rápido em todos.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={`https://instagram.com/${(config.instagram || "").replace("@", "")}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 5, background: "transparent", color: L.text, fontWeight: 600, fontSize: 14, border: `1px solid ${L.line}`, cursor: "pointer" }}><Instagram size={15} /> Instagram</a>
            <a href={waLink(config.whatsapp, whatsMsg)} target="_blank" rel="noreferrer" style={{ ...btnGold(), padding: "10px 18px" }}><MessageCircle size={15} /> WhatsApp</a>
            <a href={`mailto:${config.email}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 5, background: "transparent", color: L.text, fontWeight: 600, fontSize: 14, border: `1px solid ${L.line}`, cursor: "pointer" }}><Mail size={15} /> E-mail</a>
          </div>
        </div>
      </section>

      {/* CTA BANNER — dark, reuses hero photo treatment for contrast against the light page */}
      <section style={{ maxWidth: 1240, margin: "60px auto", padding: "0 24px" }}>
        <div className="uau-cta-banner-content" style={{ position: "relative", borderRadius: 10, padding: "50px 40px", textAlign: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <img src={heroBgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%" }} />
            <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,11,.88)" }} />
          </div>
          <div style={{ position: "relative" }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, marginBottom: 10, color: "#fff" }}>Quer atendimento rápido?</h2>
            <p style={{ color: "rgba(242,240,234,.75)", fontSize: 14.5, marginBottom: 26 }}>Fale agora com a nossa equipe e encontre o veículo ideal para você.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/estoque" style={btnGold()}>Ver estoque <ArrowRight size={15} /></Link>
              <a href={waLink(config.whatsapp, whatsMsg)} target="_blank" rel="noreferrer" style={{ ...btnGhost(), color: "#fff", borderColor: "rgba(255,255,255,.32)" }}>Falar no WhatsApp</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContatoCard({ icon: Icon, label, value, action, highlight }) {
  return (
    <div style={{ background: L.panel2, border: `1px solid ${L.line}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.gold }}>
        <Icon size={16} />
        <span style={{ fontSize: 13, fontWeight: 600, color: L.text }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: L.dim, minHeight: 32 }}>{value}</div>
      <a
        href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined}
        style={{
          textAlign: "center", padding: "8px 10px", borderRadius: 5, fontSize: 12.5, fontWeight: 600, marginTop: "auto",
          background: highlight ? `linear-gradient(135deg, ${C.goldLight}, ${C.gold})` : L.panel,
          color: highlight ? "#171208" : L.text,
          border: highlight ? "none" : `1px solid ${L.line}`,
        }}
      >
        {action.label}
      </a>
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

  if (!vehicle) return <div style={{ padding: 80, textAlign: "center", color: L.dim, background: L.bg }}>Veículo não encontrado. <Link to="/estoque" style={{ color: C.gold, cursor: "pointer" }}>Voltar ao estoque</Link></div>;

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
    <div style={{ background: L.bg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 24px 100px", color: L.text }}>
        <div style={{ fontSize: 13, color: L.dim, marginBottom: 20 }}>
          <Link to="/inicio" style={{ cursor: "pointer" }}>Início</Link> / <Link to="/estoque" style={{ cursor: "pointer" }}>Estoque</Link> / {vehicle.marca} {vehicle.modelo}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 32 }} className="uau-detail-grid">
          <div>
            <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${L.line}`, aspectRatio: "4/3", position: "relative" }}>
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
                  <div key={i} onClick={() => setPhotoIdx(i)} style={{ width: 64, height: 48, borderRadius: 4, overflow: "hidden", border: `2px solid ${i === photoIdx ? C.gold : L.line}`, cursor: "pointer" }}>
                    <img src={f} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: L.panel, border: `1px solid ${L.line}`, borderRadius: 8, padding: 22, marginTop: 24, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }} className="uau-grid-3">
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
                <p style={{ color: L.dim, fontSize: 14.5, lineHeight: 1.7 }}>{vehicle.descricao}</p>
              </div>
            )}
            {vehicle.opcionais.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 16, marginBottom: 14 }}>Itens do veículo</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px 18px" }} className="uau-grid-3">
                  {vehicle.opcionais.map((o, i) => (
                    <span key={i} style={{ fontSize: 13.5, color: L.text }}>{o}</span>
                  ))}
                </div>
              </div>
            )}

            {vehicle.fipe > 0 && (
              <div style={{ marginTop: 24, background: L.panel2, border: `1px solid ${L.line}`, borderRadius: 8, padding: 22 }}>
                <div style={{ fontSize: 12, color: L.dim, marginBottom: 18 }}>Compare os preços</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="uau-grid-2">
                  <div>
                    <div style={{ fontSize: 11.5, color: L.dim, marginBottom: 6 }}>Valor anunciado ({config.nome})</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: L.text }}>{fmtBRL(vehicle.precoAnunciado)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: L.dim, marginBottom: 6 }}>Tabela FIPE</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: C.gold }}>{fmtBRL(vehicle.fipe)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BrandLogo marca={vehicle.marca} size={18} color={C.gold} />
              <div style={{ fontSize: 12, color: C.gold, fontFamily: "'JetBrains Mono', monospace", letterSpacing: ".08em", textTransform: "uppercase" }}>{vehicle.marca}</div>
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, margin: "6px 0" }}>{vehicle.modelo}</h1>
            <div style={{ color: L.dim, fontSize: 14, marginBottom: 14 }}>{vehicle.versao}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 30, color: C.gold, marginBottom: 20 }}>{fmtBRL(vehicle.precoAnunciado)}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              <a href={waLink(config.whatsapp, msg)} target="_blank" rel="noreferrer" style={{ ...btnGold(), justifyContent: "center" }}>
                <MessageCircle size={16} /> Falar sobre este veículo no WhatsApp
              </a>
            </div>

            <div style={{ background: L.panel, border: `1px solid ${L.line}`, borderRadius: 8, padding: 22 }}>
              <h3 style={{ fontSize: 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><FileText size={15} color={C.gold} /> Tenho interesse</h3>
              {sent ? (
                <div style={{ color: "#15803d", fontSize: 14, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle2 size={18} /> Recebemos seu contato! Em breve falaremos com você.</div>
              ) : (
                <form onSubmit={submitForm} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" style={inpLight()} />
                  <input required value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="WhatsApp / Telefone" style={inpLight()} />
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail" style={inpLight()} />
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={inpLight()}>
                    <option>Quero mais informações</option>
                    <option>Quero financiar</option>
                    <option>Quero negociar</option>
                    <option>Quero dar meu veículo na troca</option>
                  </select>
                  {sendErr && <div style={{ color: "#dc2626", fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={14} />{sendErr}</div>}
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
              {related.map((v) => <VehicleCard key={v.id} v={v} light />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function Spec({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icon size={16} color={C.gold} style={{ marginTop: 2 }} />
      <div>
        <div style={{ fontSize: 11.5, color: L.dim }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: L.text }}>{value}</div>
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
function lblLight() { return { display: "block", fontSize: 11.5, color: L.dim, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }; }
function inpLight() { return { width: "100%", background: L.bg, border: `1px solid ${L.line}`, color: L.text, padding: "10px 12px", borderRadius: 5, fontSize: 13.5 }; }
function btnGold() { return { display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 5, background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: "#171208", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }; }
function btnGhost() { return { display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 5, background: "transparent", color: C.text, fontWeight: 600, fontSize: 14, border: `1px solid ${C.line}`, cursor: "pointer" }; }
function eyebrow() { return { display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, letterSpacing: ".14em", textTransform: "uppercase", color: C.goldLight }; }

// Custom-styled dropdown for the light/public pages — a native <select>'s popup is drawn by the OS,
// so no amount of CSS on the trigger fixes how jarring the plain white/blue system list looks against
// this theme. Same open/close/outside-click pattern as FipeSelector's model search, just without the
// search input. `options` is [{ value, label }] and should include the placeholder as its own entry
// (value: "") if one is wanted, same as a plain <option value="">...</option> would be.
function LightSelect({ value, onChange, options, style }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
  const selected = options.find((o) => String(o.value) === String(value));
  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        style={{ ...inpLight(), ...style, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ color: selected && selected.value !== "" ? L.text : L.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.label : ""}
        </span>
        <ChevronDown size={14} color={L.dim} style={{ flexShrink: 0, transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${L.line}`, borderRadius: 8, overflow: "hidden", zIndex: 30, maxHeight: 240, overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,.15)" }}>
          {options.map((o) => {
            const active = String(o.value) === String(value);
            return (
              <div
                key={o.value === "" ? "__blank" : o.value}
                onMouseDown={() => { onChange(String(o.value)); setOpen(false); }}
                style={{ padding: "9px 12px", fontSize: 13, cursor: "pointer", color: active ? C.gold : L.text, background: active ? "rgba(211,164,75,.08)" : "transparent", fontWeight: active ? 600 : 400 }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = L.panel2; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
function AdminPanel({ vehicles, contacts, config, setConfig, updateVehicle, addVehicle, deleteVehicle, updateContactStatus, deleteContact, onLogout }) {
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
          <Route path="estoque" element={<EstoqueAdmin vehicles={vehicles} onOpen={openVehicle} onNew={() => navigate("/admin/veiculo/novo")} />} />
          <Route path="vendidos" element={<VendidosAdmin vehicles={vehicles} onOpen={openVehicle} onDelete={deleteVehicle} />} />
          <Route path="veiculo/novo" element={<NovoVeiculoForm addVehicle={addVehicle} />} />
          <Route path="veiculo/:id" element={<VehicleAdmin vehicles={vehicles} updateVehicle={updateVehicle} />} />
          <Route path="contatos" element={<ContatosAdmin contacts={contacts} vehicles={vehicles} updateContactStatus={updateContactStatus} deleteContact={deleteContact} config={config} />} />
          <Route path="config" element={<ConfigAdmin config={config} setConfig={setConfig} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// Admin stat cards (Visão Geral, Contatos, Vendidos) run on the real shadcn/ui Card primitives —
// the rest of the app stays inline-styled, this is deliberately scoped to just these cards.
// Colors come through as inline style overrides (they always win over Tailwind classes) so this
// still matches the UAU brand tokens instead of shadcn's default gray theme.
function StatCard({ icon: Icon, label, value, sub, subColor, highlight, iconColor }) {
  const badgeBg = iconColor ? iconColor + "22" : "rgba(211,164,75,.14)";
  const badgeColor = iconColor || C.goldLight;
  return (
    <Card
      className="rounded-lg border shadow-none ring-0 gap-0 py-0"
      style={{ background: highlight ? "rgba(211,164,75,.08)" : C.panel, borderColor: highlight ? C.gold + "66" : C.line }}
    >
      <CardContent className="px-[18px] py-[18px]">
        <div style={{ width: 34, height: 34, borderRadius: 7, background: badgeBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: badgeColor }}>
          <Icon size={17} />
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 21, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: C.text }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: subColor || C.dim, marginTop: 4 }}>{sub}</div>}
      </CardContent>
    </Card>
  );
}
// Small "..." action menu — closes on outside click.
function DropdownMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", padding: 6, display: "flex", borderRadius: 6 }}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", zIndex: 30, minWidth: 210, boxShadow: "0 20px 40px rgba(0,0,0,.5)" }}>
          {items.map((it, i) => (
            <button key={i} type="button" onClick={() => { it.onClick(); setOpen(false); }} style={{
              display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "10px 14px",
              background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
              color: it.danger ? "#f87171" : C.text, fontSize: 13,
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.panel)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <it.icon size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div>{it.label}</div>
                {it.sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{it.sub}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function pagerBtn(active) {
  return {
    minWidth: 30, height: 30, padding: "0 8px", borderRadius: 6, border: `1px solid ${active ? C.gold : C.line}`,
    background: active ? "rgba(211,164,75,.12)" : "transparent", color: active ? C.goldLight : C.dim,
    cursor: "pointer", fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center",
  };
}
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 20 }}>
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} style={{ ...pagerBtn(false), opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
      {pages.map((p) => <button key={p} type="button" onClick={() => onChange(p)} style={pagerBtn(p === page)}>{p}</button>)}
      <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ ...pagerBtn(false), opacity: page === totalPages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
    </div>
  );
}

function Dashboard({ vehicles, onOpen }) {
  const ativos = vehicles.filter(emEstoque); // vendido/arquivado are out of stock, for good
  const valorInvestido = ativos.reduce((s, v) => s + custoTotal(v), 0);
  const fipeTotal = ativos.reduce((s, v) => s + (v.fipe || 0), 0);
  const potencialVenda = ativos.reduce((s, v) => s + (v.precoAnunciado || 0), 0);
  const lucroProjetado = ativos.reduce((s, v) => s + ((v.precoAnunciado || 0) - custoVendaBase(v)), 0);
  // Não entra em "Valor investido" (a loja não desembolsou esse dinheiro), mas tem que sair do bolso
  // na hora da venda — por isso "Lucro projetado" fica bem abaixo de "Potencial de venda − Valor
  // investido": Potencial de venda − (Valor investido + Repasses a pagar) = Lucro projetado.
  const repassesAPagar = ativos.filter((v) => v.origem === "consignacao").reduce((s, v) => s + (v.consignacao.valorRepasse || 0), 0);

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
        <StatCard icon={Wallet} label="Valor investido" value={fmtBRL(valorInvestido)} sub={repassesAPagar > 0 ? `+ ${fmtBRL(repassesAPagar)} em repasses a pagar` : "Só comissão nos consignados"} />
        <StatCard icon={Gauge} label="FIPE total do estoque" value={fmtBRL(fipeTotal)} />
        <StatCard icon={TrendingUp} label="Potencial de venda" value={fmtBRL(potencialVenda)} />
        <StatCard icon={BadgeDollarSign} label="Lucro projetado" value={fmtBRL(lucroProjetado)} sub="Já descontando repasses a pagar" highlight />
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

const ORIGEM_BADGE = { consignacao: { label: "Consignado", color: "#60a5fa" }, troca: { label: "Troca", color: "#c084fc" } };

function EstoqueCard({ v, onOpen }) {
  const ct = custoTotal(v);
  const base = custoVendaBase(v);
  const margem = base ? (((v.precoAnunciado || 0) - base) / base) * 100 : 0;
  const st = statusInfo(v.status);
  const origemBadge = ORIGEM_BADGE[v.origem];
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
      onClick={() => onOpen(v.id)}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.goldLight)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.line)}>
      <div style={{ position: "relative", aspectRatio: "16/10", background: C.panel2 }}>
        <img src={v.fotos[0]} alt={v.modelo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span style={{ position: "absolute", top: 7, left: 7 }}><Badge color={st.color}>{st.label}</Badge></span>
        {origemBadge && <span style={{ position: "absolute", bottom: 7, left: 7 }}><Badge color={origemBadge.color}>{origemBadge.label}</Badge></span>}
      </div>
      <div style={{ padding: 11 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{v.marca} {v.modelo}</div>
        <div style={{ fontSize: 10.5, color: C.dim, marginBottom: 6 }}>{v.versao}</div>
        <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: C.dim, marginBottom: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Calendar size={10} />{v.anoFab}/{v.anoModelo}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Gauge size={10} />{v.km.toLocaleString("pt-BR")} km</span>
        </div>
        <div style={{ paddingTop: 8, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 4 }}>
          <RowKV small label="Custo total" value={fmtBRL(ct)} />
          <RowKV small label="FIPE" value={fmtBRL(v.fipe)} />
          <RowKV small label="Preço anunciado" value={fmtBRL(v.precoAnunciado)} strong />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
            <span style={{ color: C.dim }}>Margem</span>
            <span style={{ color: margem >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>{margem.toFixed(1)}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
            <span style={{ color: C.dim }}>Publicado</span>
            <span style={{ color: v.publicado ? "#4ade80" : C.dim }}>{v.publicado ? "Sim" : "Não"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EstoqueAdmin({ vehicles, onOpen, onNew }) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 8;
  // vendido/arquivado live in the Vendidos board instead, so they don't pile up here.
  const list = vehicles.filter((v) => emEstoque(v) && `${v.marca} ${v.modelo} ${v.versao}`.toLowerCase().includes(busca.toLowerCase()));
  const totalPaginas = Math.max(1, Math.ceil(list.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const pageItems = list.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22 }}>Estoque</h1>
          <p style={{ color: C.dim, fontSize: 13.5 }}>{list.length} veículos</p>
        </div>
        <button onClick={onNew} style={btnGold()}><Plus size={16} /> Novo veículo</button>
      </div>
      <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar veículo, marca, versão..." style={{ ...inp(), maxWidth: 340, marginBottom: 18 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }} className="uau-grid-4">
        {pageItems.map((v) => <EstoqueCard key={v.id} v={v} onOpen={onOpen} />)}
        {list.length === 0 && <div style={{ color: C.dim, gridColumn: "1/-1", textAlign: "center", padding: 40 }}>Nenhum veículo encontrado.</div>}
      </div>
      {list.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 12.5, color: C.dim }}>
            Mostrando {(paginaAtual - 1) * porPagina + 1} a {Math.min(paginaAtual * porPagina, list.length)} de {list.length} veículos
          </div>
          <Pagination page={paginaAtual} totalPages={totalPaginas} onChange={setPagina} />
        </div>
      )}
    </div>
  );
}

const VENDA_SITUACAO_COLOR = { Pago: "#e0a940", Entregue: "#60a5fa", Finalizado: "#4ade80" };

function VendaCard({ v, onOpen, onDelete }) {
  const venda = v.venda;
  const base = custoVendaBase(v);
  const lucro = venda ? (venda.valor || 0) - base : 0;
  const margem = base ? (lucro / base) * 100 : 0;
  const situacao = venda?.situacao || "Pago";
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
      onClick={() => onOpen(v.id)}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.goldLight)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.line)}>
      <div style={{ position: "relative", aspectRatio: "16/10", background: C.panel2 }}>
        <img src={v.fotos[0]} alt={v.modelo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span style={{ position: "absolute", top: 7, left: 7 }}><Badge color={v.status === "vendido" ? "#4ade80" : "#94a3b8"}>{v.status === "vendido" ? "Vendido" : "Arquivado"}</Badge></span>
        <span style={{ position: "absolute", top: 5, right: 5 }}>
          <DropdownMenu items={[
            { icon: FileText, label: "Ver detalhes", onClick: () => onOpen(v.id) },
            { icon: Trash2, label: "Excluir permanentemente", danger: true, onClick: () => { if (window.confirm(`Excluir permanentemente ${v.marca} ${v.modelo}? Essa ação não pode ser desfeita.`)) onDelete(v.id); } },
          ]} />
        </span>
        {venda && <span style={{ position: "absolute", bottom: 7, left: 7 }}><Badge color={VENDA_SITUACAO_COLOR[situacao] || "#e0a940"}>{situacao}</Badge></span>}
      </div>
      <div style={{ padding: 11 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{v.marca} {v.modelo}</div>
        <div style={{ fontSize: 10.5, color: C.dim, marginBottom: 6 }}>{v.versao}</div>
        <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: C.dim, marginBottom: venda ? 8 : 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Calendar size={10} />{v.anoFab}/{v.anoModelo}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Gauge size={10} />{v.km.toLocaleString("pt-BR")} km</span>
        </div>
        {venda && venda.valor > 0 ? (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 4 }}>
            <RowKV small label="Data da venda" value={fmtDate(venda.data)} />
            <RowKV small label="Preço de venda" value={fmtBRL(venda.valor)} />
            <RowKV small label="Custo do veículo" value={fmtBRL(base)} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
              <span style={{ color: C.dim }}>Lucro / Margem</span>
              <span style={{ color: lucro >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>{fmtBRL(lucro)} <span style={{ fontWeight: 500, fontSize: 10 }}>{margem.toFixed(1)}%</span></span>
            </div>
            <RowKV small label="Dias para vender" value={`${diasEstoque(v)} dias`} />
          </div>
        ) : v.status === "vendido" ? (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${C.line}`, fontSize: 11, color: "#e0a940" }}>Vendido — detalhes ainda não preenchidos.</div>
        ) : (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${C.line}`, fontSize: 11, color: C.dim }}>Arquivado sem registro de venda.</div>
        )}
      </div>
    </div>
  );
}

function VendidosAdmin({ vehicles, onOpen, onDelete }) {
  const [busca, setBusca] = useState("");
  const [mesFiltro, setMesFiltro] = useState("Todos");
  const [vendedorFiltro, setVendedorFiltro] = useState("Todos");
  const [origemFiltro, setOrigemFiltro] = useState("Todos");
  const [pagina, setPagina] = useState(1);
  const porPagina = 8;

  const todos = vehicles.filter((v) => !emEstoque(v));
  // "Veículos vendidos" conta todo mundo com status "vendido", preenchido ou não — senão um carro
  // recém-marcado como vendido (antes de alguém abrir a ficha e preencher "Detalhes da venda") some
  // da contagem. Faturamento/Lucro/Ticket médio, por outro lado, só fazem sentido pra quem já tem
  // um valor de venda de fato — não dá pra somar um preço que ainda não foi informado.
  const marcadosVendidos = vehicles.filter((v) => v.status === "vendido");
  const vendidosComVenda = marcadosVendidos.filter((v) => v.venda && v.venda.valor > 0);

  const meses = Array.from(new Set(vendidosComVenda.map((v) => v.venda.data.slice(0, 7)))).sort().reverse();
  const vendedores = Array.from(new Set(vendidosComVenda.map((v) => v.venda.vendedor).filter(Boolean)));

  const faturamento = vendidosComVenda.reduce((s, v) => s + (v.venda.valor || 0), 0);
  const lucroRealizado = vendidosComVenda.reduce((s, v) => s + ((v.venda.valor || 0) - custoVendaBase(v)), 0);
  const ticketMedio = vendidosComVenda.length ? faturamento / vendidosComVenda.length : 0;
  const margemTotalPct = faturamento ? (lucroRealizado / faturamento) * 100 : 0;

  const hoje = new Date();
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const mesAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnteriorStr = `${mesAnt.getFullYear()}-${String(mesAnt.getMonth() + 1).padStart(2, "0")}`;
  const vendidosMesAtual = vendidosComVenda.filter((v) => v.venda.data.slice(0, 7) === mesAtualStr).length;
  const vendidosMesAnterior = vendidosComVenda.filter((v) => v.venda.data.slice(0, 7) === mesAnteriorStr).length;
  const variacaoPct = vendidosMesAnterior > 0 ? Math.round(((vendidosMesAtual - vendidosMesAnterior) / vendidosMesAnterior) * 100) : null;

  const filtrados = todos
    .filter((v) => {
      if (!`${v.marca} ${v.modelo} ${v.versao} ${v.placa || ""}`.toLowerCase().includes(busca.toLowerCase())) return false;
      if (mesFiltro !== "Todos" && (!v.venda || v.venda.data.slice(0, 7) !== mesFiltro)) return false;
      if (vendedorFiltro !== "Todos" && (!v.venda || v.venda.vendedor !== vendedorFiltro)) return false;
      if (origemFiltro !== "Todos" && v.origem !== origemFiltro) return false;
      return true;
    })
    .sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const pageItems = filtrados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  function mudarFiltro(setter, valor) { setter(valor); setPagina(1); }
  const filtrosAtivos = busca || mesFiltro !== "Todos" || vendedorFiltro !== "Todos" || origemFiltro !== "Todos";
  function limpar() { setBusca(""); setMesFiltro("Todos"); setVendedorFiltro("Todos"); setOrigemFiltro("Todos"); setPagina(1); }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22 }}>Vendidos</h1>
        <p style={{ color: C.dim, fontSize: 13.5 }}>
          {todos.length} veículos vendidos ou arquivados — saem do Estoque automaticamente, mas o histórico fica guardado aqui até você excluir.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }} className="uau-grid-4">
        <StatCard icon={Car} label="Veículos vendidos" value={marcadosVendidos.length}
          sub={variacaoPct === null ? undefined : `${variacaoPct >= 0 ? "+" : ""}${variacaoPct}% vs. mês anterior`}
          subColor={variacaoPct !== null && variacaoPct < 0 ? "#f87171" : "#4ade80"} iconColor="#e0a940" />
        <StatCard icon={Wallet} label="Faturamento" value={fmtBRL(faturamento)} sub="Receita total de vendas" iconColor="#4ade80" />
        <StatCard icon={TrendingUp} label="Lucro realizado" value={fmtBRL(lucroRealizado)} sub={`Margem total ${margemTotalPct.toFixed(1)}%`} iconColor="#60a5fa" />
        <StatCard icon={BadgeDollarSign} label="Ticket médio" value={fmtBRL(ticketMedio)} sub="Valor médio por veículo" iconColor="#c084fc" />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <input value={busca} onChange={(e) => mudarFiltro(setBusca, e.target.value)} placeholder="Buscar veículo, marca, modelo, placa..." style={{ ...inp(), flex: "2 1 240px" }} />
        <select value={mesFiltro} onChange={(e) => mudarFiltro(setMesFiltro, e.target.value)} style={{ ...inp(), flex: "1 1 150px" }}>
          <option value="Todos">Mês: Todos</option>
          {meses.map((m) => <option key={m} value={m}>{formatMesLabel(m)}</option>)}
        </select>
        <select value={vendedorFiltro} onChange={(e) => mudarFiltro(setVendedorFiltro, e.target.value)} style={{ ...inp(), flex: "1 1 150px" }}>
          <option value="Todos">Vendedor: Todos</option>
          {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={origemFiltro} onChange={(e) => mudarFiltro(setOrigemFiltro, e.target.value)} style={{ ...inp(), flex: "1 1 150px" }}>
          <option value="Todos">Origem: Todas</option>
          <option value="compra">Compra própria</option>
          <option value="consignacao">Consignação</option>
          <option value="troca">Troca</option>
        </select>
        {filtrosAtivos && (
          <button type="button" onClick={limpar} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "9px 14px", color: C.dim, fontSize: 12.5, cursor: "pointer" }}>
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }} className="uau-grid-4">
        {pageItems.map((v) => <VendaCard key={v.id} v={v} onOpen={onOpen} onDelete={onDelete} />)}
        {filtrados.length === 0 && <div style={{ color: C.dim, gridColumn: "1/-1", textAlign: "center", padding: 40 }}>Nenhum veículo encontrado.</div>}
      </div>

      {filtrados.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 12.5, color: C.dim }}>
            Mostrando {(paginaAtual - 1) * porPagina + 1} a {Math.min(paginaAtual * porPagina, filtrados.length)} de {filtrados.length} veículos vendidos
          </div>
          <Pagination page={paginaAtual} totalPages={totalPaginas} onChange={setPagina} />
        </div>
      )}
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
            const base = custoVendaBase(v);
            const margem = base ? (((v.precoAnunciado || 0) - base) / base) * 100 : 0;
            const st = statusInfo(v.status);
            return (
              <tr key={v.id} onClick={() => onOpen(v.id)} style={{ borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "10px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={v.fotos[0]} style={{ width: 42, height: 32, objectFit: "cover", borderRadius: 4 }} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontWeight: 600 }}>{v.marca} {v.modelo}</span>
                        {v.origem === "consignacao" && <Badge color="#60a5fa">Consignado</Badge>}
                        {v.origem === "troca" && <Badge color="#c084fc">Troca</Badge>}
                      </div>
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
function VehicleAdmin({ vehicles, updateVehicle }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const vehicle = vehicles.find((v) => v.id === id);
  const [tab, setTab] = useState("resumo");
  if (!vehicle) return null;

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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22 }}>
              {vehicle.marca} {vehicle.modelo}
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
// Small "auto-filled by FIPE" indicator appended to a Field label — purely informational, the
// field underneath stays fully editable (nothing is actually locked/disabled).
function LockLabel({ text, locked }) {
  return <>{text}{locked && <Lock size={10} color={C.dim} style={{ marginLeft: 5, verticalAlign: 1 }} />}</>;
}
function SectionTitle({ children }) {
  return <h3 style={{ fontSize: 14, fontWeight: 700, margin: "22px 0 14px", color: C.goldLight }}>{children}</h3>;
}
function Panel({ children, style }) {
  return <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 22, ...style }}>{children}</div>;
}

/* ---------- NOVO VEÍCULO — nothing is written to the database until this form is valid and submitted ---------- */
function NovoVeiculoForm({ addVehicle }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    marca: "", modelo: "", versao: "", anoFab: "", anoModelo: "", km: "", cor: "", combustivel: "Flex", cambio: "Automática", portas: "4", fipe: "",
    origem: "compra",
    valorPago: "", compraData: todayStr(), compraFornecedor: "",
    consProprietario: "", consTelefone: "", consValorRepasse: "", consComissaoTipo: "percentual", consComissao: "", consData: todayStr(), consObs: "",
    trocaValor: "", trocaNegociacao: "", trocaObs: "",
  });
  const [fotos, setFotos] = useState([]);
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const tempFolder = useRef(uid());

  const [fipeApplied, setFipeApplied] = useState(false);
  function setField(k, val) { setForm((f) => ({ ...f, [k]: val })); }

  function handleFipeSelect({ marca, modelo, versao, anoFab, fipeValor, combustivel }) {
    const portasInferidas = inferPortasFromFipeText(versao || modelo);
    setForm((f) => ({
      ...f, marca, modelo, versao, anoFab: String(anoFab), anoModelo: String(anoFab), fipe: String(fipeValor || ""),
      combustivel: ["Flex", "Gasolina", "Híbrido", "Diesel", "Elétrico"].includes(combustivel) ? combustivel : f.combustivel,
      portas: portasInferidas ? String(portasInferidas) : f.portas,
      cambio: inferCambioFromFipeText(versao || modelo),
    }));
    setFipeApplied(true);
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    setUploadErr("");
    const uploaded = [];
    for (const file of files) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `novo-${tempFolder.current}/${uid()}.${ext}`;
      const { error } = await supabase.storage.from("veiculos-fotos").upload(path, file);
      if (error) { setUploadErr(error.message); continue; }
      uploaded.push(supabase.storage.from("veiculos-fotos").getPublicUrl(path).data.publicUrl);
    }
    if (uploaded.length) setFotos((prev) => [...prev, ...uploaded]);
    setUploading(false);
  }
  function addFotoUrl() {
    if (!fotoUrl.trim()) return;
    setFotos((prev) => [...prev, fotoUrl.trim()]);
    setFotoUrl("");
  }
  function removeFoto(i) {
    setFotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  const camposOrigem = {
    compra: [form.valorPago === "" && "Valor pago"],
    consignacao: [
      !form.consProprietario.trim() && "Nome do proprietário", !form.consTelefone.trim() && "Telefone do proprietário",
      form.consValorRepasse === "" && "Valor de repasse", form.consComissao === "" && "Comissão",
    ],
    troca: [form.trocaValor === "" && "Valor considerado na troca"],
  };
  const camposFaltando = [
    !form.marca.trim() && "Marca", !form.modelo.trim() && "Modelo", !form.versao.trim() && "Versão",
    !form.anoFab && "Ano fabricação", !form.anoModelo && "Ano modelo", form.km === "" && "Quilometragem",
    !form.cor.trim() && "Cor", !form.combustivel && "Combustível", !form.cambio && "Câmbio",
    !form.portas && "Portas", ...camposOrigem[form.origem], fotos.length === 0 && "Fotos",
  ].filter(Boolean);

  async function submit() {
    if (camposFaltando.length) {
      setErr(`Preencha os campos obrigatórios: ${camposFaltando.join(", ")}.`);
      return;
    }
    setErr("");
    setCreating(true);
    const draft = seedVehicle({
      marca: form.marca.trim(), modelo: form.modelo.trim(), versao: form.versao.trim(),
      anoFab: sanitizeInt(form.anoFab), anoModelo: sanitizeInt(form.anoModelo), km: sanitizeInt(form.km),
      cor: form.cor.trim(), combustivel: form.combustivel, cambio: form.cambio, portas: sanitizeInt(form.portas),
      fipe: form.fipe === "" ? 0 : sanitizeInt(form.fipe),
      fotos, fotoPrincipal: 0,
      origem: form.origem,
      compra: { valorPago: sanitizeInt(form.valorPago), dataAquisicao: form.compraData, fornecedor: form.compraFornecedor.trim() },
      consignacao: {
        proprietario: form.consProprietario.trim(), telefone: form.consTelefone.trim(),
        valorRepasse: sanitizeInt(form.consValorRepasse), comissaoTipo: form.consComissaoTipo,
        comissao: form.consComissaoTipo === "percentual" ? (Number(form.consComissao) || 0) : sanitizeInt(form.consComissao),
        dataEntrada: form.consData, obs: form.consObs.trim(),
      },
      troca: { valorConsiderado: sanitizeInt(form.trocaValor), negociacaoRelacionada: form.trocaNegociacao.trim(), obs: form.trocaObs.trim() },
    });
    // Seed a real starting price instead of leaving precoAnunciado/precoMinimo at 0 — that made every
    // freshly-cadastrado vehicle show a nonsensical -100% margin until someone visited the
    // Precificação tab. precoSugerido() (custoVendaBase + the default margem, or repasse+comissão
    // for consignação) is the same "Preço sugerido" the Precificação tab shows, so this just
    // pre-fills that suggestion. "Preço mínimo desejado" defaults to FIPE — except for consignação,
    // where selling below the repasse combinado com o dono would be a guaranteed loss, so the
    // repasse itself is the real floor there.
    draft.precoAnunciado = Math.round(precoSugerido(draft));
    draft.precoMinimo = draft.origem === "consignacao" ? (draft.consignacao.valorRepasse || 0) : (draft.fipe || 0);
    const created = await addVehicle(draft);
    setCreating(false);
    if (created) navigate(`/admin/veiculo/${created.id}`);
    else setErr("Não deu pra cadastrar agora. Tenta de novo.");
  }

  return (
    <div>
      <button onClick={() => navigate("/admin/estoque")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.dim, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
        <ChevronLeft size={15} /> Voltar ao estoque
      </button>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, marginBottom: 4 }}>Novo veículo</h1>
      <p style={{ color: C.dim, fontSize: 13.5, marginBottom: 20 }}>
        Preencha os dados obrigatórios para cadastrar. Nada é salvo até você clicar em "Cadastrar veículo" — os outros
        detalhes (gastos, opcionais, descrição, precificação...) você completa depois, na tela do veículo.
      </p>

      <Panel>
        <SectionTitle>Preencher automaticamente pela tabela FIPE (opcional)</SectionTitle>
        <FipeSelector onSelect={handleFipeSelect} />

        <SectionTitle>Dados do veículo</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="uau-form-grid-3">
          <Field label={<LockLabel text="Marca *" locked={fipeApplied} />}><input style={inp()} value={form.marca} onChange={(e) => setField("marca", e.target.value)} /></Field>
          <Field label={<LockLabel text="Modelo *" locked={fipeApplied} />}><input style={inp()} value={form.modelo} onChange={(e) => setField("modelo", e.target.value)} /></Field>
          <Field label={<LockLabel text="Versão *" locked={fipeApplied} />}><input style={inp()} value={form.versao} onChange={(e) => setField("versao", e.target.value)} /></Field>
          <Field label={<LockLabel text="Ano fabricação *" locked={fipeApplied} />}><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={form.anoFab} onChange={(e) => setField("anoFab", String(sanitizeInt(e.target.value)))} /></Field>
          <Field label={<LockLabel text="Ano modelo *" locked={fipeApplied} />}><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={form.anoModelo} onChange={(e) => setField("anoModelo", String(sanitizeInt(e.target.value)))} /></Field>
          <Field label="Quilometragem *"><IntField style={inp()} value={form.km} onFocus={selectOnFocus} onChange={(n) => setField("km", n === "" ? "" : String(n))} /></Field>
          <Field label="Cor *"><input style={inp()} value={form.cor} onChange={(e) => setField("cor", e.target.value)} /></Field>
          <Field label={<LockLabel text="Combustível *" locked={fipeApplied} />}>
            <select style={inp()} value={form.combustivel} onChange={(e) => setField("combustivel", e.target.value)}>
              <option>Flex</option><option>Gasolina</option><option>Híbrido</option><option>Diesel</option><option>Elétrico</option>
            </select>
          </Field>
          <Field label={<LockLabel text="Câmbio *" locked={fipeApplied} />}>
            <select style={inp()} value={form.cambio} onChange={(e) => setField("cambio", e.target.value)}>
              <option>Manual</option><option>Automática</option>
            </select>
          </Field>
          <Field label={<LockLabel text="Portas *" locked={fipeApplied} />}><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={form.portas} onChange={(e) => setField("portas", String(sanitizeInt(e.target.value)))} /></Field>
          <Field label={<LockLabel text="FIPE (opcional)" locked={fipeApplied} />}><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={form.fipe} onChange={(n) => setField("fipe", n === "" ? "" : String(n))} /></Field>
        </div>

        <SectionTitle>Origem do veículo</SectionTitle>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {["compra", "consignacao", "troca"].map((o) => (
            <button key={o} type="button" onClick={() => setField("origem", o)} style={{
              padding: "9px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer",
              border: `1px solid ${form.origem === o ? C.goldLight : C.line}`,
              background: form.origem === o ? "rgba(211,164,75,.1)" : "transparent",
              color: form.origem === o ? C.goldLight : C.dim,
            }}>
              {{ compra: "Compra própria", consignacao: "Consignação", troca: "Troca" }[o]}
            </button>
          ))}
        </div>

        {form.origem === "compra" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="uau-form-grid-3">
            <Field label="Valor pago *"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={form.valorPago} onChange={(n) => setField("valorPago", n === "" ? "" : String(n))} /></Field>
            <Field label="Data de aquisição"><input type="date" style={inp()} value={form.compraData} onChange={(e) => setField("compraData", e.target.value)} /></Field>
            <Field label="Fornecedor (opcional)"><input style={inp()} value={form.compraFornecedor} onChange={(e) => setField("compraFornecedor", e.target.value)} /></Field>
          </div>
        )}
        {form.origem === "consignacao" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="uau-form-grid-3">
            <Field label="Nome do proprietário *"><input style={inp()} value={form.consProprietario} onChange={(e) => setField("consProprietario", e.target.value)} /></Field>
            <Field label="Telefone *"><input style={inp()} value={form.consTelefone} onChange={(e) => setField("consTelefone", e.target.value)} /></Field>
            <Field label="Valor de repasse (do dono) *"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={form.consValorRepasse} onChange={(n) => setField("consValorRepasse", n === "" ? "" : String(n))} /></Field>
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, marginTop: -4 }}>
              <button type="button" onClick={() => setField("consComissaoTipo", "percentual")} style={{
                flex: 1, padding: "9px", borderRadius: 6, cursor: "pointer", fontSize: 13,
                border: `1px solid ${form.consComissaoTipo === "percentual" ? C.goldLight : C.line}`,
                background: form.consComissaoTipo === "percentual" ? "rgba(211,164,75,.1)" : "transparent",
                color: form.consComissaoTipo === "percentual" ? C.goldLight : C.dim,
              }}>Comissão em %</button>
              <button type="button" onClick={() => setField("consComissaoTipo", "valor")} style={{
                flex: 1, padding: "9px", borderRadius: 6, cursor: "pointer", fontSize: 13,
                border: `1px solid ${form.consComissaoTipo === "valor" ? C.goldLight : C.line}`,
                background: form.consComissaoTipo === "valor" ? "rgba(211,164,75,.1)" : "transparent",
                color: form.consComissaoTipo === "valor" ? C.goldLight : C.dim,
              }}>Comissão em R$</button>
            </div>
            <Field label={form.consComissaoTipo === "percentual" ? "Comissão / margem (%) *" : "Comissão / margem combinada (R$) *"}>
              {form.consComissaoTipo === "percentual"
                ? <DecimalField style={inp()} value={form.consComissao} onCommit={(n) => setField("consComissao", n)} />
                : <IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={form.consComissao} onChange={(n) => setField("consComissao", n)} />}
            </Field>
            <Field label="Data de entrada"><input type="date" style={inp()} value={form.consData} onChange={(e) => setField("consData", e.target.value)} /></Field>
            <Field label="Observações (opcional)"><input style={inp()} value={form.consObs} onChange={(e) => setField("consObs", e.target.value)} /></Field>
            <div style={{ gridColumn: "1/-1", fontSize: 12, color: C.dim, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> O valor de repasse não entra como valor investido pela loja — apenas a comissão é considerada no custo
              {form.consComissaoTipo === "percentual" && " (calculada sobre o valor de repasse)"}.
            </div>
          </div>
        )}
        {form.origem === "troca" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="uau-form-grid-3">
            <Field label="Valor considerado na troca *"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={form.trocaValor} onChange={(n) => setField("trocaValor", n === "" ? "" : String(n))} /></Field>
            <Field label="Negociação relacionada (opcional)"><input style={inp()} value={form.trocaNegociacao} onChange={(e) => setField("trocaNegociacao", e.target.value)} /></Field>
            <Field label="Observações (opcional)"><input style={inp()} value={form.trocaObs} onChange={(e) => setField("trocaObs", e.target.value)} /></Field>
          </div>
        )}

        <SectionTitle>Fotos *</SectionTitle>
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
          <input value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="...ou cole a URL de uma imagem" style={inp()} />
          <button type="button" onClick={addFotoUrl} style={btnGhost()}><Plus size={15} /> Adicionar link</button>
        </div>
        {fotos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 8 }} className="uau-grid-4">
            {fotos.map((f, i) => (
              <div key={i} style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.line}` }}>
                <img src={f} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
                <button type="button" onClick={() => removeFoto(i)} style={{ position: "absolute", bottom: 6, right: 6, padding: "5px 8px", borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(10,10,11,.75)", color: "#f87171" }}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}

        {err && <div style={{ color: "#f87171", fontSize: 13, display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}><AlertCircle size={14} />{err}</div>}
        <button onClick={submit} disabled={creating} style={{ ...btnGold(), marginTop: 18, opacity: creating ? 0.7 : 1 }}>
          {creating ? "Cadastrando..." : "Cadastrar veículo"}
        </button>
      </Panel>
    </div>
  );
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

// Same text-buffer idea as DecimalField, but for whole-number money/odometer fields that should
// display with a pt-BR thousands separator while typing (e.g. "650000" renders as "650.000").
// onChange receives "" (field cleared) or a plain number — never a formatted string — so existing
// required-field checks (`=== ""`) and sanitizeInt() calls elsewhere keep working unchanged.
function IntField({ value, onChange, style, prefix = "", onFocus, onBlur = (e) => {} }) {
  const fmt = (n) => (n === "" || n == null ? "" : Number(n).toLocaleString("pt-BR"));
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(fmt(value)); }, [value]);
  const input = (
    <input
      type="text" inputMode="numeric" style={prefix ? { ...style, paddingLeft: 34 } : style}
      value={text}
      onFocus={(e) => { focused.current = true; onFocus?.(e); e.target.select(); }}
      onBlur={(e) => { focused.current = false; setText(fmt(value)); onBlur?.(e); }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        const n = digits === "" ? "" : Number(digits);
        setText(fmt(n));
        onChange(n);
      }}
    />
  );
  if (!prefix) return input;
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13.5, color: C.dim, pointerEvents: "none" }}>{prefix}</span>
      {input}
    </div>
  );
}

function TabResumo({ vehicle, patch }) {
  const ct = custoTotal(vehicle);
  const base = custoVendaBase(vehicle);
  const margem = base ? (((vehicle.precoAnunciado || 0) - base) / base) * 100 : 0;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 22 }} className="uau-resumo-grid">
        <Panel style={{ padding: 0, overflow: "hidden" }}>
          <img src={vehicle.fotos[vehicle.fotoPrincipal] || vehicle.fotos[0]} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
        </Panel>
        <Panel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="uau-grid-3">
            <ResumoItem label="Situação"><Badge color={statusInfo(vehicle.status).color}>{statusInfo(vehicle.status).label}</Badge></ResumoItem>
            <ResumoItem label="Dias em estoque" value={`${diasEstoque(vehicle)} dias`} />
            <ResumoItem label="Origem" value={{ compra: "Compra própria", consignacao: "Consignação", troca: "Troca" }[vehicle.origem]} />
            <ResumoItem label={labelValorEntrada(vehicle)} value={fmtBRL(valorEntrada(vehicle))} />
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
  const venda = vehicle.venda || { data: todayStr(), valor: vehicle.precoAnunciado || 0, comprador: "", vendedor: "", situacao: "Pago", obs: "" };
  const margemGanha = (venda.valor || 0) - custoVendaBase(vehicle);
  function setVenda(fields) {
    patch({ venda: { ...venda, ...fields } });
  }
  return (
    <Panel style={{ marginTop: 22 }}>
      <SectionTitle>Detalhes da venda</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="uau-form-grid-4">
        <Field label="Valor de venda"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={venda.valor} onChange={(n) => setVenda({ valor: n === "" ? 0 : n })} /></Field>
        <Field label="Comprador"><input style={inp()} value={venda.comprador} onChange={(e) => setVenda({ comprador: e.target.value })} /></Field>
        <Field label="Vendedor"><input style={inp()} value={venda.vendedor} onChange={(e) => setVenda({ vendedor: e.target.value })} /></Field>
        <Field label="Data da venda"><input type="date" style={inp()} value={venda.data} onChange={(e) => setVenda({ data: e.target.value })} /></Field>
      </div>
      <Field label="Situação">
        <select style={inp()} value={venda.situacao || "Pago"} onChange={(e) => setVenda({ situacao: e.target.value })}>
          <option>Pago</option><option>Entregue</option><option>Finalizado</option>
        </select>
      </Field>
      <Field label="Observações"><input style={inp()} value={venda.obs} onChange={(e) => setVenda({ obs: e.target.value })} /></Field>
      <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: margemGanha >= 0 ? "rgba(74,222,128,.1)" : "rgba(248,113,113,.1)", border: `1px solid ${margemGanha >= 0 ? "#4ade80" : "#f87171"}55` }}>
        <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 4 }}>Margem ganha (valor de venda − custo/repasse)</div>
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

  function handleFipeSelect({ marca, modelo, versao, anoFab, fipeValor, combustivel }) {
    const patchObj = { marca, modelo, versao, anoFab, anoModelo: anoFab, fipe: fipeValor, cambio: inferCambioFromFipeText(versao || modelo) };
    if (["Flex", "Gasolina", "Híbrido", "Diesel", "Elétrico"].includes(combustivel)) patchObj.combustivel = combustivel;
    const portasInferidas = inferPortasFromFipeText(versao || modelo);
    if (portasInferidas) patchObj.portas = portasInferidas;
    set(patchObj);
  }

  return (
    <Panel>
      <SectionTitle>Dados do veículo</SectionTitle>
      <div style={{ marginBottom: 18, padding: 16, borderRadius: 8, background: C.panel2, border: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 10 }}>Preencher automaticamente pela tabela FIPE (opcional)</div>
        <FipeSelector onSelect={handleFipeSelect} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="uau-form-grid-3">
        <Field label="Marca"><input style={inp()} value={v.marca} onChange={(e) => set({ marca: e.target.value })} /></Field>
        <Field label="Modelo"><input style={inp()} value={v.modelo} onChange={(e) => set({ modelo: e.target.value })} /></Field>
        <Field label="Versão"><input style={inp()} value={v.versao} onChange={(e) => set({ versao: e.target.value })} /></Field>
        <Field label="Ano fabricação"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.anoFab} onChange={(e) => set({ anoFab: sanitizeInt(e.target.value) })} /></Field>
        <Field label="Ano modelo"><input type="text" inputMode="numeric" style={inp()} onFocus={selectOnFocus} value={v.anoModelo} onChange={(e) => set({ anoModelo: sanitizeInt(e.target.value) })} /></Field>
        <Field label="Quilometragem"><IntField style={inp()} onFocus={selectOnFocus} value={v.km} onChange={(n) => set({ km: n === "" ? 0 : n })} /></Field>
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
          <Field label="Valor pago"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={v.compra.valorPago} onChange={(n) => set({ compra: { ...v.compra, valorPago: n === "" ? 0 : n } })} /></Field>
          <Field label="FIPE"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={v.fipe} onChange={(n) => set({ fipe: n === "" ? 0 : n })} /></Field>
          <Field label="Data de aquisição"><input type="date" style={inp()} value={v.compra.dataAquisicao} onChange={(e) => set({ compra: { ...v.compra, dataAquisicao: e.target.value } })} /></Field>
          <Field label="Fornecedor (opcional)"><input style={inp()} value={v.compra.fornecedor} onChange={(e) => set({ compra: { ...v.compra, fornecedor: e.target.value } })} /></Field>
        </div>
      )}
      {v.origem === "consignacao" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="uau-form-grid-3">
          <Field label="Nome do proprietário"><input style={inp()} value={v.consignacao.proprietario} onChange={(e) => set({ consignacao: { ...v.consignacao, proprietario: e.target.value } })} /></Field>
          <Field label="Telefone"><input style={inp()} value={v.consignacao.telefone} onChange={(e) => set({ consignacao: { ...v.consignacao, telefone: e.target.value } })} /></Field>
          <Field label="Valor de repasse (do dono)"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={v.consignacao.valorRepasse} onChange={(n) => set({ consignacao: { ...v.consignacao, valorRepasse: n === "" ? 0 : n } })} /></Field>
          <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, marginTop: -4 }}>
            <button type="button" onClick={() => set({ consignacao: { ...v.consignacao, comissaoTipo: "percentual" } })} style={{
              flex: 1, padding: "9px", borderRadius: 6, cursor: "pointer", fontSize: 13,
              border: `1px solid ${v.consignacao.comissaoTipo === "percentual" ? C.goldLight : C.line}`,
              background: v.consignacao.comissaoTipo === "percentual" ? "rgba(211,164,75,.1)" : "transparent",
              color: v.consignacao.comissaoTipo === "percentual" ? C.goldLight : C.dim,
            }}>Comissão em %</button>
            <button type="button" onClick={() => set({ consignacao: { ...v.consignacao, comissaoTipo: "valor" } })} style={{
              flex: 1, padding: "9px", borderRadius: 6, cursor: "pointer", fontSize: 13,
              border: `1px solid ${v.consignacao.comissaoTipo === "valor" ? C.goldLight : C.line}`,
              background: v.consignacao.comissaoTipo === "valor" ? "rgba(211,164,75,.1)" : "transparent",
              color: v.consignacao.comissaoTipo === "valor" ? C.goldLight : C.dim,
            }}>Comissão em R$</button>
          </div>
          <Field label={v.consignacao.comissaoTipo === "percentual" ? "Comissão / margem (%)" : "Comissão / margem combinada (R$)"}>
            {v.consignacao.comissaoTipo === "percentual"
              ? <DecimalField style={inp()} value={v.consignacao.comissao} onCommit={(n) => set({ consignacao: { ...v.consignacao, comissao: n } })} />
              : <IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={v.consignacao.comissao} onChange={(n) => set({ consignacao: { ...v.consignacao, comissao: n === "" ? 0 : n } })} />}
          </Field>
          <Field label="Data de entrada"><input type="date" style={inp()} value={v.consignacao.dataEntrada} onChange={(e) => set({ consignacao: { ...v.consignacao, dataEntrada: e.target.value } })} /></Field>
          <Field label="Observações"><input style={inp()} value={v.consignacao.obs} onChange={(e) => set({ consignacao: { ...v.consignacao, obs: e.target.value } })} /></Field>
          <div style={{ gridColumn: "1/-1", fontSize: 12, color: C.dim, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> O valor de repasse não entra como valor investido pela loja — apenas a comissão é considerada no custo
            {v.consignacao.comissaoTipo === "percentual" && " (calculada sobre o valor de repasse)"}.
          </div>
        </div>
      )}
      {v.origem === "troca" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="uau-form-grid-3">
          <Field label="Valor considerado na troca"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={v.troca.valorConsiderado} onChange={(n) => set({ troca: { ...v.troca, valorConsiderado: n === "" ? 0 : n } })} /></Field>
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
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="uau-form-grid-4">
            <Field label="Saldo assumido"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={v.financiamento.saldo} onChange={(n) => set({ financiamento: { ...v.financiamento, saldo: n === "" ? 0 : n } })} /></Field>
            <Field label="Banco"><input style={inp()} value={v.financiamento.banco} onChange={(e) => set({ financiamento: { ...v.financiamento, banco: e.target.value } })} /></Field>
            <Field label="Parcelas (opcional)"><input style={inp()} value={v.financiamento.parcelas} onChange={(e) => set({ financiamento: { ...v.financiamento, parcelas: e.target.value } })} /></Field>
            <Field label="Valor da parcela (opcional)"><input style={inp()} value={v.financiamento.valorParcela} onChange={(e) => set({ financiamento: { ...v.financiamento, valorParcela: e.target.value } })} /></Field>
          </div>
          <div style={{ fontSize: 12, color: C.dim, display: "flex", gap: 8, alignItems: "flex-start", marginTop: -6 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> O saldo assumido já entra automaticamente no custo total do veículo — não lance ele de novo em Gastos.
          </div>
        </>
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
          <Field label="Valor"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={form.valor} onChange={(n) => setForm({ ...form, valor: n === "" ? "" : String(n) })} /></Field>
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
        <div style={{ overflowX: "auto" }}>
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
        </div>
      </Panel>
    </div>
  );
}

function TabPrecificacao({ vehicle, patch }) {
  const ct = custoTotal(vehicle);
  const sugerido = precoSugerido(vehicle);
  const lucroEsperado = (vehicle.precoAnunciado || 0) - custoVendaBase(vehicle);
  // Historico should record one "price changed" entry per edit, not one per keystroke — so it's
  // logged on blur (comparing against the value when the field was focused), not on every onChange.
  const precoAoFocar = useRef(vehicle.precoAnunciado);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="uau-preco-grid">
      <Panel>
        <SectionTitle>Sugestão de preço</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
          <RowKV label={labelValorEntrada(vehicle)} value={fmtBRL(valorEntrada(vehicle))} />
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
        <Field label="Preço anunciado">
          <IntField
            prefix="R$ " style={inp()}
            onFocus={(e) => { selectOnFocus(e); precoAoFocar.current = vehicle.precoAnunciado; }}
            value={vehicle.precoAnunciado}
            onChange={(n) => patch({ precoAnunciado: n === "" ? 0 : n })}
            onBlur={() => {
              if (vehicle.precoAnunciado !== precoAoFocar.current) {
                patch({}, `Preço alterado para ${fmtBRL(vehicle.precoAnunciado)}.`);
              }
            }}
          />
        </Field>
        <Field label="Preço mínimo desejado"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={vehicle.precoMinimo} onChange={(n) => patch({ precoMinimo: n === "" ? 0 : n })} /></Field>
        <Field label="FIPE de referência"><IntField prefix="R$ " style={inp()} onFocus={selectOnFocus} value={vehicle.fipe} onChange={(n) => patch({ fipe: n === "" ? 0 : n })} /></Field>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
          <RowKV label="Lucro esperado" value={fmtBRL(lucroEsperado)} color={lucroEsperado >= 0 ? "#4ade80" : "#f87171"} strong />
        </div>
      </Panel>
    </div>
  );
}
function RowKV({ label, value, strong, color, small }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: small ? 11.5 : 13.5 }}>
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
const CONTATO_STATUS_LABEL = { Novo: "Novo", Contatado: "Em atendimento", Finalizado: "Finalizado" };
const CONTATO_STATUS_COLOR = { Novo: "#60a5fa", Contatado: "#e0a940", Finalizado: "#4ade80" };
const AVATAR_PALETTE = ["#d3a44b", "#60a5fa", "#c084fc", "#4ade80", "#f87171", "#e0a940"];
function initials(nome) {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes[1]?.[0] || "")).toUpperCase();
}
// Cor determinística por nome — o mesmo contato sempre cai na mesma cor entre renders.
function avatarColor(nome) {
  let hash = 0;
  for (const ch of nome || "") hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function ContatosAdmin({ contacts, vehicles, updateContactStatus, deleteContact, config }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("Todos");
  const [veiculoFiltro, setVeiculoFiltro] = useState("Todos");
  const [origemFiltro, setOrigemFiltro] = useState("Todos");
  const [periodoFiltro, setPeriodoFiltro] = useState("Todos");
  const [ocultarFinalizados, setOcultarFinalizados] = useState(true);
  const [pagina, setPagina] = useState(1);
  const porPagina = 10;

  const novos = contacts.filter((c) => c.status === "Novo").length;
  const emAtendimento = contacts.filter((c) => c.status === "Contatado").length;
  const finalizados = contacts.filter((c) => c.status === "Finalizado").length;

  const veiculosComContato = vehicles.filter((v) => contacts.some((c) => c.veiculoId === v.id));
  // "Origem" = qual formulário/CTA do site gerou o lead (tipo já carrega isso: "Quero mais
  // informações", "Quero agendar test-drive", etc.) — não temos um canal separado (site/whatsapp/etc).
  const origens = Array.from(new Set(contacts.map((c) => c.tipo).filter(Boolean)));

  function dentroDoPeriodo(dataStr) {
    if (periodoFiltro === "Todos") return true;
    const d = new Date(dataStr + "T00:00:00");
    const hoje = new Date();
    const dias = Math.round((hoje - d) / 86400000);
    if (periodoFiltro === "hoje") return dias === 0;
    if (periodoFiltro === "7dias") return dias <= 7;
    if (periodoFiltro === "30dias") return dias <= 30;
    if (periodoFiltro === "mes") return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
    return true;
  }

  const filtrados = contacts
    .filter((c) => {
      const v = vehicles.find((x) => x.id === c.veiculoId);
      if (ocultarFinalizados && c.status === "Finalizado") return false;
      if (statusFiltro !== "Todos" && c.status !== statusFiltro) return false;
      if (veiculoFiltro !== "Todos" && c.veiculoId !== veiculoFiltro) return false;
      if (origemFiltro !== "Todos" && c.tipo !== origemFiltro) return false;
      if (!dentroDoPeriodo(c.data)) return false;
      if (busca) {
        const alvo = `${c.nome} ${c.telefone} ${c.email} ${v ? v.marca + " " + v.modelo : ""}`.toLowerCase();
        if (!alvo.includes(busca.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const pageItems = filtrados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  function mudarFiltro(setter, valor) { setter(valor); setPagina(1); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, marginBottom: 4 }}>Contatos</h1>
          <p style={{ color: C.dim, fontSize: 13.5 }}>Gerencie leads e acompanhe o atendimento dos clientes.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }} className="uau-grid-3">
        <StatCard icon={UserCircle} label="Novos" value={novos} sub="Não iniciados" iconColor="#e0a940" />
        <StatCard icon={Headphones} label="Em atendimento" value={emAtendimento} sub="Conversas em andamento" iconColor="#60a5fa" />
        <StatCard icon={CheckCircle2} label="Finalizados" value={finalizados} sub="Arquivados" iconColor="#4ade80" />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 18 }}>
        <input value={busca} onChange={(e) => mudarFiltro(setBusca, e.target.value)} placeholder="Buscar por nome, telefone, e-mail ou veículo..." style={{ ...inp(), flex: "2 1 240px" }} />
        <select value={statusFiltro} onChange={(e) => mudarFiltro(setStatusFiltro, e.target.value)} style={{ ...inp(), flex: "1 1 130px" }}>
          <option value="Todos">Status: Todos</option>
          <option value="Novo">Novo</option>
          <option value="Contatado">Em atendimento</option>
          <option value="Finalizado">Finalizado</option>
        </select>
        <select value={veiculoFiltro} onChange={(e) => mudarFiltro(setVeiculoFiltro, e.target.value)} style={{ ...inp(), flex: "1 1 150px" }}>
          <option value="Todos">Veículo: Todos</option>
          {veiculosComContato.map((v) => <option key={v.id} value={v.id}>{v.marca} {v.modelo}</option>)}
        </select>
        <select value={origemFiltro} onChange={(e) => mudarFiltro(setOrigemFiltro, e.target.value)} style={{ ...inp(), flex: "1 1 170px" }}>
          <option value="Todos">Origem: Todas</option>
          {origens.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={periodoFiltro} onChange={(e) => mudarFiltro(setPeriodoFiltro, e.target.value)} style={{ ...inp(), flex: "1 1 150px" }}>
          <option value="Todos">Período: Todos</option>
          <option value="hoje">Hoje</option>
          <option value="7dias">Últimos 7 dias</option>
          <option value="30dias">Últimos 30 dias</option>
          <option value="mes">Este mês</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.dim, whiteSpace: "nowrap", cursor: "pointer" }}>
          <input type="checkbox" checked={ocultarFinalizados} onChange={(e) => mudarFiltro(setOcultarFinalizados, e.target.checked)} />
          Ocultar finalizados
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {pageItems.map((c) => {
          const v = vehicles.find((x) => x.id === c.veiculoId);
          const cor = avatarColor(c.nome);
          return (
            <Panel key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div style={{ display: "flex", gap: 14, flex: 1, minWidth: 240 }}>
                <div style={{ width: 40, height: 40, borderRadius: 99, background: cor + "33", color: cor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {initials(c.nome)}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700 }}>{c.nome}</span>
                    <Badge color={CONTATO_STATUS_COLOR[c.status]}>{CONTATO_STATUS_LABEL[c.status] || c.status}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>{c.telefone} · {c.email}</div>
                  <div style={{ fontSize: 13 }}>Veículo: <strong>{v ? `${v.marca} ${v.modelo}` : "—"}</strong> · Interesse: {c.tipo}</div>
                  {c.mensagem && <div style={{ fontSize: 12.5, color: C.dim, marginTop: 4, fontStyle: "italic" }}>"{c.mensagem}"</div>}
                  <div style={{ fontSize: 11.5, color: C.dim, marginTop: 4 }}>{fmtDate(c.data)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={c.status} onChange={(e) => updateContactStatus(c.id, e.target.value)} style={{ ...inp(), width: 150 }}>
                  <option value="Novo">Novo</option>
                  <option value="Contatado">Em atendimento</option>
                  <option value="Finalizado">Finalizado</option>
                </select>
                <a href={waLink(c.telefone, `Olá ${c.nome}, aqui é da ${config.nome}! Vi seu interesse${v ? ` no ${v.marca} ${v.modelo}` : ""}.`)} target="_blank" rel="noreferrer" style={{ ...btnGold(), padding: "9px 14px" }}>
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <DropdownMenu items={[
                  { icon: Archive, label: "Finalizar e arquivar", sub: "Mover para arquivados", onClick: () => updateContactStatus(c.id, "Finalizado") },
                  { icon: Trash2, label: "Remover da lista", sub: "Excluir permanentemente", danger: true, onClick: () => { if (window.confirm(`Excluir o contato de ${c.nome} permanentemente?`)) deleteContact(c.id); } },
                ]} />
              </div>
            </Panel>
          );
        })}
        {filtrados.length === 0 && <div style={{ color: C.dim, textAlign: "center", padding: 40 }}>Nenhum contato encontrado.</div>}
      </div>

      {filtrados.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 12.5, color: C.dim }}>
            Mostrando {(paginaAtual - 1) * porPagina + 1} a {Math.min(paginaAtual * porPagina, filtrados.length)} de {filtrados.length} contatos
          </div>
          <Pagination page={paginaAtual} totalPages={totalPaginas} onChange={setPagina} />
        </div>
      )}
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
