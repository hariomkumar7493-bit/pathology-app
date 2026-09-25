import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from './ToastContext';

const VoiceContext = createContext();

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

// ── Route map ──
const NAV_ROUTES = {
  dashboard: '/dashboard', home: '/dashboard',
  patients: '/patients', 'patient list': '/patients',
  reports: '/reports', 'report list': '/reports', 'all reports': '/reports',
  'quick report': '/quick-report', 'new report': '/quick-report', 'create report': '/quick-report',
  settings: '/settings', 'test management': '/test-management',
  'report layout': '/report-layout', 'staff management': '/staff-management',
  analyzer: '/analyzer',
};

// Hindi aliases
const HINDI_NAV = {
  'डैशबोर्ड': '/dashboard', 'होम': '/dashboard',
  'मरीज': '/patients', 'रिपोर्ट': '/reports', 'रिपोर्ट्स': '/reports',
  'क्विक रिपोर्ट': '/quick-report', 'नई रिपोर्ट': '/quick-report',
  'सेटिंग्स': '/settings',
};

// ── Intent detection — fuzzy natural language ──
function detectIntent(text) {
  const t = text.toLowerCase().trim();

  // Navigation intents
  for (const [phrase, route] of [...Object.entries(NAV_ROUTES), ...Object.entries(HINDI_NAV)]) {
    const patterns = [
      `go to ${phrase}`, `open ${phrase}`, `navigate to ${phrase}`, `take me to ${phrase}`,
      `show ${phrase}`, `show me ${phrase}`, `goto ${phrase}`,
      `${phrase} page`, `${phrase} खोलो`, `${phrase} दिखाओ`,
      phrase, // direct match last
    ];
    for (const p of patterns) {
      if (t === p || t.startsWith(p + ' ') || t.endsWith(' ' + p)) {
        return { intent: 'navigate', route, target: phrase };
      }
    }
  }

  // Save intents
  if (/\b(save|सेव|बचाओ)\b/.test(t)) return { intent: 'save' };

  // Print intents
  if (/\b(print|प्रिंट|छापो)\b/.test(t)) return { intent: 'print' };

  // Clear / Reset / New
  if (/\b(clear|reset|new report|नई रिपोर्ट|हटाओ|clear form)\b/.test(t)) return { intent: 'clear' };

  // Search intents
  const searchMatch = t.match(/(?:search|find|look for|खोजो|ढूंढो)\s+(.+)/);
  if (searchMatch) return { intent: 'search', query: searchMatch[1].trim() };

  // Patient name
  const nameMatch = t.match(/(?:patient\s*(?:name)?|name|मरीज\s*(?:का\s*)?नाम)\s*(?:is\s*|hai\s*|है\s*)?(.+)/i);
  if (nameMatch) return { intent: 'set_field', field: 'patient_name', value: nameMatch[1].trim() };

  // Age
  const ageMatch = t.match(/(?:age|उम्र|आयु)\s*(?:is\s*|hai\s*|है\s*)?\s*(\d+)/i);
  if (ageMatch) return { intent: 'set_field', field: 'age', value: ageMatch[1] };

  // Gender
  if (/\b(female|महिला|woman|lady|स्त्री)\b/i.test(t)) return { intent: 'set_field', field: 'gender', value: 'Female' };
  if (/\b(male|पुरुष|man|gent)\b/i.test(t)) return { intent: 'set_field', field: 'gender', value: 'Male' };

  // Specimen
  const specMatch = t.match(/(?:specimen|sample|नमूना)\s*(?:is\s*)?\s*(blood|urine|serum|stool|sputum|csf|plasma|swab|खून|पेशाब)/i);
  if (specMatch) return { intent: 'set_field', field: 'specimen', value: specMatch[1].toUpperCase() };

  // Referred by
  const refMatch = t.match(/(?:referred?\s*by|doctor|डॉक्टर)\s+(.+)/i);
  if (refMatch) return { intent: 'set_field', field: 'referred_by', value: refMatch[1].trim() };

  // Filter intents (Reports page)
  if (/\b(completed|complete|पूरे)\b/.test(t) && /\b(show|filter|only|सिर्फ)\b/.test(t)) return { intent: 'filter', value: 'Completed' };
  if (/\b(pending|अधूरे)\b/.test(t) && /\b(show|filter|only|सिर्फ)\b/.test(t)) return { intent: 'filter', value: 'Pending' };
  if (/\b(show all|all reports|सब|clear filter)\b/.test(t)) return { intent: 'filter', value: 'All' };

  // Today / History (Doctor dashboard)
  if (/\b(today|आज)\b/.test(t) && /\b(report|show|दिखाओ)\b/.test(t)) return { intent: 'view_tab', value: 'today' };
  if (/\b(history|purane|पुराने|all)\b/.test(t) && /\b(report|show|दिखाओ)\b/.test(t)) return { intent: 'view_tab', value: 'history' };

  // Help
  if (/\b(help|मदद|what can you do|commands)\b/.test(t)) return { intent: 'help' };

  // Hello / greeting
  if (/^(hi|hello|hey|namaste|नमस्ते|हेलो)\b/.test(t)) return { intent: 'greet' };

  // Thank you
  if (/\b(thank|thanks|धन्यवाद|शुक्रिया)\b/.test(t)) return { intent: 'thanks' };

  // Stop listening
  if (/\b(stop|रुको|बंद करो|that's all|bye|goodbye)\b/.test(t)) return { intent: 'stop' };

  return { intent: 'unknown', text };
}

export function VoiceProvider({ children }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [language, setLanguage] = useState('en-IN');
  const [supported] = useState(!!SpeechRecognition);
  const [conversation, setConversation] = useState([]); // {role: 'user'|'assistant', text}
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const commandHandlersRef = useRef(new Map());
  const navigateRef = useRef(null);
  const locationRef = useRef(null);
  const ttsVoiceRef = useRef(null);
  const { addToast } = useToast();

  // Pick a good TTS voice
  useEffect(() => {
    const pickVoice = () => {
      const voices = synth?.getVoices() || [];
      // Prefer a female English-Indian or English voice
      ttsVoiceRef.current =
        voices.find(v => v.lang === 'en-IN' && v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.lang === 'en-IN') ||
        voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0] || null;
    };
    pickVoice();
    synth?.addEventListener?.('voiceschanged', pickVoice);
    return () => synth?.removeEventListener?.('voiceschanged', pickVoice);
  }, []);

  // ── Text-to-Speech ──
  const speak = useCallback((text) => {
    if (!synth || !text) return;
    synth.cancel(); // stop previous
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = ttsVoiceRef.current;
    utter.lang = language === 'hi-IN' ? 'hi-IN' : 'en-IN';
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    synth.speak(utter);
  }, [language]);

  // Add to conversation log
  const addMessage = useCallback((role, text) => {
    setConversation(prev => [...prev.slice(-19), { role, text, ts: Date.now() }]);
  }, []);

  // Register page-specific handlers
  const registerCommands = useCallback((pageId, handler) => {
    commandHandlersRef.current.set(pageId, handler);
    return () => commandHandlersRef.current.delete(pageId);
  }, []);

  // ── Process speech ──
  const processCommand = useCallback((text) => {
    const raw = text.trim();
    if (!raw) return;
    addMessage('user', raw);

    const intent = detectIntent(raw);

    switch (intent.intent) {
      case 'navigate': {
        navigateRef.current?.(intent.route);
        const reply = `Opening ${intent.target}`;
        speak(reply);
        addMessage('assistant', reply);
        return;
      }

      case 'greet': {
        const reply = 'Hello! I am your lab assistant. You can tell me to create reports, search patients, print, or navigate anywhere. How can I help?';
        speak(reply);
        addMessage('assistant', reply);
        return;
      }

      case 'help': {
        const reply = 'You can say things like: Patient name Rajesh Kumar, age 45, male, print, save, go to reports, search hemoglobin, or show today reports. I understand both English and Hindi.';
        speak(reply);
        addMessage('assistant', reply);
        return;
      }

      case 'thanks': {
        const reply = 'You\'re welcome! Let me know if you need anything else.';
        speak(reply);
        addMessage('assistant', reply);
        return;
      }

      case 'stop': {
        const reply = 'Okay, stopping voice assistant. Click the mic to start again.';
        speak(reply);
        addMessage('assistant', reply);
        setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
          }
          setListening(false);
        }, 1500);
        return;
      }

      case 'save':
      case 'print':
      case 'clear':
      case 'search':
      case 'set_field':
      case 'filter':
      case 'view_tab': {
        // Try page-specific handlers
        const handlers = Array.from(commandHandlersRef.current.values()).reverse();
        for (const handler of handlers) {
          const result = handler(intent, raw);
          if (result) {
            const reply = typeof result === 'string' ? result : `Done`;
            speak(reply);
            addMessage('assistant', reply);
            return;
          }
        }
        // Fallback responses
        if (intent.intent === 'save') {
          const reply = 'There is nothing to save right now. Go to quick report first.';
          speak(reply);
          addMessage('assistant', reply);
        } else if (intent.intent === 'print') {
          const reply = 'There is nothing to print right now. Open a report first.';
          speak(reply);
          addMessage('assistant', reply);
        } else if (intent.intent === 'set_field') {
          const reply = `I heard ${intent.field} ${intent.value}, but you need to be on the quick report page. Say "go to quick report".`;
          speak(reply);
          addMessage('assistant', reply);
        } else {
          const reply = `I can't do that on this page. Try navigating first.`;
          speak(reply);
          addMessage('assistant', reply);
        }
        return;
      }

      default: {
        const reply = `I heard "${raw}" but I'm not sure what to do. Say "help" to see what I can do.`;
        speak(reply);
        addMessage('assistant', reply);
      }
    }
  }, [speak, addMessage]);

  // ── Speech recognition ──
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      addToast('Speech recognition not supported in this browser', 'error');
      return;
    }
    if (recognitionRef.current) recognitionRef.current.stop();

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setTranscript('');
      setInterimTranscript('');
      const greeting = 'Hi, I\'m listening. How can I help?';
      speak(greeting);
      addMessage('assistant', greeting);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (interim) setInterimTranscript(interim);
      if (final) {
        setTranscript(final);
        setInterimTranscript('');
        processCommand(final);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        addToast('Microphone access denied. Please allow microphone.', 'error');
        speak('I need microphone access to help you. Please allow it in your browser.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
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
  }, [language, processCommand, addToast, speak, addMessage]);

  const stopListening = useCallback(() => {
    synth?.cancel();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
    setInterimTranscript('');
    setSpeaking(false);
  }, []);

  const toggleListening = useCallback(() => {
    listening ? stopListening() : startListening();
  }, [listening, startListening, stopListening]);

  const toggleLanguage = useCallback(() => {
    const newLang = language === 'en-IN' ? 'hi-IN' : 'en-IN';
    setLanguage(newLang);
    const msg = newLang === 'hi-IN' ? 'Hindi mode activated. Ab aap Hindi mein baat kar sakte hain.' : 'Switched to English mode.';
    speak(msg);
    addMessage('assistant', msg);
    if (listening) {
      stopListening();
      setTimeout(() => startListening(), 600);
    }
  }, [language, listening, stopListening, startListening, speak, addMessage]);

  const clearConversation = useCallback(() => setConversation([]), []);

  useEffect(() => {
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); synth?.cancel(); };
  }, []);

  return (
    <VoiceContext.Provider value={{
      listening, transcript, interimTranscript, language, supported, speaking, conversation,
      startListening, stopListening, toggleListening, toggleLanguage, clearConversation,
      registerCommands, speak, addMessage,
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
