# SpicyPrompter

Batch AI prompt generator for image workflows. Connect any OpenAI-compatible LLM, randomize categories, generate hundreds of prompts, and pipe them straight into ComfyUI.

![version](https://img.shields.io/badge/version-1.5.1-blue)

---

## Features

- **Batch generation** — unlimited prompts per run *(paid)*; up to 250 total in demo (5 per run)
- **Category system** — acts, scenes, themes, styles, roles, body types, races — each with curated subject/tag pools
- **Random mode** — per-slot randomization across all categories; chosen value shown in log per prompt
- **ComfyUI integration** — sends each prompt directly to your ComfyUI instance via API workflow
- **LLM agnostic** — any OpenAI-compatible endpoint (Ollama, llama.cpp, LM Studio, OpenRouter, etc.)
- **License gating** — demo mode with restricted category pool; full access with license key
- **Conflict detection** — skips incompatible role/scene combinations before calling the LLM, eliminating wasted retries
- **Sampling controls** — temperature, top-p, min-p, repetition penalty, max tokens

---

## Requirements

- Windows 10/11
- Node.js 18+ (or none — installer downloads portable Node automatically)
- A running OpenAI-compatible LLM endpoint
- ComfyUI (optional, for image generation)

---

## Install

1. Download `spicyprompter-v1.4.1.zip` from [Releases](https://github.com/magnetik713/spicyprompter/releases)
2. Extract anywhere
3. Run `install.bat` — installs dependencies, prompts for port (default `3014`)
4. Browser opens to `http://localhost:3014/prompts`

After first install, use `start.bat` to launch.

---

## Setup

Go to **Settings** and configure:

### LLM Inference

| Setting | Description |
|---|---|
| Base URL | Your LLM endpoint, e.g. `http://localhost:11434/v1` |
| API Key | Leave blank for local, or paste your key |
| Default Model | Model name, e.g. `qwen3:8b` |

### Generation Parameters

| Setting | Default | Notes |
|---|---|---|
| Temperature | 1.0 | Higher = more creative |
| Top-p | off | Nucleus sampling cutoff |
| Min-p | off | Cuts tokens below fraction of top token probability. Try 0.05–0.1 with high temp |
| Repetition Penalty | 1.1 | Discourages repeated phrasing |
| Max Tokens | 300 | Per prompt |
| Raw output | off | Strips LLM preamble/postamble |

### ComfyUI

| Setting | Description |
|---|---|
| Host | ComfyUI host, e.g. `localhost` |
| Port | ComfyUI port, e.g. `8188` |
| Workflow File | Upload an API-format workflow JSON |
| Model | Checkpoint filename to inject into workflow |

---

## Generate Tab

- **Role / Body Type / Race** — filter subject pool
- **Act / Scene / Theme / Style** — set category context; pick a specific value or **Random**
- **Count** — number of prompts to generate
- **Send to ComfyUI** — queue each prompt as it completes

Random slots pick a fresh category each iteration and show the chosen value in the log:
```
[1/10] [film_grain] [cowgirl] [bedroom] oiled...
```

---

## License

Demo mode is active without a key — a curated subset of categories is available, with generation capped at 5 prompts per run (250 total). Enter a license key in Settings to unlock all categories and remove generation limits.

---

## Uninstall

Run `uninstall.bat` or delete the folder. No registry entries, no system-wide installs (if portable Node was used).
