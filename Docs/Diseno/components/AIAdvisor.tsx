import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Sparkles, Send, Bot, User, Trash2, HelpCircle } from 'lucide-react';

export default function AIAdvisor() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init_msg',
      sender: 'assistant',
      text: '¡Hola! Bienvenido a Jygasoft Energy. Soy tu Asesor Solar Inteligente. Te puedo ayudar a calcular tu retorno de inversión, explicarte las tarifas de CFE (como la DAC), y detallarte el trámite de interconexión. ¿Cuál es tu consulta de hoy?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sampleQuestions = [
    '¿Qué es la tarifa DAC de CFE y cómo me afecta?',
    '¿Cómo funciona la interconexión bidireccional?',
    '¿Tienen garantía de 25 años en México?',
    '¿Vale la pena instalar paneles en Monterrey o CDMX?'
  ];

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-10) // Send the last 10 messages for conversation context
        }),
      });

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: data.text,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: 'Disculpa, tenemos una pequeña interrupción en la red. Sin embargo, recuerda que Jygasoft tiene cobertura nacional en México, garantizando 25 años de rendimiento y reduciendo tu consumo CFE en hasta un 90%.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  const handleClearChat = () => {
    if (window.confirm('¿Quieres reiniciar la conversación con nuestro asesor de IA?')) {
      setMessages([
        {
          id: 'init_msg_restart',
          sender: 'assistant',
          text: 'Entendido. He reiniciado la consulta. ¿Qué te gustaría calcular o saber sobre nuestros sistemas de energía solar con CFE?',
          timestamp: new Date()
        }
      ]);
    }
  };

  return (
    <div id="asesor-ia" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          
          {/* Info Side */}
          <div className="lg:col-span-4 flex flex-col justify-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[#206c3b]">Tecnología Inteligente</span>
            <h2 className="text-4xl font-extrabold text-[#002612] tracking-tight mt-3">
              Asistente Solar Inteligente IA
            </h2>
            <p className="text-stone-600 mt-4 leading-relaxed font-light">
              Nuestra inteligencia artificial está entrenada directamente por ingenieros expertos en la regulación mexicana de energía renovable.
            </p>
            <p className="text-stone-600 mt-3 leading-relaxed font-light">
              Pregúntale sobre deducciones fiscales (LISR Art. 34), requisitos de CFE, tarifas industriales o tipos de celdas monocristalinas que utilizamos.
            </p>

            <div className="mt-8 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-500 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#206c3b]" />
                Preguntas sugeridas:
              </h4>
              <div className="flex flex-wrap gap-2">
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q)}
                    className="text-left text-xs bg-[#f8faf9] hover:bg-[#eceeed] hover:text-[#002612] text-stone-700 font-medium py-2 px-3 rounded-lg border border-stone-200 transition-all duration-200 cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Interactive Chat GUI */}
          <div className="lg:col-span-8 flex flex-col h-[550px] bg-[#f8faf9] rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            
            {/* Header */}
            <div className="bg-[#002612] p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#206c3b] flex items-center justify-center border border-white/20">
                  <Bot className="w-5 h-5 text-white animate-float" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                    Asesor Solar Jygasoft
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </h4>
                  <span className="text-[11px] text-stone-300 font-light block mt-0.5">CFE &amp; Renovables México - Activo</span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleClearChat}
                title="Reiniciar chat"
                className="p-2 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Conversation Flow Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-stone-50/50">
              {messages.map((m) => {
                const isAssistant = m.sender === 'assistant';
                return (
                  <div
                    key={m.id}
                    className={`flex gap-3 max-w-[85%] ${
                      isAssistant ? 'mr-auto' : 'ml-auto flex-row-reverse'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                        isAssistant ? 'bg-[#206c3b] text-white' : 'bg-[#f5b301] text-stone-900'
                      }`}
                    >
                      {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>

                    <div
                      className={`rounded-2xl p-4 text-sm shadow-sm font-light leading-relaxed whitespace-pre-line ${
                        isAssistant
                          ? 'bg-white text-stone-800 rounded-tl-none border border-stone-100'
                          : 'bg-[#0f3d24] text-white rounded-tr-none'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex gap-3 max-w-[85%] mr-auto">
                  <div className="w-8 h-8 rounded-full bg-[#206c3b] text-white flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white text-stone-500 rounded-2xl rounded-tl-none p-4 text-sm border border-stone-100 shadow-sm flex items-center gap-2">
                    <span className="text-xs italic">Redactando consultoría solar...</span>
                    <span className="flex space-x-1">
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Submission Footer bar */}
            <form onSubmit={handleFormSubmit} className="p-4 bg-white border-t border-stone-200 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta algo como: ¿Cuánto tiempo tardan en instalar los paneles?"
                className="flex-1 px-4 py-3 rounded-xl bg-[#f8faf9] text-stone-800 placeholder-stone-400 text-sm border border-stone-200 focus:border-[#206c3b] outline-none transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-[#206c3b] hover:bg-[#164a28] disabled:bg-stone-300 text-white p-3.5 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
