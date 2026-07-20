# SpicyPrompter

Bulk AI prompt generator for local and cloud image models. Connects to any OpenAI-compatible endpoint and uses an LLM to build structured prompts across 175+ categories — then sends them straight to ComfyUI.

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

## Free vs Full

| Feature | Free | Full ($29) |
|---|---|---|
| Generation | Up to 200 prompts total, 5 per run | Unlimited, 999 per batch |
| Race & act controls | ✓ | ✓ |
| Full 175+ category access | — | ✓ |
| Body, scene, style, role, theme controls | — | ✓ |
| Custom categories | — | ✓ |
| Star, sort & filter library | — | ✓ |
| LoRA Dataset Builder | ✓ | ✓ |

[Buy on Gumroad →](https://spicyprompter.gumroad.com/l/meenyg/SPICY49)

## LoRA Dataset Builder

Generate portrait prompt sets for LoRA character training. Pick subject attributes, select camera angles, and download a ZIP with numbered `.txt` prompt files, `captions.csv`, and an optional reference image slot — ready to drop into Kohya-ss, SimpleTuner, or OneTrainer.

Also available as a standalone free tool: [LoRA Dataset Builder](https://github.com/magnetik713/lora-dataset-builder)

## Works With

- **Local:** Ollama, LM Studio, llama.cpp
- **Cloud:** Venice.ai, Groq, OpenRouter, any OpenAI-compatible API
- **Image models:** Stable Diffusion 1.5, SDXL, FLUX — includes ready-to-use ComfyUI workflow JSONs

## Data & Privacy

Prompts are stored in `%APPDATA%\SpicyPrompter\prompts.db` — separate from the app folder so updates, reinstalls, and folder changes never affect your data. No accounts, no sync, no cloud storage.
