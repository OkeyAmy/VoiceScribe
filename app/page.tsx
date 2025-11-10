'use client';

import VoiceNotesApp from './components/VoiceNotesApp';

export default function Home() {
  return (
    <>
      <VoiceNotesApp />
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <i className="fas fa-microphone-lines"></i>
            <span>VoiceScribe</span>
          </div>
          <div className="header-actions">
            <button id="themeToggleButton" className="icon-button" title="Toggle dark/light mode">
              <i className="fas fa-sun"></i>
            </button>
            <button id="helpButton" className="icon-button" title="Help">
              <i className="fas fa-question"></i>
            </button>
          </div>
        </header>
        
        <div className="main-container">
          <aside className="sidebar">
            <div className="sidebar-header">
              <h3>My Notes</h3>
              <button id="newButton" className="icon-button" title="New Note">
                <i className="fas fa-plus"></i>
              </button>
            </div>
            
            <div className="note-list">
              <div className="empty-notes-message">
                <i className="fas fa-microphone-lines"></i>
                <p>Start recording to create your first note</p>
              </div>
            </div>
          </aside>
          
          <main className="content-area">
            <div className="editor-container">
              <div className="editor-header">
                <div className="editor-title" contentEditable={true} suppressContentEditableWarning={true} data-placeholder="Untitled Note"></div>
                <div className="editor-actions">
                  <button id="exportButton" className="action-pill" title="Export as Markdown">
                    <i className="fas fa-file-export"></i>
                    <span>Export</span>
                  </button>
                  <button id="shareButton" className="action-pill" title="Share Note">
                    <i className="fas fa-share-nodes"></i>
                    <span>Share</span>
                  </button>
                </div>
              </div>
              
              <div className="tab-navigation-container">
                <div className="tab-navigation">
                  <button className="tab-button active" data-tab="note">
                    <i className="fas fa-file-lines"></i>
                    <span>Polished</span>
                  </button>
                  <button className="tab-button" data-tab="raw">
                    <i className="fas fa-microphone-alt"></i>
                    <span>Raw</span>
                  </button>
                  <button className="tab-button" data-tab="summary">
                    <i className="fas fa-list-check"></i>
                    <span>Summary</span>
                  </button>
                  <div className="active-tab-indicator"></div>
                </div>
              </div>
              
              <div className="editor-content-container">
                <div id="noteTab" className="editor-tab active">
                  <div id="polishedNote" className="editor-content" contentEditable={true} suppressContentEditableWarning={true} data-placeholder="Your polished note will appear here..."></div>
                </div>
                <div id="rawTab" className="editor-tab">
                  <div id="rawTranscription" className="editor-content" contentEditable={true} suppressContentEditableWarning={true} data-placeholder="Your raw transcription will appear here..."></div>
                </div>
                <div id="summaryTab" className="editor-tab">
                  <div id="summaryContent" className="editor-content">
                    <div className="empty-content-action">
                      <p>No summary generated yet</p>
                      <button id="generateSummaryBtn" className="action-button-inline">
                        <i className="fas fa-wand-magic-sparkles"></i>
                        Generate Summary
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
        
        <div className="floating-record-container">
          <div className="recording-status" id="recordingStatus">Ready to record</div>
          <button id="recordButton" className="floating-record-button" title="Start Recording">
            <div className="record-button-inner">
              <i className="fas fa-microphone"></i>
            </div>
          </button>
        </div>
        
        <div id="recordingModal" className="recording-modal">
          <div className="recording-modal-content">
            <div className="live-recording-title">Recording in Progress</div>
            <div className="waveform-container">
              <canvas id="liveWaveformCanvas"></canvas>
            </div>
            <div id="liveRecordingTimerDisplay" className="live-recording-timer">00:00.00</div>
            <button id="stopRecordButton" className="stop-record-button">
              <i className="fas fa-stop"></i>
              <span>Stop Recording</span>
            </button>
          </div>
        </div>
        
        <div id="helpModal" className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Voice Scribe Help</h2>
              <button className="modal-close-button" onClick={() => document.getElementById('helpModal')?.classList.remove('show')}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <h3>Getting Started</h3>
              <p>Voice Scribe helps you turn your spoken words into organized notes using AI.</p>
              
              <h3>Features</h3>
              <ul>
                <li><strong>Record:</strong> Click the microphone button to start/stop recording.</li>
                <li><strong>Polished Notes:</strong> Automatically removes filler words and formats your speech.</li>
                <li><strong>Flashcard Summaries:</strong> Generate concise, visual flashcard-style summaries of your recordings.</li>
              </ul>
              
              <h3>Tips</h3>
              <ul>
                <li>Speak clearly for the best transcription results.</li>
                <li>Use the Raw tab to see your original transcription.</li>
                <li>Export your notes to share or save for later.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
