-- Run this in the Supabase SQL Editor (against your Supabase project DB).
-- It enables RLS on all tables flagged by Security Advisor lint 0013.

-- 1) Enable RLS
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
ALTER TABLE public."horarios_fixos" ENABLE ROW LEVEL SECURITY;

-- 2) Baseline policy for privileged roles
-- Use the current role and include service_role if it exists.
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

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_horarios_fixos',
      'horarios_fixos',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$$;

-- 3) Verify RLS is enabled for the flagged tables
SELECT
  n.nspname AS schema,
  c.relname AS table,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    '_prisma_migrations',
    'membros',
    'configuracoes',
    'planos',
    'notificacoes',
    'fichas_treino',
    'pagamentos',
    'exercicios',
    'horarios_disponiveis',
    'agendamentos',
    'usuarios',
    'anamneses',
    'treinos_template',
    'treinos_template_exercicios',
    'horarios_fixos'
  )
ORDER BY c.relname;

