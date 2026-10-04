const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { auditProject, findEnvFiles } = require('../../core/drift-detector');
const { scanDirectory } = require('../../core/scanner');
const { syncEnvFile } = require('../../core/synchronizer');
const { readEnvFile, serializeEnv, parseEnv } = require('../../core/env-parser');
const { generateMarkdownReport, generateHtmlReport } = require('../../core/reporter');

/**
 * Get project environment status & full audit
 */
router.get('/audit', (req, res) => {
  try {
    const targetDir = req.query.dir ? path.resolve(req.query.dir) : process.cwd();
    const result = auditProject(targetDir);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Run raw code AST scan
 */
router.get('/scan', (req, res) => {
  try {
    const targetDir = req.query.dir ? path.resolve(req.query.dir) : process.cwd();
    const result = scanDirectory(targetDir);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get all .env* files and their contents
 */
router.get('/environments', (req, res) => {
  try {
    const targetDir = req.query.dir ? path.resolve(req.query.dir) : process.cwd();
    const envPaths = findEnvFiles(targetDir);
    const files = envPaths.map(p => {
      const parsed = readEnvFile(p);
      const raw = fs.readFileSync(p, 'utf8');
      return {
        fileName: path.basename(p),
        filePath: p,
        raw,
        keys: Object.keys(parsed.values),
        count: Object.keys(parsed.values).length
      };
    });

    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Save or update an environment file
 */
router.post('/save-env', (req, res) => {
  try {
    const { fileName, content, dir } = req.body;
    if (!fileName || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'fileName and content are required' });
    }

    const targetDir = dir ? path.resolve(dir) : process.cwd();
    const filePath = path.join(targetDir, path.basename(fileName));

    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true, message: `Successfully saved ${fileName}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Synchronize missing variables
 */
router.post('/sync', (req, res) => {
  try {
    const { targetFile = '.env', keys, customValues = {}, dir } = req.body;
    const targetDir = dir ? path.resolve(dir) : process.cwd();
    const filePath = path.join(targetDir, targetFile);

    let keysToAdd = keys;
    if (!keysToAdd || !Array.isArray(keysToAdd) || keysToAdd.length === 0) {
      const audit = auditProject(targetDir);
      keysToAdd = targetFile.includes('.example') 
        ? audit.missingInExample.map(m => m.key)
        : audit.missingInEnv.map(m => m.key);
    }

    const syncResult = syncEnvFile(filePath, keysToAdd, {
      mode: targetFile.includes('.example') ? 'example' : 'target',
      customValues
    });

    res.json({ success: true, data: syncResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Export audit report
 */
router.get('/export', (req, res) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    const targetDir = req.query.dir ? path.resolve(req.query.dir) : process.cwd();
    const audit = auditProject(targetDir);

    if (format === 'markdown' || format === 'md') {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename="env-guard-report.md"');
      return res.send(generateMarkdownReport(audit));
    }

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(generateHtmlReport(audit));
    }

    res.json(audit);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
