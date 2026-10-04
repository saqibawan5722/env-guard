const { auditProject, findEnvFiles } = require('./core/drift-detector');
const { scanDirectory, scanFile } = require('./core/scanner');
const { parseEnv, readEnvFile, serializeEnv } = require('./core/env-parser');
const { syncEnvFile } = require('./core/synchronizer');
const { checkSecret, calculateEntropy } = require('./core/secret-checker');
const { inferVariableType } = require('./core/type-inferrer');
const { generateHtmlReport, generateMarkdownReport } = require('./core/reporter');
const { createApp, startServer } = require('./server/app');

module.exports = {
  // Core Audit & Scanner
  auditProject,
  findEnvFiles,
  scanDirectory,
  scanFile,

  // Env Parsing & Serialization
  parseEnv,
  readEnvFile,
  serializeEnv,

  // Synchronization & Auto-Fix
  syncEnvFile,

  // Security & Secret Analysis
  checkSecret,
  calculateEntropy,

  // Type Inference
  inferVariableType,

  // Reporting
  generateHtmlReport,
  generateMarkdownReport,

  // Express Web Server
  createApp,
  startServer
};
