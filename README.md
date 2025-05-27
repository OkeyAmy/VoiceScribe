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

- Node.js v14+ and npm installed
- A Google Cloud API key with access to Gemini 2.5 models

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/OkeyAmy/VoiceScribe.git
   cd VoiceScribe
   ```
2. Install dependencies (use `--legacy-peer-deps` if prompted):
   ```bash
   npm install --legacy-peer-deps
   ```
3. Create a `.env` file in the root directory with your API key:
   ```env
   GEMINI_API_KEY=your_google_genai_api_key
   ```
4. Start the development server:
   ```bash
   npm start
   ```
5. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. Click the **Record** button to begin audio capture.
2. Click **Stop** in the recording modal to end.
3. Wait for transcription and polishing to complete; view in the **Raw** and **Polished** tabs.
4. Generate a summary in the **Summary** tab.
5. Use the **Translate** button in the **Summary** tab to convert your summary into another language.
6. Export or share via the header buttons.

## Configuration

- **API_KEY**: Set in `.env` to authenticate GenAI requests.
- **Port**: Default is `5173`; modify in `package.json` scripts if needed.

## Project Structure

```
/ (root)
├─ index.html       # Main HTML template
├─ index.css        # Styles (Tailwind-inspired variables)
├─ index.tsx        # Main TypeScript application logic
├─ README.md        # Project documentation
└─ .env             # Environment variables (not committed)
```

## Technologies

- **Language & Framework**: TypeScript, HTML, CSS
- **AI & NLP**: @google/genai (Gemini-2.5), marked (Markdown parser)
- **Browser APIs**: MediaRecorder, Web Share, Clipboard, LocalStorage
- **Styling**: CSS variables, Flexbox, Grid, responsive design
- **Icons & Fonts**: Font Awesome 6, Google Fonts (Inter)


## License

This project is licensed under the Apache-2.0 License.
