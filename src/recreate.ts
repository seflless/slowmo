/**
 * slowmo/recreate - Animation Recreation Skill
 *
 * This module provides AI-powered analysis and recreation of animations.
 * Feed it a video, GIF, or screenshots of an animation, and it will
 * generate code to recreate it in your preferred animation runtime.
 *
 * ## Supported AI Backends:
 * - Google Gemini (recommended for video understanding)
 * - OpenAI GPT-4 Vision
 * - Anthropic Claude
 *
 * ## Supported Output Runtimes:
 * - CSS Animations/Keyframes
 * - Framer Motion (React)
 * - GSAP
 * - Remotion (React video)
 * - Motion One
 * - Anime.js
 * - Three.js (3D animations)
 * - Lottie (export format)
 *
 * @example
 * import { recreate } from 'slowmo/recreate';
 *
 * const code = await recreate({
 *   source: './animation.mp4',
 *   runtime: 'framer-motion',
 *   apiKey: process.env.GEMINI_API_KEY,
 * });
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Supported animation runtime targets
 */
export type AnimationRuntime =
  | 'css'
  | 'framer-motion'
  | 'gsap'
  | 'remotion'
  | 'motion-one'
  | 'anime'
  | 'three'
  | 'lottie'
  | 'react-spring'
  | 'popmotion';

/**
 * Supported AI backends for analysis
 */
export type AIBackend = 'gemini' | 'openai' | 'anthropic';

/**
 * Source input types
 */
export type SourceInput =
  | string // File path or URL
  | Blob // Browser blob
  | ArrayBuffer // Raw binary
  | File // Browser File object
  | HTMLVideoElement // Video element reference
  | HTMLCanvasElement; // Canvas with frames

/**
 * Frame extraction options
 */
export interface FrameExtractionOptions {
  /** Frames per second to extract (default: 10) */
  fps?: number;
  /** Maximum number of frames to extract (default: 30) */
  maxFrames?: number;
  /** Image format for extracted frames */
  format?: 'jpeg' | 'png' | 'webp';
  /** Quality for lossy formats (0-1, default: 0.8) */
  quality?: number;
}

/**
 * UI element detected in the animation
 */
export interface UIElement {
  /** Type of UI element */
  type: 'button' | 'card' | 'panel' | 'input' | 'modal' | 'menu' | 'icon' | 'text' | 'image' | 'container' | 'other';
  /** Role in the animation */
  role: 'trigger' | 'animated' | 'container' | 'static';
  /** Description of the element */
  description: string;
  /** CSS-like properties (background, border, etc.) */
  styles?: Record<string, string>;
  /** Text content if visible */
  text?: string;
}

/**
 * User interaction detected in the video
 */
export interface UserInteraction {
  /** Type of interaction */
  type: 'click' | 'hover' | 'scroll' | 'drag' | 'keypress' | 'focus';
  /** When in the video (normalized 0-1) */
  timestamp: number;
  /** What element was interacted with */
  target: string;
  /** Description of what happened */
  description: string;
}

/**
 * Animation analysis result from AI
 */
export interface AnimationAnalysis {
  /** Human-readable description of the animation */
  description: string;
  /** Duration estimate in seconds */
  duration: number;
  /** Detected easing function */
  easing: string;
  /** List of animated properties detected */
  properties: AnimatedProperty[];
  /** Keyframes with timing */
  keyframes: Keyframe[];
  /** Color palette detected */
  colors: string[];
  /** Overall animation style/category */
  style: AnimationStyle;
  /** Confidence score (0-1) */
  confidence: number;
  /** UI elements detected in the recording */
  uiElements?: UIElement[];
  /** User interactions visible in the recording */
  interactions?: UserInteraction[];
  /** Whether this is an interactive component (vs pure animation) */
  isInteractive?: boolean;
  /** Raw AI response for debugging */
  rawResponse?: string;
}

export interface AnimatedProperty {
  name: string;
  startValue: string | number;
  endValue: string | number;
  unit?: string;
}

export interface Keyframe {
  offset: number; // 0-1
  properties: Record<string, string | number>;
  easing?: string;
}

export type AnimationStyle =
  | 'entrance'
  | 'exit'
  | 'attention'
  | 'background'
  | 'loading'
  | 'transition'
  | 'hover'
  | 'scroll'
  | 'parallax'
  | 'morphing'
  | 'particle'
  | 'physics'
  | 'custom';

/**
 * Code generation result
 */
export interface GeneratedCode {
  /** The generated animation code (CSS for interactive, full code otherwise) */
  code: string;
  /** HTML structure (for interactive components) */
  html?: string;
  /** JavaScript for interactivity */
  javascript?: string;
  /** Runtime this code targets */
  runtime: AnimationRuntime;
  /** Language of the code */
  language: 'typescript' | 'javascript' | 'css' | 'json';
  /** Required dependencies */
  dependencies: string[];
  /** Usage example */
  usage: string;
  /** Additional notes or warnings */
  notes?: string[];
  /** Whether this is an interactive component */
  isInteractive?: boolean;
}

/**
 * Main recreation options
 */
export interface RecreateOptions {
  /** Video, GIF, image(s), or URL to analyze */
  source: SourceInput | SourceInput[];
  /** Target animation runtime */
  runtime: AnimationRuntime;
  /** AI backend to use (default: 'gemini') */
  backend?: AIBackend;
  /** API key for the AI service */
  apiKey: string;
  /** Custom API endpoint (for proxies or self-hosted) */
  apiEndpoint?: string;
  /** Frame extraction options */
  frameOptions?: FrameExtractionOptions;
  /** Additional context about the animation */
  context?: string;
  /** Preferred coding style */
  style?: 'minimal' | 'detailed' | 'production';
  /** Include TypeScript types */
  typescript?: boolean;
  /** Custom system prompt addition */
  customPrompt?: string;
}

/**
 * Complete recreation result
 */
export interface RecreateResult {
  /** Analysis of the input animation */
  analysis: AnimationAnalysis;
  /** Generated code for the target runtime */
  code: GeneratedCode;
  /** Frames extracted for analysis */
  frames?: string[]; // base64 data URLs
  /** Processing metadata */
  meta: {
    processingTime: number;
    framesAnalyzed: number;
    backend: AIBackend;
    model: string;
    timing: {
      frameExtraction: number;
      analysis: number;
      codeGeneration: number;
    };
    sourceInfo?: {
      sizeBytes: number;
      mimeType?: string;
    };
  };
}

// ============================================================================
// Runtime Presets - Baked-in opinions for each animation library
// ============================================================================

interface RuntimePreset {
  name: string;
  description: string;
  language: 'typescript' | 'javascript' | 'css' | 'json';
  dependencies: string[];
  template: string;
  systemPrompt: string;
  examples: string[];
}

const RUNTIME_PRESETS: Record<AnimationRuntime, RuntimePreset> = {
  css: {
    name: 'CSS Animations',
    description: 'Native CSS @keyframes and transitions',
    language: 'css',
    dependencies: [],
    template: `@keyframes {{name}} {
  {{keyframes}}
}

.{{className}} {
  animation: {{name}} {{duration}}s {{easing}} {{iterations}};
}`,
    systemPrompt: `Generate pure CSS animations using @keyframes.
Use modern CSS features like cubic-bezier, calc(), and CSS custom properties.
Prefer transform and opacity for performance.
Include vendor prefixes only when necessary.
Use semantic class names.`,
    examples: [
      `.fade-in { animation: fadeIn 0.3s ease-out forwards; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}`,
    ],
  },

  'framer-motion': {
    name: 'Framer Motion',
    description: 'React animation library with declarative API',
    language: 'typescript',
    dependencies: ['framer-motion'],
    template: `import { motion } from 'framer-motion';

export const {{ComponentName}} = () => (
  <motion.div
    initial={{initial}}
    animate={{animate}}
    transition={{transition}}
  >
    {/* content */}
  </motion.div>
);`,
    systemPrompt: `Generate Framer Motion React components.
Use the motion component with initial, animate, and exit props.
Prefer variants for complex multi-element animations.
Use spring physics for natural motion when appropriate.
Include TypeScript types.
Use the latest Framer Motion v11+ API.`,
    examples: [
      `const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

<motion.div variants={variants} initial="hidden" animate="visible" />`,
    ],
  },

  gsap: {
    name: 'GSAP',
    description: 'Professional-grade animation library',
    language: 'javascript',
    dependencies: ['gsap'],
    template: `import gsap from 'gsap';

gsap.to('{{selector}}', {
  {{properties}},
  duration: {{duration}},
  ease: '{{easing}}',
});`,
    systemPrompt: `Generate GSAP (GreenSock) animations.
Use gsap.to(), gsap.from(), gsap.fromTo() appropriately.
Prefer timeline for sequenced animations.
Use GSAP's built-in easing functions (power2.out, elastic, etc.).
Consider ScrollTrigger for scroll-based animations.
Use modern GSAP 3.x syntax.`,
    examples: [
      `gsap.timeline()
  .from('.title', { opacity: 0, y: 50, duration: 0.8 })
  .from('.subtitle', { opacity: 0, y: 30, duration: 0.6 }, '-=0.4');`,
    ],
  },

  remotion: {
    name: 'Remotion',
    description: 'React framework for creating videos programmatically',
    language: 'typescript',
    dependencies: ['remotion', '@remotion/cli'],
    template: `import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const {{ComponentName}}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  {{interpolations}}

  return (
    <div style={{{{styles}}}}>
      {/* content */}
    </div>
  );
};`,
    systemPrompt: `Generate Remotion video compositions.
Use useCurrentFrame() and interpolate() for frame-based animations.
Structure as reusable Composition components.
Include proper TypeScript types.
Use spring() for natural motion.
Consider sequence() for chaining animations.
Target 30fps unless specified otherwise.
Output video-friendly animations (avoid blur, use solid colors).`,
    examples: [
      `const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateRight: 'clamp',
});
const scale = spring({ frame, fps, config: { damping: 10 } });`,
    ],
  },

  'motion-one': {
    name: 'Motion One',
    description: 'Lightweight, performant animation library',
    language: 'typescript',
    dependencies: ['motion'],
    template: `import { animate, stagger } from 'motion';

animate('{{selector}}', {
  {{properties}}
}, {
  duration: {{duration}},
  easing: '{{easing}}',
});`,
    systemPrompt: `Generate Motion One animations.
Use animate() for single element animations.
Use stagger() for sequential element animations.
Use timeline() for complex sequences.
Prefer WAAPI-compatible easing strings.
Keep it minimal - Motion One is about simplicity.`,
    examples: [
      `animate('.card',
  { opacity: [0, 1], y: [20, 0] },
  { duration: 0.5, easing: 'ease-out' }
);`,
    ],
  },

  anime: {
    name: 'Anime.js',
    description: 'Lightweight JavaScript animation library',
    language: 'javascript',
    dependencies: ['animejs'],
    template: `import anime from 'animejs';

anime({
  targets: '{{selector}}',
  {{properties}},
  duration: {{duration}},
  easing: '{{easing}}',
});`,
    systemPrompt: `Generate Anime.js animations.
Use the targets property for element selection.
Leverage built-in easing functions (easeOutExpo, easeInOutQuad, etc.).
Use timeline for sequenced animations.
Consider staggering for multiple elements.
Use anime.js v3 syntax.`,
    examples: [
      `anime({
  targets: '.box',
  translateX: 250,
  rotate: '1turn',
  duration: 800,
  easing: 'easeInOutQuad',
});`,
    ],
  },

  three: {
    name: 'Three.js',
    description: '3D graphics and animation library',
    language: 'typescript',
    dependencies: ['three', '@types/three'],
    template: `import * as THREE from 'three';

function animate() {
  requestAnimationFrame(animate);
  {{animationLogic}}
  renderer.render(scene, camera);
}`,
    systemPrompt: `Generate Three.js 3D animations.
Use proper scene, camera, renderer setup.
Animate using requestAnimationFrame loop.
Consider using THREE.Clock for time-based animations.
Use TWEEN or GSAP for complex easing.
Include proper cleanup and dispose methods.
Add TypeScript types.`,
    examples: [
      `const clock = new THREE.Clock();
function animate() {
  const delta = clock.getDelta();
  mesh.rotation.y += delta * 0.5;
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}`,
    ],
  },

  lottie: {
    name: 'Lottie',
    description: 'JSON-based animation format from After Effects',
    language: 'json',
    dependencies: ['lottie-web'],
    template: `{
  "v": "5.7.4",
  "fr": {{fps}},
  "ip": 0,
  "op": {{totalFrames}},
  "w": {{width}},
  "h": {{height}},
  "layers": [{{layers}}]
}`,
    systemPrompt: `Generate Lottie JSON animations.
Follow the Bodymovin/Lottie JSON spec.
Use shape layers for vector graphics.
Keep file size minimal - optimize keyframes.
Use expressions sparingly.
Target lottie-web compatibility.
Include proper timing in frames (not seconds).`,
    examples: [
      `{
  "ty": "tr",
  "p": { "a": 1, "k": [{ "t": 0, "s": [0, 0] }, { "t": 30, "s": [100, 0] }] }
}`,
    ],
  },

  'react-spring': {
    name: 'React Spring',
    description: 'Spring-physics based React animation library',
    language: 'typescript',
    dependencies: ['@react-spring/web'],
    template: `import { useSpring, animated } from '@react-spring/web';

export const {{ComponentName}} = () => {
  const springs = useSpring({
    from: {{from}},
    to: {{to}},
    config: {{config}},
  });

  return <animated.div style={springs}>{/* content */}</animated.div>;
};`,
    systemPrompt: `Generate React Spring animations.
Use useSpring for single animations.
Use useSprings for lists.
Use useTrail for staggered animations.
Configure spring physics (mass, tension, friction).
Use the latest @react-spring/web API.
Include TypeScript types.`,
    examples: [
      `const springs = useSpring({
  from: { opacity: 0, transform: 'translateY(20px)' },
  to: { opacity: 1, transform: 'translateY(0px)' },
  config: { tension: 200, friction: 20 },
});`,
    ],
  },

  popmotion: {
    name: 'Popmotion',
    description: 'Functional animation library',
    language: 'typescript',
    dependencies: ['popmotion'],
    template: `import { animate } from 'popmotion';

animate({
  from: {{from}},
  to: {{to}},
  duration: {{duration}},
  onUpdate: (v) => {{updateLogic}},
});`,
    systemPrompt: `Generate Popmotion animations.
Use animate() for tweening values.
Use spring() for spring physics.
Use decay() for momentum-based animations.
Keep it functional and composable.
Include TypeScript types.`,
    examples: [
      `animate({
  from: 0,
  to: 100,
  duration: 500,
  onUpdate: (v) => element.style.transform = \`translateX(\${v}px)\`,
});`,
    ],
  },
};

// ============================================================================
// AI Backend Implementations
// ============================================================================

interface AIRequest {
  images: string[]; // base64 encoded
  prompt: string;
  apiKey: string;
  endpoint?: string;
}

interface AIResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Call Gemini API for video/image analysis
 */
async function callGemini(request: AIRequest): Promise<AIResponse> {
  const endpoint =
    request.endpoint ||
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Add images/video frames
  for (const image of request.images) {
    // Extract mimeType and base64 data from data URL
    const dataUrlMatch = image.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      const [, mimeType, base64Data] = dataUrlMatch;
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    } else {
      // Assume raw base64 image data
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: image,
        },
      });
    }
  }

  // Add text prompt
  parts.push({ text: request.prompt });

  const response = await fetch(`${endpoint}?key=${request.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    content,
    model: 'gemini-2.0-flash',
    usage: data.usageMetadata
      ? {
          inputTokens: data.usageMetadata.promptTokenCount,
          outputTokens: data.usageMetadata.candidatesTokenCount,
        }
      : undefined,
  };
}

/**
 * Call OpenAI API for image analysis
 */
async function callOpenAI(request: AIRequest): Promise<AIResponse> {
  const endpoint = request.endpoint || 'https://api.openai.com/v1/chat/completions';

  const imageContent = request.images.map((img) => ({
    type: 'image_url' as const,
    image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` },
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [...imageContent, { type: 'text', text: request.prompt }],
        },
      ],
      max_tokens: 4096,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || '',
    model: 'gpt-4o',
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

/**
 * Call Anthropic API for image analysis
 */
async function callAnthropic(request: AIRequest): Promise<AIResponse> {
  const endpoint = request.endpoint || 'https://api.anthropic.com/v1/messages';

  const imageContent = request.images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const,
      data: img.replace(/^data:image\/\w+;base64,/, ''),
    },
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': request.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [...imageContent, { type: 'text', text: request.prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    content: data.content[0]?.text || '',
    model: 'claude-sonnet-4-20250514',
    usage: data.usage
      ? {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        }
      : undefined,
  };
}

const AI_BACKENDS: Record<AIBackend, (req: AIRequest) => Promise<AIResponse>> = {
  gemini: callGemini,
  openai: callOpenAI,
  anthropic: callAnthropic,
};

// ============================================================================
// Frame Extraction
// ============================================================================

/**
 * Extract frames from a video element
 */
async function extractFramesFromVideo(
  video: HTMLVideoElement,
  options: FrameExtractionOptions = {}
): Promise<string[]> {
  const { fps = 10, maxFrames = 30, format = 'jpeg', quality = 0.8 } = options;

  const frames: string[] = [];
  const duration = video.duration;
  const frameInterval = 1 / fps;
  const totalFrames = Math.min(Math.floor(duration * fps), maxFrames);

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;

  for (let i = 0; i < totalFrames; i++) {
    video.currentTime = i * frameInterval;
    await new Promise((resolve) => {
      video.onseeked = resolve;
    });
    ctx.drawImage(video, 0, 0);
    frames.push(canvas.toDataURL(`image/${format}`, quality));
  }

  return frames;
}

/**
 * Extract frames from a video file/URL in Node.js environment
 * This is a placeholder - actual implementation would use ffmpeg or similar
 */
async function extractFramesFromFile(
  source: string,
  _options: FrameExtractionOptions = {}
): Promise<string[]> {
  // In a full implementation, this would use:
  // - ffmpeg for video processing
  // - sharp or jimp for image manipulation
  // For now, return a helpful error
  throw new Error(
    `Video file extraction not implemented in browser. ` +
      `Use a video element or pre-extract frames. Source: ${source}`
  );
}

/**
 * Load source and extract frames for analysis
 */
async function prepareFrames(
  source: SourceInput | SourceInput[],
  options: FrameExtractionOptions = {}
): Promise<string[]> {
  const sources = Array.isArray(source) ? source : [source];
  const allFrames: string[] = [];

  for (const src of sources) {
    if (typeof src === 'string') {
      // URL or file path
      if (src.startsWith('data:')) {
        // Already a data URL
        allFrames.push(src);
      } else if (src.match(/\.(mp4|webm|mov|avi)$/i)) {
        // Video file - try to load in browser
        if (typeof document !== 'undefined') {
          const video = document.createElement('video');
          video.src = src;
          video.muted = true;
          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
          });
          const frames = await extractFramesFromVideo(video, options);
          allFrames.push(...frames);
        } else {
          const frames = await extractFramesFromFile(src, options);
          allFrames.push(...frames);
        }
      } else if (src.match(/\.(gif)$/i)) {
        // GIF - would need gif parsing library
        // For now, treat as single image
        allFrames.push(src);
      } else {
        // Assume it's an image URL
        allFrames.push(src);
      }
    } else if (src instanceof Blob || src instanceof File) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(src);
      });
      allFrames.push(dataUrl);
    } else if (src instanceof HTMLVideoElement) {
      const frames = await extractFramesFromVideo(src, options);
      allFrames.push(...frames);
    } else if (src instanceof HTMLCanvasElement) {
      allFrames.push(src.toDataURL('image/jpeg', options.quality || 0.8));
    } else if (src instanceof ArrayBuffer) {
      const blob = new Blob([src]);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      allFrames.push(dataUrl);
    }
  }

  return allFrames;
}

// ============================================================================
// Prompt Generation
// ============================================================================

function buildAnalysisPrompt(runtime: AnimationRuntime, context?: string): string {
  const preset = RUNTIME_PRESETS[runtime];

  return `You are an expert animation analyst, UI/UX designer, and ${preset.name} developer.

Analyze the provided frames from a screen recording and reverse-engineer BOTH the animation AND the UI context it exists within.

## Your Task:
1. **UI Context Analysis**: Identify ALL visible UI elements (buttons, cards, panels, inputs, etc.)
2. **Interaction Detection**: Look for user interactions - mouse cursor, clicks, hovers, typing
3. **Animation Analysis**: What animates, how, and what triggers it
4. **Visual Design**: Colors, spacing, border radius, shadows, typography

## CRITICAL: This may be a SCREEN RECORDING of an interactive UI, not just an isolated animation.
- Look for buttons, cards, panels, modals, menus
- Look for mouse cursor movements and clicks
- Determine if animation is triggered by user action
- If you see a UI with interaction, set isInteractive: true

## Output Format:
Respond with a JSON object:
\`\`\`json
{
  "description": "What the animation/interaction does",
  "duration": 0.5,
  "easing": "ease-out",
  "properties": [
    { "name": "opacity", "startValue": 0, "endValue": 1 },
    { "name": "translateY", "startValue": 20, "endValue": 0, "unit": "px" }
  ],
  "keyframes": [
    { "offset": 0, "properties": { "opacity": 0, "transform": "translateY(20px)" } },
    { "offset": 1, "properties": { "opacity": 1, "transform": "translateY(0)" } }
  ],
  "colors": ["#ffffff", "#000000"],
  "style": "entrance",
  "confidence": 0.85,
  "isInteractive": true,
  "uiElements": [
    {
      "type": "button",
      "role": "trigger",
      "description": "Cyan button that triggers the animation",
      "text": "Show",
      "styles": { "background": "#22d3ee", "borderRadius": "8px", "padding": "8px 16px" }
    },
    {
      "type": "card",
      "role": "container",
      "description": "Dark card containing the content",
      "styles": { "background": "#171717", "borderRadius": "12px", "border": "1px solid #262626" }
    },
    {
      "type": "panel",
      "role": "animated",
      "description": "Content panel that shows/hides",
      "styles": { "background": "#1a1a1a" }
    }
  ],
  "interactions": [
    {
      "type": "click",
      "timestamp": 0.2,
      "target": "button",
      "description": "User clicks the Show button to reveal content"
    }
  ]
}
\`\`\`

${context ? `## Additional Context:\n${context}\n` : ''}

## Important:
- If you see a button/trigger, include it in uiElements with role: "trigger"
- If you see mouse cursor/click, record it in interactions
- Match colors EXACTLY from the recording (use color picker precision)
- Include ALL visible UI elements, even static ones
- Be precise with timing and values`;
}

function buildCodeGenerationPrompt(
  analysis: AnimationAnalysis,
  runtime: AnimationRuntime,
  options: {
    style?: 'minimal' | 'detailed' | 'production';
    typescript?: boolean;
    customPrompt?: string;
  } = {}
): string {
  const preset = RUNTIME_PRESETS[runtime];
  const { style = 'production', typescript = true, customPrompt } = options;
  const isInteractive = analysis.isInteractive || (analysis.uiElements && analysis.uiElements.length > 0);

  // For interactive UI components, generate full HTML/CSS/JS
  if (isInteractive && runtime === 'css') {
    return `You are an expert frontend developer. Recreate this INTERACTIVE UI COMPONENT with its animation.

## Analysis (includes UI elements and interactions):
${JSON.stringify(analysis, null, 2)}

## CRITICAL REQUIREMENTS:
1. Generate COMPLETE HTML + CSS + JavaScript as SEPARATE fields
2. Include ALL UI elements from the analysis (buttons, cards, panels, etc.)
3. Make the component INTERACTIVE - respond to clicks/hovers as shown
4. Match the visual design EXACTLY (colors, spacing, border radius, shadows)
5. The animation should trigger on user interaction (not auto-play)

## Code Style: ${style}

## IMPORTANT OUTPUT FORMAT:
You MUST respond with a JSON object containing THREE separate fields:
- "code": CSS styles only (no <style> tags)
- "html": HTML snippet only (no <!DOCTYPE>, no <html>, no <head>, no <body> tags - just the component markup)
- "javascript": JavaScript code only (no <script> tags)

DO NOT return a full HTML document. Return ONLY this JSON structure:

\`\`\`json
{
  "code": ".container { background: #000; padding: 20px; }\\n.panel { ... }\\n.button { ... }\\n@keyframes slideIn { ... }",
  "html": "<div class=\\"container\\">\\n  <div class=\\"panel\\"></div>\\n  <button class=\\"button\\">Show</button>\\n</div>",
  "javascript": "const btn = document.querySelector('.button');\\nconst panel = document.querySelector('.panel');\\nbtn.addEventListener('click', () => { panel.classList.toggle('visible'); });",
  "usage": "Add the HTML to your page, include the CSS, and run the JavaScript",
  "notes": ["Click the button to toggle the panel visibility"]
}
\`\`\`

## Design Requirements:
- Match all colors from analysis.colors exactly
- Include proper hover states for interactive elements
- Use smooth transitions (not just keyframes) where appropriate
- Make buttons look clickable with cursor: pointer
- Add focus states for accessibility

REMEMBER: Return JSON with separate code/html/javascript fields. NOT a full HTML document.`;
  }

  // Standard animation-only prompt
  return `You are an expert ${preset.name} developer. Generate code to recreate this animation.

## Animation Analysis:
${JSON.stringify(analysis, null, 2)}

## Target: ${preset.name}
${preset.systemPrompt}

## Code Style: ${style}
${style === 'minimal' ? 'Keep the code as short as possible, only essentials.' : ''}
${style === 'detailed' ? 'Include comments explaining each part.' : ''}
${style === 'production' ? 'Production-ready code with proper error handling and types.' : ''}

## TypeScript: ${typescript ? 'Yes, include proper types' : 'No, plain JavaScript'}

## Example ${preset.name} code:
${preset.examples[0]}

${customPrompt ? `## Custom Instructions:\n${customPrompt}\n` : ''}

## Output Format:
Respond with a JSON object:
\`\`\`json
{
  "code": "// Your complete code here",
  "usage": "// Example usage of the animation",
  "notes": ["Any important notes or caveats"]
}
\`\`\`

Generate clean, idiomatic ${preset.name} code that accurately recreates the analyzed animation.`;
}

// ============================================================================
// Main Recreation Function
// ============================================================================

/**
 * Recreate an animation from video/images using AI analysis.
 *
 * @example
 * const result = await recreate({
 *   source: './my-animation.mp4',
 *   runtime: 'framer-motion',
 *   apiKey: process.env.GEMINI_API_KEY,
 * });
 *
 * console.log(result.code.code);
 */
export async function recreate(options: RecreateOptions): Promise<RecreateResult> {
  const {
    source,
    runtime,
    backend = 'gemini',
    apiKey,
    apiEndpoint,
    frameOptions,
    context,
    style = 'production',
    typescript = true,
    customPrompt,
  } = options;

  const startTime = Date.now();
  const timing = { frameExtraction: 0, analysis: 0, codeGeneration: 0 };
  const preset = RUNTIME_PRESETS[runtime];
  const aiCall = AI_BACKENDS[backend];

  if (!aiCall) {
    throw new Error(`Unknown AI backend: ${backend}`);
  }

  if (!preset) {
    throw new Error(`Unknown runtime: ${runtime}`);
  }

  // Step 1: Extract frames from source
  const frameStartTime = Date.now();
  const frames = await prepareFrames(source, frameOptions);
  timing.frameExtraction = Date.now() - frameStartTime;

  if (frames.length === 0) {
    throw new Error('No frames could be extracted from the source');
  }

  // Step 2: Analyze animation with AI
  const analysisStartTime = Date.now();
  const analysisPrompt = buildAnalysisPrompt(runtime, context);
  const analysisResponse = await aiCall({
    images: frames,
    prompt: analysisPrompt,
    apiKey,
    endpoint: apiEndpoint,
  });

  // Parse analysis JSON from response
  let analysis: AnimationAnalysis;
  try {
    const jsonMatch = analysisResponse.content.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : analysisResponse.content;
    analysis = JSON.parse(jsonStr);
    analysis.rawResponse = analysisResponse.content;
  } catch (e) {
    throw new Error(`Failed to parse animation analysis: ${e}`);
  }
  timing.analysis = Date.now() - analysisStartTime;

  // Step 3: Generate code for target runtime
  const codeGenStartTime = Date.now();
  const codePrompt = buildCodeGenerationPrompt(analysis, runtime, {
    style,
    typescript,
    customPrompt,
  });
  const codeResponse = await aiCall({
    images: frames.slice(0, 3), // Send fewer frames for code gen
    prompt: codePrompt,
    apiKey,
    endpoint: apiEndpoint,
  });

  // Parse code JSON from response
  let codeResult: { code: string; html?: string; javascript?: string; usage: string; notes?: string[] };
  try {
    const jsonMatch = codeResponse.content.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : codeResponse.content;
    codeResult = JSON.parse(jsonStr);
  } catch (e) {
    // If JSON parsing fails, try to extract from various formats
    const content = codeResponse.content;

    // Check if it's a full HTML document
    if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
      // Extract CSS from <style> tags
      const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const css = styleMatch ? styleMatch[1].trim() : '';

      // Extract HTML from <body> tags (just the inner content)
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      let html = '';
      if (bodyMatch) {
        // Remove script tags from body content
        html = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').trim();
      }

      // Extract JavaScript from <script> tags
      const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
      const js = scriptMatch ? scriptMatch[1].trim() : '';

      codeResult = {
        code: css,
        html: html || undefined,
        javascript: js || undefined,
        usage: 'Extracted from full HTML document',
        notes: ['AI returned full HTML document - extracted CSS, HTML body, and JavaScript'],
      };
    } else {
      // Try to extract code block directly
      const codeMatch = content.match(/```(?:tsx?|jsx?|css|html)?\n?([\s\S]*?)\n?```/);
      codeResult = {
        code: codeMatch ? codeMatch[1] : content,
        usage: 'See code above',
        notes: ['Code extraction was not in expected format'],
      };
    }
  }

  timing.codeGeneration = Date.now() - codeGenStartTime;

  const isInteractive = analysis.isInteractive || (analysis.uiElements && analysis.uiElements.length > 0);

  const generatedCode: GeneratedCode = {
    code: codeResult.code,
    html: codeResult.html,
    javascript: codeResult.javascript,
    runtime,
    language: preset.language,
    dependencies: preset.dependencies,
    usage: codeResult.usage,
    notes: codeResult.notes,
    isInteractive,
  };

  // Calculate source info from first frame if available
  let sourceInfo: { sizeBytes: number; mimeType?: string } | undefined;
  if (frames.length > 0 && typeof frames[0] === 'string') {
    const firstFrame = frames[0];
    const mimeMatch = firstFrame.match(/^data:([^;]+);base64,/);
    if (mimeMatch) {
      const base64Data = firstFrame.replace(/^data:[^;]+;base64,/, '');
      sourceInfo = {
        sizeBytes: Math.round((base64Data.length * 3) / 4), // Approximate decoded size
        mimeType: mimeMatch[1],
      };
    }
  }

  return {
    analysis,
    code: generatedCode,
    frames,
    meta: {
      processingTime: Date.now() - startTime,
      framesAnalyzed: frames.length,
      backend,
      model: analysisResponse.model,
      timing,
      sourceInfo,
    },
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick recreation with minimal options
 */
export async function quickRecreate(
  source: SourceInput | SourceInput[],
  runtime: AnimationRuntime,
  apiKey: string
): Promise<string> {
  const result = await recreate({ source, runtime, apiKey });
  return result.code.code;
}

/**
 * Analyze animation without generating code
 */
export async function analyze(
  source: SourceInput | SourceInput[],
  apiKey: string,
  backend: AIBackend = 'gemini'
): Promise<AnimationAnalysis> {
  const frames = await prepareFrames(source);
  const aiCall = AI_BACKENDS[backend];

  const prompt = `Analyze this animation and describe:
1. What elements are being animated
2. The animation properties (transform, opacity, etc.)
3. Timing and easing
4. Keyframes with exact values

Respond with JSON:
\`\`\`json
{
  "description": "...",
  "duration": 0.5,
  "easing": "ease-out",
  "properties": [...],
  "keyframes": [...],
  "colors": [...],
  "style": "entrance",
  "confidence": 0.85
}
\`\`\``;

  const response = await aiCall({ images: frames, prompt, apiKey });

  const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : response.content;
  return JSON.parse(jsonStr);
}

/**
 * Get available runtime presets
 */
export function getRuntimes(): Array<{ id: AnimationRuntime; name: string; description: string }> {
  return Object.entries(RUNTIME_PRESETS).map(([id, preset]) => ({
    id: id as AnimationRuntime,
    name: preset.name,
    description: preset.description,
  }));
}

/**
 * Get details about a specific runtime
 */
export function getRuntimeInfo(runtime: AnimationRuntime): RuntimePreset | undefined {
  return RUNTIME_PRESETS[runtime];
}

// ============================================================================
// Export all types and functions
// ============================================================================

export {
  RUNTIME_PRESETS,
  AI_BACKENDS,
  extractFramesFromVideo,
  prepareFrames,
  buildAnalysisPrompt,
  buildCodeGenerationPrompt,
};

export default recreate;
