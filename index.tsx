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
  
  // Updated properties for simplified features
  private summaryContent: HTMLDivElement;
  private generateSummaryBtn: HTMLButtonElement | null;
  private exportButton: HTMLButtonElement;
  private shareButton: HTMLButtonElement;
  private helpButton: HTMLButtonElement;
  private helpModal: HTMLDivElement;
  private notes: Note[] = [];
  private noteList: HTMLDivElement;
  private isProcessingSummary: boolean = false;

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
    
    this.exportButton.addEventListener('click', () => this.exportNote());
    this.shareButton.addEventListener('click', () => this.shareNote());
    
    // Initialize tab navigation
    this.initTabNavigation();
    
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

      // const contents = [
      //   {text: 'Transcribe this audio literally and exactly as spoken. The audio may contain a mix of English, Igbo, Yoruba, Hausa, and Nigerian Pidgin.\n\n' +
      //   'Important guidelines:\n' +
      //   '- Transcribe ONLY the spoken content - do not add any notes, comments, or description\n' +
      //   '- Do NOT include phrases like "here\'s what the user said" or similar meta-commentary\n' +
      //   '- Do NOT include any headers, sections, or explanations\n' +
      //   '- Start the transcript immediately with the first spoken words\n' +
      //   '- Preserve all linguistic nuances including:\n' +
      //   '  - Tonal patterns and dialectal variations in Igbo\n' +
      //   '  - Diacritical marks and tonal inflections in Yoruba\n' +
      //   '  - Contextual meanings and idiomatic expressions in Hausa\n' +
      //   '  - Code-switching between languages\n' +
      //   '  - It must be word for word, no paraphrasing or summarizing\n just the words as they are spoken from the user\n' +
      //   '  - Regional Nigerian Pidgin expressions and colloquialisms\n' +
      //   '- Include all fillers, hesitations, and repetitions\n' +
      //   '- Do not clean up or polish the language - provide the raw verbatim transcript\n' +
      //   '- Preserve the cultural context and meaning in the transcription'},
      //   {inlineData: {mimeType: mimeType, data: base64Audio}},
      // ];
      const contents = [
        {
          text: `Transcribe the provided audio exactly as spoken, preserving every nuance. The recording may include English, Igbo, Yoruba, Hausa, and Nigerian Pidgin.
      
      Guidelines:
      1. **Literal Verbatim**: Capture only the spoken words, without paraphrasing, summarizing, or adding any commentary.
      2. **No Meta-Text**: Do not include headers, notes (e.g., “here’s what the user said”), descriptions, or explanations.
      3. **Immediate Start**: Begin the transcript with the first utterance—no preamble.
      4. **Nuance Preservation**:
         - Tonal patterns and dialectal variations in Igbo
         - Diacritical marks and tonal inflections in Yoruba
         - Contextual meanings and idiomatic expressions in Hausa
         - Code-switching and mixed-language segments
         - Regional Nigerian Pidgin colloquialisms
      5. **Fillers and Hesitations**: Include all fillers (e.g., “um,” “ah”), repetitions, false starts, and pauses.
      6. **Cultural Context**: Maintain the original cultural connotations and emphasis used by the speaker.
      7. **Raw Format**: Do not clean up or polish the language; provide raw, unedited speech content.
      8. **Timestamps**: Attach metadata timestamps for each segment (e.g., [00:00:05]) where feasible.
      
      Provide the output as a plain transcript array without modifying this template.`,
        },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio
          }
        }
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

      const prompt = `Polish and format this raw transcription text using markdown. It may contain a mix of English, Igbo, Yoruba, Hausa, and Nigerian Pidgin.

Important guidelines:
- Preserve linguistic nuances across all languages (tonal patterns, diacritical marks, contextual expressions, colloquialisms)
- Maintain all code-switching between languages
- Remove filler words (um, uh, like), repetitions, and false starts
- Correct obvious grammatical errors without altering meaning
- Format with markdown for readability (headings, lists, bold, italics where needed)
- Retain all key information and cultural nuances
- Focus solely on direct polishing - do NOT include ANY meta-commentary about the text or your process

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
      this.summaryContent.innerHTML = `
        <div class="summary-toolbar">
          <select id="languageSelect" class="language-button">
            <option value="" disabled selected>Translate to...</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Igbo">Igbo</option>
            <option value="Yoruba">Yoruba</option>
            <option value="Hausa">Hausa</option>
            <option value="Nigerian Pidgin">Nigerian Pidgin</option>
          </select>
          <button id="translateSummaryBtn" class="action-button-inline">
            <i class="fas fa-language"></i>
            Translate
          </button>
        </div>
        <div class="flashcard-summary">
          ${marked.parse(note.summary)}
        </div>
      `;
      this.summaryContent.classList.remove('placeholder-active');
      // Bind translation listener
      const translateBtn = this.summaryContent.querySelector('#translateSummaryBtn') as HTMLButtonElement;
      const langSelect = this.summaryContent.querySelector('#languageSelect') as HTMLSelectElement;
      if (translateBtn && langSelect) {
        translateBtn.addEventListener('click', () => {
          const lang = langSelect.value;
          if (lang) this.translateSummary(lang);
        });
      }
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
        <span>Generating flashcard summary...</span>
      </div>
    `;
    
    try {
      const prompt = `Create a flashcard-style summary of the following text.

The summary should:
- Extract 3-6 key points from the text
- Format each key point as a bullet point with a bolded heading followed by a brief explanation
- Example format:
  - **Heading/Key Point**: Brief explanation or details about this point.
  - **Another Key Concept**: Further explanation about this concept.
- Make each flashcard concise but informative
- Preserve the language(s) used in the original text (which may include English, Igbo, Yoruba, Hausa, and/or Nigerian Pidgin)
- Focus solely on creating the summary - do NOT include ANY meta-commentary about the text or your process

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
        
        // Display the flashcard summary with translation toolbar
        const htmlContent = `
          <div class="summary-toolbar">
            <select id="languageSelect" class="language-button">
              <option value="" disabled selected>Translate to...</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Igbo">Igbo</option>
              <option value="Yoruba">Yoruba</option>
              <option value="Hausa">Hausa</option>
              <option value="Nigerian Pidgin">Nigerian Pidgin</option>
            </select>
            <button id="translateSummaryBtn" class="action-button-inline">
              <i class="fas fa-language"></i>
              Translate
            </button>
          </div>
          <div class="flashcard-summary">
            ${marked.parse(summaryText)}
          </div>
        `;
        this.summaryContent.innerHTML = htmlContent;
        this.summaryContent.classList.remove('placeholder-active');
        // Bind translation listener
        const translateBtn = this.summaryContent.querySelector('#translateSummaryBtn') as HTMLButtonElement;
        const langSelect = this.summaryContent.querySelector('#languageSelect') as HTMLSelectElement;
        if (translateBtn && langSelect) {
          translateBtn.addEventListener('click', () => {
            const lang = langSelect.value;
            if (lang) this.translateSummary(lang);
          });
        }
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

  private initTabNavigation(): void {
    const tabNav = document.querySelector('.tab-navigation');
    if (!tabNav) return;
    const tabButtons = Array.from(tabNav.querySelectorAll<HTMLButtonElement>('.tab-button'));
    const indicator = tabNav.querySelector<HTMLDivElement>('.active-tab-indicator');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (indicator) {
          indicator.style.left = `${btn.offsetLeft}px`;
          indicator.style.width = `${btn.offsetWidth}px`;
        }
        const selected = btn.getAttribute('data-tab');
        ['note', 'raw', 'summary'].forEach(name => {
          const el = document.getElementById(`${name}Tab`);
          if (el) el.classList.remove('active');
        });
        const target = document.getElementById(`${selected}Tab`);
        if (target) target.classList.add('active');
      });
    });
    const activeBtn = tabNav.querySelector<HTMLButtonElement>('.tab-button.active');
    if (activeBtn && indicator) {
      indicator.style.left = `${activeBtn.offsetLeft}px`;
      indicator.style.width = `${activeBtn.offsetWidth}px`;
    }
  }

  private async translateSummary(language: string): Promise<void> {
    if (!this.currentNote?.summary) {
      alert('No summary available to translate.');
      return;
    }
    this.summaryContent.innerHTML = `
      <div class="translation-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Translating summary to ${language}...</span>
      </div>
    `;
    try {
      const prompt = `Translate the following markdown flashcard summary into ${language}. Preserve the bullet points and formatting exactly:
      
      ${this.currentNote.summary}`;
      const response: GenerateContentResponse = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: [{ text: prompt }],
      });
      const translatedText = response.text;
      // Update note and persist
      this.currentNote.summary = translatedText;
      const idx = this.notes.findIndex(n => n.id === this.currentNote!.id);
      if (idx !== -1) {
        this.notes[idx] = this.currentNote;
        this.saveNotes();
      }
      // Render translated summary with toolbar
      this.summaryContent.innerHTML = `
        <div class="summary-toolbar">
          <select id="languageSelect" class="language-button">
            <option value="" disabled selected>Translate to...</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Igbo">Igbo</option>
            <option value="Yoruba">Yoruba</option>
            <option value="Hausa">Hausa</option>
            <option value="Nigerian Pidgin">Nigerian Pidgin</option>
          </select>
          <button id="translateSummaryBtn" class="action-button-inline">
            <i class="fas fa-language"></i>
            Translate
          </button>
        </div>
        <div class="flashcard-summary">
          ${marked.parse(translatedText)}
        </div>
      `;
      this.summaryContent.classList.remove('placeholder-active');
      // Rebind translation listener
      const translateBtn2 = this.summaryContent.querySelector('#translateSummaryBtn') as HTMLButtonElement;
      const langSelect2 = this.summaryContent.querySelector('#languageSelect') as HTMLSelectElement;
      if (translateBtn2 && langSelect2) {
        translateBtn2.addEventListener('click', () => this.translateSummary(langSelect2.value));
      }
    } catch (error) {
      console.error('Error translating summary:', error);
      this.summaryContent.innerHTML = `
        <div class="empty-content-action">
          <p>Failed to translate summary. Please try again.</p>
          <button id="translateSummaryBtn" class="action-button-inline">
            <i class="fas fa-wand-magic-sparkles"></i>
            Retry
          </button>
        </div>
      `;
      const retryBtn = this.summaryContent.querySelector('#translateSummaryBtn');
      if (retryBtn) retryBtn.addEventListener('click', () => this.translateSummary(language));
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
