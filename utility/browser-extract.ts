/**
 * NextFit Browser Data Extractor
 * 
 * This script is meant to be used with the data captured from the NextFit API.
 * 
 * HOW TO USE:
 * 1. Open https://app.nextfit.com.br/cliente/lista in Cursor browser
 * 2. Open browser DevTools (F12) -> Network tab
 * 3. Look for request to: api.nextfit.com.br/api/Cliente/RecuperarPesquisaGeral
 * 4. Copy the response JSON
 * 5. Save it to utility/csv/raw-data.json
 * 6. Run: npx tsx utility/browser-extract.ts
 * 
 * OR use the API directly with the token from browser.
 */

import * as fs from "fs";
import * as path from "path";

const CONFIG = {
  outputDir: path.join(__dirname, "csv"),
  defaultValue: "Pendente",
};

interface NextFitClient {
  Id: number;
  Nome: string;
  DataNascimento?: string;
  Sexo?: string;
  Inativo?: boolean;
  ClienteParametro?: {
    Status?: string;
    Vip?: boolean;
    UrlImagem?: string;
  };
  // Additional fields that might come from detail page
  Cpf?: string;
  Email?: string;
  Celular?: string;
  Telefone?: string;
  Plano?: string;
}

interface Member {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  data_nascimento: string;
  plano: string;
}

interface ApiResponse {
  Data: NextFitClient[];
  Total: number;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return CONFIG.defaultValue;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return CONFIG.defaultValue;
    
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return CONFIG.defaultValue;
  }
}

function transformClient(client: NextFitClient): Member {
  return {
    nome: client.Nome || CONFIG.defaultValue,
    email: client.Email || CONFIG.defaultValue,
    cpf: client.Cpf || CONFIG.defaultValue,
    telefone: client.Celular || client.Telefone || CONFIG.defaultValue,
    data_nascimento: formatDate(client.DataNascimento),
    plano: client.Plano || CONFIG.defaultValue,
  };
}

function toCSV(members: Member[]): string {
  const headers = "nome,email,cpf,telefone,data_nascimento,plano";
  const rows = members.map((m) =>
    [m.nome, m.email, m.cpf, m.telefone, m.data_nascimento, m.plano]
      .map(escapeCSV)
      .join(",")
  );
  return [headers, ...rows].join("\n");
}

async function main() {
  const rawDataPath = path.join(CONFIG.outputDir, "raw-data.json");
  
  if (!fs.existsSync(rawDataPath)) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              NextFit Browser Data Extractor                      ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Raw data file not found at:                                     ║
║  ${rawDataPath}
║                                                                  ║
║  HOW TO GET THE DATA:                                            ║
║                                                                  ║
║  1. Open https://app.nextfit.com.br/cliente/lista                ║
║  2. Open DevTools (F12) -> Network tab                           ║
║  3. Refresh the page                                             ║
║  4. Find request: RecuperarPesquisaGeral                         ║
║  5. Right-click -> Copy -> Copy response                         ║
║  6. Save to: utility/csv/raw-data.json                           ║
║  7. Run this script again                                        ║
║                                                                  ║
║  TIP: Change the limit parameter in the URL to 200 to get        ║
║  all members in one request.                                     ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
    return;
  }

  console.log("📂 Reading raw data...");
  const rawData = JSON.parse(fs.readFileSync(rawDataPath, "utf-8")) as ApiResponse;
  
  console.log(`📊 Found ${rawData.Data?.length || 0} clients (Total: ${rawData.Total})`);
  
  if (!rawData.Data || rawData.Data.length === 0) {
    console.log("❌ No client data found in the file.");
    return;
  }

  const members = rawData.Data.map(transformClient);
  
  const timestamp = new Date().toISOString().split("T")[0];
  const csvPath = path.join(CONFIG.outputDir, `nextfit-export-${timestamp}.csv`);
  
  const csvContent = toCSV(members);
  fs.writeFileSync(csvPath, csvContent, "utf-8");
  
  console.log(`✅ CSV saved to: ${csvPath}`);
  console.log(`📊 Total members exported: ${members.length}`);
  console.log("\n📋 Sample data:");
  console.log(csvContent.split("\n").slice(0, 6).join("\n"));
  
  // Show warning about missing fields
  const missingEmail = members.filter(m => m.email === CONFIG.defaultValue).length;
  const missingCpf = members.filter(m => m.cpf === CONFIG.defaultValue).length;
  const missingPhone = members.filter(m => m.telefone === CONFIG.defaultValue).length;
  const missingPlan = members.filter(m => m.plano === CONFIG.defaultValue).length;
  
  if (missingEmail > 0 || missingCpf > 0 || missingPhone > 0 || missingPlan > 0) {
    console.log("\n⚠️  Missing data summary:");
    if (missingEmail > 0) console.log(`   - Email: ${missingEmail} members`);
    if (missingCpf > 0) console.log(`   - CPF: ${missingCpf} members`);
    if (missingPhone > 0) console.log(`   - Telefone: ${missingPhone} members`);
    if (missingPlan > 0) console.log(`   - Plano: ${missingPlan} members`);
    console.log("\n   The list API doesn't include all fields.");
    console.log("   You may need to fetch individual member details.");
  }
}

main().catch(console.error);

