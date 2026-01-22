/**
 * NextFit Anamnesis Console Extractor
 * 
 * HOW TO USE:
 * 1. Open https://app.nextfit.com.br/cliente/lista in Chrome
 * 2. Login if needed
 * 3. Open DevTools (F12 or Cmd+Option+I) -> Console tab
 * 4. Copy and paste this entire script into the console
 * 5. Press Enter to run
 * 6. Wait for the extraction to complete (~2-5 minutes depending on member count)
 * 7. The JSON file will be automatically downloaded
 * 
 * OUTPUT:
 * - anamnese-export-{date}.json - Contains all anamnesis data
 * 
 * NOTE: This script runs in your authenticated browser session,
 * bypassing Cloudflare protection.
 */

(async function extractNextFitAnamnesis() {
    const DEFAULT_VALUE = "Não informado";
    const DELAY_MS = 600; // Delay between API calls to avoid rate limiting

    // Helper to make API calls
    async function fetchAPI(url) {
        const response = await fetch(url, {
            credentials: "include",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return response.json();
    }

    // Helper to delay
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    console.log("🚀 Starting NextFit Anamnesis Extraction...\n");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║           NextFit Anamnesis Console Extractor                ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║  Extracting health questionnaire answers for all members    ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    const results = {
        extractedAt: new Date().toISOString(),
        totalMembers: 0,
        successfulExtractions: 0,
        failedExtractions: 0,
        data: [],
        errors: []
    };

    try {
        // Step 1: Get all member IDs from the list API
        console.log("📋 Step 1: Fetching member list...");

        const listUrl = "https://api.nextfit.com.br/api/Cliente/RecuperarPesquisaGeral?" +
            "limit=500&page=1" +
            "&fields=[%22Id%22,%22Nome%22,%22DataNascimento%22,%22Sexo%22,%22Inativo%22]" +
            "&includes=[%22ClienteParametro%22]" +
            "&sort=[{%22property%22:%22Nome%22,%22direction%22:%22ASC%22}]" +
            "&filter=[]" +
            "&VerRemovidos=false&VerVIPs=false&Descricao=&TipoVinculoStr=[1,2]";

        const listData = await fetchAPI(listUrl);
        const members = listData.Data || [];
        results.totalMembers = members.length;

        console.log(`   Found ${members.length} members\n`);

        if (members.length === 0) {
            console.log("❌ No members found!");
            return;
        }

        // Step 2: Fetch anamnesis for each member
        console.log("📝 Step 2: Fetching anamnesis data...\n");

        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const memberId = member.Id;
            const memberName = member.Nome || `Member ${memberId}`;

            console.log(`   Processing ${i + 1}/${members.length}: ${memberName}`);

            try {
                // Try various API endpoints for anamnesis
                // Common NextFit API patterns:
                const anamnesisEndpoints = [
                    `https://api.nextfit.com.br/api/Anamnese/RecuperarPorCliente?codigoCliente=${memberId}`,
                    `https://api.nextfit.com.br/api/Anamnese/${memberId}`,
                    `https://api.nextfit.com.br/api/Cliente/${memberId}/Anamnese`,
                    `https://api.nextfit.com.br/api/AnamneseResposta/RecuperarPorCliente?codigoCliente=${memberId}`,
                    `https://api.nextfit.com.br/api/Formulario/RecuperarRespostasCliente?codigoCliente=${memberId}`,
                ];

                let anamnesisData = null;
                let usedEndpoint = null;

                for (const endpoint of anamnesisEndpoints) {
                    try {
                        const response = await fetchAPI(endpoint);
                        if (response && (response.Data || response.Respostas || Array.isArray(response) || response.Id)) {
                            anamnesisData = response;
                            usedEndpoint = endpoint;
                            break;
                        }
                    } catch {
                        // Try next endpoint
                        continue;
                    }
                }

                // Extract questions from the response
                const questions = [];

                if (anamnesisData) {
                    // Handle different response formats

                    // Format 1: { Data: [...] } or array of items
                    const items = anamnesisData.Data || anamnesisData.Respostas ||
                        (Array.isArray(anamnesisData) ? anamnesisData : null);

                    if (items && Array.isArray(items)) {
                        for (const item of items) {
                            // Try to extract question and answer
                            const pergunta = item.Pergunta || item.Questao || item.Descricao ||
                                item.Question || item.Label || item.Nome || "Pergunta não identificada";
                            const resposta = item.Resposta || item.Valor || item.Answer ||
                                item.Value || item.Response || DEFAULT_VALUE;

                            questions.push({
                                pergunta: String(pergunta).trim(),
                                resposta: String(resposta).trim() || DEFAULT_VALUE
                            });
                        }
                    }

                    // Format 2: Single object with properties
                    else if (typeof anamnesisData === 'object' && !Array.isArray(anamnesisData)) {
                        // Extract all properties that look like Q&A
                        for (const [key, value] of Object.entries(anamnesisData)) {
                            // Skip metadata fields
                            if (['Id', 'ClienteId', 'DataCriacao', 'DataAlteracao', 'Ativo'].includes(key)) {
                                continue;
                            }

                            if (value !== null && value !== undefined) {
                                questions.push({
                                    pergunta: key,
                                    resposta: String(value).trim() || DEFAULT_VALUE
                                });
                            }
                        }
                    }
                }

                // Also try to fetch from the full client details
                if (questions.length === 0) {
                    try {
                        const clientUrl = `https://api.nextfit.com.br/api/Cliente/${memberId}`;
                        const clientData = await fetchAPI(clientUrl);

                        // Look for anamnesis-related fields in the client data
                        const anamneseFields = [
                            'Anamnese', 'AnamneseData', 'Respostas', 'Questionario',
                            'ObjetivoPrincipal', 'RestricaoMedica', 'Observacoes',
                            'PraticaAtividadeFisica', 'Lesao', 'Cirurgia', 'Medicamento',
                            'Alergia', 'ProblemaCardiaco', 'Diabetes', 'Hipertensao',
                            'Fumante', 'Gestante', 'FrequenciaSemanal'
                        ];

                        for (const field of anamneseFields) {
                            if (clientData[field] !== null && clientData[field] !== undefined) {
                                questions.push({
                                    pergunta: field,
                                    resposta: String(clientData[field]).trim() || DEFAULT_VALUE
                                });
                            }
                        }
                    } catch {
                        // Client fetch failed
                    }
                }

                results.data.push({
                    memberId,
                    memberName,
                    extractedAt: new Date().toISOString(),
                    questions,
                    endpoint: usedEndpoint
                });

                results.successfulExtractions++;
                console.log(`   ✅ ${questions.length} questions extracted`);

            } catch (e) {
                console.log(`   ⚠️ Error: ${e.message}`);
                results.failedExtractions++;
                results.errors.push({
                    memberId,
                    memberName,
                    error: e.message
                });
            }

            // Small delay to avoid rate limiting
            await delay(DELAY_MS);

            // Progress indicator every 10 members
            if ((i + 1) % 10 === 0) {
                console.log(`   --- Progress: ${i + 1}/${members.length} (${Math.round((i + 1) / members.length * 100)}%) ---`);
            }
        }

        // Step 3: Download JSON
        console.log("\n💾 Step 3: Downloading JSON file...");

        const jsonStr = JSON.stringify(results, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `anamnese-export-${new Date().toISOString().split("T")[0]}.json`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Summary
        console.log("\n╔══════════════════════════════════════════════════════════════╗");
        console.log("║                    EXTRACTION COMPLETE                       ║");
        console.log("╠══════════════════════════════════════════════════════════════╣");
        console.log(`║  Total members:        ${results.totalMembers.toString().padEnd(36)}║`);
        console.log(`║  Successful:           ${results.successfulExtractions.toString().padEnd(36)}║`);
        console.log(`║  Failed:               ${results.failedExtractions.toString().padEnd(36)}║`);
        console.log("╚══════════════════════════════════════════════════════════════╝");

        console.log(`\n📁 Downloaded: anamnese-export-${new Date().toISOString().split("T")[0]}.json`);

        // Show sample data
        console.log("\n📋 Sample data from first member:");
        if (results.data.length > 0 && results.data[0].questions.length > 0) {
            results.data[0].questions.slice(0, 5).forEach(q => {
                console.log(`   - ${q.pergunta}: ${q.resposta}`);
            });
        } else {
            console.log("   No questions extracted for the first member.");
        }

        // Statistics
        const membersWithData = results.data.filter(m => m.questions.length > 0).length;
        console.log(`\n📈 Data completeness: ${membersWithData}/${results.totalMembers} members have anamnesis data (${Math.round(membersWithData / results.totalMembers * 100)}%)`);

        // Show errors if any
        if (results.errors.length > 0) {
            console.log(`\n⚠️ Errors occurred for ${results.errors.length} members:`);
            results.errors.slice(0, 5).forEach(e => {
                console.log(`   - ${e.memberName}: ${e.error}`);
            });
            if (results.errors.length > 5) {
                console.log(`   ... and ${results.errors.length - 5} more`);
            }
        }

        // Make results available in console
        window.anamneseResults = results;
        console.log("\n💡 Tip: Results are also available in window.anamneseResults for inspection");

    } catch (error) {
        console.error("❌ Error:", error);
        console.log("\nPossible solutions:");
        console.log("1. Make sure you're logged into NextFit");
        console.log("2. Refresh the page and try again");
        console.log("3. Check if NextFit's API structure has changed");
    }
})();
