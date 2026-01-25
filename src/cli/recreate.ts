#!/usr/bin/env node
/**
 * slowmo recreate CLI
 *
 * Command-line tool for analyzing and recreating animations using AI.
 *
 * @example
 * npx slowmo-recreate ./animation.mp4 --runtime framer-motion --api-key $GEMINI_API_KEY
 *
 * @example
 * # Using environment variable
 * export GEMINI_API_KEY=your-api-key
 * npx slowmo-recreate ./video.mp4 -r gsap
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Dynamic import for the recreate module
import {
  recreate,
  analyze,
  getRuntimes,
  type AnimationRuntime,
  type AIBackend,
  type RecreateOptions,
} from '../recreate.js';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CLIOptions {
  source: string;
  runtime: AnimationRuntime;
  backend: AIBackend;
  apiKey: string;
  output?: string;
  format: 'code' | 'json' | 'full';
  style: 'minimal' | 'detailed' | 'production';
  typescript: boolean;
  context?: string;
  analyzeOnly: boolean;
  listRuntimes: boolean;
  help: boolean;
  version: boolean;
  verbose: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    source: '',
    runtime: 'framer-motion',
    backend: 'gemini',
    apiKey: '',
    format: 'code',
    style: 'production',
    typescript: true,
    analyzeOnly: false,
    listRuntimes: false,
    help: false,
    version: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '-r':
      case '--runtime':
        options.runtime = nextArg as AnimationRuntime;
        i++;
        break;
      case '-b':
      case '--backend':
        options.backend = nextArg as AIBackend;
        i++;
        break;
      case '-k':
      case '--api-key':
        options.apiKey = nextArg;
        i++;
        break;
      case '-o':
      case '--output':
        options.output = nextArg;
        i++;
        break;
      case '-f':
      case '--format':
        options.format = nextArg as 'code' | 'json' | 'full';
        i++;
        break;
      case '-s':
      case '--style':
        options.style = nextArg as 'minimal' | 'detailed' | 'production';
        i++;
        break;
      case '-c':
      case '--context':
        options.context = nextArg;
        i++;
        break;
      case '--no-typescript':
      case '--js':
        options.typescript = false;
        break;
      case '-a':
      case '--analyze':
        options.analyzeOnly = true;
        break;
      case '-l':
      case '--list-runtimes':
        options.listRuntimes = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        if (!arg.startsWith('-') && !options.source) {
          options.source = arg;
        }
    }
  }

  // Try environment variables for API key
  if (!options.apiKey) {
    options.apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      '';
  }

  return options;
}

// ============================================================================
// Help & Info
// ============================================================================

const HELP_TEXT = `
slowmo recreate - AI-powered animation recreation

USAGE:
  slowmo-recreate <source> [options]
  slowmo-recreate ./animation.mp4 --runtime framer-motion

ARGUMENTS:
  <source>                    Video, GIF, or image file to analyze

OPTIONS:
  -r, --runtime <name>        Target animation runtime (default: framer-motion)
                              Options: css, framer-motion, gsap, remotion,
                                       motion-one, anime, three, lottie,
                                       react-spring, popmotion

  -b, --backend <name>        AI backend to use (default: gemini)
                              Options: gemini, openai, anthropic

  -k, --api-key <key>         API key for the AI service
                              Also reads from GEMINI_API_KEY, OPENAI_API_KEY,
                              or ANTHROPIC_API_KEY environment variables

  -o, --output <file>         Write output to file (default: stdout)

  -f, --format <format>       Output format (default: code)
                              code: Just the generated code
                              json: Analysis + code as JSON
                              full: Everything including metadata

  -s, --style <style>         Code generation style (default: production)
                              minimal: Shortest possible code
                              detailed: With explanatory comments
                              production: Ready for production use

  -c, --context <text>        Additional context about the animation

  --no-typescript, --js       Generate JavaScript instead of TypeScript

  -a, --analyze               Only analyze, don't generate code

  -l, --list-runtimes         List available animation runtimes

  -v, --version               Show version number

  --verbose                   Show detailed processing information

  -h, --help                  Show this help message

EXAMPLES:
  # Recreate animation as Framer Motion component
  slowmo-recreate animation.mp4 -r framer-motion -k $GEMINI_API_KEY

  # Analyze animation only
  slowmo-recreate animation.gif -a

  # Generate GSAP code and save to file
  slowmo-recreate demo.mp4 -r gsap -o animation.js

  # Use OpenAI instead of Gemini
  slowmo-recreate video.mp4 -b openai -k $OPENAI_API_KEY

  # Generate minimal CSS animation
  slowmo-recreate fade.gif -r css -s minimal

ENVIRONMENT VARIABLES:
  GEMINI_API_KEY              Google Gemini API key
  OPENAI_API_KEY              OpenAI API key
  ANTHROPIC_API_KEY           Anthropic API key

For more information, visit: https://github.com/seflless/slowmo
`;

function showHelp(): void {
  console.log(HELP_TEXT);
}

function showVersion(): void {
  // Hardcode version since we're in ESM context
  console.log('slowmo-recreate v0.9.0');
}

function showRuntimes(): void {
  console.log('\nAvailable Animation Runtimes:\n');
  const runtimes = getRuntimes();
  for (const rt of runtimes) {
    console.log(`  ${rt.id.padEnd(15)} ${rt.description}`);
  }
  console.log('\nUse: slowmo-recreate <source> -r <runtime>');
}

// ============================================================================
// File Handling
// ============================================================================

function loadSource(sourcePath: string): string {
  const absolutePath = path.resolve(process.cwd(), sourcePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Source file not found: ${absolutePath}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(sourcePath).toLowerCase();

  // Determine MIME type
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
  };

  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  const base64 = buffer.toString('base64');

  return `data:${mimeType};base64,${base64}`;
}

function writeOutput(content: string, outputPath?: string): void {
  if (outputPath) {
    const absolutePath = path.resolve(process.cwd(), outputPath);
    fs.writeFileSync(absolutePath, content);
    console.error(`\nWritten to: ${absolutePath}`);
  } else {
    console.log(content);
  }
}

// ============================================================================
// Main CLI Logic
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Handle info commands
  if (options.help) {
    showHelp();
    return;
  }

  if (options.version) {
    showVersion();
    return;
  }

  if (options.listRuntimes) {
    showRuntimes();
    return;
  }

  // Validate required options
  if (!options.source) {
    console.error('Error: No source file specified');
    console.error('Usage: slowmo-recreate <source> [options]');
    console.error('Run with --help for more information');
    process.exit(1);
  }

  if (!options.apiKey) {
    console.error('Error: No API key provided');
    console.error('Use --api-key <key> or set GEMINI_API_KEY environment variable');
    process.exit(1);
  }

  // Load source file
  if (options.verbose) {
    console.error(`Loading source: ${options.source}`);
  }

  let sourceData: string;
  try {
    sourceData = loadSource(options.source);
  } catch (err) {
    console.error(`Error loading source: ${(err as Error).message}`);
    process.exit(1);
    return; // TypeScript needs this to understand control flow
  }

  if (options.verbose) {
    console.error(`Source loaded (${Math.round(sourceData.length / 1024)}KB)`);
    console.error(`Runtime: ${options.runtime}`);
    console.error(`Backend: ${options.backend}`);
  }

  // Run analysis or full recreation
  try {
    if (options.analyzeOnly) {
      if (options.verbose) {
        console.error('Analyzing animation...');
      }

      const analysis = await analyze(sourceData, options.apiKey, options.backend);

      const output =
        options.format === 'code'
          ? JSON.stringify(analysis, null, 2)
          : JSON.stringify(analysis, null, 2);

      writeOutput(output, options.output);
    } else {
      if (options.verbose) {
        console.error('Analyzing and generating code...');
      }

      const recreateOptions: RecreateOptions = {
        source: sourceData,
        runtime: options.runtime,
        backend: options.backend,
        apiKey: options.apiKey,
        context: options.context,
        style: options.style,
        typescript: options.typescript,
      };

      const result = await recreate(recreateOptions);

      let output: string;

      switch (options.format) {
        case 'code':
          output = result.code.code;
          break;
        case 'json':
          output = JSON.stringify(
            {
              analysis: result.analysis,
              code: result.code,
            },
            null,
            2
          );
          break;
        case 'full':
          output = JSON.stringify(result, null, 2);
          break;
        default:
          output = result.code.code;
      }

      writeOutput(output, options.output);

      if (options.verbose) {
        console.error(`\nProcessing time: ${result.meta.processingTime}ms`);
        console.error(`Frames analyzed: ${result.meta.framesAnalyzed}`);
        console.error(`Model used: ${result.meta.model}`);
      }
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    if (options.verbose) {
      console.error((err as Error).stack);
    }
    process.exit(1);
  }
}

// Run CLI
main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
