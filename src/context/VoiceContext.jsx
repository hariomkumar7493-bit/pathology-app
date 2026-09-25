import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from './ToastContext';

const VoiceContext = createContext();

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Navigation route map — voice can say these
const NAV_ROUTES = {
  dashboard: '/dashboard',
  patients: '/patients',
  reports: '/reports',
  'quick report': '/quick-report',
  settings: '/settings',
  'test management': '/test-management',
  'report layout': '/report-layout',
  'staff management': '/staff-management',
  analyzer: '/analyzer',
};

// Hindi navigation aliases
const NAV_HINDI = {
  '\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921': '/dashboard',
  '\u092E\u0930\u0940\u091C': '/patients',
  '\u0930\u093F\u092A\u094B\u0930\u094D\u091F': '/reports',
  '\u0930\u093F\u092A\u094B\u0930\u094D\u091F\u094D\u0938': '/reports',
  '\u0915\u094D\u0935\u093F\u0915 \u0930\u093F\u092A\u094B\u0930\u094D\u091F': '/quick-report',
  '\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938': '/settings',
};

export function VoiceProvider({ children }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [language, setLanguage] = useState('en-IN'); // 'en-IN' | 'hi-IN'
  const [supported, setSupported] = useState(!!SpeechRecognition);
  const recognitionRef = useRef(null);
  const commandHandlersRef = useRef(new Map()); // page-specific handlers
  const navigateRef = useRef(null);
  const locationRef = useRef(null);
  const { addToast } = useToast();

  // Pages register command handlers via this
  const registerCommands = useCallback((pageId, handler) => {
    commandHandlersRef.current.set(pageId, handler);
    return () => commandHandlersRef.current.delete(pageId);
  }, []);

  // Process a final transcript
  const processCommand = useCallback((text) => {
    const lower = text.toLowerCase().trim();
    if (!lower) return;

    // 1. Navigation commands
    const navPrefixes = ['go to', 'open', 'navigate to', 'show', 'goto'];
    const hindiNavPrefixes = ['\u0916\u094B\u0932\u094B', '\u091C\u093E\u0913', '\u0926\u093F\u0916\u093E\u0913'];
    for (const prefix of navPrefixes) {
      if (lower.startsWith(prefix)) {
        const target = lower.slice(prefix.length).trim();
        const route = NAV_ROUTES[target];
        if (route && navigateRef.current) {
          navigateRef.current(route);
          addToast(`Navigating to ${target}`, 'info');
          return;
        }
      }
    }
    for (const prefix of hindiNavPrefixes) {
      if (lower.startsWith(prefix)) {
        const target = lower.slice(prefix.length).trim();
        const route = NAV_HINDI[target];
        if (route && navigateRef.current) {
          navigateRef.current(route);
          addToast(`Navigating to ${target}`, 'info');
          return;
        }
      }
    }
    // Direct route match
    if (NAV_ROUTES[lower]) {
      navigateRef.current?.(NAV_ROUTES[lower]);
      addToast(`Navigating to ${lower}`, 'info');
      return;
    }

    // 2. Try page-specific command handlers (most recently registered first)
    const handlers = Array.from(commandHandlersRef.current.values()).reverse();
    for (const handler of handlers) {
      const handled = handler(lower, text);
      if (handled) return;
    }

    // 3. Unrecognized
    addToast(`Voice: "${text}"`, 'info', 2000);
  }, [addToast]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      addToast('Speech recognition not supported in this browser', 'error');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setTranscript('');
      setInterimTranscript('');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) setInterimTranscript(interim);
      if (final) {
        setTranscript(final);
        setInterimTranscript('');
        processCommand(final);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        addToast('Microphone access denied. Please allow microphone.', 'error');
      } else if (event.error !== 'aborted') {
        addToast(`Voice error: ${event.error}`, 'error');
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language, processCommand, addToast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
    setInterimTranscript('');
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening, stopListening]);

  // Switch language on the fly
  const toggleLanguage = useCallback(() => {
    const newLang = language === 'en-IN' ? 'hi-IN' : 'en-IN';
    setLanguage(newLang);
    if (listening) {
      stopListening();
      // Restart with new language after brief pause
      setTimeout(() => startListening(), 300);
    }
  }, [language, listening, stopListening, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <VoiceContext.Provider value={{
      listening,
      transcript,
      interimTranscript,
      language,
      supported,
      startListening,
      stopListening,
      toggleListening,
      toggleLanguage,
      registerCommands,
      setNavigate: (nav) => { navigateRef.current = nav; },
      setLocation: (loc) => { locationRef.current = loc; },
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider');
  return ctx;
}
