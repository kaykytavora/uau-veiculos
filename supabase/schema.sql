-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to re-run: uses "if not exists" / "or replace" everywhere it can.

create extension if not exists pgcrypto;

create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  -- Short public-facing id for URLs (/estoque/fiat-argo-drive-1-0-42) instead of the raw UUID.
  -- `id` stays the real primary key everywhere internally (updates, RLS, joins).
  codigo bigint generated always as identity unique,

  marca text not null default '',
  modelo text not null default '',
  versao text not null default '',
  ano_fab int not null default extract(year from now()),
  ano_modelo int not null default extract(year from now()),
  km int not null default 0,
  cor text not null default '',
  combustivel text not null default 'Flex',
  cambio text not null default 'Automático',
  portas int not null default 4,
  placa text not null default '',

  fotos jsonb not null default '[]'::jsonb,
  foto_principal int not null default 0,

  origem text not null default 'compra',
  compra jsonb not null default '{}'::jsonb,
  consignacao jsonb not null default '{}'::jsonb,
  troca jsonb not null default '{}'::jsonb,

  financiamento_assumido boolean not null default false,
  financiamento jsonb not null default '{}'::jsonb,

  gastos jsonb not null default '[]'::jsonb,

  status text not null default 'cadastrado',
  publicado boolean not null default false,

  margem_tipo text not null default 'percent',
  margem_valor numeric not null default 0,
  fipe numeric not null default 0,
  preco_anunciado numeric not null default 0,
  preco_minimo numeric not null default 0,

  descricao text not null default '',
  opcionais jsonb not null default '[]'::jsonb,
  anotacoes jsonb not null default '[]'::jsonb,
  historico jsonb not null default '[]'::jsonb,
  divulgacao jsonb not null default '{}'::jsonb,

  negociacao jsonb,
  venda jsonb,

  data_cadastro date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- defensive: if the table already existed from a run before `codigo` was added, add it now
alter table public.veiculos add column if not exists codigo bigint generated always as identity unique;

-- keep updated_at current on every write
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists veiculos_set_updated_at on public.veiculos;
create trigger veiculos_set_updated_at
  before update on public.veiculos
  for each row execute function public.set_updated_at();

alter table public.veiculos enable row level security;

-- Anon gets NO direct access to this table. RLS can only filter rows, not columns, and this table
-- has columns (compra, gastos, margem_valor, preco_minimo, anotacoes, historico, venda...) that must
-- never reach a site visitor. Public reads go through the veiculos_publicos view below instead, which
-- exposes only customer-facing columns.
drop policy if exists "veiculos publicados sao publicos" on public.veiculos;

drop policy if exists "autenticados veem tudo" on public.veiculos;
create policy "autenticados veem tudo"
  on public.veiculos for select
  to authenticated
  using (true);

drop policy if exists "autenticados podem inserir" on public.veiculos;
create policy "autenticados podem inserir"
  on public.veiculos for insert
  to authenticated
  with check (true);

drop policy if exists "autenticados podem atualizar" on public.veiculos;
create policy "autenticados podem atualizar"
  on public.veiculos for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "autenticados podem apagar" on public.veiculos;
create policy "autenticados podem apagar"
  on public.veiculos for delete
  to authenticated
  using (true);

-- ============================================================
-- PUBLIC VIEW: what the site (and anyone with the anon key) is actually allowed to see.
-- Deliberately excludes: placa, origem, compra, consignacao, troca, financiamento*, gastos,
-- margem_tipo, margem_valor, preco_minimo, anotacoes, historico, negociacao, venda, created_at,
-- updated_at — all internal/financial/PII data with no reason to leave the admin panel.
-- The row filter is written directly into the view rather than left to RLS: views run with the
-- privileges of their owner (who, as the table owner, bypasses RLS on `veiculos` by default), so
-- this WHERE clause — not any policy — is what actually keeps unpublished/sold rows out here.
-- ============================================================
create or replace view public.veiculos_publicos as
select
  id, codigo, marca, modelo, versao, ano_fab, ano_modelo, km, cor, combustivel, cambio, portas,
  fotos, foto_principal, status, publicado, fipe, preco_anunciado, descricao, opcionais, divulgacao,
  data_cadastro
from public.veiculos
where publicado = true and status not in ('vendido', 'arquivado');

grant select on public.veiculos_publicos to anon, authenticated;

-- Demo seed data (equivalent to the old in-memory SEED_VEHICLES). Skipped if the table already has rows.
insert into public.veiculos (
  marca, modelo, versao, ano_fab, ano_modelo, km, cor, combustivel, cambio, portas,
  fotos, foto_principal, origem, compra, gastos, status, publicado, margem_tipo, margem_valor,
  fipe, preco_anunciado, preco_minimo, descricao, opcionais, historico, divulgacao, data_cadastro
)
select * from (values
  (
    'Honda', 'CR-V', 'Touring 2.0 16V AWD Aut. (Híbrido)', 2024, 2024, 39500, 'Branco', 'Híbrido', 'Automática', 4,
    '["https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?q=80&w=900&auto=format&fit=crop","https://images.unsplash.com/photo-1550355291-bbee04a92027?q=80&w=900&auto=format&fit=crop"]'::jsonb, 0,
    'compra', '{"valorPago":180000,"dataAquisicao":"2024-05-02","fornecedor":"Leilão BR"}'::jsonb,
    '[{"categoria":"Mecânica","descricao":"Revisão completa","valor":3200,"data":"2024-05-08","status":"Pago","obs":""},{"categoria":"Higienização","descricao":"Detalhamento","valor":900,"data":"2024-05-10","status":"Pago","obs":""},{"categoria":"Documentação","descricao":"Transferência","valor":1200,"data":"2024-05-09","status":"Pago","obs":""}]'::jsonb,
    'disponivel', true, 'percent', 10.5,
    265957, 263900, 255000,
    'CR-V Touring híbrida, único dono, revisões em concessionária, pneus novos.',
    '["Teto solar","Bancos em couro","Central multimídia","Câmera 360°"]'::jsonb,
    '[{"data":"2024-05-02","texto":"Veículo cadastrado."},{"data":"2024-05-10","texto":"Status alterado para Em preparação."},{"data":"2024-05-13","texto":"Veículo publicado no site."}]'::jsonb,
    '{"instagramFeed":true,"instagramStories":true,"facebook":false,"marketplace":true,"outra":false,"dataPostagem":"2024-05-13","obs":"","link":""}'::jsonb,
    '2024-05-02'::date
  ),
  (
    'BMW', 'X1', '2.0 sDrive18i Top Aut.', 2014, 2014, 95000, 'Prata', 'Gasolina', 'Automática', 4,
    '["https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?q=80&w=900&auto=format&fit=crop"]'::jsonb, 0,
    'compra', '{"valorPago":62000,"dataAquisicao":"2024-04-10","fornecedor":""}'::jsonb,
    '[{"categoria":"Funilaria","descricao":"Retoque para-choque","valor":1400,"data":"2024-04-20","status":"Pago","obs":""}]'::jsonb,
    'disponivel', true, 'valor', 15000,
    88500, 77900, 74000,
    'BMW X1 completa, revisada, pronta para rodar.',
    '["Bancos em couro","Piloto automático"]'::jsonb,
    '[{"data":"2024-04-10","texto":"Veículo cadastrado."}]'::jsonb,
    '{}'::jsonb,
    '2024-04-10'::date
  ),
  (
    'Chevrolet', 'Onix', '1.0 LT SPE/4', 2016, 2016, 92000, 'Vermelho', 'Flex', 'Manual', 4,
    '["https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=900&auto=format&fit=crop"]'::jsonb, 0,
    'consignacao', '{}'::jsonb,
    '[{"categoria":"Higienização","descricao":"Lavagem completa","valor":250,"data":"2024-05-03","status":"Pago","obs":""}]'::jsonb,
    'preparacao', false, 'percent', 8,
    49562, 48900, 46000,
    '', '[]'::jsonb,
    '[{"data":"2024-05-01","texto":"Veículo cadastrado (consignação)."}]'::jsonb,
    '{}'::jsonb,
    '2024-05-01'::date
  ),
  (
    'Fiat', 'Argo', 'Drive 1.0', 2024, 2025, 43289, 'Cinza', 'Flex', 'Manual', 4,
    '["https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=900&auto=format&fit=crop"]'::jsonb, 0,
    'compra', '{"valorPago":58000,"dataAquisicao":"2024-05-14","fornecedor":""}'::jsonb,
    '[{"categoria":"Documentação","descricao":"Transferência","valor":900,"data":"2024-05-16","status":"Pago","obs":""}]'::jsonb,
    'disponivel', true, 'percent', 9.5,
    71548, 69900, 66000,
    '', '[]'::jsonb,
    '[{"data":"2024-05-14","texto":"Veículo cadastrado."}]'::jsonb,
    '{}'::jsonb,
    '2024-05-14'::date
  ),
  (
    'Toyota', 'Corolla', '2.0 XEi Multi-Drive S', 2018, 2018, 98500, 'Preto', 'Flex', 'Automática', 4,
    '["https://images.unsplash.com/photo-1493238792000-8113da705763?q=80&w=900&auto=format&fit=crop"]'::jsonb, 0,
    'compra', '{"valorPago":72000,"dataAquisicao":"2024-04-25","fornecedor":""}'::jsonb,
    '[{"categoria":"Pneus","descricao":"Jogo de pneus","valor":1900,"data":"2024-05-02","status":"Pago","obs":""}]'::jsonb,
    'disponivel', true, 'percent', 9,
    93872, 87500, 84000,
    '', '[]'::jsonb,
    '[{"data":"2024-04-25","texto":"Veículo cadastrado."}]'::jsonb,
    '{}'::jsonb,
    '2024-04-25'::date
  ),
  (
    'Ford', 'EcoSport', 'SE 1.5 Aut. (Flex)', 2018, 2018, 98500, 'Prata', 'Flex', 'Automática', 4,
    '["https://images.unsplash.com/photo-1571607388263-1044f9ea01dd?q=80&w=900&auto=format&fit=crop"]'::jsonb, 0,
    'troca', '{}'::jsonb,
    '[]'::jsonb,
    'vendido', false, 'percent', 20,
    61184, 64900, 60000,
    '', '[]'::jsonb,
    '[{"data":"2024-03-10","texto":"Veículo cadastrado (troca)."},{"data":"2024-04-02","texto":"Veículo vendido por R$ 64.900,00."}]'::jsonb,
    '{}'::jsonb,
    '2024-03-10'::date
  )
) as seed
where not exists (select 1 from public.veiculos);

-- Normalize rows from before the status list was simplified (safe to re-run, no-ops once clean):
-- "Publicado" duplicated the `publicado` checkbox -> merged into "Disponível".
-- "Reservado" duplicated "Em negociação" -> merged into it.
-- "Cadastrado" was dropped -> merged into "Em preparação".
update public.veiculos set status = 'disponivel' where status = 'publicado';
update public.veiculos set status = 'negociacao' where status = 'reservado';
update public.veiculos set status = 'preparacao' where status = 'cadastrado';
-- publicado can now only be true while status is preparacao/disponivel; clean up any rows left
-- inconsistent by the old rule (checking the box used to force status to disponivel instead).
update public.veiculos set publicado = false where publicado = true and status not in ('preparacao', 'disponivel');

-- ============================================================
-- STORAGE: vehicle photo uploads
-- The "veiculos-fotos" bucket itself is created via the Storage API (not SQL), but access to it
-- is still governed by RLS on storage.objects like any other table.
-- ============================================================
drop policy if exists "veiculos-fotos leitura publica" on storage.objects;
create policy "veiculos-fotos leitura publica"
  on storage.objects for select
  to public
  using (bucket_id = 'veiculos-fotos');

drop policy if exists "veiculos-fotos upload autenticado" on storage.objects;
create policy "veiculos-fotos upload autenticado"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'veiculos-fotos');

drop policy if exists "veiculos-fotos exclusao autenticada" on storage.objects;
create policy "veiculos-fotos exclusao autenticada"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'veiculos-fotos');

-- ============================================================
-- CONTATOS (leads from the public "Tenho interesse" form)
-- ============================================================
create table if not exists public.contatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  telefone text not null default '',
  email text not null default '',
  veiculo_id uuid references public.veiculos(id) on delete set null,
  tipo text not null default '',
  status text not null default 'Novo',
  data date not null default current_date,
  created_at timestamptz not null default now()
);

-- Free-text details for requests that don't fit the fixed columns: the customer's own car info for
-- consignação (marca/modelo/km/valor desejado), a preferred day/time for test-drive or videochamada, etc.
alter table public.contatos add column if not exists mensagem text not null default '';

alter table public.contatos enable row level security;

-- Anyone (including anonymous site visitors) can submit the interest form...
drop policy if exists "contatos podem ser enviados por qualquer um" on public.contatos;
create policy "contatos podem ser enviados por qualquer um"
  on public.contatos for insert
  to anon, authenticated
  with check (true);

-- ...but only the logged-in admin can read or update them (name/phone/email are PII).
drop policy if exists "autenticados veem contatos" on public.contatos;
create policy "autenticados veem contatos"
  on public.contatos for select
  to authenticated
  using (true);

drop policy if exists "autenticados atualizam contatos" on public.contatos;
create policy "autenticados atualizam contatos"
  on public.contatos for update
  to authenticated
  using (true)
  with check (true);
 