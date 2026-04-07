-- Enable Row Level Security (RLS) on tables created after the initial RLS migration.
-- Addresses Supabase Security Advisor lint 0013 (rls_disabled_in_public) for:
--   - horarios_fixos        (created by 20260128130000_add_horarios_fixos)
--   - pagamento_import_runs (created by 20260223103841_add_pagamento_import_audit)
--   - pagamento_import_logs (created by 20260223103841_add_pagamento_import_audit)
--
-- All three tables are accessed server-side only (Prisma / Node.js).
-- The policy grants full access to the migrating role and service_role (Supabase),
-- consistent with the pattern in 20260127120000_enable_rls_public/migration.sql.

-- 1) Enable RLS
ALTER TABLE public."horarios_fixos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pagamento_import_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pagamento_import_logs" ENABLE ROW LEVEL SECURITY;

-- 2) Baseline policies for privileged roles
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
      'p_full_access_horarios_fixos',
      'horarios_fixos',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_pagamento_import_runs',
      'pagamento_import_runs',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (true) WITH CHECK (true)',
      'p_full_access_pagamento_import_logs',
      'pagamento_import_logs',
      role_list
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$$;
