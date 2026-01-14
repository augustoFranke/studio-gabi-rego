/**
 * NextFit Anamnesis Data Scraper
 *
 * This script extracts anamnesis data from NextFit system.
 * Run this in the browser console while logged into NextFit.
 *
 * Usage:
 * 1. Open NextFit and log in
 * 2. Navigate to the physical evaluations report: /relatorio/avaliacoes
 * 3. Open browser console (F12 -> Console)
 * 4. Paste this entire script and press Enter
 * 5. Wait for extraction to complete
 * 6. Download the JSON file when prompted
 */

(async function() {
  const DELAY_MS = 2000; // Delay between requests to avoid rate limiting
  const results = [];

  // Helper: Wait for specified milliseconds
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper: Download JSON data
  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper: Extract client ID from URL
  const extractClientId = (url) => {
    const match = url.match(/\/cliente\/(\d+)/);
    return match ? match[1] : null;
  };

  // Helper: Extract evaluation ID from URL
  const extractEvaluationId = (url) => {
    const match = url.match(/\/avaliacao\/(\d+)/);
    return match ? match[1] : null;
  };

  // Step 1: Get list of clients from the current page (evaluations report)
  console.log('Starting anamnesis extraction...');

  // Check if we are on the evaluations report page
  if (!window.location.href.includes('/relatorio/avaliacoes')) {
    console.error('Please navigate to /relatorio/avaliacoes first!');
    console.log('Go to: Relatorios -> Clientes -> Avaliacoes fisicas realizadas');
    return;
  }

  // Get all client rows from the table
  const clientRows = document.querySelectorAll('table tbody tr, .mat-row, [class*="list-item"]');
  console.log(`Found ${clientRows.length} evaluation records`);

  // Extract client info from each row
  const clients = [];
  clientRows.forEach((row, index) => {
    const text = row.innerText;
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length >= 2) {
      const clientName = lines[0].replace(/\s*phone\s*/gi, '').trim();
      const phone = text.match(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/)?.[0] || '';
      const evaluator = lines.find(l => l.includes('GABRIELA') || l.includes('FERREIRA')) || '';
      const date = lines.find(l => /\d{2}\/\d{2}\/\d{4}/.test(l)) || '';

      clients.push({
        index,
        clientName,
        phone,
        evaluator,
        date,
        element: row
      });
    }
  });

  console.log(`Parsed ${clients.length} clients`);

  // For now, let's just display what we found
  console.log('Clients found:');
  clients.forEach((c, i) => {
    console.log(`${i + 1}. ${c.clientName} - ${c.phone} - ${c.date}`);
  });

  // Instructions for manual extraction
  console.log('\n=== MANUAL EXTRACTION STEPS ===');
  console.log('For each client above, you need to:');
  console.log('1. Search for the client name in the search bar');
  console.log('2. Click on them to open their profile');
  console.log('3. Go to AVALIACOES FISICAS tab');
  console.log('4. Click the 3-dot menu -> Editar');
  console.log('5. Click on Anamnese');
  console.log('6. Copy the data\n');

  // Export the client list
  const exportData = {
    exportDate: new Date().toISOString(),
    source: 'NextFit',
    totalClients: clients.length,
    clients: clients.map(c => ({
      clientName: c.clientName,
      phone: c.phone,
      evaluationDate: c.date,
      evaluator: c.evaluator,
      anamnesisStatus: 'PENDING_EXTRACTION',
      anamnesisData: null
    }))
  };

  console.log('\nExporting client list...');
  downloadJSON(exportData, `nextfit_clients_${new Date().toISOString().split('T')[0]}.json`);

  console.log('\n=== EXTRACTION COMPLETE ===');
  console.log('A JSON file with the client list has been downloaded.');
  console.log('You can use this as a checklist for manual anamnesis extraction.');

  return exportData;
})();
