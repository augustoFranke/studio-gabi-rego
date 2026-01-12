/**
 * NextFit Member Scraper
 *
 * This script is designed to be run manually with the Cursor browser tools.
 * It extracts member data from NextFit and exports to CSV.
 *
 * INSTRUCTIONS:
 * 1. Open https://app.nextfit.com.br/cliente/lista in Cursor browser
 * 2. Login manually
 * 3. Run: npx tsx utility/nextfit-scraper.ts
 *
 * The script will use the network requests captured from the browser
 * or you can use the extract-from-browser.ts script with Cursor browser tools.
 */

import * as fs from "fs";
import * as path from "path";

// Configuration
const CONFIG = {
  outputDir: path.join(__dirname, "csv"),
  defaultValue: "Pendente",
};

interface Member {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  data_nascimento: string;
  plano: string;
}

/**
 * Escapes a CSV field value
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts members array to CSV string
 */
function toCSV(members: Member[]): string {
  const headers = "nome,email,cpf,telefone,data_nascimento,plano";
  const rows = members.map((m) =>
    [m.nome, m.email, m.cpf, m.telefone, m.data_nascimento, m.plano]
      .map(escapeCSV)
      .join(",")
  );
  return [headers, ...rows].join("\n");
}

/**
 * Saves members to CSV file
 */
export function saveToCSV(members: Member[]): string {
  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const csvPath = path.join(CONFIG.outputDir, `nextfit-export-${timestamp}.csv`);

  const csvContent = toCSV(members);
  fs.writeFileSync(csvPath, csvContent, "utf-8");

  console.log(`✅ CSV saved to: ${csvPath}`);
  console.log(`📊 Total members: ${members.length}`);
  console.log("\n📋 Sample data:");
  console.log(csvContent.split("\n").slice(0, 6).join("\n"));

  return csvPath;
}

/**
 * Creates a member object with default values
 */
export function createMember(data: Partial<Member>): Member {
  return {
    nome: data.nome || CONFIG.defaultValue,
    email: data.email || CONFIG.defaultValue,
    cpf: data.cpf || CONFIG.defaultValue,
    telefone: data.telefone || CONFIG.defaultValue,
    data_nascimento: data.data_nascimento || CONFIG.defaultValue,
    plano: data.plano || CONFIG.defaultValue,
  };
}

// If run directly, show instructions
if (require.main === module) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                   NextFit Member Scraper                         ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  This scraper requires manual browser interaction due to         ║
║  Cloudflare protection on the NextFit website.                   ║
║                                                                  ║
║  INSTRUCTIONS:                                                   ║
║                                                                  ║
║  1. Open the Cursor browser and navigate to:                     ║
║     https://app.nextfit.com.br/cliente/lista                     ║
║                                                                  ║
║  2. Login with your credentials                                  ║
║                                                                  ║
║  3. Use the Cursor browser tools to:                             ║
║     - Take a snapshot of the page                                ║
║     - Navigate through members                                   ║
║     - Extract data from each member's cadastro page              ║
║                                                                  ║
║  4. The data will be saved to:                                   ║
║     ${CONFIG.outputDir}                                          ║
║                                                                  ║
║  Alternatively, use the browser-extract.ts script with the       ║
║  Cursor AI to automate the extraction process.                   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

export { CONFIG };
export type { Member };
