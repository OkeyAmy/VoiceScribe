/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

// Fix: Import GenerateContentResponse for strong typing of API responses.
import {GoogleGenAI, GenerateContentResponse} from '@google/genai';
import {marked} from 'marked';

const MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

interface Note {
  id: string;
  rawTranscription: string;
  polishedNote: string;
  summary?: string;
  translations?: Record<string, string>;
  timestamp: number;
}

class VoiceNotesApp {
  // Fix: Type genAI instance with GoogleGenAI for better type safety and to align with SDK usage.
  private genAI: GoogleGenAI;
  private mediaRecorder: MediaRecorder | null = null;
  private recordButton: HTMLButtonElement;
  private recordingStatus: HTMLDivElement;
  private rawTranscription: HTMLDivElement;
  private polishedNote: HTMLDivElement;
  private newButton: HTMLButtonElement;
  private themeToggleButton: HTMLButtonElement;
  private themeToggleIcon: HTMLElement;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private currentNote: Note | null = null;
  private stream: MediaStream | null = null;
  private editorTitle: HTMLDivElement;
  private hasAttemptedPermission = false;

  private liveWaveformCanvas: HTMLCanvasElement | null;
  private liveWaveformCtx: CanvasRenderingContext2D | null = null;
  private liveRecordingTimerDisplay: HTMLDivElement;
  private liveRecordingTitle: HTMLDivElement;

  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private waveformDataArray: Uint8Array | null = null;
  private waveformDrawingId: number | null = null;
  private timerIntervalId: number | null = null;
  private recordingStartTime: number = 0;
  
  // New properties for enhanced features
  private summaryContent: HTMLDivElement;
  private translationsContent: HTMLDivElement;
  private translationResult: HTMLDivElement;
  private languageButtons: NodeListOf<HTMLButtonElement>;
  private generateSummaryBtn: HTMLButtonElement | null;
  private exportButton: HTMLButtonElement;
  private shareButton: HTMLButtonElement;
  private helpButton: HTMLButtonElement;
  private helpModal: HTMLDivElement;
  private notes: Note[] = [];
  private noteList: HTMLDivElement;
  private isProcessingSummary: boolean = false;
  private isProcessingTranslation: boolean = false;

  constructor() {
    // Fix: Initialize GoogleGenAI client according to guidelines, removing apiVersion.
    // This ensures consistent API behavior as described in the guidelines,
    // particularly that response.text should be a direct string.
    this.genAI = new GoogleGenAI({
      apiKey: process.env.API_KEY!,
    });

    this.recordButton = document.getElementById(
      'recordButton',
    ) as HTMLButtonElement;
    this.recordingStatus = document.getElementById(
      'recordingStatus',
    ) as HTMLDivElement;
    this.rawTranscription = document.getElementById(
      'rawTranscription',
    ) as HTMLDivElement;
    this.polishedNote = document.getElementById(
      'polishedNote',
    ) as HTMLDivElement;
    this.newButton = document.getElementById('newButton') as HTMLButtonElement;
    this.themeToggleButton = document.getElementById(
      'themeToggleButton',
    ) as HTMLButtonElement;
    this.themeToggleIcon = this.themeToggleButton.querySelector(
      'i',
    ) as HTMLElement;
    this.editorTitle = document.querySelector(
      '.editor-title',
    ) as HTMLDivElement;

    this.liveWaveformCanvas = document.getElementById(
      'liveWaveformCanvas',
    ) as HTMLCanvasElement;
    this.liveRecordingTimerDisplay = document.getElementById(
      'liveRecordingTimerDisplay',
    ) as HTMLDivElement;
    this.liveRecordingTitle = document.getElementById(
      'liveRecordingTitle',
    ) as HTMLDivElement;

    // Get new DOM elements
    this.summaryContent = document.getElementById('summaryContent') as HTMLDivElement;
    this.translationsContent = document.getElementById('translationsContent') as HTMLDivElement;
    this.translationResult = document.getElementById('translationResult') as HTMLDivElement;
    this.languageButtons = document.querySelectorAll('.language-button') as NodeListOf<HTMLButtonElement>;
    this.generateSummaryBtn = document.getElementById('generateSummaryBtn') as HTMLButtonElement;
    this.exportButton = document.getElementById('exportButton') as HTMLButtonElement;
    this.shareButton = document.getElementById('shareButton') as HTMLButtonElement;
    this.helpButton = document.getElementById('helpButton') as HTMLButtonElement;
    this.helpModal = document.getElementById('helpModal') as HTMLDivElement;
    this.noteList = document.querySelector('.note-list') as HTMLDivElement;

    if (this.liveWaveformCanvas) {
      this.liveWaveformCtx = this.liveWaveformCanvas.getContext('2d');
    } else {
      console.warn(
        'Live waveform canvas element not found. Visualizer will not work.',
      );
    }

    this.bindEventListeners();
    this.initTheme();
    this.createNewNote();

    // Load saved notes from localStorage
    this.loadNotes();

    this.recordingStatus.textContent = 'Ready to record';
  }

  private bindEventListeners(): void {
    this.recordButton.addEventListener('click', () => this.toggleRecording());
    this.newButton.addEventListener('click', () => this.createNewNote());
    this.themeToggleButton.addEventListener('click', () => this.toggleTheme());
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Initialize stop record button in recording modal
    const stopRecordButton = document.getElementById('stopRecordButton');
    if (stopRecordButton) {
      stopRecordButton.addEventListener('click', () => {
        if (this.isRecording) {
          this.stopRecording();
        }
      });
    }
    
    // Feature listeners
    if (this.generateSummaryBtn) {
      this.generateSummaryBtn.addEventListener('click', () => this.generateSummary());
    }
    
    this.languageButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const lang = (e.currentTarget as HTMLButtonElement).getAttribute('data-lang');
        if (lang) this.translateNote(lang);
      });
    });
    
    this.exportButton.addEventListener('click', () => this.exportNote());
    this.shareButton.addEventListener('click', () => this.shareNote());
    
    // Help modal listeners are handled in the HTML
  }

  private handleResize(): void {
    if (
      this.isRecording &&
      this.liveWaveformCanvas &&
      this.liveWaveformCanvas.style.display === 'block'
    ) {
      requestAnimationFrame(() => {
        this.setupCanvasDimensions();
      });
    }
  }

  private setupCanvasDimensions(): void {
    if (!this.liveWaveformCanvas || !this.liveWaveformCtx) return;

    const canvas = this.liveWaveformCanvas;
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    this.liveWaveformCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      this.themeToggleIcon.classList.remove('fa-sun');
      this.themeToggleIcon.classList.add('fa-moon');
    } else {
      document.body.classList.remove('light-mode');
      this.themeToggleIcon.classList.remove('fa-moon');
      this.themeToggleIcon.classList.add('fa-sun');
    }
  }

  private toggleTheme(): void {
    document.body.classList.toggle('light-mode');
    if (document.body.classList.contains('light-mode')) {
      localStorage.setItem('theme', 'light');
      this.themeToggleIcon.classList.remove('fa-sun');
      this.themeToggleIcon.classList.add('fa-moon');
    } else {
      localStorage.setItem('theme', 'dark');
      this.themeToggleIcon.classList.remove('fa-moon');
      this.themeToggleIcon.classList.add('fa-sun');
    }
  }

  private toggleRecording(): void {
    if (!this.isRecording) {
      this.startRecording();
    } else {
      this.stopRecording();
    }
  }

  private setupAudioVisualizer(): void {
    if (!this.stream || this.audioContext) return;

    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyserNode = this.audioContext.createAnalyser();

    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.75;

    const bufferLength = this.analyserNode.frequencyBinCount;
    this.waveformDataArray = new Uint8Array(bufferLength);

    source.connect(this.analyserNode);
  }

  private drawLiveWaveform(): void {
    if (
      !this.analyserNode ||
      !this.waveformDataArray ||
      !this.liveWaveformCtx ||
      !this.liveWaveformCanvas ||
      !this.isRecording
    ) {
      if (this.waveformDrawingId) cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
      return;
    }

    this.waveformDrawingId = requestAnimationFrame(() =>
      this.drawLiveWaveform(),
    );
    this.analyserNode.getByteFrequencyData(this.waveformDataArray);

    const ctx = this.liveWaveformCtx;
    const canvas = this.liveWaveformCanvas;

    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;

    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    const bufferLength = this.analyserNode.frequencyBinCount;
    const numBars = Math.floor(bufferLength * 0.5);

    if (numBars === 0) return;

    const totalBarPlusSpacingWidth = logicalWidth / numBars;
    const barWidth = Math.max(1, Math.floor(totalBarPlusSpacingWidth * 0.7));
    const barSpacing = Math.max(0, Math.floor(totalBarPlusSpacingWidth * 0.3));

    let x = 0;

    const recordingColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-recording')
        .trim() || '#ff3b30';
    ctx.fillStyle = recordingColor;

    for (let i = 0; i < numBars; i++) {
      if (x >= logicalWidth) break;

      const dataIndex = Math.floor(i * (bufferLength / numBars));
      const barHeightNormalized = this.waveformDataArray[dataIndex] / 255.0;
      let barHeight = barHeightNormalized * logicalHeight;

      if (barHeight < 1 && barHeight > 0) barHeight = 1;
      barHeight = Math.round(barHeight);

      const y = Math.round((logicalHeight - barHeight) / 2);

      ctx.fillRect(Math.floor(x), y, barWidth, barHeight);
      x += barWidth + barSpacing;
    }
  }

  private updateLiveTimer(): void {
    if (!this.isRecording || !this.liveRecordingTimerDisplay) return;
    const now = Date.now();
    const elapsedMs = now - this.recordingStartTime;

    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((elapsedMs % 1000) / 10);

    this.liveRecordingTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  }

  private async startRecording(): Promise<void> {
    try {
      this.audioChunks = [];
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.recordingStatus.textContent = 'Requesting microphone access...';

      try {
        this.stream = await navigator.mediaDevices.getUserMedia({audio: true});
      } catch (err) {
        console.error('Failed with basic constraints:', err);
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }

      try {
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: 'audio/webm',
        });
      } catch (e) {
        console.error('audio/webm not supported, trying default:', e);
        this.mediaRecorder = new MediaRecorder(this.stream);
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0)
          this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        // Close recording modal when finished
        const recordingModal = document.getElementById('recordingModal');
        if (recordingModal) {
          recordingModal.classList.remove('show');
        }

        if (this.waveformDrawingId) {
          cancelAnimationFrame(this.waveformDrawingId);
          this.waveformDrawingId = null;
        }
        
        if (this.timerIntervalId) {
          clearInterval(this.timerIntervalId);
          this.timerIntervalId = null;
        }

        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          this.processAudio(audioBlob).catch((err) => {
            console.error('Error processing audio:', err);
            this.recordingStatus.textContent = 'Error processing recording';
          });
        } else {
          this.recordingStatus.textContent =
            'No audio data captured. Please try again.';
        }

        if (this.stream) {
          this.stream.getTracks().forEach((track) => {
            track.stop();
          });
          this.stream = null;
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      this.recordButton.classList.add('recording');
      this.recordButton.setAttribute('title', 'Stop Recording');

      // Show recording modal
      const recordingModal = document.getElementById('recordingModal');
      if (recordingModal) {
        recordingModal.classList.add('show');
      }

      // Setup waveform and timer
      this.setupCanvasDimensions();
      this.setupAudioVisualizer();
      this.drawLiveWaveform();
      
      this.recordingStartTime = Date.now();
      this.updateLiveTimer();
      if (this.timerIntervalId) clearInterval(this.timerIntervalId);
      this.timerIntervalId = window.setInterval(() => this.updateLiveTimer(), 50);
      
      // Setup stop recording button
      const stopRecordButton = document.getElementById('stopRecordButton');
      if (stopRecordButton) {
        stopRecordButton.addEventListener('click', () => {
          this.stopRecording();
        }, { once: true });
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';

      if (
        errorName === 'NotAllowedError' ||
        errorName === 'PermissionDeniedError'
      ) {
        this.recordingStatus.textContent =
          'Microphone permission denied. Please check browser settings and reload page.';
      } else if (
        errorName === 'NotFoundError' ||
        (errorName === 'DOMException' &&
          errorMessage.includes('Requested device not found'))
      ) {
        this.recordingStatus.textContent =
          'No microphone found. Please connect a microphone.';
      } else if (
        errorName === 'NotReadableError' ||
        errorName === 'AbortError' ||
        (errorName === 'DOMException' &&
          errorMessage.includes('Failed to allocate audiosource'))
      ) {
        this.recordingStatus.textContent =
          'Cannot access microphone. It may be in use by another application.';
      } else {
        this.recordingStatus.textContent = `Error: ${errorMessage}`;
      }

      this.isRecording = false;
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      
      // Hide recording modal if there was an error
      const recordingModal = document.getElementById('recordingModal');
      if (recordingModal) {
        recordingModal.classList.remove('show');
      }
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
      }

      this.isRecording = false;
      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      this.recordingStatus.textContent = 'Processing audio...';
    }
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    if (audioBlob.size === 0) {
      this.recordingStatus.textContent =
        'No audio data captured. Please try again.';
      return;
    }

    try {
      URL.createObjectURL(audioBlob);

      this.recordingStatus.textContent = 'Converting audio...';

      const reader = new FileReader();
      const readResult = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          try {
            const base64data = reader.result as string;
            const base64Audio = base64data.split(',')[1];
            resolve(base64Audio);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await readResult;

      if (!base64Audio) throw new Error('Failed to convert audio to base64');

      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
      await this.getTranscription(base64Audio, mimeType);
    } catch (error) {
      console.error('Error in processAudio:', error);
      this.recordingStatus.textContent =
        'Error processing recording. Please try again.';
    }
  }

  private async getTranscription(
    base64Audio: string,
    mimeType: string,
  ): Promise<void> {
    try {
      this.recordingStatus.textContent = 'Getting transcription...';

      const contents = [
        {text: 'Generate a complete, detailed transcript of this audio. The audio may contain a mix of English, Igbo, Yoruba, Hausa, and Nigerian Pidgin. Accurately transcribe preserving all original languages and dialects with their proper tone marks, accents, and linguistic nuances. Pay special attention to:' +
        '\n- Tonal patterns and dialectal variations in Igbo' +
        '\n- Diacritical marks and tonal inflections in Yoruba' +
        '\n- Contextual meanings and idiomatic expressions in Hausa' +
        '\n- Code-switching between languages (which is common in Nigerian speech)' +
        '\n- Regional Nigerian Pidgin expressions and colloquialisms' +
        '\n\nPreserve the cultural context and meaning in the transcription.'},
        {inlineData: {mimeType: mimeType, data: base64Audio}},
      ];

      // Fix: Explicitly type `response` for clarity and to ensure `response.text` is correctly typed as string.
      const response: GenerateContentResponse = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
      });

      const transcriptionText = response.text;

      if (transcriptionText) {
        this.rawTranscription.textContent = transcriptionText;
        if (transcriptionText.trim() !== '') {
          this.rawTranscription.classList.remove('placeholder-active');
        } else {
          const placeholder =
            this.rawTranscription.getAttribute('placeholder') || '';
          this.rawTranscription.textContent = placeholder;
          this.rawTranscription.classList.add('placeholder-active');
        }

        if (this.currentNote)
          this.currentNote.rawTranscription = transcriptionText;
        this.recordingStatus.textContent =
          'Transcription complete. Polishing note...';
        this.getPolishedNote().catch((err) => {
          console.error('Error polishing note:', err);
          this.recordingStatus.textContent =
            'Error polishing note after transcription.';
        });
      } else {
        this.recordingStatus.textContent =
          'Transcription failed or returned empty.';
        this.polishedNote.innerHTML =
          '<p><em>Could not transcribe audio. Please try again.</em></p>';
        this.rawTranscription.textContent =
          this.rawTranscription.getAttribute('placeholder');
        this.rawTranscription.classList.add('placeholder-active');
      }
    } catch (error) {
      console.error('Error getting transcription:', error);
      this.recordingStatus.textContent =
        'Error getting transcription. Please try again.';
      this.polishedNote.innerHTML = `<p><em>Error during transcription: ${error instanceof Error ? error.message : String(error)}</em></p>`;
      this.rawTranscription.textContent =
        this.rawTranscription.getAttribute('placeholder');
      this.rawTranscription.classList.add('placeholder-active');
    }
  }

  private async getPolishedNote(): Promise<void> {
    try {
      if (
        !this.rawTranscription.textContent ||
        this.rawTranscription.textContent.trim() === '' ||
        this.rawTranscription.classList.contains('placeholder-active')
      ) {
        this.recordingStatus.textContent = 'No transcription to polish';
        this.polishedNote.innerHTML =
          '<p><em>No transcription available to polish.</em></p>';
        const placeholder = this.polishedNote.getAttribute('placeholder') || '';
        this.polishedNote.innerHTML = placeholder;
        this.polishedNote.classList.add('placeholder-active');
        return;
      }

      this.recordingStatus.textContent = 'Polishing note...';

      const prompt = `Take this raw transcription, which may contain a mix of English, Igbo, Yoruba, Hausa, and Nigerian Pidgin, and create a polished, well-formatted note.
- Recognize and preserve linguistic nuances across all languages including:
  * Tonal patterns in Igbo
  * Diacritical marks in Yoruba 
  * Contextual expressions in Hausa
  * Colloquialisms in Nigerian Pidgin
- Maintain all code-switching between languages
- Preserve cultural context and idiomatic expressions
- Remove filler words (e.g., um, uh, like), repetitions, and false starts
- Correct obvious grammatical errors if they don't alter meaning
- Format the note using markdown for headings, lists, bolding, and italics where appropriate
- Ensure all key information and cultural nuances from the raw transcription are retained
- The polished note should be clear, concise, and easy to read, while authentically representing the original speech patterns

Raw transcription:
${this.rawTranscription.textContent}`;
      const contents = [{text: prompt}];

      // Fix: Explicitly type `response` for clarity. `response.text` is expected to be a string
      // due to earlier fixes in GenAI initialization and typing.
      const response: GenerateContentResponse = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
      });
      const polishedText = response.text; // This should now be a string.

      if (polishedText) {
        const htmlContent = marked.parse(polishedText); // Error on this line should be resolved.
        this.polishedNote.innerHTML = htmlContent;
        if (polishedText.trim() !== '') {
          this.polishedNote.classList.remove('placeholder-active');
        } else {
          const placeholder =
            this.polishedNote.getAttribute('placeholder') || '';
          this.polishedNote.innerHTML = placeholder;
          this.polishedNote.classList.add('placeholder-active');
        }

        let noteTitleSet = false;
        const lines = polishedText.split('\n').map((l) => l.trim());

        for (const line of lines) {
          if (line.startsWith('#')) {
            const title = line.replace(/^#+\s+/, '').trim();
            if (this.editorTitle && title) {
              this.editorTitle.textContent = title;
              this.editorTitle.classList.remove('placeholder-active');
              noteTitleSet = true;
              break;
            }
          }
        }

        if (!noteTitleSet && this.editorTitle) {
          for (const line of lines) {
            if (line.length > 0) {
              let potentialTitle = line.replace(
                /^[\*_\`#\->\s\[\]\(.\d)]+/,
                '',
              );
              potentialTitle = potentialTitle.replace(/[\*_\`#]+$/, '');
              potentialTitle = potentialTitle.trim();

              if (potentialTitle.length > 3) {
                const maxLength = 60;
                this.editorTitle.textContent =
                  potentialTitle.substring(0, maxLength) +
                  (potentialTitle.length > maxLength ? '...' : '');
                this.editorTitle.classList.remove('placeholder-active');
                noteTitleSet = true;
                break;
              }
            }
          }
        }

        if (!noteTitleSet && this.editorTitle) {
          const currentEditorText = this.editorTitle.textContent?.trim();
          const placeholderText =
            this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
          if (
            currentEditorText === '' ||
            currentEditorText === placeholderText
          ) {
            this.editorTitle.textContent = placeholderText;
            if (!this.editorTitle.classList.contains('placeholder-active')) {
              this.editorTitle.classList.add('placeholder-active');
            }
          }
        }

        if (this.currentNote) {
          this.currentNote.polishedNote = polishedText;
          
          // Update the notes array and save to localStorage
          const noteIndex = this.notes.findIndex(n => n.id === this.currentNote!.id);
          if (noteIndex !== -1) {
            this.notes[noteIndex] = this.currentNote;
            this.saveNotes();
            // Update note list to reflect any title changes
            this.renderNoteList();
          }
        }
        
        this.recordingStatus.textContent =
          'Note polished. Ready for next recording.';
      } else {
        this.recordingStatus.textContent =
          'Polishing failed or returned empty.';
        this.polishedNote.innerHTML =
          '<p><em>Polishing returned empty. Raw transcription is available.</em></p>';
        if (
          this.polishedNote.textContent?.trim() === '' ||
          this.polishedNote.innerHTML.includes('<em>Polishing returned empty')
        ) {
          const placeholder =
            this.polishedNote.getAttribute('placeholder') || '';
          this.polishedNote.innerHTML = placeholder;
          this.polishedNote.classList.add('placeholder-active');
        }
      }
    } catch (error) {
      console.error('Error polishing note:', error);
      this.recordingStatus.textContent =
        'Error polishing note. Please try again.';
      this.polishedNote.innerHTML = `<p><em>Error during polishing: ${error instanceof Error ? error.message : String(error)}</em></p>`;
      if (
        this.polishedNote.textContent?.trim() === '' ||
        this.polishedNote.innerHTML.includes('<em>Error during polishing')
      ) {
        const placeholder = this.polishedNote.getAttribute('placeholder') || '';
        this.polishedNote.innerHTML = placeholder;
        this.polishedNote.classList.add('placeholder-active');
      }
    }
  }

  private createNewNote(): void {
    this.currentNote = {
      id: `note_${Date.now()}`,
      rawTranscription: '',
      polishedNote: '',
      timestamp: Date.now(),
    };
    
    // Add to notes array
    this.notes.push(this.currentNote);
    this.saveNotes();
    this.renderNoteList();

    const rawPlaceholder =
      this.rawTranscription.getAttribute('placeholder') || '';
    this.rawTranscription.textContent = rawPlaceholder;
    this.rawTranscription.classList.add('placeholder-active');

    const polishedPlaceholder =
      this.polishedNote.getAttribute('placeholder') || '';
    this.polishedNote.innerHTML = polishedPlaceholder;
    this.polishedNote.classList.add('placeholder-active');
    
    // Reset summary tab
    this.summaryContent.innerHTML = `
      <div class="empty-content-action">
        <p>No summary generated yet</p>
        <button id="generateSummaryBtn" class="action-button-inline">
          <i class="fas fa-wand-magic-sparkles"></i>
          Generate Summary
        </button>
      </div>
    `;
    
    const newGenerateBtn = this.summaryContent.querySelector('#generateSummaryBtn');
    if (newGenerateBtn) {
      newGenerateBtn.addEventListener('click', () => this.generateSummary());
    }
    
    // Reset translations tab
    this.translationResult.innerHTML = `
      <p class="translation-placeholder">Select a language to translate your note</p>
    `;

    if (this.editorTitle) {
      const placeholder =
        this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
      this.editorTitle.textContent = placeholder;
      this.editorTitle.classList.add('placeholder-active');
    }
    this.recordingStatus.textContent = 'Ready to record';

    if (this.isRecording) {
      this.mediaRecorder?.stop();
      this.isRecording = false;
      this.recordButton.classList.remove('recording');
    } else {
      if (this.waveformDrawingId) {
        cancelAnimationFrame(this.waveformDrawingId);
        this.waveformDrawingId = null;
      }
      if (this.timerIntervalId) {
        clearInterval(this.timerIntervalId);
        this.timerIntervalId = null;
      }
      if (this.liveWaveformCtx && this.liveWaveformCanvas) {
        this.liveWaveformCtx.clearRect(
          0,
          0,
          this.liveWaveformCanvas.width,
          this.liveWaveformCanvas.height,
        );
      }

      if (this.audioContext) {
        if (this.audioContext.state !== 'closed') {
          this.audioContext
            .close()
            .catch((e) => console.warn('Error closing audio context', e));
        }
        this.audioContext = null;
      }
      this.analyserNode = null;
      this.waveformDataArray = null;
    }
  }

  // New methods for enhanced functionality
  private loadNotes(): void {
    try {
      const savedNotes = localStorage.getItem('voiceScribeNotes');
      if (savedNotes) {
        this.notes = JSON.parse(savedNotes);
        this.renderNoteList();
      }
    } catch (error) {
      console.error('Error loading notes from localStorage:', error);
    }
  }

  private saveNotes(): void {
    try {
      localStorage.setItem('voiceScribeNotes', JSON.stringify(this.notes));
    } catch (error) {
      console.error('Error saving notes to localStorage:', error);
    }
  }

  private renderNoteList(): void {
    if (this.notes.length === 0) {
      this.noteList.innerHTML = `
        <div class="empty-notes-message">
          <i class="fas fa-microphone-lines"></i>
          <p>Start recording to create your first note</p>
        </div>
      `;
      return;
    }

    // Sort notes by timestamp (newest first)
    const sortedNotes = [...this.notes].sort((a, b) => b.timestamp - a.timestamp);
    
    let notesHtml = '';
    sortedNotes.forEach(note => {
      const title = this.extractTitle(note.polishedNote) || 'Untitled Note';
      const date = new Date(note.timestamp).toLocaleDateString();
      
      notesHtml += `
        <div class="note-item" data-id="${note.id}">
          <div class="note-item-content">
            <h4>${title}</h4>
            <span class="note-date">${date}</span>
          </div>
          <button class="note-delete-btn" data-id="${note.id}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
    });
    
    this.noteList.innerHTML = notesHtml;
    
    // Add event listeners to note items
    document.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Don't load note if delete button was clicked
        if (target.closest('.note-delete-btn')) return;
        
        const noteId = item.getAttribute('data-id');
        if (noteId) this.loadNote(noteId);
      });
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.note-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.getAttribute('data-id');
        if (noteId) this.deleteNote(noteId);
      });
    });
  }

  private extractTitle(text: string): string | null {
    if (!text) return null;
    
    const lines = text.split('\n').map(l => l.trim());
    
    // Try to find a heading first
    for (const line of lines) {
      if (line.startsWith('#')) {
        return line.replace(/^#+\s+/, '').trim();
      }
    }
    
    // If no heading, use the first non-empty line
    for (const line of lines) {
      if (line.length > 0) {
        return line.substring(0, 60) + (line.length > 60 ? '...' : '');
      }
    }
    
    return null;
  }

  private loadNote(noteId: string): void {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;
    
    this.currentNote = note;
    
    // Update UI with note content
    this.rawTranscription.textContent = note.rawTranscription;
    this.rawTranscription.classList.remove('placeholder-active');
    
    this.polishedNote.innerHTML = marked.parse(note.polishedNote);
    this.polishedNote.classList.remove('placeholder-active');
    
    // Set title
    const title = this.extractTitle(note.polishedNote) || 'Untitled Note';
    this.editorTitle.textContent = title;
    this.editorTitle.classList.remove('placeholder-active');
    
    // Update summary tab if available
    if (note.summary) {
      this.summaryContent.innerHTML = marked.parse(note.summary);
      this.summaryContent.classList.remove('placeholder-active');
    } else {
      this.summaryContent.innerHTML = `
        <div class="empty-content-action">
          <p>No summary generated yet</p>
          <button id="generateSummaryBtn" class="action-button-inline">
            <i class="fas fa-wand-magic-sparkles"></i>
            Generate Summary
          </button>
        </div>
      `;
      const newGenerateBtn = this.summaryContent.querySelector('#generateSummaryBtn');
      if (newGenerateBtn) {
        newGenerateBtn.addEventListener('click', () => this.generateSummary());
      }
    }
    
    // Reset translations tab
    this.translationResult.innerHTML = `
      <p class="translation-placeholder">Select a language to translate your note</p>
    `;
  }

  private deleteNote(noteId: string): void {
    if (confirm('Are you sure you want to delete this note?')) {
      this.notes = this.notes.filter(note => note.id !== noteId);
      this.saveNotes();
      this.renderNoteList();
      
      // If the deleted note was the current note, create a new one
      if (this.currentNote && this.currentNote.id === noteId) {
        this.createNewNote();
      }
    }
  }

  private async generateSummary(): Promise<void> {
    if (this.isProcessingSummary) return;
    
    if (
      !this.currentNote?.polishedNote ||
      this.currentNote.polishedNote.trim() === ''
    ) {
      alert('Please record and transcribe something first to generate a summary.');
      return;
    }
    
    this.isProcessingSummary = true;
    
    // Update UI to show generation in progress
    this.summaryContent.innerHTML = `
      <div class="generating-content">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Generating summary...</span>
      </div>
    `;
    
    try {
      const prompt = `Generate a concise summary of the following text. 
The summary should:
- Capture the main ideas, key points, and important details
- Be about 30% the length of the original text
- Preserve the language(s) used in the original text (which may include English, Igbo, Yoruba, Hausa, and/or Nigerian Pidgin)
- Format the summary using markdown if appropriate

Text to summarize:
${this.currentNote.polishedNote}`;

      const contents = [{text: prompt}];
      
      const response: GenerateContentResponse = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
      });
      
      const summaryText = response.text;
      
      if (summaryText) {
        // Save summary to current note
        if (this.currentNote) {
          this.currentNote.summary = summaryText;
          
          // Update the notes array and save to localStorage
          const noteIndex = this.notes.findIndex(n => n.id === this.currentNote!.id);
          if (noteIndex !== -1) {
            this.notes[noteIndex] = this.currentNote;
            this.saveNotes();
          }
        }
        
        // Display the summary
        const htmlContent = marked.parse(summaryText);
        this.summaryContent.innerHTML = htmlContent;
        this.summaryContent.classList.remove('placeholder-active');
      } else {
        this.summaryContent.innerHTML = `
          <div class="empty-content-action">
            <p>Failed to generate summary. Please try again.</p>
            <button id="generateSummaryBtn" class="action-button-inline">
              <i class="fas fa-wand-magic-sparkles"></i>
              Retry
            </button>
          </div>
        `;
        
        const newGenerateBtn = this.summaryContent.querySelector('#generateSummaryBtn');
        if (newGenerateBtn) {
          newGenerateBtn.addEventListener('click', () => this.generateSummary());
        }
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      this.summaryContent.innerHTML = `
        <div class="empty-content-action">
          <p>Error generating summary: ${error instanceof Error ? error.message : String(error)}</p>
          <button id="generateSummaryBtn" class="action-button-inline">
            <i class="fas fa-wand-magic-sparkles"></i>
            Retry
          </button>
        </div>
      `;
      
      const newGenerateBtn = this.summaryContent.querySelector('#generateSummaryBtn');
      if (newGenerateBtn) {
        newGenerateBtn.addEventListener('click', () => this.generateSummary());
      }
    } finally {
      this.isProcessingSummary = false;
    }
  }

  private async translateNote(targetLang: string): Promise<void> {
    if (this.isProcessingTranslation) return;
    
    if (
      !this.currentNote?.polishedNote ||
      this.currentNote.polishedNote.trim() === ''
    ) {
      alert('Please record and transcribe something first to translate.');
      return;
    }
    
    this.isProcessingTranslation = true;
    
    // Update UI to show translation in progress
    const languages: Record<string, string> = {
      'en': 'English',
      'ig': 'Igbo',
      'yo': 'Yoruba',
      'ha': 'Hausa'
    };
    
    this.translationResult.innerHTML = `
      <div class="translation-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Translating to ${languages[targetLang]}...</span>
      </div>
    `;
    
    try {
      // Check if translation is already cached
      if (
        this.currentNote.translations && 
        this.currentNote.translations[targetLang]
      ) {
        this.translationResult.innerHTML = marked.parse(this.currentNote.translations[targetLang]);
        this.isProcessingTranslation = false;
        return;
      }
      
      const prompt = `Translate the following text into ${languages[targetLang]}. 
Maintain the original formatting and preserve any markdown. 
Ensure the translation captures the meaning and nuances of the original text.

Original text:
${this.currentNote.polishedNote}`;

      const contents = [{text: prompt}];
      
      const response: GenerateContentResponse = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
      });
      
      const translatedText = response.text;
      
      if (translatedText) {
        // Save translation to current note
        if (this.currentNote) {
          if (!this.currentNote.translations) {
            this.currentNote.translations = {};
          }
          
          this.currentNote.translations[targetLang] = translatedText;
          
          // Update the notes array and save to localStorage
          const noteIndex = this.notes.findIndex(n => n.id === this.currentNote!.id);
          if (noteIndex !== -1) {
            this.notes[noteIndex] = this.currentNote;
            this.saveNotes();
          }
        }
        
        // Display the translation
        const htmlContent = marked.parse(translatedText);
        this.translationResult.innerHTML = htmlContent;
      } else {
        this.translationResult.innerHTML = `
          <div class="translation-error">
            <p>Failed to translate. Please try again.</p>
          </div>
        `;
      }
    } catch (error) {
      console.error(`Error translating to ${targetLang}:`, error);
      this.translationResult.innerHTML = `
        <div class="translation-error">
          <p>Error translating: ${error instanceof Error ? error.message : String(error)}</p>
        </div>
      `;
    } finally {
      this.isProcessingTranslation = false;
    }
  }

  private exportNote(): void {
    if (
      !this.currentNote?.polishedNote ||
      this.currentNote.polishedNote.trim() === ''
    ) {
      alert('Please record and transcribe something first to export.');
      return;
    }
    
    const title = this.extractTitle(this.currentNote.polishedNote) || 'Untitled Note';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${title.replace(/[^a-z0-9]/gi, '_')}_${date}.md`;
    
    const blob = new Blob([this.currentNote.polishedNote], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  private shareNote(): void {
    if (
      !this.currentNote?.polishedNote ||
      this.currentNote.polishedNote.trim() === ''
    ) {
      alert('Please record and transcribe something first to share.');
      return;
    }
    
    // Check if Web Share API is available
    if (navigator.share) {
      const title = this.extractTitle(this.currentNote.polishedNote) || 'Untitled Note';
      
      navigator.share({
        title: title,
        text: this.currentNote.polishedNote,
      })
      .catch(error => {
        console.error('Error sharing:', error);
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(this.currentNote.polishedNote)
        .then(() => {
          this.recordingStatus.textContent = 'Note copied to clipboard';
          setTimeout(() => {
            this.recordingStatus.textContent = 'Ready to record';
          }, 3000);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          alert('Could not copy text to clipboard. Your browser may not support this feature.');
        });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VoiceNotesApp();

  document
    .querySelectorAll<HTMLElement>('[contenteditable][placeholder]')
    .forEach((el) => {
      const placeholder = el.getAttribute('placeholder')!;

      function updatePlaceholderState() {
        const currentText = (
          el.id === 'polishedNote' ? el.innerText : el.textContent
        )?.trim();

        if (currentText === '' || currentText === placeholder) {
          if (el.id === 'polishedNote' && currentText === '') {
            el.innerHTML = placeholder;
          } else if (currentText === '') {
            el.textContent = placeholder;
          }
          el.classList.add('placeholder-active');
        } else {
          el.classList.remove('placeholder-active');
        }
      }

      updatePlaceholderState();

      el.addEventListener('focus', function () {
        const currentText = (
          this.id === 'polishedNote' ? this.innerText : this.textContent
        )?.trim();
        if (currentText === placeholder) {
          if (this.id === 'polishedNote') this.innerHTML = '';
          else this.textContent = '';
          this.classList.remove('placeholder-active');
        }
      });

      el.addEventListener('blur', function () {
        updatePlaceholderState();
      });
    });
});

export {};
