# Prisma + Supabase Security Checklist

## Connection Security

### Connection Strings
- [ ] **SSL/TLS enforced**
  - Check: `sslmode=require` in DATABASE_URL
  - Risk: Data in transit interception

- [ ] **Credentials not hardcoded**
  - All connection strings in `.env` files
  - `.env.production` is gitignored

- [ ] **Correct pooler configuration**
  ```
  DATABASE_URL    -> Transaction pooler (port 6543) + pgbouncer=true
  DIRECT_URL      -> Session pooler or direct (port 5432)
  ```
  - Risk: Prepared statement issues without `pgbouncer=true`

### Credential Rotation
- [ ] **Password not default or weak**
- [ ] **Credentials rotated after any potential exposure**
- [ ] **Service role key protected (never in client code)**

---

## Row Level Security (RLS)

### RLS Enablement
- [ ] **RLS enabled on ALL tables**
  - Check: `rls_enable_public.sql` covers all tables in schema
  - Verify: Run query to confirm:
  ```sql
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public';
  ```

### Policy Coverage
- [ ] **Policies exist for each table**
  - Current setup: `p_full_access_*` policies for service_role only
  - Risk: If Supabase client used directly (not via Prisma), no protection

- [ ] **Policies follow least privilege**
  ```sql
  -- DANGEROUS: Open access
  CREATE POLICY "allow_all" ON membros FOR ALL USING (true);
  
  -- SECURE: Scoped access
  CREATE POLICY "users_own_data" ON membros 
    FOR ALL 
    USING (auth.uid() = usuario_id);
  ```

### Bypass Risks
- [ ] **Application uses service_role only through Prisma**
  - Supabase client with anon key would bypass Prisma auth layer
  - Verify: No `@supabase/supabase-js` usage with anon key for data access

---

## Prisma Query Security

### SQL Injection
- [ ] **No string interpolation in raw queries**
  ```typescript
  // DANGEROUS: SQL Injection
  const users = await prisma.$queryRaw`
    SELECT * FROM usuarios WHERE email = '${email}'
  `
  
  // SECURE: Parameterized
  const users = await prisma.$queryRaw`
    SELECT * FROM usuarios WHERE email = ${email}
  `
  // Note: Template literal with Prisma.sql auto-parameterizes
  ```

- [ ] **No `$queryRawUnsafe` with user input**
  - This method does NOT parameterize
  - Grep: `\$queryRawUnsafe` should have zero results with user data

### Mass Assignment
- [ ] **Create/Update don't accept raw request body**
  ```typescript
  // DANGEROUS: Mass assignment
  const body = await request.json()
  await prisma.usuario.update({
    where: { id },
    data: body  // Attacker could set role: "ADMIN"!
  })
  
  // SECURE: Explicit field mapping
  const { nome, email } = validation.data
  await prisma.usuario.update({
    where: { id },
    data: { nome, email }
  })
  ```

### Field Selection
- [ ] **Sensitive fields never returned in queries**
  - Use `select` to whitelist fields
  - Never return: `senha`, `tokenReset`, `tokenVerificacao`, `anamneseToken`

  ```typescript
  // DANGEROUS: Returns password hash
  const user = await prisma.usuario.findUnique({ where: { id } })
  
  // SECURE: Explicit selection
  const user = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      nome: true,
      role: true,
      // senha: false (omitted)
    }
  })
  ```

---

## Transaction Safety

### Atomic Operations
- [ ] **Related changes wrapped in `$transaction`**
  - User + Member creation should be atomic
  - Payment status + balance updates should be atomic
  - Risk: Partial updates leave inconsistent state

### Race Conditions
- [ ] **Concurrent updates handled**
  - Use `@updatedAt` for optimistic locking
  - Or `SELECT FOR UPDATE` in transactions

```typescript
// DANGEROUS: Race condition
const slot = await prisma.horarioDisponivel.findUnique({ where: { id } })
if (slot.vagasDisponiveis > 0) {
  await prisma.agendamento.create({ ... })
  await prisma.horarioDisponivel.update({
    where: { id },
    data: { vagasDisponiveis: slot.vagasDisponiveis - 1 }
  })
}

// SECURE: Atomic with conditional
await prisma.horarioDisponivel.update({
  where: { id, vagasDisponiveis: { gt: 0 } },
  data: { vagasDisponiveis: { decrement: 1 } }
})
```

---

## Cascade Delete Implications

### Data Integrity
- [ ] **Cascade deletes don't orphan critical data**
  - Check: `onDelete: Cascade` in schema.prisma
  - Verify: Deleting a user deletes their sensitive data (good)
  - Verify: Deleting a user doesn't orphan financial records (check)

### Audit Trail
- [ ] **Soft deletes for auditable entities**
  - Payments, important transactions should use status flags
  - Not hard deletes

---

## Sensitive Data Handling

### PII Storage
- [ ] **CPF, RG stored encrypted or hashed if not needed for lookup**
  - Current: Stored as plaintext (required for business logic)
  - Mitigation: Database-level encryption at rest

### Password Handling
- [ ] **Passwords hashed with bcrypt, cost >= 12**
  ```typescript
  // Verify in auth.ts
  const senhaHash = await hash(password, 12)  // Cost factor 12
  ```

### Token Generation
- [ ] **Tokens use cryptographically secure random**
  ```typescript
  // SECURE
  import { randomBytes } from "crypto"
  const token = randomBytes(32).toString("hex")  // 256 bits
  
  // DANGEROUS
  const token = Math.random().toString(36)  // Predictable!
  ```

### Token Expiry
- [ ] **All tokens have expiration**
  - `tokenVerificacaoExpira`
  - `tokenResetExpira`
  - `anamneseTokenExpira`
  - Check: Expiry validated before use

---

## Migration Security

### Migration Files
- [ ] **No secrets in migration files**
  - Migrations are committed to git
  - Seeds should use env vars, not hardcoded values

### Schema Changes
- [ ] **Destructive migrations reviewed**
  - Column drops, table drops need data backup plan
  - Use `prisma migrate diff` to preview changes

---

## Supabase-Specific

### API Keys
- [ ] **Anon key not used for privileged operations**
  - Anon key is public (in browser)
  - Service role key is secret (server only)

### Realtime
- [ ] **Realtime subscriptions respect RLS**
  - If using Supabase Realtime, RLS applies
  - Verify: Users can't subscribe to other users' data

### Storage
- [ ] **Storage buckets have proper policies**
  - If using Supabase Storage for uploads
  - Public buckets: Only for truly public assets
  - Private buckets: RLS-based access
