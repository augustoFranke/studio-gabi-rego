/**
 * NextFit Console Extractor
 * 
 * HOW TO USE:
 * 1. Open https://app.nextfit.com.br/cliente/lista in your browser
 * 2. Login if needed
 * 3. Open DevTools (F12) -> Console tab
 * 4. Copy and paste this entire script into the console
 * 5. Press Enter to run
 * 6. Wait for the extraction to complete
 * 7. The CSV will be automatically downloaded
 */

(async function extractNextFitMembers() {
  const DEFAULT_VALUE = "Pendente";
  const DELAY_MS = 500; // Delay between API calls
  
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
  
  // Format date to DD/MM/YYYY
  function formatDate(dateStr) {
    if (!dateStr) return DEFAULT_VALUE;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return DEFAULT_VALUE;
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return DEFAULT_VALUE;
    }
  }
  
  // Escape CSV value
  function escapeCSV(value) {
    if (!value) return DEFAULT_VALUE;
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  
  console.log("🚀 Starting NextFit Member Extraction...\n");
  
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
    const total = listData.Total || members.length;
    
    console.log(`   Found ${members.length} members (Total: ${total})`);
    
    if (members.length === 0) {
      console.log("❌ No members found!");
      return;
    }
    
    // Step 2: Fetch details for each member
    console.log("\n📝 Step 2: Fetching member details...");
    
    const results = [];
    
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const memberId = member.Id;
      
      console.log(`   Processing ${i + 1}/${members.length}: ${member.Nome}`);
      
      try {
        // Fetch member details
        const detailUrl = `https://api.nextfit.com.br/api/Cliente/${memberId}`;
        const details = await fetchAPI(detailUrl);
        
        // Extract data
        const result = {
          nome: details.Nome || member.Nome || DEFAULT_VALUE,
          email: details.Email || DEFAULT_VALUE,
          cpf: details.Cpf || DEFAULT_VALUE,
          telefone: details.Celular || details.Telefone || DEFAULT_VALUE,
          data_nascimento: formatDate(details.DataNascimento || member.DataNascimento),
          plano: DEFAULT_VALUE, // Will try to get from contracts
        };
        
        // Try to get active plan from contracts
        try {
          const contractUrl = `https://api.nextfit.com.br/api/Contrato/RecuperarContratosCliente?CodigoCliente=${memberId}`;
          const contracts = await fetchAPI(contractUrl);
          
          if (contracts.Data && contracts.Data.length > 0) {
            // Find active contract
            const activeContract = contracts.Data.find(c => !c.Encerrado) || contracts.Data[0];
            if (activeContract && activeContract.Modalidade) {
              result.plano = activeContract.Modalidade.Nome || activeContract.Modalidade;
            }
          }
        } catch {
          // Contract fetch failed, keep default value
        }
        
        results.push(result);
        
      } catch (e) {
        console.log(`   ⚠️ Error fetching details for ${member.Nome}: ${e.message}`);
        results.push({
          nome: member.Nome || DEFAULT_VALUE,
          email: DEFAULT_VALUE,
          cpf: DEFAULT_VALUE,
          telefone: DEFAULT_VALUE,
          data_nascimento: formatDate(member.DataNascimento),
          plano: DEFAULT_VALUE,
        });
      }
      
      // Small delay to avoid rate limiting
      await delay(DELAY_MS);
    }
    
    // Step 3: Generate CSV
    console.log("\n📊 Step 3: Generating CSV...");
    
    const headers = "nome,email,cpf,telefone,data_nascimento,plano";
    const rows = results.map(r => 
      [r.nome, r.email, r.cpf, r.telefone, r.data_nascimento, r.plano]
        .map(escapeCSV)
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    
    // Step 4: Download CSV
    console.log("\n💾 Step 4: Downloading CSV...");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nextfit-export-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log("\n✅ Extraction complete!");
    console.log(`📁 Downloaded: nextfit-export-${new Date().toISOString().split("T")[0]}.csv`);
    console.log(`📊 Total members: ${results.length}`);
    
    // Show sample
    console.log("\n📋 Sample data:");
    console.log(headers);
    results.slice(0, 5).forEach(r => {
      console.log([r.nome, r.email, r.cpf, r.telefone, r.data_nascimento, r.plano].join(", "));
    });
    
    // Show stats
    const stats = {
      withEmail: results.filter(r => r.email !== DEFAULT_VALUE).length,
      withCpf: results.filter(r => r.cpf !== DEFAULT_VALUE).length,
      withPhone: results.filter(r => r.telefone !== DEFAULT_VALUE).length,
      withPlan: results.filter(r => r.plano !== DEFAULT_VALUE).length,
    };
    
    console.log("\n📈 Data completeness:");
    console.log(`   Email: ${stats.withEmail}/${results.length} (${Math.round(stats.withEmail/results.length*100)}%)`);
    console.log(`   CPF: ${stats.withCpf}/${results.length} (${Math.round(stats.withCpf/results.length*100)}%)`);
    console.log(`   Telefone: ${stats.withPhone}/${results.length} (${Math.round(stats.withPhone/results.length*100)}%)`);
    console.log(`   Plano: ${stats.withPlan}/${results.length} (${Math.round(stats.withPlan/results.length*100)}%)`);
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
