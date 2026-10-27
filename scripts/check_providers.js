const { checkAllProviders } = require('../services/health');

async function run() {
  console.log('\n🩺 Diagnosticando estado de proveedores TACIT STR...\n');
  const results = await checkAllProviders();

  let allOk = true;
  for (const r of results) {
    const icon = r.ok ? '🟢 OK' : '🔴 FALLÓ';
    const detail = r.ok ? `${r.ms}ms ${r.info ? '(' + r.info + ')' : ''}` : `(${r.error || 'Error'})`;
    console.log(`[${icon}] ${r.name.padEnd(28)} -> ${detail}`);
    if (!r.ok) allOk = false;
  }

  const online = results.filter(r => r.ok).length;
  console.log(`\nResumen: ${online}/${results.length} proveedores operativos.\n`);
  process.exit(allOk ? 0 : 1);
}

run();
