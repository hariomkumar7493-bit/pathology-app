import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, X, Languages, Trash2, ChevronDown } from 'lucide-react';
import { useVoice } from '../context/VoiceContext';

export default function VoiceAssistant() {
  const {
    listening, speaking, transcript, interimTranscript, language, supported,
    conversation, toggleListening, toggleLanguage, clearConversation,
    setNavigate, setLocation,
  } = useVoice();
  const [showPanel, setShowPanel] = useState(false);
  const chatEndRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setNavigate(navigate); setLocation(location); }, [navigate, location, setNavigate, setLocation]);

  // Show panel when listening starts
  useEffect(() => { if (listening) setShowPanel(true); }, [listening]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, interimTranscript]);

  if (!supported) return null;

  return (
    <>
      {/* Chat Panel */}
      {showPanel && (
        <div className="fixed bottom-20 right-4 z-[9998] w-96 max-w-[calc(100vw-2rem)]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col" style={{ maxHeight: '70vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 rounded-t-2xl">
              <div className="flex items-center gap-2">
                {/* Animated waveform when listening/speaking */}
                <div className="flex items-end gap-0.5 h-4">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`w-0.5 rounded-full transition-all duration-150 ${
                        listening || speaking ? 'bg-white animate-pulse' : 'bg-white/40'
                      }`}
                      style={{
                        height: listening || speaking ? `${8 + Math.sin((Date.now() / 200) + i) * 8}px` : '4px',
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-white">
                  {speaking ? 'Speaking...' : listening ? 'Listening...' : 'Lab Assistant'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggleLanguage} className="px-2 py-0.5 text-xs bg-white/20 hover:bg-white/30 rounded text-white font-medium" title="Switch language">
                  {language === 'en-IN' ? 'EN' : 'HI'}
                </button>
                <button onClick={clearConversation} className="p-1 hover:bg-white/20 rounded" title="Clear chat">
                  <Trash2 className="w-3.5 h-3.5 text-white/70" />
                </button>
                <button onClick={() => setShowPanel(false)} className="p-1 hover:bg-white/20 rounded">
                  <ChevronDown className="w-4 h-4 text-white/70" />
                </button>
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px] max-h-[50vh]">
              {conversation.length === 0 && !listening && (
                <div className="text-center py-4 text-gray-400 text-xs space-y-2">
                  <p className="text-sm font-medium text-gray-500">Hi, I'm your lab assistant!</p>
                  <p>Click the mic and talk to me. Try saying:</p>
                  <div className="space-y-1 text-left bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mt-2">
                    <p className="text-gray-600 dark:text-gray-300">"Go to quick report"</p>
                    <p className="text-gray-600 dark:text-gray-300">"Patient name Rajesh Kumar"</p>
                    <p className="text-gray-600 dark:text-gray-300">"Age 45, Male"</p>
                    <p className="text-gray-600 dark:text-gray-300">"Print" or "Save"</p>
                    <p className="text-gray-600 dark:text-gray-300">"Search hemoglobin"</p>
                  </div>
                </div>
              )}
              {conversation.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white rounded-br-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {interimTranscript && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm bg-primary-200 text-primary-800 rounded-br-sm italic">
                    {interimTranscript}...
                  </div>
                </div>
              )}
              {listening && !interimTranscript && conversation.length > 0 && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl bg-gray-100 dark:bg-gray-700 rounded-bl-sm flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Floating mic button */}
      <button
        onClick={toggleListening}
        className={`fixed bottom-4 right-4 z-[9998] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          listening
            ? 'bg-red-500 hover:bg-red-600 text-white scale-110'
            : 'bg-primary-600 hover:bg-primary-700 text-white hover:scale-105'
        }`}
        title={listening ? 'Stop listening' : 'Start voice assistant'}
      >
        {/* Pulse ring when listening */}
        {listening && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
            <span className="absolute inset-[-4px] rounded-full border-2 border-red-300 animate-pulse" />
          </>
        )}
        {listening ? <MicOff className="w-6 h-6 relative z-10" /> : <Mic className="w-6 h-6" />}
      </button>

      {/* Small badge to reopen panel */}
      {!showPanel && conversation.length > 0 && !listening && (
        <button
          onClick={() => setShowPanel(true)}
          className="fixed bottom-[72px] right-4 z-[9997] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 shadow-md text-xs text-gray-500 hover:text-primary-600 transition-colors"
        >
          Show chat
        </button>
      )}
    </>
  );
}
