# Utility Tools

This folder contains auxiliary tools for data migration and system utilities.

---

## Update Plans Script

Updates only the plan (planoId) for existing members by matching them via CPF.

### Usage

```bash
npm run update:plans
```

### What it does:

1. Reads the exported CSV from `utility/csv/nextfit-export-*.csv`
2. Finds members in your database by CPF
3. Creates missing plans automatically (from NextFit plan names)
4. Updates the `planoId` for each member

### Notes:

- Plans are created with `valor: 0` - you'll need to update prices manually
- Weekly sessions are extracted from plan name (e.g., "TREINO 3X" → 3 sessions)
- Members not found in database are skipped

---

## Payments Sync (Local -> Supabase)

Adds missing payments from the local database to Supabase without overwriting existing rows.

### Usage

```bash
# Dry run (recommended first)
SUPABASE_DATABASE_URL="postgresql://..." npx tsx utility/sync-payments-to-supabase.ts --dry-run

# Live run
SUPABASE_DATABASE_URL="postgresql://..." npx tsx utility/sync-payments-to-supabase.ts
```

### Notes

- Uses `DATABASE_URL` for local DB by default (override with `LOCAL_DATABASE_URL`)
- Use Supabase direct connection (port 5432) for best reliability
- Skips payments that already exist remotely (by `id`)
- Skips payments whose `membroId` or `planoId` does not exist in Supabase

---

## NextFit Scraper

Extracts member data from the NextFit system (`https://app.nextfit.com.br/cliente/lista`) and exports to CSV format.

### Output Format

```csv
nome,email,cpf,telefone,data_nascimento,plano
Maria Silva,maria@email.com,123.456.789-10,(11)99999-0000,12/03/1990,Mensal
```

Missing data will be filled with "Pendente".

---

## Anamnesis Scraper

Extracts individual anamnesis (health questionnaire) answers from NextFit for all members.

### Usage

```bash
npm run scrape:anamnesis
# or
npx tsx utility/scrape-anamnesis.ts
```

### What it does:
1. Opens a browser window (uses Playwright)
2. Checks if you're logged in (prompts for manual login if needed)
3. Fetches all member IDs from the list
4. Visits each member's anamnesis page
5. Extracts question/answer pairs
6. Saves results to JSON

### Environment Variables (Optional)

```bash
NEXTFIT_USER=your@email.com
NEXTFIT_PASS=yourpassword
```

### Output Format

Results are saved to `utility/csv/anamnesis-dump-{date}.json`:

```json
{
  "success": true,
  "totalMembers": 50,
  "successfulExtractions": 48,
  "failedExtractions": 2,
  "data": [
    {
      "memberId": 123,
      "memberName": "Maria Silva",
      "extractedAt": "2025-01-14T12:00:00.000Z",
      "questions": [
        { "pergunta": "Tem alguma restrição médica?", "resposta": "Não" },
        { "pergunta": "Pratica exercícios regularmente?", "resposta": "Sim" }
      ]
    }
  ],
  "errors": []
}
```

### Customization

**Important:** The CSS selectors in the script are placeholders. To customize:

1. Open `https://app.nextfit.com.br` in your browser
2. Navigate to a member's anamnesis page
3. Inspect the HTML structure (F12 → Elements)
4. Update the selectors in `scrape-anamnesis.ts` to match the actual DOM

Look for:
- `anamnesisTabSelectors` - How to navigate to the anamnesis tab
- `formGroupSelectors` - The structure of question/answer pairs
- Table patterns or specific CSS classes

---

## Method 1: Browser Console Script (Recommended)

The easiest method - runs directly in your browser.

### Steps:

1. Open `https://app.nextfit.com.br/cliente/lista` in your browser
2. Login with your credentials
3. Open DevTools (F12 or Cmd+Option+I on Mac)
4. Go to the **Console** tab
5. Copy the contents of `utility/console-extractor.js`
6. Paste into the console and press Enter
7. Wait for extraction to complete (~2-3 minutes for 159 members)
8. CSV file will be automatically downloaded

### What it does:
- Fetches all member IDs from the list API
- For each member, fetches their full details (email, CPF, phone, etc.)
- Attempts to fetch their active plan from contracts
- Generates and downloads a CSV file

---

## Method 2: Playwright Automation

Uses Playwright to automate browser interaction. Requires manual login due to Cloudflare protection.

### Steps:

```bash
# Install dependencies (if not already)
npm install playwright
npx playwright install chromium

# Run the extractor
npx tsx utility/extract-members.ts
```

The script will:
1. Open a browser window
2. If not logged in, wait for you to login manually
3. Extract all member IDs from the list
4. Visit each member's registration page
5. Extract details and save to CSV

---

## Method 3: Manual API Data Export

If you prefer to extract the raw API data manually:

1. Open `https://app.nextfit.com.br/cliente/lista`
2. Open DevTools (F12) → Network tab
3. Look for request to `RecuperarPesquisaGeral`
4. Right-click → Copy → Copy response
5. Save to `utility/csv/raw-data.json`
6. Run: `npx tsx utility/browser-extract.ts`

**Note:** This method only gets basic info (name, birth date, sex). Full details require Method 1 or 2.

---

## Output Location

All CSV files are saved to: `utility/csv/`

Files are named: `nextfit-export-{YYYY-MM-DD}.csv`

---

## Troubleshooting

### Cloudflare blocking automation
- Use Method 1 (Console Script) - it runs in your authenticated browser session
- Or use Method 2 with manual login

### Missing data
- Some members may not have email, CPF, or phone registered
- These fields will show "Pendente"

### Rate limiting
- The scripts include delays between API calls
- If you get errors, try increasing the delay

### API errors
- Make sure you're logged in
- Check if your session hasn't expired
- Try refreshing the page and running again
