import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, X, Languages } from 'lucide-react';
import { useVoice } from '../context/VoiceContext';

export default function VoiceAssistant() {
  const {
    listening, transcript, interimTranscript, language, supported,
    toggleListening, toggleLanguage, setNavigate, setLocation,
  } = useVoice();
  const [showPanel, setShowPanel] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Pass navigate/location to voice context
  useEffect(() => {
    setNavigate(navigate);
    setLocation(location);
  }, [navigate, location, setNavigate, setLocation]);

  // Auto-show panel when listening starts
  useEffect(() => {
    if (listening) setShowPanel(true);
  }, [listening]);

  // Auto-hide panel 3s after listening stops
  useEffect(() => {
    if (!listening && showPanel) {
      const timer = setTimeout(() => setShowPanel(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [listening, showPanel]);

  if (!supported) return null;

  return (
    <>
      {/* Transcript panel */}
      {showPanel && (
        <div className="fixed bottom-20 right-4 z-[9998] w-80 max-w-[calc(100vw-2rem)]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-primary-50 dark:bg-primary-900/30 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${listening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                  Voice Assistant
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleLanguage}
                  className="p-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1"
                  title="Switch language"
                >
                  <Languages className="w-3.5 h-3.5" />
                  {language === 'en-IN' ? 'EN' : 'HI'}
                </button>
                <button
                  onClick={() => setShowPanel(false)}
                  className="p-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 py-3 min-h-[60px] max-h-40 overflow-y-auto">
              {listening && !transcript && !interimTranscript && (
                <p className="text-sm text-gray-400 italic flex items-center gap-2">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  Listening...
                </p>
              )}
              {transcript && (
                <p className="text-sm text-gray-800 dark:text-gray-200">{transcript}</p>
              )}
              {interimTranscript && (
                <p className="text-sm text-gray-400 italic">{interimTranscript}</p>
              )}
              {!listening && !transcript && !interimTranscript && (
                <div className="text-xs text-gray-400 space-y-1">
                  <p className="font-medium text-gray-500">Voice commands:</p>
                  <p>"Go to quick report" - Navigate</p>
                  <p>"Patient name John" - Fill form</p>
                  <p>"Save" / "Print" - Actions</p>
                  <p>"Search hemoglobin" - Search</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating mic button */}
      <button
        onClick={toggleListening}
        className={`fixed bottom-4 right-4 z-[9998] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          listening
            ? 'bg-red-500 hover:bg-red-600 text-white scale-110 ring-4 ring-red-200 dark:ring-red-800'
            : 'bg-primary-600 hover:bg-primary-700 text-white hover:scale-105'
        }`}
        title={listening ? 'Stop listening' : 'Start voice assistant'}
      >
        {listening ? (
          <MicOff className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>
    </>
  );
}
