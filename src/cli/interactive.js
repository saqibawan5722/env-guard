const readline = require('readline');
const { colors } = require('./logger');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

/**
 * Interactively prompt for missing environment variables.
 */
async function promptMissingVariables(missingList) {
  const customValues = {};

  console.log(colors.cyan('\n🔧 Interactive Env-Guard Configuration Wizard'));
  console.log(colors.dim('Press Enter to accept suggested placeholder or type a custom value.\n'));

  for (const item of missingList) {
    const promptText = `${colors.bold(item.key)} ${colors.dim(`[Type: ${item.type}]`)} (default: ${colors.yellow(item.defaultPlaceholder)}): `;
    const answer = await askQuestion(promptText);
    customValues[item.key] = answer.length > 0 ? answer : item.defaultPlaceholder;
  }

  return customValues;
}

module.exports = {
  askQuestion,
  promptMissingVariables
};
