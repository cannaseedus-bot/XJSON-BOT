/**
 * VOICE INTERFACE - Web Speech API Integration
 * =============================================
 * Provides voice input and text-to-speech output
 *
 * Features:
 * - Speech recognition (voice input)
 * - Text-to-speech (voice output)
 * - Voice commands
 * - Language support
 * - Continuous listening mode
 */

/* ============================================================
   VOICE INPUT (SPEECH RECOGNITION)
   ============================================================ */

const VoiceInput = {
  recognition: null,
  isListening: false,
  isContinuous: false,
  language: 'en-US',
  onResult: null,
  onError: null,
  onStart: null,
  onEnd: null,

  // Check if speech recognition is supported
  isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  },

  // Initialize speech recognition
  init(options = {}) {
    if (!this.isSupported()) {
      console.warn('Speech recognition not supported in this browser');
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure
    this.recognition.continuous = options.continuous || false;
    this.recognition.interimResults = options.interimResults || true;
    this.recognition.lang = options.language || this.language;
    this.recognition.maxAlternatives = options.maxAlternatives || 1;

    // Event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStart) this.onStart();
      console.log('Voice input started');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onEnd) this.onEnd();

      // Restart if continuous mode
      if (this.isContinuous) {
        setTimeout(() => this.start(), 100);
      }
    };

    this.recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const latest = results[results.length - 1];

      if (latest.isFinal) {
        const transcript = latest[0].transcript.trim();
        const confidence = latest[0].confidence;

        if (this.onResult) {
          this.onResult({
            transcript,
            confidence,
            isFinal: true
          });
        }

        // Check for voice commands
        this.handleVoiceCommand(transcript);
      } else {
        // Interim result
        if (this.onResult) {
          this.onResult({
            transcript: latest[0].transcript,
            confidence: latest[0].confidence,
            isFinal: false
          });
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Voice input error:', event.error);
      if (this.onError) this.onError(event.error);

      // Handle specific errors
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      }
    };

    return true;
  },

  // Start listening
  start() {
    if (!this.recognition) {
      if (!this.init()) return false;
    }

    try {
      this.recognition.start();
      return true;
    } catch (e) {
      console.error('Failed to start voice input:', e);
      return false;
    }
  },

  // Stop listening
  stop() {
    if (this.recognition && this.isListening) {
      this.isContinuous = false;
      this.recognition.stop();
    }
  },

  // Start continuous listening
  startContinuous() {
    this.isContinuous = true;
    this.start();
  },

  // Stop continuous listening
  stopContinuous() {
    this.isContinuous = false;
    this.stop();
  },

  // Toggle listening
  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
    return this.isListening;
  },

  // Handle voice commands
  handleVoiceCommand(transcript) {
    const command = transcript.toLowerCase();

    // Navigation commands
    if (command.includes('go to settings') || command.includes('open settings')) {
      if (typeof App !== 'undefined') App.showView('settings');
      VoiceOutput.speak('Opening settings');
      return true;
    }

    if (command.includes('go to chat') || command.includes('open chat')) {
      if (typeof App !== 'undefined') App.showView('chat');
      VoiceOutput.speak('Opening chat');
      return true;
    }

    if (command.includes('new chat') || command.includes('start new chat')) {
      if (typeof ChatHistory !== 'undefined') {
        ChatHistory.createNew();
        if (typeof App !== 'undefined') App.render();
      }
      VoiceOutput.speak('Starting new chat');
      return true;
    }

    // Voice control commands
    if (command.includes('stop listening')) {
      this.stop();
      VoiceOutput.speak('Voice input stopped');
      return true;
    }

    if (command.includes('read response') || command.includes('read last message')) {
      const chat = typeof ChatHistory !== 'undefined' ? ChatHistory.getActive() : null;
      if (chat && chat.messages.length > 0) {
        const lastAssistant = [...chat.messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistant) {
          VoiceOutput.speak(lastAssistant.content);
        }
      }
      return true;
    }

    return false;
  },

  // Set language
  setLanguage(lang) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }
};

/* ============================================================
   VOICE OUTPUT (TEXT-TO-SPEECH)
   ============================================================ */

const VoiceOutput = {
  synth: null,
  voices: [],
  currentVoice: null,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  isSpeaking: false,
  queue: [],

  // Check if TTS is supported
  isSupported() {
    return 'speechSynthesis' in window;
  },

  // Initialize TTS
  init() {
    if (!this.isSupported()) {
      console.warn('Text-to-speech not supported in this browser');
      return false;
    }

    this.synth = window.speechSynthesis;

    // Load voices
    this.loadVoices();

    // Voices may load asynchronously
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }

    return true;
  },

  // Load available voices
  loadVoices() {
    this.voices = this.synth.getVoices();

    // Set default voice (prefer English)
    const englishVoice = this.voices.find(v =>
      v.lang.startsWith('en') && v.localService
    );

    this.currentVoice = englishVoice || this.voices[0];
  },

  // Get available voices
  getVoices() {
    return this.voices.map(v => ({
      name: v.name,
      lang: v.lang,
      local: v.localService
    }));
  },

  // Set voice by name or language
  setVoice(nameOrLang) {
    const voice = this.voices.find(v =>
      v.name.toLowerCase().includes(nameOrLang.toLowerCase()) ||
      v.lang.toLowerCase().includes(nameOrLang.toLowerCase())
    );

    if (voice) {
      this.currentVoice = voice;
      return true;
    }
    return false;
  },

  // Speak text
  speak(text, options = {}) {
    if (!this.synth) {
      if (!this.init()) return false;
    }

    // Cancel current speech if requested
    if (options.interrupt) {
      this.stop();
    }

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.voice = options.voice || this.currentVoice;
    utterance.rate = options.rate || this.rate;
    utterance.pitch = options.pitch || this.pitch;
    utterance.volume = options.volume || this.volume;
    utterance.lang = options.lang || (this.currentVoice?.lang || 'en-US');

    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.processQueue();
    };

    utterance.onerror = (event) => {
      console.error('TTS error:', event.error);
      this.isSpeaking = false;
      this.processQueue();
    };

    if (options.queue && this.isSpeaking) {
      this.queue.push(utterance);
    } else {
      this.synth.speak(utterance);
    }

    return true;
  },

  // Process queued utterances
  processQueue() {
    if (this.queue.length > 0 && !this.isSpeaking) {
      const next = this.queue.shift();
      this.synth.speak(next);
    }
  },

  // Stop speaking
  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.queue = [];
      this.isSpeaking = false;
    }
  },

  // Pause speaking
  pause() {
    if (this.synth) {
      this.synth.pause();
    }
  },

  // Resume speaking
  resume() {
    if (this.synth) {
      this.synth.resume();
    }
  },

  // Set rate (0.1 to 10)
  setRate(rate) {
    this.rate = Math.max(0.1, Math.min(10, rate));
  },

  // Set pitch (0 to 2)
  setPitch(pitch) {
    this.pitch = Math.max(0, Math.min(2, pitch));
  },

  // Set volume (0 to 1)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }
};

/* ============================================================
   VOICE INTERFACE MANAGER
   ============================================================ */

const Voice = {
  input: VoiceInput,
  output: VoiceOutput,
  isEnabled: false,

  // Initialize voice interface
  init() {
    const inputSupported = VoiceInput.init();
    const outputSupported = VoiceOutput.init();

    this.isEnabled = inputSupported || outputSupported;

    console.log('Voice Interface:', {
      input: inputSupported,
      output: outputSupported
    });

    return this.isEnabled;
  },

  // Check browser support
  isSupported() {
    return VoiceInput.isSupported() || VoiceOutput.isSupported();
  },

  // Start voice input and connect to chat
  startVoiceChat(onMessage) {
    VoiceInput.onResult = (result) => {
      if (result.isFinal && onMessage) {
        onMessage(result.transcript);
      }
    };

    VoiceInput.start();
  },

  // Speak response
  speakResponse(text) {
    VoiceOutput.speak(text);
  },

  // Toggle voice mode
  toggle() {
    if (VoiceInput.isListening) {
      VoiceInput.stop();
      return false;
    } else {
      VoiceInput.start();
      return true;
    }
  },

  // Get status
  getStatus() {
    return {
      inputSupported: VoiceInput.isSupported(),
      outputSupported: VoiceOutput.isSupported(),
      isListening: VoiceInput.isListening,
      isSpeaking: VoiceOutput.isSpeaking,
      inputLanguage: VoiceInput.language,
      outputVoice: VoiceOutput.currentVoice?.name
    };
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */

// Make available globally
if (typeof window !== 'undefined') {
  window.Voice = Voice;
  window.VoiceInput = VoiceInput;
  window.VoiceOutput = VoiceOutput;
}

console.log('VOICE INTERFACE v1.0 - LOADED');
console.log('- Speech Recognition:', VoiceInput.isSupported() ? 'Supported' : 'Not Supported');
console.log('- Text-to-Speech:', VoiceOutput.isSupported() ? 'Supported' : 'Not Supported');
