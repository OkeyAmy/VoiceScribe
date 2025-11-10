# VoiceScribe

VoiceScribe is a modern, web-based multilingual dictation application that lets you record audio, transcribe speech into text, polish and format your notes, generate summaries, and translate content—all in one place. It supports mixed-language recordings in English, Igbo, Yoruba, Hausa, and Nigerian Pidgin, preserving tonal patterns, diacritical marks, and regional nuances.

---

## Features

- **Voice Recording**: Single floating record button to start/stop audio capture.
- **Real-time Waveform**: Visual feedback of sound input while recording.
- **Multilingual Transcription**: Uses Google GenAI to transcribe mixed speech in English, Igbo, Yoruba, Hausa, and Nigerian Pidgin, preserving linguistic nuances.
- **Polished Notes**: Automatically removes filler words, corrects grammar, and formats text in Markdown.
- **Summaries**: One-click generation of creative flashcard-style summaries that highlight key points while retaining meaning and tone.
- **Translations**: Translate your summary flashcards into multiple languages (Spanish, French, German, Igbo, Yoruba, Hausa, Nigerian Pidgin) with Markdown formatting preserved, directly in the Summary tab.
- **Save & Manage Notes**: List, switch between, and delete notes; stored locally in browser.
- **Export & Share**: Export notes as `.md` files or share via the Web Share API (or clipboard fallback).
- **Dark/Light Theme**: Toggle between dark and light modes with a header icon.
- **Local Dialect Support**: Special prompts to handle tonal patterns in Igbo, diacritics in Yoruba, idioms in Hausa, and code-switching in Pidgin.



## Installation

### Prerequisites

- Node.js v18+ and npm (or pnpm) installed
- A Google Cloud API key with access to Gemini 2.5 models

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/OkeyAmy/VoiceScribe.git
   cd VoiceScribe
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   # or
   pnpm install --legacy-peer-deps
   ```

3. Create a `.env.local` file in the root directory with your API key:
   ```env
   GEMINI_API_KEY=your_google_genai_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click the **Record** button to begin audio capture.
2. Click **Stop** in the recording modal to end.
3. Wait for transcription and polishing to complete; view in the **Raw** and **Polished** tabs.
4. Generate a summary in the **Summary** tab.
5. Use the **Translate** button in the **Summary** tab to convert your summary into another language.
6. Export or share via the header buttons.

## Building for Production

To create an optimized production build:

```bash
npm run build
# or
pnpm build
```

To run the production build locally:

```bash
npm start
# or
pnpm start
```

## Configuration

- **GEMINI_API_KEY**: Set in `.env.local` to authenticate GenAI requests.
- **Port**: Default is `3000`; set `PORT` environment variable to change.

## Project Structure

```
/ (root)
├─ app/
│  ├─ components/
│  │  └─ VoiceNotesApp.tsx  # Main application logic
│  ├─ layout.tsx             # Root layout with metadata
│  ├─ page.tsx               # Main page component
│  └─ globals.css            # Global styles
├─ public/                   # Static assets
├─ next.config.js            # Next.js configuration
├─ tsconfig.json             # TypeScript configuration
├─ package.json              # Dependencies and scripts
├─ .env.local                # Environment variables (not committed)
└─ README.md                 # Project documentation
```

## Technologies

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI**: React 19
- **AI & NLP**: @google/genai (Gemini-2.5), marked (Markdown parser)
- **Browser APIs**: MediaRecorder, Web Share, Clipboard, LocalStorage
- **Styling**: CSS variables, Flexbox, Grid, responsive design
- **Icons & Fonts**: Font Awesome 6, Google Fonts (Inter, JetBrains Mono)

## Deployment

This Next.js application can be deployed to:

- **Vercel** (recommended): Connect your repository for automatic deployments
- **Netlify**: Deploy with the Next.js plugin
- **Self-hosted**: Use `npm run build && npm start` on any Node.js server

Make sure to set the `GEMINI_API_KEY` environment variable in your deployment platform.


## License

This project is licensed under the Apache-2.0 License.
