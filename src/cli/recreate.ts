/**
 * slowmo recreate subcommand
 *
 * Analyzes videos/GIFs and generates animation code using AI.
 *
 * @example
 * slowmo recreate ./animation.mp4 --runtime framer-motion --api-key $GEMINI_API_KEY
 *
 * @example
 * # Using environment variable
 * export GEMINI_API_KEY=your-api-key
 * slowmo recreate ./video.mp4 -r gsap
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';

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
  fps: number;
  maxFrames: number;
  analyzeOnly: boolean;
  demo: boolean;
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
    fps: 60,
    maxFrames: 60,
    analyzeOnly: false,
    demo: false,
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
      case '--fps':
        options.fps = parseInt(nextArg, 10);
        i++;
        break;
      case '--max-frames':
        options.maxFrames = parseInt(nextArg, 10);
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
      case '-d':
      case '--demo':
        options.demo = true;
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
  slowmo recreate <source> [options]
  slowmo recreate ./animation.mp4 --runtime framer-motion

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

  --fps <number>              Frame rate for extraction (default: 60)
  --max-frames <number>       Maximum frames to extract (default: 60)

  --no-typescript, --js       Generate JavaScript instead of TypeScript

  -a, --analyze               Only analyze, don't generate code

  -d, --demo                  Generate standalone HTML demo file
                              Includes live preview + copyable code

  -l, --list-runtimes         List available animation runtimes

  -v, --version               Show version number

  --verbose                   Show detailed processing information

  -h, --help                  Show this help message

EXAMPLES:
  # Recreate animation as Framer Motion component
  slowmo recreate animation.mp4 -r framer-motion -k $GEMINI_API_KEY

  # Analyze animation only
  slowmo recreate animation.gif -a

  # Generate GSAP code and save to file
  slowmo recreate demo.mp4 -r gsap -o animation.js

  # Use OpenAI instead of Gemini
  slowmo recreate video.mp4 -b openai -k $OPENAI_API_KEY

  # Generate minimal CSS animation
  slowmo recreate fade.gif -r css -s minimal

  # Generate HTML demo with live preview
  slowmo recreate bounce.mp4 -r css --demo -o demo.html

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
  console.log('slowmo recreate v0.9.0');
}

function showRuntimes(): void {
  console.log('\nAvailable Animation Runtimes:\n');
  const runtimes = getRuntimes();
  for (const rt of runtimes) {
    console.log(`  ${rt.id.padEnd(15)} ${rt.description}`);
  }
  console.log('\nUse: slowmo recreate <source> -r <runtime>');
}

// ============================================================================
// File Handling
// ============================================================================

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

function getVideoInfo(videoPath: string): VideoInfo | null {
  try {
    const result = spawnSync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath,
    ]);

    if (result.status !== 0) return null;

    const data = JSON.parse(result.stdout.toString());
    const videoStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');

    if (!videoStream) return null;

    // Parse frame rate (e.g., "30/1" or "29.97")
    let fps = 30;
    if (videoStream.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
      fps = den ? num / den : num;
    }

    return {
      duration: parseFloat(data.format?.duration || videoStream.duration || '0'),
      width: videoStream.width || 0,
      height: videoStream.height || 0,
      fps,
    };
  } catch {
    return null;
  }
}

function extractFramesWithFfmpeg(
  videoPath: string,
  options: { fps: number; maxFrames: number }
): string[] {
  const { fps, maxFrames } = options;
  const absolutePath = path.resolve(process.cwd(), videoPath);

  // Get video info
  const videoInfo = getVideoInfo(absolutePath);
  if (!videoInfo) {
    throw new Error('Could not read video info. Is ffmpeg/ffprobe installed?');
  }

  // Calculate actual fps to use - don't exceed video's native fps
  const effectiveFps = Math.min(fps, videoInfo.fps);

  // Calculate how many frames we'd get and adjust if needed
  const totalPossibleFrames = Math.floor(videoInfo.duration * effectiveFps);
  const framesToExtract = Math.min(totalPossibleFrames, maxFrames);

  // If we need fewer frames than fps would give us, calculate interval
  let fpsToUse = effectiveFps;
  if (framesToExtract < totalPossibleFrames) {
    fpsToUse = framesToExtract / videoInfo.duration;
  }

  // Create temp directory for frames
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slowmo-frames-'));

  try {
    // Extract frames using ffmpeg
    const result = spawnSync('ffmpeg', [
      '-i', absolutePath,
      '-vf', `fps=${fpsToUse}`,
      '-frames:v', String(maxFrames),
      '-q:v', '2', // High quality JPEG
      path.join(tempDir, 'frame-%04d.jpg'),
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    if (result.status !== 0) {
      const stderr = result.stderr?.toString() || '';
      throw new Error(`ffmpeg failed: ${stderr}`);
    }

    // Read extracted frames
    const frameFiles = fs.readdirSync(tempDir)
      .filter(f => f.startsWith('frame-') && f.endsWith('.jpg'))
      .sort();

    const frames: string[] = [];
    for (const frameFile of frameFiles) {
      const framePath = path.join(tempDir, frameFile);
      const buffer = fs.readFileSync(framePath);
      const base64 = buffer.toString('base64');
      frames.push(`data:image/jpeg;base64,${base64}`);
    }

    return frames;
  } finally {
    // Clean up temp directory
    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'].includes(ext);
}

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

interface DemoOptions {
  code: string;
  html?: string;
  javascript?: string;
  runtime: string;
  analysis?: { description?: string; isInteractive?: boolean };
  sourceVideo?: string; // base64 data URL of original video
  isInteractive?: boolean;
}

function generateInteractiveDemo(options: DemoOptions): string {
  const { code, html, javascript, runtime, analysis, sourceVideo } = options;
  const description = analysis?.description || 'Interactive UI component';

  // Combine CSS, HTML, JS for display
  const fullCode = `/* CSS */\n${code}\n\n/* HTML */\n${html || ''}\n\n/* JavaScript */\n${javascript || ''}`;
  const escapedCode = fullCode.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>slowmo - Interactive Component Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #fff;
    }
    .subtitle {
      color: #737373;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }
    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .panel {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 12px;
      overflow: hidden;
    }
    .panel-header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #262626;
      background: #1a1a1a;
      font-size: 0.75rem;
      font-weight: 500;
      color: #a3a3a3;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .panel-content {
      padding: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      background: #000;
    }
    .panel-content video {
      max-width: 100%;
      max-height: 280px;
      border-radius: 4px;
    }
    .interactive-preview {
      width: 100%;
      height: 100%;
      min-height: 280px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .code-section {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 12px;
      overflow: hidden;
    }
    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #262626;
      background: #1a1a1a;
    }
    .code-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #a3a3a3;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .copy-btn {
      background: #262626;
      border: 1px solid #404040;
      color: #e5e5e5;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .copy-btn:hover { background: #333; border-color: #525252; }
    .copy-btn:active { transform: scale(0.98); }
    .copy-btn.copied { background: #166534; border-color: #22c55e; }
    pre {
      margin: 0;
      padding: 1rem;
      overflow-x: auto;
      font-family: ui-monospace, 'SF Mono', Menlo, Monaco, monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
      color: #d4d4d4;
      max-height: 400px;
    }
    .runtime-badge {
      display: inline-block;
      background: #262626;
      color: #a3a3a3;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-left: 0.5rem;
    }
    .interactive-badge {
      background: #166534;
      color: #22c55e;
    }
    /* Component styles */
${code}
  </style>
</head>
<body>
  <div class="container">
    <h1>Interactive Recreation <span class="runtime-badge">${runtime}</span> <span class="runtime-badge interactive-badge">Interactive</span></h1>
    <p class="subtitle">${description}</p>

    <div class="comparison">
      <div class="panel">
        <div class="panel-header">Before (Original Recording)</div>
        <div class="panel-content">
          ${sourceVideo ? `<video id="sourceVideo" src="${sourceVideo}" loop muted autoplay playsinline controls></video>` : '<span style="color:#525252">No source video</span>'}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">After (Recreated - Click to interact!)</div>
        <div class="panel-content">
          <div class="interactive-preview">
            ${html || '<span style="color:#525252">No HTML generated</span>'}
          </div>
        </div>
      </div>
    </div>

    <div class="code-section">
      <div class="code-header">
        <span class="code-label">HTML + CSS + JS</span>
        <button class="copy-btn" onclick="copyCode()">Copy</button>
      </div>
      <pre><code id="code">${escapedCode}</code></pre>
    </div>
  </div>

  <script>
    function copyCode() {
      const code = document.getElementById('code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    }

    // Component JavaScript
    ${javascript || ''}
  </script>
</body>
</html>`;
}

function generateDemo(options: DemoOptions): string {
  const { code, html, javascript, runtime, analysis, sourceVideo, isInteractive } = options;
  const description = analysis?.description || 'Generated animation';

  // If this is an interactive component, generate a different demo
  if (isInteractive && html) {
    return generateInteractiveDemo(options);
  }

  const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Extract the main animated class name from CSS
  const classMatch = code.match(/\.([a-zA-Z][\w-]*)\s*\{[^}]*animation[^}]*\}/);
  const animatedClass = classMatch ? classMatch[1] : 'circle';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>slowmo - Animation Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #fff;
    }
    .subtitle {
      color: #737373;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }
    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .panel {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 12px;
      overflow: hidden;
    }
    .panel-header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #262626;
      background: #1a1a1a;
      font-size: 0.75rem;
      font-weight: 500;
      color: #a3a3a3;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .panel-content {
      padding: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 250px;
      background: #000;
    }
    .panel-content video {
      max-width: 100%;
      max-height: 200px;
      border-radius: 4px;
    }
    .controls {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      justify-content: center;
    }
    .btn {
      background: #262626;
      border: 1px solid #404040;
      color: #e5e5e5;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .btn:hover { background: #333; border-color: #525252; }
    .btn:active { transform: scale(0.98); }
    .btn.active { background: #166534; border-color: #22c55e; }
    .code-section {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 12px;
      overflow: hidden;
    }
    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #262626;
      background: #1a1a1a;
    }
    .code-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #a3a3a3;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .copy-btn {
      background: #262626;
      border: 1px solid #404040;
      color: #e5e5e5;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .copy-btn:hover { background: #333; border-color: #525252; }
    .copy-btn:active { transform: scale(0.98); }
    .copy-btn.copied { background: #166534; border-color: #22c55e; }
    pre {
      margin: 0;
      padding: 1rem;
      overflow-x: auto;
      font-family: ui-monospace, 'SF Mono', Menlo, Monaco, monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
      color: #d4d4d4;
    }
    .runtime-badge {
      display: inline-block;
      background: #262626;
      color: #a3a3a3;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-left: 0.5rem;
    }
    .animation-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .animation-wrapper.paused .${animatedClass} {
      animation-play-state: paused;
    }
${code}
  </style>
</head>
<body>
  <div class="container">
    <h1>Animation Recreation <span class="runtime-badge">${runtime}</span></h1>
    <p class="subtitle">${description}</p>

    <div class="controls">
      <button class="btn" id="playPauseBtn" onclick="togglePlayPause()">
        <span id="playPauseIcon">⏸</span> <span id="playPauseText">Pause</span>
      </button>
      <button class="btn" onclick="resetAll()">
        ↺ Reset
      </button>
    </div>

    <div class="comparison">
      <div class="panel">
        <div class="panel-header">Before (Original)</div>
        <div class="panel-content">
          ${sourceVideo ? `<video id="sourceVideo" src="${sourceVideo}" loop muted autoplay playsinline></video>` : '<span style="color:#525252">No source video</span>'}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">After (Recreated)</div>
        <div class="panel-content">
          <div class="animation-wrapper" id="animationWrapper">
            <div class="${animatedClass}" id="animatedElement"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="code-section">
      <div class="code-header">
        <span class="code-label">${runtime.toUpperCase()}</span>
        <button class="copy-btn" onclick="copyCode()">Copy</button>
      </div>
      <pre><code id="code">${escapedCode}</code></pre>
    </div>
  </div>

  <script>
    let isPaused = false;
    const video = document.getElementById('sourceVideo');
    const wrapper = document.getElementById('animationWrapper');
    let animatedEl = document.getElementById('animatedElement');

    function togglePlayPause() {
      isPaused = !isPaused;
      const icon = document.getElementById('playPauseIcon');
      const text = document.getElementById('playPauseText');

      if (isPaused) {
        if (video) video.pause();
        wrapper.classList.add('paused');
        icon.textContent = '▶';
        text.textContent = 'Play';
      } else {
        if (video) video.play();
        wrapper.classList.remove('paused');
        icon.textContent = '⏸';
        text.textContent = 'Pause';
      }
    }

    function restartAnimation() {
      // Reset CSS animation by cloning the element
      const parent = animatedEl.parentNode;
      const clone = animatedEl.cloneNode(true);
      clone.id = 'animatedElement';
      parent.replaceChild(clone, animatedEl);
      animatedEl = clone;
    }

    function resetAll() {
      // Reset video
      if (video) {
        video.currentTime = 0;
        if (!isPaused) video.play();
      }
      restartAnimation();
    }

    function copyCode() {
      const code = document.getElementById('code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    }

    // Sync animation with video loop
    if (video) {
      let lastTime = 0;
      video.addEventListener('timeupdate', () => {
        // Detect loop: time jumped backwards significantly
        if (video.currentTime < lastTime - 0.1) {
          restartAnimation();
        }
        lastTime = video.currentTime;
      });
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// Main CLI Logic
// ============================================================================

export async function runRecreate(args: string[]): Promise<void> {
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
    console.error('Usage: slowmo recreate <source> [options]');
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

  let sourceData: string | string[];
  let videoInfo: VideoInfo | null = null;
  let originalVideoDataUrl: string | undefined;

  try {
    if (isVideoFile(options.source)) {
      // Extract frames from video using ffmpeg
      const absolutePath = path.resolve(process.cwd(), options.source);
      videoInfo = getVideoInfo(absolutePath);

      if (options.verbose && videoInfo) {
        console.error(`Video: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration.toFixed(2)}s @ ${videoInfo.fps.toFixed(1)}fps`);
        console.error(`Extracting frames with ffmpeg...`);
      }

      // Load original video for demo comparison
      originalVideoDataUrl = loadSource(options.source);

      sourceData = extractFramesWithFfmpeg(options.source, {
        fps: options.fps,
        maxFrames: options.maxFrames,
      });

      if (options.verbose) {
        console.error(`Extracted ${sourceData.length} frames`);
      }
    } else {
      // Load as single image/file
      sourceData = loadSource(options.source);
    }
  } catch (err) {
    console.error(`Error loading source: ${(err as Error).message}`);
    process.exit(1);
  }

  if (options.verbose) {
    const sizeKB = Array.isArray(sourceData)
      ? sourceData.reduce((sum, f) => sum + f.length, 0) / 1024
      : sourceData.length / 1024;
    console.error(`Source loaded (${Math.round(sizeKB)}KB total)`);
    console.error(`Runtime: ${options.runtime}`);
    console.error(`Backend: ${options.backend}`);
    console.error(`FPS: ${options.fps}, Max frames: ${options.maxFrames}`);
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

      // Build context with video metadata
      let contextParts: string[] = [];
      if (options.context) {
        contextParts.push(options.context);
      }
      if (videoInfo) {
        contextParts.push(`Video duration: ${videoInfo.duration.toFixed(3)} seconds. The animation MUST have this exact duration.`);
        contextParts.push(`Video resolution: ${videoInfo.width}x${videoInfo.height}`);
        contextParts.push(`Source FPS: ${videoInfo.fps}`);
      }
      // Always request looping animation for demos
      if (options.demo) {
        contextParts.push('Generate a LOOPING animation (animation-iteration-count: infinite or equivalent).');
      }

      const recreateOptions: RecreateOptions = {
        source: sourceData,
        runtime: options.runtime,
        backend: options.backend,
        apiKey: options.apiKey,
        context: contextParts.length > 0 ? contextParts.join('\n') : undefined,
        style: options.style,
        typescript: options.typescript,
        frameOptions: {
          fps: options.fps,
          maxFrames: options.maxFrames,
        },
      };

      const result = await recreate(recreateOptions);

      let output: string;

      if (options.demo) {
        // Generate standalone HTML demo with before/after comparison
        output = generateDemo({
          code: result.code.code,
          html: result.code.html,
          javascript: result.code.javascript,
          runtime: options.runtime,
          analysis: result.analysis,
          sourceVideo: originalVideoDataUrl,
          isInteractive: result.code.isInteractive,
        });
      } else {
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
      }

      writeOutput(output, options.output);

      if (options.verbose) {
        const { meta, analysis } = result;
        console.error('\n--- Stats ---');
        console.error(`Total time:        ${meta.processingTime}ms`);
        console.error(`  Frame extraction: ${meta.timing.frameExtraction}ms`);
        console.error(`  AI analysis:      ${meta.timing.analysis}ms`);
        console.error(`  Code generation:  ${meta.timing.codeGeneration}ms`);
        console.error(`Frames analyzed:   ${meta.framesAnalyzed}`);
        console.error(`Backend:           ${meta.backend}`);
        console.error(`Model:             ${meta.model}`);
        if (meta.sourceInfo) {
          const sizeKB = (meta.sourceInfo.sizeBytes / 1024).toFixed(1);
          console.error(`Frame size:        ~${sizeKB}KB (${meta.sourceInfo.mimeType})`);
        }
        if (result.code.isInteractive) {
          console.error(`Interactive:       Yes`);
          if (analysis.uiElements) {
            console.error(`UI elements:       ${analysis.uiElements.length} detected`);
          }
          if (analysis.interactions) {
            console.error(`Interactions:      ${analysis.interactions.length} detected`);
          }
        }
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
