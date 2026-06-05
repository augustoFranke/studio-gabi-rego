-- Enable Row Level Security (RLS) on public tables exposed by Supabase PostgREST.
-- This addresses Supabase Security Advisor lint 0013 (rls_disabled_in_public).
--
-- We also add a baseline "full access" policy for privileged roles so Prisma
-- migrations and server-side access keep working. In Supabase, `postgres` and
-- `service_role` bypass RLS, but we still add a policy defensively.
--
-- The `service_role` role does not exist in local Postgres by default,
-- so we check for it before including it in policies.

-- 1) Enable RLS on all flagged tables
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."membros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."configuracoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."planos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notificacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fichas_treino" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pagamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."exercicios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."horarios_disponiveis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."agendamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."anamneses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."treinos_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."treinos_template_exercicios" ENABLE ROW LEVEL SECURITY;

-- 2) Baseline policies for privileged roles
-- Use the current database role, and include `service_role` when present.
DO $$
DECLARE
  roles text[] := ARRAY[current_user];
  role_list text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    roles := array_append(roles, 'service_role');
  END IF;

  SELECT string_agg(quote_ident(r), ', ')
  INTO role_list
  FROM unnest(roles) AS r;

  -- Helper: create policy and ignore duplicates
  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access__prisma_migrations',
      '_prisma_migrations',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_membros',
      'membros',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_configuracoes',
      'configuracoes',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_planos',
      'planos',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_notificacoes',
      'notificacoes',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_fichas_treino',
      'fichas_treino',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_pagamentos',
      'pagamentos',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_exercicios',
      'exercicios',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_horarios_disponiveis',
      'horarios_disponiveis',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_agendamentos',
      'agendamentos',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_usuarios',
      'usuarios',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_anamneses',
      'anamneses',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_treinos_template',
      'treinos_template',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_treinos_template_exercicios',
      'treinos_template_exercicios',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$$;
