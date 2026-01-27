#!/usr/bin/env node
/**
 * slowmo CLI
 *
 * Universal slow-motion control for web animations.
 *
 * @example
 * bun slowmo recreate ./animation.mp4 --runtime framer-motion
 */

import { runRecreate } from './recreate.js';

const HELP_TEXT = `
slowmo - Universal slow-motion control for web animations

USAGE:
  slowmo <command> [options]

COMMANDS:
  recreate <source>     Analyze video/GIF and generate animation code
                        Use 'slowmo recreate --help' for more details

OPTIONS:
  -v, --version         Show version number
  -h, --help            Show this help message

EXAMPLES:
  slowmo recreate animation.mp4 -r framer-motion
  slowmo recreate demo.gif -r gsap -o animation.js

For more information, visit: https://github.com/seflless/slowmo
`;

function showHelp(): void {
  console.log(HELP_TEXT);
}

function showVersion(): void {
  console.log('slowmo v0.9.0');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Handle top-level flags
  if (!command || command === '-h' || command === '--help') {
    showHelp();
    return;
  }

  if (command === '-v' || command === '--version') {
    showVersion();
    return;
  }

  // Route to subcommands
  switch (command) {
    case 'recreate':
      await runRecreate(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "slowmo --help" for usage information');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
