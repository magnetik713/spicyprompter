# SpicyPrompter

Bulk AI prompt generator for local and cloud image models. Supports **Realistic** and **Anime** modes — connects to any OpenAI-compatible LLM and generates structured prompts across 200+ categories, then sends them straight to ComfyUI.

**[spicyprompter.com](https://spicyprompter.com) — [Download](https://github.com/magnetik713/spicyprompter/releases/latest)**

---

## Requirements

- Windows 10/11
- [Node.js](https://nodejs.org) v18+
- A running LLM (Ollama, LM Studio, llama.cpp, or any OpenAI-compatible API)
- ComfyUI (optional — for direct queue integration)

## Installation

1. Download the latest zip from [Releases](https://github.com/magnetik713/spicyprompter/releases/latest)
2. Extract to any folder
3. Run `install.bat` — installs dependencies and creates a desktop shortcut
4. Run `start.bat` (or use the shortcut) — opens the app in your browser

## Updating

1. Download the latest zip from [Releases](https://github.com/magnetik713/spicyprompter/releases/latest)
2. Extract to any folder (fresh folder or over the existing one — both work)
3. Run `install.bat` to reinstall dependencies

Your prompts are stored in `%APPDATA%\SpicyPrompter\prompts.db`, separate from the app folder. Updates and reinstalls never touch your data.

## Setup

On first launch, go to **Settings** and configure:

- **LLM Base URL** — e.g. `http://localhost:11434/v1` for Ollama
- **LLM Model** — model name as your endpoint expects it
- **ComfyUI URL** — e.g. `http://localhost:8188` (optional)
- **License Key** — paste your key to unlock full access (leave blank for free demo)

### Anime Mode Setup

To use Anime mode, configure two additional settings:

- **Image Model Compatibility** — selects the quality tag format injected into every prompt:
  | Setting | Quality Tags | Use With |
  |---|---|---|
  | `illustrious` | `masterpiece, best quality, newest, absurdres, rating:explicit` | WAI-Illustrious SDXL, Noob Illustrious |
  | `noobai` | `masterpiece, best quality, newest, rating:explicit` | NoobAI Epsilon |
  | `pony` | `score_9, score_8_up, score_7_up, score_6_up, source_anime, rating:explicit` | Pony Diffusion v6 XL |

- **ComfyUI Workflow** — select a workflow JSON for the anime model you're running. Included workflows:
  | File | Model | Sampler | Resolution |
  |---|---|---|---|
  | `wai-illustrious-t2i.json` | WAI-Illustrious SDXL v17 | Euler a / Karras, 30+20 steps | 832×1216 → 1080×1584 |
  | `noobai-t2i.json` | NoobAI Epsilon 1.1 | DPM++ 2M / Karras, 25+15 steps | 832×1216 → 1080×1584 |

Anime mode outputs **booru-style tags** (comma-separated, underscored) with automatic photography term filtering — no realistic prose bleeds into anime prompts.

## Generation Modes

### Realistic
Natural language prompts for photographic image models (FLUX, SDXL, SD 1.5). Covers 30 ethnicities, 20 lighting conditions, 10 photographic styles, and 35 themes.

### Anime
Booru-tag output for anime models (Pony, Illustrious, NoobAI). Covers 15 character types (catgirl, elf, demon, etc.), 14 art styles (cel shading, flat color, watercolor, etc.), and 4 anime lighting presets. Gender-aware act filtering ensures correct character count tags (1girl, 2girls, 1boy 1girl, etc.).

## Free vs Full

| Feature | Free | Full ($29) |
|---|---|---|
| Generation | Up to 200 prompts total, 5 per run | Unlimited, 999 per batch |
| Race, act, body controls | ✓ | ✓ |
| Style & lighting controls | ✓ | ✓ |
| Anime character type selection | ✓ | ✓ |
| Full 200+ category access | — | ✓ |
| Scene, role, theme, view controls | — | ✓ |
| Hair, expression, skin controls | — | ✓ |
| Custom categories | — | ✓ |
| Star, sort & filter library | — | ✓ |
| LoRA Dataset Builder | ✓ | ✓ |

[Buy on Gumroad →](https://spicyprompter.gumroad.com/l/meenyg/SPICY49)

## LoRA Dataset Builder

Generate portrait prompt sets for LoRA character training. Pick subject attributes, select camera angles, and download a ZIP with numbered `.txt` prompt files, `captions.csv`, and an optional reference image slot — ready to drop into Kohya-ss, SimpleTuner, or OneTrainer.

Also available as a standalone free tool: [LoRA Dataset Builder](https://github.com/magnetik713/lora-dataset-builder)

## Works With

- **Local LLMs:** Ollama, LM Studio, llama.cpp
- **Cloud LLMs:** Venice.ai, Groq, OpenRouter, any OpenAI-compatible API
- **Realistic models:** Stable Diffusion 1.5, SDXL, FLUX — includes ready-to-use ComfyUI workflow JSONs
- **Anime models:** Pony Diffusion v6 XL, WAI-Illustrious SDXL, NoobAI Epsilon — includes workflow JSONs with hi-res pass

## Data & Privacy

Prompts are stored in `%APPDATA%\SpicyPrompter\prompts.db` — separate from the app folder so updates, reinstalls, and folder changes never affect your data. No accounts, no sync, no cloud storage.
