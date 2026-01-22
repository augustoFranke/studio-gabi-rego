/**
 * NextFit Anamnesis Scraper
 *
 * Extracts individual anamnesis answers from the NextFit application.
 * Uses Playwright to automate the browser with an existing session.
 *
 * Usage:
 *   npm run scrape:anamnesis
 *   # or
 *   npx tsx utility/scrape-anamnesis.ts
 *
 * INSTRUCTIONS:
 * 1. The script will open a browser window
 * 2. If not logged in, login manually when prompted
 * 3. Press Enter in the terminal after logging in
 * 4. The script will extract anamnesis data for all members
 * 5. Data is saved to utility/csv/anamnesis-dump-{date}.json
 *
 * ENVIRONMENT VARIABLES (optional):
 *   NEXTFIT_USER - Username for automatic login
 *   NEXTFIT_PASS - Password for automatic login
 *
 * NOTE: Due to Cloudflare protection, automatic login may not work.
 *       Manual login is recommended.
 */

import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

// Configuration
const CONFIG = {
    baseUrl: "https://app.nextfit.com.br",
    loginUrl: "https://app.nextfit.com.br/login",
    listUrl: "https://app.nextfit.com.br/cliente/lista",
    outputDir: path.join(__dirname, "csv"),
    logsDir: path.join(__dirname, "logs"),
    defaultValue: "Não informado",
    delayBetweenMembers: 1000, // ms - be nice to the server
    delayBetweenActions: 500, // ms
};

// Interfaces
interface AnamnesisQuestion {
    pergunta: string;
    resposta: string;
}

interface MemberAnamnesis {
    memberId: number;
    memberName: string;
    extractedAt: string;
    questions: AnamnesisQuestion[];
    rawHtml?: string; // Optional: store raw HTML for debugging
}

interface ExtractionResult {
    success: boolean;
    totalMembers: number;
    successfulExtractions: number;
    failedExtractions: number;
    data: MemberAnamnesis[];
    errors: Array<{ memberId: number; error: string }>;
}

/**
 * Attempts automatic login using environment variables
 */
async function attemptAutoLogin(page: Page): Promise<boolean> {
    const username = process.env.NEXTFIT_USER;
    const password = process.env.NEXTFIT_PASS;

    if (!username || !password) {
        console.log("   ℹ️  No credentials found in environment variables.");
        console.log("   Set NEXTFIT_USER and NEXTFIT_PASS for automatic login.\n");
        return false;
    }

    try {
        console.log("   🔐 Attempting automatic login...");

        // Wait for login form
        await page.waitForSelector('input[type="text"], input[name*="user" i], input[name*="email" i]', {
            timeout: 5000,
        });

        // Find and fill username field
        // Common selectors for login forms
        const usernameSelectors = [
            'input[name="email"]',
            'input[name="usuario"]',
            'input[name="username"]',
            'input[type="email"]',
            'input[type="text"]:first-of-type',
        ];

        let usernameField = null;
        for (const selector of usernameSelectors) {
            const field = page.locator(selector).first();
            if ((await field.count()) > 0) {
                usernameField = field;
                break;
            }
        }

        if (!usernameField) {
            console.log("   ⚠️  Could not find username field");
            return false;
        }

        await usernameField.fill(username);
        await page.waitForTimeout(CONFIG.delayBetweenActions);

        // Find and fill password field
        const passwordField = page.locator('input[type="password"]').first();
        if ((await passwordField.count()) === 0) {
            console.log("   ⚠️  Could not find password field");
            return false;
        }

        await passwordField.fill(password);
        await page.waitForTimeout(CONFIG.delayBetweenActions);

        // Click login button
        const loginButtonSelectors = [
            'button[type="submit"]',
            'button:has-text("Entrar")',
            'button:has-text("Login")',
            'input[type="submit"]',
        ];

        let loginButton = null;
        for (const selector of loginButtonSelectors) {
            const button = page.locator(selector).first();
            if ((await button.count()) > 0) {
                loginButton = button;
                break;
            }
        }

        if (!loginButton) {
            console.log("   ⚠️  Could not find login button");
            return false;
        }

        await loginButton.click();
        await page.waitForTimeout(3000);

        // Check if login was successful
        if (!page.url().includes("login")) {
            console.log("   ✅ Automatic login successful!");
            return true;
        }

        console.log("   ⚠️  Automatic login failed - please login manually");
        return false;
    } catch (error) {
        console.log(`   ⚠️  Auto-login error: ${error}`);
        return false;
    }
}

/**
 * Extract member IDs from the list page
 */
async function extractMemberIds(page: Page): Promise<number[]> {
    const ids: number[] = [];

    // Intercept API responses to get member IDs
    const apiData: unknown[] = [];

    page.on("response", async (response) => {
        if (response.url().includes("RecuperarPesquisaGeral")) {
            try {
                const json = await response.json();
                apiData.push(json);
            } catch {
                // Ignore parsing errors
            }
        }
    });

    // Navigate to list
    await page.goto(CONFIG.listUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Try to change page size to maximum
    const pageSizeButton = page.locator('button:has-text("20")');
    if ((await pageSizeButton.count()) > 0) {
        await pageSizeButton.click();
        await page.waitForTimeout(500);

        // Look for 100 or max option
        const maxOption = page.locator('li:has-text("100"), [data-value="100"]');
        if ((await maxOption.count()) > 0) {
            await maxOption.first().click();
            await page.waitForTimeout(2000);
        }
    }

    // Extract IDs from page links
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

/**
 * Extract member name from the page
 */
async function extractMemberName(page: Page): Promise<string> {
    // Try various selectors for the member name
    const nameSelectors = [
        'input[name*="nome" i]',
        'input[aria-label*="Nome"]',
        'h1.member-name',
        '.member-header .name',
        '[class*="client-name"]',
        'h1, h2, h3', // Fallback to headers
    ];

    for (const selector of nameSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            // Try to get input value first
            try {
                const value = await element.inputValue();
                if (value && value.trim()) return value.trim();
            } catch {
                // Not an input, try text content
                const text = await element.textContent();
                if (text && text.trim()) return text.trim();
            }
        }
    }

    return CONFIG.defaultValue;
}

/**
 * Extract anamnesis data for a single member
 *
 * NOTE: The exact selectors below are PLACEHOLDERS.
 * You will need to inspect the NextFit application to find the correct selectors
 * for the anamnesis section.
 *
 * Common patterns to look for:
 * - Anamnesis tab or link
 * - Question/Answer pairs in the form
 * - Tables or lists containing the Q&A
 */
async function extractMemberAnamnesis(page: Page, memberId: number): Promise<MemberAnamnesis | null> {
    const questions: AnamnesisQuestion[] = [];

    try {
        // ========================================
        // STEP 1: Navigate to member's page
        // ========================================
        // Try different URL patterns that NextFit might use for anamnesis
        const anamnesisUrls = [
            `${CONFIG.baseUrl}/cliente-cadastro/${memberId}/anamnese`,
            `${CONFIG.baseUrl}/cliente/${memberId}/anamnese`,
            `${CONFIG.baseUrl}/cliente-anamnese/${memberId}`,
            `${CONFIG.baseUrl}/anamnese/${memberId}`,
        ];

        let anamnesisFound = false;

        // First, try navigating to the main cadastro page
        const cadastroUrl = `${CONFIG.baseUrl}/cliente-cadastro/${memberId}`;
        await page.goto(cadastroUrl, { waitUntil: "networkidle", timeout: 15000 });
        await page.waitForTimeout(CONFIG.delayBetweenActions);

        // Get member name while on the page
        const memberName = await extractMemberName(page);

        // ========================================
        // STEP 2: Look for anamnesis tab/link
        // ========================================
        // Common selectors for anamnesis navigation
        const anamnesisTabSelectors = [
            'a:has-text("Anamnese")',
            'button:has-text("Anamnese")',
            '[class*="anamnese"]',
            'a[href*="anamnese"]',
            '.tab:has-text("Anamnese")',
            '.nav-item:has-text("Anamnese")',
            'li:has-text("Anamnese") a',
        ];

        for (const selector of anamnesisTabSelectors) {
            const tab = page.locator(selector).first();
            if ((await tab.count()) > 0) {
                await tab.click();
                await page.waitForTimeout(1500);
                anamnesisFound = true;
                break;
            }
        }

        // If no tab found, try direct URLs
        if (!anamnesisFound) {
            for (const url of anamnesisUrls) {
                try {
                    await page.goto(url, { waitUntil: "networkidle", timeout: 10000 });
                    await page.waitForTimeout(1000);

                    // Check if page loaded something meaningful
                    const hasContent = await page.locator("form, .anamnesis, .questions, table").count();
                    if (hasContent > 0) {
                        anamnesisFound = true;
                        break;
                    }
                } catch {
                    // URL didn't work, try next
                    continue;
                }
            }
        }

        // ========================================
        // STEP 3: Extract questions and answers
        // ========================================
        // These are PLACEHOLDER SELECTORS - you need to inspect NextFit
        // and update these to match the actual DOM structure

        // Pattern 1: Look for question/answer pairs in a form
        const formGroupSelectors = [
            ".form-group",
            ".question-group",
            ".anamnese-item",
            ".pergunta-resposta",
            '[class*="question"]',
            "label + input",
            "label + select",
            "label + textarea",
        ];

        for (const groupSelector of formGroupSelectors) {
            const groups = await page.locator(groupSelector).all();
            for (const group of groups) {
                try {
                    // Look for label (question)
                    const labelElement = group.locator("label").first();
                    const questionText =
                        (await labelElement.count()) > 0 ? (await labelElement.textContent()) ?? "" : "";

                    // Look for input/select/textarea (answer)
                    let answerText = "";

                    // Try input
                    const inputElement = group.locator("input").first();
                    if ((await inputElement.count()) > 0) {
                        answerText = (await inputElement.inputValue()) || "";
                    }

                    // Try select
                    if (!answerText) {
                        const selectElement = group.locator("select").first();
                        if ((await selectElement.count()) > 0) {
                            const selectedOption = selectElement.locator("option:checked").first();
                            answerText = (await selectedOption.textContent()) || "";
                        }
                    }

                    // Try textarea
                    if (!answerText) {
                        const textareaElement = group.locator("textarea").first();
                        if ((await textareaElement.count()) > 0) {
                            answerText = (await textareaElement.inputValue()) || "";
                        }
                    }

                    // Try checkbox/radio
                    if (!answerText) {
                        const checkboxElement = group.locator('input[type="checkbox"]:checked, input[type="radio"]:checked');
                        if ((await checkboxElement.count()) > 0) {
                            const labelForCheckbox = group.locator('label[for], .label');
                            answerText = (await labelForCheckbox.textContent()) || "Sim";
                        }
                    }

                    if (questionText.trim()) {
                        questions.push({
                            pergunta: questionText.trim(),
                            resposta: answerText.trim() || CONFIG.defaultValue,
                        });
                    }
                } catch {
                    // Skip problematic groups
                    continue;
                }
            }
        }

        // Pattern 2: Look for table with questions
        const tableRows = await page.locator("table tr").all();
        for (const row of tableRows) {
            try {
                const cells = await row.locator("td, th").all();
                if (cells.length >= 2) {
                    const question = (await cells[0].textContent()) ?? "";
                    const answer = (await cells[1].textContent()) ?? "";

                    if (question.trim() && !question.toLowerCase().includes("pergunta")) {
                        // Skip header
                        questions.push({
                            pergunta: question.trim(),
                            resposta: answer.trim() || CONFIG.defaultValue,
                        });
                    }
                }
            } catch {
                continue;
            }
        }

        // Pattern 3: Extract any visible text that looks like Q&A
        // This is a fallback if we can't find structured data
        if (questions.length === 0) {
            // Try to capture the main content area
            const contentArea = page.locator("main, .content, .container, article").first();
            if ((await contentArea.count()) > 0) {
                const allText = await contentArea.innerText();
                // Store raw text for manual parsing
                questions.push({
                    pergunta: "_RAW_CONTENT_",
                    resposta: allText,
                });
            }
        }

        // Store raw HTML for debugging if no questions found
        let rawHtml: string | undefined;
        if (questions.length === 0 || questions[0].pergunta === "_RAW_CONTENT_") {
            rawHtml = await page.content();
        }

        return {
            memberId,
            memberName,
            extractedAt: new Date().toISOString(),
            questions,
            rawHtml,
        };
    } catch (error) {
        console.log(`   ⚠️  Error extracting anamnesis for member ${memberId}: ${error}`);
        return null;
    }
}

/**
 * Save results to JSON file
 */
function saveResults(result: ExtractionResult): string {
    // Ensure output directories exist
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const jsonPath = path.join(CONFIG.outputDir, `anamnesis-dump-${timestamp}.json`);

    // Create a clean version without raw HTML for the main output
    const cleanResult = {
        ...result,
        data: result.data.map((entry) => {
            const { rawHtml, ...rest } = entry;
            void rawHtml;
            return rest;
        }),
    };

    fs.writeFileSync(jsonPath, JSON.stringify(cleanResult, null, 2), "utf-8");

    console.log(`\n✅ Results saved to: ${jsonPath}`);

    // If there are entries with raw HTML, save them separately for debugging
    const entriesWithRawHtml = result.data.filter((d) => d.rawHtml);
    if (entriesWithRawHtml.length > 0) {
        const debugPath = path.join(CONFIG.logsDir, `anamnesis-debug-${timestamp}.json`);
        if (!fs.existsSync(CONFIG.logsDir)) {
            fs.mkdirSync(CONFIG.logsDir, { recursive: true });
        }
        fs.writeFileSync(debugPath, JSON.stringify(entriesWithRawHtml, null, 2), "utf-8");
        console.log(`   📋 Debug data saved to: ${debugPath}`);
    }

    return jsonPath;
}

/**
 * Main execution function
 */
async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              NextFit Anamnesis Scraper                           ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  This script extracts anamnesis (health questionnaire) data      ║
║  from the NextFit application for all members.                   ║
║                                                                  ║
║  Output: utility/csv/anamnesis-dump-{date}.json                  ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);

    const result: ExtractionResult = {
        success: false,
        totalMembers: 0,
        successfulExtractions: 0,
        failedExtractions: 0,
        data: [],
        errors: [],
    };

    // Launch browser with persistent context (to reuse login session)
    const userDataDir = path.join(CONFIG.outputDir, ".browser-data");

    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: { width: 1920, height: 1080 },
    });

    const page = browser.pages()[0] || (await browser.newPage());

    try {
        // Check if logged in
        console.log("📋 Checking login status...");
        await page.goto(CONFIG.listUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(3000);

        // If redirected to login, try auto-login or wait for manual login
        if (page.url().includes("login")) {
            console.log("\n⚠️  Not logged in.");

            // Try automatic login
            const autoLoginSuccess = await attemptAutoLogin(page);

            if (!autoLoginSuccess) {
                console.log("   Please login manually in the browser window.");
                console.log("   After logging in, press Enter to continue...\n");

                // Wait for user input
                await new Promise<void>((resolve) => {
                    process.stdin.once("data", () => resolve());
                });

                // Navigate to list again
                await page.goto(CONFIG.listUrl, { waitUntil: "networkidle" });
                await page.waitForTimeout(3000);
            }
        }

        console.log("✅ Logged in successfully!\n");

        // Get all member IDs
        console.log("📊 Extracting member IDs...");
        const memberIds = await extractMemberIds(page);
        result.totalMembers = memberIds.length;
        console.log(`   Found ${memberIds.length} members\n`);

        if (memberIds.length === 0) {
            console.log("❌ No members found. Please check if you're on the correct page.");
            return;
        }

        // Extract anamnesis for each member
        console.log("🔍 Extracting anamnesis data...\n");

        for (let i = 0; i < memberIds.length; i++) {
            const memberId = memberIds[i];
            console.log(`📝 Processing member ${i + 1}/${memberIds.length} (ID: ${memberId})...`);

            const anamnesis = await extractMemberAnamnesis(page, memberId);

            if (anamnesis) {
                result.data.push(anamnesis);
                result.successfulExtractions++;

                const questionsCount = anamnesis.questions.length;
                console.log(`   ✅ ${anamnesis.memberName} - ${questionsCount} questions extracted`);
            } else {
                result.failedExtractions++;
                result.errors.push({ memberId, error: "Failed to extract anamnesis" });
                console.log(`   ❌ Failed to extract anamnesis`);
            }

            // Progress save every 10 members
            if ((i + 1) % 10 === 0) {
                const progressPath = path.join(CONFIG.outputDir, "anamnesis-progress.json");
                fs.writeFileSync(progressPath, JSON.stringify(result, null, 2), "utf-8");
                console.log(`   💾 Progress saved (${i + 1} members)`);
            }

            // Delay to be nice to the server
            await page.waitForTimeout(CONFIG.delayBetweenMembers);
        }

        result.success = true;

        // Save final results
        const outputPath = saveResults(result);

        // Summary
        console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                        EXTRACTION COMPLETE                       ║
╠══════════════════════════════════════════════════════════════════╣
║  Total members:        ${result.totalMembers.toString().padEnd(40)}║
║  Successful:           ${result.successfulExtractions.toString().padEnd(40)}║
║  Failed:               ${result.failedExtractions.toString().padEnd(40)}║
╚══════════════════════════════════════════════════════════════════╝

📁 Output: ${outputPath}
`);

        if (result.errors.length > 0) {
            console.log("⚠️  Members with errors:");
            result.errors.slice(0, 10).forEach((e) => console.log(`   - ID ${e.memberId}: ${e.error}`));
            if (result.errors.length > 10) {
                console.log(`   ... and ${result.errors.length - 10} more`);
            }
        }

        // Important notes for the user
        console.log(`
┌──────────────────────────────────────────────────────────────────┐
│  IMPORTANT NOTES:                                                │
│                                                                  │
│  The selectors used in this script are PLACEHOLDERS.             │
│  If the extraction returned empty or incorrect data:             │
│                                                                  │
│  1. Open https://app.nextfit.com.br in your browser              │
│  2. Navigate to a member's anamnesis page                        │
│  3. Inspect the HTML structure (F12 → Elements)                  │
│  4. Update the selectors in this script to match                 │
│     the actual DOM structure                                     │
│                                                                  │
│  Look for:                                                       │
│  - How to navigate to the anamnesis tab                          │
│  - The structure of question/answer pairs                        │
│  - CSS classes or IDs that identify the form fields              │
└──────────────────────────────────────────────────────────────────┘
`);
    } catch (error) {
        console.error("\n❌ Error:", error);
        result.errors.push({ memberId: 0, error: String(error) });

        // Save what we have so far
        if (result.data.length > 0) {
            saveResults(result);
        }
    } finally {
        await browser.close();
        console.log("\n🏁 Scraper finished.");
    }
}

// Run the script
main().catch(console.error);
