const path = require('path');
const fs = require('fs');
const { auditProject, findEnvFiles } = require('../core/drift-detector');
const { scanDirectory } = require('../core/scanner');
const { syncEnvFile } = require('../core/synchronizer');
const { generateMarkdownReport, generateHtmlReport } = require('../core/reporter');
const { colors, box, renderTable, banner } = require('./logger');
const { promptMissingVariables } = require('./interactive');
const { installPreCommitHook } = require('./hooks');
const { startServer } = require('../server/app');

function printHelp() {
  console.log(banner());
  console.log(`
${colors.bold('USAGE:')}
  $ ${colors.cyan('env-guard')} ${colors.yellow('<command>')} ${colors.dim('[options]')}

${colors.bold('COMMANDS:')}
  ${colors.cyan('audit')} ${colors.dim('[dir]')}             Run full drift & health audit on project (Default)
  ${colors.cyan('scan')} ${colors.dim('[dir]')}              Scan code AST for all environment variable references
  ${colors.cyan('sync')} ${colors.dim('[dir]')}              Auto-sync missing variables to .env or .env.example
  ${colors.cyan('check')} ${colors.dim('[dir]')}             CI/CD check (fails with exit code 1 if drift exists)
  ${colors.cyan('report')} ${colors.dim('[dir]')}            Generate standalone HTML, JSON, or Markdown report
  ${colors.cyan('ui')} ${colors.dim('[port]')}               Launch modern Express Web Dashboard (default port: 4321)
  ${colors.cyan('init-hook')}                Install Git pre-commit hook to prevent broken commits

${colors.bold('OPTIONS:')}
  ${colors.yellow('--dir')} ${colors.dim('<path>')}          Target project directory (default: current directory)
  ${colors.yellow('--target')} ${colors.dim('<file>')}       Target env file (default: .env)
  ${colors.yellow('--example')} ${colors.dim('<file>')}      Example env file (default: .env.example)
  ${colors.yellow('--interactive, -i')}     Prompt interactively for values during sync
  ${colors.yellow('--strict')}              Strict mode for CI checks
  ${colors.yellow('--html')} ${colors.dim('<file>')}         Export HTML report to path
  ${colors.yellow('--json')} ${colors.dim('<file>')}         Export JSON report to path
  ${colors.yellow('--port')} ${colors.dim('<port>')}         Port for Express dashboard (default: 4321)
  ${colors.yellow('--help, -h')}            Show this help message
  ${colors.yellow('--version, -v')}         Show version

${colors.bold('EXAMPLES:')}
  $ ${colors.dim('npx env-guard')}
  $ ${colors.dim('npx env-guard audit --dir ./my-app')}
  $ ${colors.dim('npx env-guard sync --interactive')}
  $ ${colors.dim('npx env-guard check --strict')}
  $ ${colors.dim('npx env-guard ui 4321')}
  $ ${colors.dim('npx env-guard report --html ./audit.html')}
`);
}

async function runCli(argv = process.argv.slice(2)) {
  const args = argv.filter(a => !a.startsWith('-'));
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (['dir', 'target', 'example', 'html', 'json', 'port'].includes(key) && argv[i + 1] && !argv[i + 1].startsWith('-')) {
        flags[key] = argv[i + 1];
        i++;
      } else {
        flags[key] = true;
      }
    } else if (a.startsWith('-')) {
      const char = a.slice(1);
      if (char === 'i') flags.interactive = true;
      if (char === 'h') flags.help = true;
      if (char === 'v') flags.version = true;
    }
  }

  if (flags.help) {
    printHelp();
    return 0;
  }

  if (flags.version) {
    const pkg = require('../../package.json');
    console.log(`env-guard v${pkg.version}`);
    return 0;
  }

  const command = args[0] || 'audit';
  const targetDir = flags.dir || args[1] || process.cwd();

  switch (command) {
    case 'audit':
      return handleAudit(targetDir, flags);

    case 'scan':
      return handleScan(targetDir, flags);

    case 'sync':
      return handleSync(targetDir, flags);

    case 'check':
      return handleCheck(targetDir, flags);

    case 'report':
      return handleReport(targetDir, flags);

    case 'ui':
    case 'server':
      return handleServer(flags.port || args[1] || 4321);

    case 'init-hook':
      return handleInitHook(targetDir);

    default:
      console.log(colors.red(`Unknown command: "${command}"`));
      printHelp();
      return 1;
  }
}

function handleAudit(targetDir, flags) {
  console.log(banner());
  console.log(`${colors.dim('Scanning project:')} ${colors.cyan(path.resolve(targetDir))}\n`);

  const audit = auditProject(targetDir, {
    targetEnvFile: flags.target || '.env',
    exampleFile: flags.example || '.env.example'
  });

  const { summary, healthScore, missingInEnv, missingInExample, deadInEnv, secrets, matrix } = audit;

  // Health Score Box
  const healthColor = healthScore >= 80 ? 'green' : healthScore >= 50 ? 'yellow' : 'red';
  const scoreMsg = [
    `Project Health Score: ${colors.bold(healthScore + '%')} [${audit.isPassing ? colors.green('PASSED') : colors.red('ACTION REQUIRED')}]`,
    `Total Files Scanned: ${summary.totalFilesScanned} | Discovered .env Files: ${summary.envFilesFound}`,
    `Code References: ${summary.codeKeysCount} | Missing: ${summary.missingInEnvCount} | Leaks: ${summary.secretsCount}`
  ].join('\n');

  console.log(box(scoreMsg, { title: 'AUDIT SUMMARY', borderColor: healthColor, padding: 1 }));

  // Missing In .env
  if (missingInEnv.length > 0) {
    console.log(colors.red(colors.bold('\n❌ MISSING IN .env (Risk of runtime crash):')));
    const headers = ['Variable Key', 'Type', 'Suggested Default', 'File Occurrences'];
    const rows = missingInEnv.map(m => [
      colors.bold(colors.red(m.key)),
      colors.yellow(m.type),
      colors.cyan(m.defaultPlaceholder),
      m.occurrences.map(o => `${o.file}:${o.line}`).slice(0, 2).join(', ')
    ]);
    console.log(renderTable(headers, rows));
  } else {
    console.log(colors.green('\n✅ All code environment variables exist in .env!'));
  }

  // Missing in .env.example
  if (missingInExample.length > 0) {
    console.log(colors.yellow(colors.bold('\n⚠️  MISSING IN .env.example (Team onboarding drift):')));
    const headers = ['Variable Key', 'Type', 'Status'];
    const rows = missingInExample.map(m => [
      colors.yellow(m.key),
      m.type,
      m.inCode ? 'Used in Code' : 'Present in .env'
    ]);
    console.log(renderTable(headers, rows));
  }

  // Dead variables in .env
  if (deadInEnv.length > 0) {
    console.log(colors.gray(colors.bold('\n🧟 DEAD / ZOMBIE VARIABLES (Defined in .env but never used):')));
    const headers = ['Variable Key', 'Line in .env'];
    const rows = deadInEnv.map(d => [colors.gray(d.key), String(d.line || '-')]);
    console.log(renderTable(headers, rows));
  }

  // Secret Leaks
  if (secrets.length > 0) {
    console.log(colors.red(colors.bold('\n🔒 SENSITIVE SECRETS & TOKENS DETECTED:')));
    const headers = ['File', 'Line', 'Variable', 'Rule', 'Severity'];
    const rows = secrets.map(s => [
      s.file,
      String(s.line || '-'),
      colors.bold(s.key),
      s.ruleName,
      s.severity === 'CRITICAL' ? colors.bgRed(` ${s.severity} `) : colors.yellow(s.severity)
    ]);
    console.log(renderTable(headers, rows));
  }

  console.log(`\n${colors.dim('💡 Tip: Run')} ${colors.cyan('npx env-guard sync')} ${colors.dim('to automatically scaffold missing variables.')}`);
  console.log(`${colors.dim('💡 Tip: Run')} ${colors.cyan('npx env-guard ui')} ${colors.dim('to launch the interactive web dashboard.')}\n`);

  return audit.isPassing ? 0 : 1;
}

function handleScan(targetDir) {
  console.log(banner());
  console.log(`${colors.dim('Scanning AST in:')} ${colors.cyan(path.resolve(targetDir))}\n`);

  const scan = scanDirectory(targetDir);
  console.log(`${colors.bold('Scanned')} ${scan.totalFilesScanned} files. Found ${colors.bold(scan.uniqueKeys.length)} unique environment keys:\n`);

  const headers = ['Variable Key', 'Count', 'Locations'];
  const rows = scan.uniqueKeys.map(key => {
    const occs = scan.keyOccurrences[key] || [];
    const locs = occs.map(o => `${o.file}:${o.line}`).slice(0, 3).join(', ');
    return [colors.cyan(key), String(occs.length), locs];
  });

  console.log(renderTable(headers, rows));
  return 0;
}

async function handleSync(targetDir, flags) {
  console.log(banner());
  const targetEnv = flags.target || '.env';
  const targetPath = path.join(targetDir, targetEnv);

  const audit = auditProject(targetDir);
  const missingList = targetEnv.includes('.example') ? audit.missingInExample : audit.missingInEnv;

  if (missingList.length === 0) {
    console.log(colors.green(`🎉 No missing environment variables found for ${targetEnv}!`));
    return 0;
  }

  let customValues = {};
  if (flags.interactive) {
    customValues = await promptMissingVariables(missingList);
  }

  const result = syncEnvFile(targetPath, missingList.map(m => m.key), {
    mode: targetEnv.includes('.example') ? 'example' : 'target',
    customValues
  });

  console.log(colors.green(`\n✅ Successfully synced ${result.addedKeys.length} variables to ${targetEnv}:`));
  result.addedKeys.forEach(k => console.log(`   + ${colors.bold(k)}`));
  console.log('');
  return 0;
}

function handleCheck(targetDir, flags) {
  const audit = auditProject(targetDir);
  if (!audit.isPassing || (flags.strict && (audit.missingInExample.length > 0 || audit.summary.criticalSecretsCount > 0))) {
    console.error(colors.red(`❌ Env-Guard CI Check FAILED!`));
    console.error(`Missing keys in .env: ${audit.missingInEnv.length}`);
    console.error(`Critical secret leaks: ${audit.summary.criticalSecretsCount}`);
    return 1;
  }
  console.log(colors.green(`✅ Env-Guard CI Check PASSED! All environment variables verified.`));
  return 0;
}

function handleReport(targetDir, flags) {
  const audit = auditProject(targetDir);

  if (flags.html) {
    const html = generateHtmlReport(audit);
    fs.writeFileSync(flags.html, html, 'utf8');
    console.log(colors.green(`✅ Standalone HTML report saved to: ${flags.html}`));
    return 0;
  }

  if (flags.json) {
    fs.writeFileSync(flags.json, JSON.stringify(audit, null, 2), 'utf8');
    console.log(colors.green(`✅ JSON report saved to: ${flags.json}`));
    return 0;
  }

  // Print markdown
  console.log(generateMarkdownReport(audit));
  return 0;
}

async function handleServer(port = 4321) {
  console.log(banner());
  try {
    const { url, port: activePort, wasFallback } = await startServer(port);
    const lines = [
      `🌐 Env-Guard Express Dashboard is live!`,
      ``,
      `Local URL:  ${colors.bold(colors.cyan(url))}`,
      `Directory:  ${colors.dim(process.cwd())}`,
      ``,
      `Press Ctrl+C to stop server`
    ];

    if (wasFallback) {
      lines.splice(2, 0, colors.yellow(`⚠️  Port ${port} was occupied, auto-switched to ${activePort}`));
    }

    console.log(box(lines.join('\n'), { title: 'DASHBOARD READY', borderColor: 'green', padding: 1 }));
  } catch (err) {
    console.error(colors.red(`Failed to start server: ${err.message}`));
    return 1;
  }
}

function handleInitHook(targetDir) {
  console.log(banner());
  const res = installPreCommitHook(targetDir);
  if (res.success) {
    console.log(colors.green(`✅ ${res.message}`));
    return 0;
  } else {
    console.error(colors.red(`❌ ${res.message}`));
    return 1;
  }
}

module.exports = {
  runCli
};
