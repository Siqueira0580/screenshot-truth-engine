## Histórico de Logins (Painel Admin)

Adiciona auditoria de acessos por utilizador, exibida na aba **Utilizadores** do Painel Admin, com coluna "Último Acesso" e painel lateral de histórico cronológico.

### 1. Banco de Dados (migração)

Cria tabela `public.user_login_logs`:
- `id uuid PK default gen_random_uuid()`
- `user_id uuid NOT NULL` (referencia `auth.users.id` lógicamente, sem FK para evitar lock em `auth`)
- `login_at timestamptz NOT NULL default now()`
- `ip_address text NULL`
- `user_agent text NULL` (extra útil)

Índices:
- `idx_user_login_logs_user_login_at (user_id, login_at desc)`

RLS:
- Enable RLS.
- Policy SELECT: `has_role(auth.uid(), 'admin')` OU `user_id = auth.uid()` (utilizador vê o próprio histórico, admin vê tudo).
- Policy INSERT: `auth.uid() = user_id` (cliente registra o próprio login após `SIGNED_IN`).
- Sem UPDATE/DELETE para utilizadores; admin pode DELETE (`has_role`).

Observação técnica importante: o Supabase **não permite triggers em `auth.users`** a partir de migrações geridas. Por isso o registo é feito do **front-end** no `AuthContext` no evento `SIGNED_IN`, garantido pela policy de INSERT (apenas o próprio user). Isto é coerente com a arquitetura atual da app.

### 2. Registro automático de login (front-end)

No `src/contexts/AuthContext.tsx`, ao receber `SIGNED_IN`:
- Inserir em `user_login_logs` `{ user_id, ip_address: null, user_agent: navigator.userAgent }`.
- Usar guard com `sessionStorage` (`login_logged_<uid>`) para evitar duplicações em refresh/foco da aba.
- Fire-and-forget (não bloqueia UI; não exibe erro ao utilizador).

### 3. UI - Aba de Utilizadores (`AdminUsersTab.tsx`)

Mudanças:
- Buscar último login por utilizador num único query agregado:
  - `select user_id, max(login_at)` em `user_login_logs` agrupado e juntado em memória ao array de profiles.
- Nova coluna **"Último Acesso"** após "Cadastro": exibe data/hora formatada `DD/MM/YYYY às HH:mm` (pt-BR) ou `Nunca` se nulo.
- Novo botão ícone `History` (lucide) em cada linha, antes do menu `MoreVertical`, abrindo um `Sheet` lateral.

### 4. Sheet de Histórico de Logins

Novo componente `src/components/admin/UserLoginHistorySheet.tsx`:
- Props: `userId`, `userLabel`, `open`, `onOpenChange`.
- Carrega `user_login_logs` filtrado por `user_id`, ordenado `login_at desc`, paginação client-side por blocos de 30 (botão "Carregar mais").
- Agrupamento visual por dia: cabeçalhos "Hoje", "Ontem", ou `"DD de mês"` (pt-BR via `Intl.DateTimeFormat`).
- Cada item: hora `HH:mm`, ícone relógio, opcional IP/user-agent resumido.
- Estados: loading skeleton, vazio ("Nenhum acesso registrado").

### 5. Performance

- Índice composto `(user_id, login_at desc)` cobre tanto o histórico individual quanto o `max(login_at)` por utilizador.
- Listagem geral usa **uma única query** agregada para últimos acessos.
- Sheet usa paginação `range()` do Supabase (limite 30 por página).

### Arquivos afetados

- **Nova migração SQL** (tabela + índice + RLS).
- `src/contexts/AuthContext.tsx` — insert no `SIGNED_IN`.
- `src/components/admin/AdminUsersTab.tsx` — coluna + botão histórico.
- `src/components/admin/UserLoginHistorySheet.tsx` — novo painel lateral.

### Trecho SQL principal

```sql
create table public.user_login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  login_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index idx_user_login_logs_user_login_at
  on public.user_login_logs (user_id, login_at desc);

alter table public.user_login_logs enable row level security;

create policy "Admin or self can read login logs"
  on public.user_login_logs for select to authenticated
  using (has_role(auth.uid(),'admin') or user_id = auth.uid());

create policy "User can insert own login log"
  on public.user_login_logs for insert to authenticated
  with check (user_id = auth.uid());

create policy "Admin can delete login logs"
  on public.user_login_logs for delete to authenticated
  using (has_role(auth.uid(),'admin'));
```

Pronto para aprovar e implementar.