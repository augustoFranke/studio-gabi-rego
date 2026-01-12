/**
 * NextFit Member Extractor
 * 
 * Extracts full member details by visiting each member's cadastro page.
 * Uses Playwright to automate the browser with an existing session.
 * 
 * Usage: npx tsx utility/extract-members.ts
 */

import { chromium, type BrowserContext, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const CONFIG = {
  baseUrl: "https://app.nextfit.com.br",
  listUrl: "https://app.nextfit.com.br/cliente/lista",
  outputDir: path.join(__dirname, "csv"),
  defaultValue: "Pendente",
  delayBetweenMembers: 800, // ms
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

async function extractMemberIds(page: Page): Promise<number[]> {
  const ids: number[] = [];
  
  // Intercept API responses to get member IDs
  const apiData: unknown[] = [];
  
  page.on("response", async (response) => {
    if (response.url().includes("RecuperarPesquisaGeral")) {
      try {
        const json = await response.json();
        apiData.push(json);
      } catch {}
    }
  });
  
  // Navigate to list with high limit to get all members
  const listUrlWithLimit = `${CONFIG.listUrl}`;
  await page.goto(listUrlWithLimit, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  
  // Try to change page size to maximum
  const pageSizeButton = page.locator('button:has-text("20")');
  if (await pageSizeButton.count() > 0) {
    await pageSizeButton.click();
    await page.waitForTimeout(500);
    
    // Look for 100 or max option
    const maxOption = page.locator('li:has-text("100"), [data-value="100"]');
    if (await maxOption.count() > 0) {
      await maxOption.first().click();
      await page.waitForTimeout(2000);
    }
  }
  
  // Extract IDs from the page URL pattern or API response
  // Member URLs follow pattern: /cliente/{id}/cliente-dashboard
  const links = await page.locator('a[href*="/cliente/"]').all();
  
  for (const link of links) {
    const href = await link.getAttribute("href");
    if (href) {
      const match = href.match(/\/cliente\/(\d+)/);
      if (match) {
        const id = parseInt(match[1], 10);
        if (!ids.includes(id)) {
          ids.push(id);
        }
      }
    }
  }
  
  // Also try to get from API response
  for (const data of apiData) {
    const response = data as { Data?: Array<{ Id: number }> };
    if (response.Data) {
      for (const client of response.Data) {
        if (client.Id && !ids.includes(client.Id)) {
          ids.push(client.Id);
        }
      }
    }
  }
  
  return ids;
}

async function extractMemberDetails(page: Page, memberId: number): Promise<Member> {
  const member: Member = {
    nome: CONFIG.defaultValue,
    email: CONFIG.defaultValue,
    cpf: CONFIG.defaultValue,
    telefone: CONFIG.defaultValue,
    data_nascimento: CONFIG.defaultValue,
    plano: CONFIG.defaultValue,
  };
  
  try {
    // Navigate to member's cadastro page
    const cadastroUrl = `${CONFIG.baseUrl}/cliente-cadastro/${memberId}`;
    await page.goto(cadastroUrl, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1500);
    
    // Extract Nome
    const nomeInput = page.locator('input[name*="nome" i], input[aria-label*="Nome"]').first();
    if (await nomeInput.count() > 0) {
      member.nome = await nomeInput.inputValue() || CONFIG.defaultValue;
    }
    
    // Extract CPF
    const cpfInput = page.locator('input[name*="cpf" i], input[aria-label*="CPF"]').first();
    if (await cpfInput.count() > 0) {
      member.cpf = await cpfInput.inputValue() || CONFIG.defaultValue;
    }
    
    // Extract Celular/Telefone
    const celularInput = page.locator('input[name*="celular" i], input[aria-label*="Celular"]').first();
    if (await celularInput.count() > 0) {
      member.telefone = await celularInput.inputValue() || CONFIG.defaultValue;
    }
    
    // Extract Data de Nascimento
    const dataNascInput = page.locator('input[name*="nascimento" i], input[aria-label*="nascimento" i]').first();
    if (await dataNascInput.count() > 0) {
      member.data_nascimento = await dataNascInput.inputValue() || CONFIG.defaultValue;
    }
    
    // Extract Email
    const emailInput = page.locator('input[name*="email" i], input[aria-label*="E-mail"], input[type="email"]').first();
    if (await emailInput.count() > 0) {
      member.email = await emailInput.inputValue() || CONFIG.defaultValue;
    }
    
    // For Plano, we might need to go to the Contrato tab
    // Try to find it on the current page first
    const planoText = await page.locator('[class*="plano"], [class*="plan"]').first().textContent().catch(() => null);
    if (planoText) {
      member.plano = planoText.trim();
    }
    
  } catch (error) {
    console.log(`    ⚠️ Error extracting member ${memberId}: ${error}`);
  }
  
  return member;
}

async function main() {
  console.log("🚀 Starting NextFit Member Extractor...\n");
  
  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  // Launch browser with persistent context (to reuse login session)
  const userDataDir = path.join(CONFIG.outputDir, ".browser-data");
  
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
  });
  
  const page = browser.pages()[0] || await browser.newPage();
  
  try {
    // Check if logged in by navigating to list
    console.log("📋 Checking login status...");
    await page.goto(CONFIG.listUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    
    // If redirected to login, wait for manual login
    if (page.url().includes("login")) {
      console.log("\n⚠️  Not logged in. Please login manually in the browser window.");
      console.log("   After logging in, press Enter to continue...\n");
      
      // Wait for user input
      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => resolve());
      });
      
      // Navigate to list again
      await page.goto(CONFIG.listUrl, { waitUntil: "networkidle" });
      await page.waitForTimeout(3000);
    }
    
    console.log("✅ Logged in successfully!\n");
    
    // Get all member IDs
    console.log("📊 Extracting member IDs...");
    const memberIds = await extractMemberIds(page);
    console.log(`   Found ${memberIds.length} members\n`);
    
    if (memberIds.length === 0) {
      console.log("❌ No members found. Please check if you're on the correct page.");
      return;
    }
    
    // Extract details for each member
    const members: Member[] = [];
    
    for (let i = 0; i < memberIds.length; i++) {
      const memberId = memberIds[i];
      console.log(`📝 Processing member ${i + 1}/${memberIds.length} (ID: ${memberId})...`);
      
      const member = await extractMemberDetails(page, memberId);
      members.push(member);
      
      // Progress save every 10 members
      if ((i + 1) % 10 === 0) {
        const progressPath = path.join(CONFIG.outputDir, "progress.csv");
        fs.writeFileSync(progressPath, toCSV(members), "utf-8");
        console.log(`   💾 Progress saved (${i + 1} members)`);
      }
      
      // Small delay to be nice to the server
      await page.waitForTimeout(CONFIG.delayBetweenMembers);
    }
    
    // Save final CSV
    const timestamp = new Date().toISOString().split("T")[0];
    const csvPath = path.join(CONFIG.outputDir, `nextfit-export-${timestamp}.csv`);
    
    fs.writeFileSync(csvPath, toCSV(members), "utf-8");
    
    console.log(`\n✅ Extraction complete!`);
    console.log(`📁 CSV saved to: ${csvPath}`);
    console.log(`📊 Total members: ${members.length}`);
    console.log("\n📋 Sample data:");
    console.log(toCSV(members).split("\n").slice(0, 6).join("\n"));
    
  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    await browser.close();
    console.log("\n🏁 Extractor finished.");
  }
}

main().catch(console.error);

