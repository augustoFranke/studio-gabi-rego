/**
 * NextFit Direct API Extraction
 * 
 * This script extracts member data directly from the NextFit API v2.
 * It requires the JWT token from an authenticated browser session.
 */

import * as fs from "fs";
import * as path from "path";

const CONFIG = {
  outputDir: path.join(__dirname, "csv"),
  defaultValue: "Pendente",
  delayMs: 200,
  token: process.env.NEXTFIT_TOKEN || "",
};

interface Member {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  data_nascimento: string;
  plano: string;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

function formatDate(dateStr: string | undefined | null): string {
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAPI(url: string, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} - ${text.substring(0, 100)}`);
  }
  
  return response.json();
}

interface ClienteV2 {
  Id: number;
  Nome: string;
  Email?: string;
  Cpf?: string;
  Celular?: string;
  Telefone?: string;
  Fone?: string;
  DddFone?: string;
  DataNascimento?: string;
  Contatos?: Array<{ Contato?: string; TipoContato?: { Nome?: string; Id?: number } }>;
}

// Debug flag
const DEBUG = process.env.DEBUG === "1";

interface ContratoResponse {
  Content?: Array<{
    Status?: number;
    ContratoBase?: { 
      Descricao?: string;
      Modalidade?: { Descricao?: string };
    };
  }>;
}

async function main() {
  console.log("🚀 Starting NextFit Direct API Extraction (v2)...\n");
  
  if (!CONFIG.token) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    TOKEN REQUIRED                                ║
║  Run: NEXTFIT_TOKEN="your_token" npx tsx utility/run-extraction.ts
╚══════════════════════════════════════════════════════════════════╝
`);
    return;
  }
  
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  try {
    // Step 1: Get all members from list
    console.log("📋 Step 1: Fetching member list...");
    
    const listUrl = "https://api.nextfit.com.br/api/Cliente/RecuperarPesquisaGeral?" +
      new URLSearchParams({
        limit: "500",
        page: "1",
        fields: JSON.stringify(["Id", "Nome", "DataNascimento"]),
        includes: JSON.stringify(["ClienteParametro"]),
        sort: JSON.stringify([{ property: "Nome", direction: "ASC" }]),
        filter: "[]",
        VerRemovidos: "false",
        VerVIPs: "false",
        Descricao: "",
        TipoVinculoStr: "[1,2]",
      }).toString();
    
    const listData = await fetchAPI(listUrl, CONFIG.token) as { 
      Content?: Array<{ Id: number; Nome: string; DataNascimento?: string }>;
      Total: number 
    };
    
    const memberList = listData.Content || [];
    console.log(`   Found ${memberList.length} members (Total: ${listData.Total})\n`);
    
    if (memberList.length === 0) {
      console.log("❌ No members found!");
      return;
    }
    
    // Step 2: Fetch full details for each member using v2 API
    console.log("📝 Step 2: Fetching member details (using v2 API)...\n");
    
    const results: Member[] = [];
    
    for (let i = 0; i < memberList.length; i++) {
      const member = memberList[i];
      const memberId = member.Id;
      
      process.stdout.write(`   ${(i + 1).toString().padStart(3)}/${memberList.length}: ${member.Nome.substring(0, 35).padEnd(35)} `);
      
      try {
        // Use v2 API with includes to get full details
        const detailUrl = "https://api.nextfit.com.br/api/v2/Cliente/Listar?" +
          new URLSearchParams({
            includes: JSON.stringify(["Cidade", "Contatos", "Cliente.ClienteParametro", "Contatos.TipoContato"]),
            filter: JSON.stringify([{ property: "Id", operator: "equal", value: String(memberId) }]),
            limit: "1",
            page: "1",
          }).toString();
        
        const detailData = await fetchAPI(detailUrl, CONFIG.token) as { Content?: ClienteV2[] };
        const details = detailData.Content?.[0];
        
        // Debug first member
        if (DEBUG && i === 0) {
          console.log("\n📋 DEBUG - First member raw data:");
          console.log(JSON.stringify(details, null, 2));
        }
        
        // Build phone number from DddFone + Fone
        let telefone = CONFIG.defaultValue;
        if (details?.DddFone && details?.Fone) {
          telefone = `(${details.DddFone})${details.Fone}`;
        } else if (details?.Fone) {
          telefone = details.Fone;
        } else if (details?.Celular) {
          telefone = details.Celular;
        } else if (details?.Telefone) {
          telefone = details.Telefone;
        }
        
        const result: Member = {
          nome: details?.Nome || member.Nome || CONFIG.defaultValue,
          email: details?.Email || CONFIG.defaultValue,
          cpf: details?.Cpf || CONFIG.defaultValue,
          telefone,
          data_nascimento: formatDate(details?.DataNascimento || member.DataNascimento),
          plano: CONFIG.defaultValue,
        };
        
        // Extract phone from Contatos if not directly available
        if (result.telefone === CONFIG.defaultValue && details?.Contatos && details.Contatos.length > 0) {
          // Try to find phone contact
          const phoneContact = details.Contatos.find(c => {
            const tipoNome = c.TipoContato?.Nome?.toLowerCase() || "";
            return tipoNome.includes("celular") ||
                   tipoNome.includes("telefone") ||
                   tipoNome.includes("whatsapp") ||
                   tipoNome.includes("fone");
          });
          
          if (phoneContact?.Contato) {
            result.telefone = phoneContact.Contato;
          }
        }
        
        // Extract email from Contatos if not directly available
        if (result.email === CONFIG.defaultValue && details?.Contatos) {
          const emailContact = details.Contatos.find(c => 
            c.TipoContato?.Nome?.toLowerCase().includes("email") ||
            (c.Contato && c.Contato.includes("@"))
          );
          if (emailContact?.Contato) {
            result.email = emailContact.Contato;
          }
        }
        
        // Try to get active plan from contracts
        try {
          const contractUrl = "https://api.nextfit.com.br/api/contratocliente/v2/Listar?" +
            new URLSearchParams({
              fields: JSON.stringify([
                "Id", "Status", "ContratoBase.Id", "ContratoBase.Descricao", 
                "ContratoBase.Modalidade.Descricao"
              ]),
              filter: JSON.stringify([
                { property: "CodigoCliente", operator: "equal", value: String(memberId), and: true },
                { property: "Status", operator: "in", value: [1, 3, 4, 5, 6, 7], and: true } // Active statuses
              ]),
              limit: "10",
              page: "1",
              sort: JSON.stringify([{ property: "Id", direction: "desc" }]),
            }).toString();
          
          const contracts = await fetchAPI(contractUrl, CONFIG.token) as ContratoResponse;
          
          if (contracts.Content && contracts.Content.length > 0) {
            // Get the most recent contract with a description
            const contract = contracts.Content.find(c => c.ContratoBase?.Descricao) || contracts.Content[0];
            if (contract?.ContratoBase?.Descricao) {
              result.plano = contract.ContratoBase.Descricao;
            } else if (contract?.ContratoBase?.Modalidade?.Descricao) {
              result.plano = contract.ContratoBase.Modalidade.Descricao;
            }
          }
        } catch {
          // Contract fetch failed
        }
        
        results.push(result);
        console.log("✓");
        
      } catch (e) {
        console.log(`⚠️ ${(e as Error).message.substring(0, 30)}`);
        results.push({
          nome: member.Nome || CONFIG.defaultValue,
          email: CONFIG.defaultValue,
          cpf: CONFIG.defaultValue,
          telefone: CONFIG.defaultValue,
          data_nascimento: formatDate(member.DataNascimento),
          plano: CONFIG.defaultValue,
        });
      }
      
      await delay(CONFIG.delayMs);
    }
    
    // Step 3: Save CSV
    console.log("\n📊 Step 3: Generating CSV...");
    
    const timestamp = new Date().toISOString().split("T")[0];
    const csvPath = path.join(CONFIG.outputDir, `nextfit-export-${timestamp}.csv`);
    
    const csvContent = toCSV(results);
    fs.writeFileSync(csvPath, csvContent, "utf-8");
    
    console.log(`\n✅ Extraction complete!`);
    console.log(`📁 CSV saved to: ${csvPath}`);
    console.log(`📊 Total members: ${results.length}`);
    
    console.log("\n📋 Sample data:");
    console.log(csvContent.split("\n").slice(0, 6).join("\n"));
    
    const stats = {
      withEmail: results.filter(r => r.email !== CONFIG.defaultValue).length,
      withCpf: results.filter(r => r.cpf !== CONFIG.defaultValue).length,
      withPhone: results.filter(r => r.telefone !== CONFIG.defaultValue).length,
      withPlan: results.filter(r => r.plano !== CONFIG.defaultValue).length,
    };
    
    console.log("\n📈 Data completeness:");
    console.log(`   Email: ${stats.withEmail}/${results.length} (${Math.round(stats.withEmail/results.length*100)}%)`);
    console.log(`   CPF: ${stats.withCpf}/${results.length} (${Math.round(stats.withCpf/results.length*100)}%)`);
    console.log(`   Telefone: ${stats.withPhone}/${results.length} (${Math.round(stats.withPhone/results.length*100)}%)`);
    console.log(`   Plano: ${stats.withPlan}/${results.length} (${Math.round(stats.withPlan/results.length*100)}%)`);
    
  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

main().catch(console.error);
