/**
 * Zero-Dependency ANSI Terminal Styling, Tables, Box Drawing & Color Engine.
 */

const isColorSupported = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);

function code(open, close) {
  return (str) => isColorSupported ? `\x1b[${open}m${str}\x1b[${close}m` : String(str);
}

const colors = {
  reset: code(0, 0),
  bold: code(1, 22),
  dim: code(2, 22),
  italic: code(3, 23),
  underline: code(4, 24),
  inverse: code(7, 27),
  
  // Foreground
  black: code(30, 39),
  red: code(31, 39),
  green: code(32, 39),
  yellow: code(33, 39),
  blue: code(34, 39),
  magenta: code(35, 39),
  cyan: code(36, 39),
  white: code(37, 39),
  gray: code(90, 39),

  // Bright
  brightRed: code(91, 39),
  brightGreen: code(92, 39),
  brightYellow: code(93, 39),
  brightBlue: code(94, 39),
  brightMagenta: code(95, 39),
  brightCyan: code(96, 39),

  // Backgrounds
  bgRed: code(41, 49),
  bgGreen: code(42, 49),
  bgYellow: code(43, 49),
  bgBlue: code(44, 49),
  bgMagenta: code(45, 49),
  bgCyan: code(46, 49),
  bgDarkGray: code(100, 49)
};

function stripAnsi(str) {
  return String(str).replace(/\x1B\[\d+m/g, '');
}

function stringWidth(str) {
  return stripAnsi(str).length;
}

function box(text, options = {}) {
  const {
    title = '',
    borderColor = 'cyan',
    padding = 1,
    margin = 1
  } = options;

  const colorFn = colors[borderColor] || colors.cyan;
  const lines = text.split('\n');
  let maxContentWidth = title ? stringWidth(title) + 4 : 0;

  for (const l of lines) {
    const w = stringWidth(l);
    if (w > maxContentWidth) maxContentWidth = w;
  }

  const innerWidth = maxContentWidth + padding * 2;
  const topTitle = title ? `─[ ${colors.bold(title)} ]` : '';
  const topFill = '─'.repeat(Math.max(0, innerWidth - stringWidth(topTitle)));
  const topBorder = colorFn(`┌${topTitle}${topFill}┐`);
  const botBorder = colorFn(`└${'─'.repeat(innerWidth)}┘`);

  const emptyLine = colorFn('│') + ' '.repeat(innerWidth) + colorFn('│');
  const result = [];

  for (let m = 0; m < margin; m++) result.push('');
  result.push(topBorder);

  for (let p = 0; p < padding; p++) result.push(emptyLine);

  for (const line of lines) {
    const visibleLen = stringWidth(line);
    const rightPad = ' '.repeat(Math.max(0, innerWidth - padding - visibleLen));
    const leftPad = ' '.repeat(padding);
    result.push(colorFn('│') + leftPad + line + rightPad + colorFn('│'));
  }

  for (let p = 0; p < padding; p++) result.push(emptyLine);
  result.push(botBorder);
  for (let m = 0; m < margin; m++) result.push('');

  return result.join('\n');
}

function renderTable(headers, rows) {
  const colWidths = headers.map(h => stringWidth(h));

  for (const row of rows) {
    row.forEach((cell, idx) => {
      const len = stringWidth(String(cell || ''));
      if (len > (colWidths[idx] || 0)) {
        colWidths[idx] = len;
      }
    });
  }

  // Padding
  const paddedWidths = colWidths.map(w => w + 2);

  const top = '┌' + paddedWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
  const mid = '├' + paddedWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
  const bot = '└' + paddedWidths.map(w => '─'.repeat(w)).join('┴') + '┘';

  function formatRow(cells, isHeader = false) {
    const line = cells.map((cell, idx) => {
      const val = String(cell || '');
      const padLen = Math.max(0, paddedWidths[idx] - stringWidth(val) - 1);
      return ' ' + (isHeader ? colors.bold(val) : val) + ' '.repeat(padLen);
    }).join('│');
    return '│' + line + '│';
  }

  const out = [];
  out.push(colors.dim(top));
  out.push(formatRow(headers, true));
  out.push(colors.dim(mid));
  for (const row of rows) {
    out.push(formatRow(row, false));
  }
  out.push(colors.dim(bot));

  return out.join('\n');
}

function banner() {
  const title = `
  ███████╗███╗   ██╗██╗   ██╗     ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ 
  ██╔════╝████╗  ██║██║   ██║    ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
  █████╗  ██╔██╗ ██║██║   ██║    ██║  ███╗██║   ██║███████║██████╔╝██║  ██║
  ██╔══╝  ██║╚██╗██║╚██╗ ██╔╝    ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
  ███████╗██║ ╚████║ ╚████╔╝     ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
  ╚══════╝╚═╝  ╚═══╝  ╚═══╝       ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ 
`;
  return colors.brightCyan(title) + '\n' +
    colors.dim('  ⚡ Zero-Dependency AST Environment Drift Detector & Multi-Env Auditor\n');
}

module.exports = {
  colors,
  box,
  renderTable,
  banner,
  stringWidth,
  stripAnsi
};
