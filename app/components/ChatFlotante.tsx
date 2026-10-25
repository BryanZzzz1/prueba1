'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { MessageSquare, X, Send, Bot, Package, HelpCircle, Truck, ExternalLink, Sparkles } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import Link from 'next/link';

const MENSAJE_BIENVENIDA: UIMessage = {
    id: 'mensaje-bienvenida-inicial',
    role: 'assistant',
    parts: [
        {
            type: 'text',
            text: '¡Hola! 🧉 Bienvenido a **SuMateCL**. Soy tu asistente virtual.\n\nPuedo ayudarte a:\n- 📦 Rastrear tu compra con tu código **SM-XXXXXX**\n- 🧉 Buscar mates, bombillas y precios en stock\n- 🚚 Resolver dudas de envíos (**$2.650** a todo Chile)\n\n¿En qué te ayudo hoy?',
        },
    ],
};

// Renderiza negritas (**texto**) y enlaces ([texto](url)) dentro de una línea
function renderizarLineaEnriquecida(linea: string, keyPrefix: string) {
    const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*)/g;
    const elementos: React.ReactNode[] = [];
    let ultimoIndice = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(linea)) !== null) {
        if (match.index > ultimoIndice) {
            elementos.push(linea.substring(ultimoIndice, match.index));
        }

        if (match[2] && match[3]) {
            elementos.push(
                <Link
                    key={`${keyPrefix}-link-${match.index}`}
                    href={match[3]}
                    className="mt-2.5 flex items-center justify-center gap-2 w-full bg-[#314235] hover:bg-[#253328] text-white font-medium px-3.5 py-2 rounded-xl shadow-xs transition-all text-xs"
                >
                    <span>{match[2]}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                </Link>
            );
        } else if (match[4]) {
            elementos.push(
                <strong key={`${keyPrefix}-bold-${match.index}`} className="font-semibold text-stone-900">
                    {match[4]}
                </strong>
            );
        }

        ultimoIndice = regex.lastIndex;
    }

    if (ultimoIndice < linea.length) {
        elementos.push(linea.substring(ultimoIndice));
    }

    return elementos.length > 0 ? elementos : linea;
}

// Formatea el mensaje completo separando párrafos y listas con viñetas
function formatearMensajeRico(texto: string, esUsuario: boolean): React.ReactNode {
    if (esUsuario) return texto;

    const lineas = texto.split('\n');

    return (
        <div className="space-y-1.5">
            {lineas.map((linea, idx) => {
                const limpia = linea.trim();
                if (!limpia) return <div key={idx} className="h-1" />;

                if (limpia.startsWith('- ') || limpia.startsWith('• ')) {
                    const contenidoLista = limpia.substring(2);
                    return (
                        <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
                            <span className="text-emerald-700 font-bold mt-0.5">•</span>
                            <div className="flex-1 leading-snug">
                                {renderizarLineaEnriquecida(contenidoLista, `line-${idx}`)}
                            </div>
                        </div>
                    );
                }

                return (
                    <div key={idx} className="leading-relaxed">
                        {renderizarLineaEnriquecida(limpia, `line-${idx}`)}
                    </div>
                );
            })}
        </div>
    );
}

export default function ChatFlotante() {
    const [abierto, setAbierto] = useState(false);
    const [input, setInput] = useState('');
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [conversacionId, setConversacionId] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSessionToken(data.session?.access_token || null));
        const { data: authListener } = supabase.auth.onAuthStateChange((_, session) =>
            setSessionToken(session?.access_token || null)
        );

        let convId = sessionStorage.getItem('sumate_chat_conv_id');
        if (!convId) {
            convId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `conv-${Date.now()}`;
            sessionStorage.setItem('sumate_chat_conv_id', convId);
        }
        setConversacionId(convId);

        return () => authListener.subscription.unsubscribe();
    }, []);

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: '/api/chat',
                body: () => ({
                    sessionToken: sessionToken ?? '',
                    conversacionId,
                }),
            }),
        [sessionToken, conversacionId]
    );

    const { messages, sendMessage, status } = useChat({
        transport,
    });

    const mensajesAMostrar = useMemo(() => {
        if (messages.length === 0) return [MENSAJE_BIENVENIDA];
        return messages;
    }, [messages]);

    const isLoading = status === 'submitted' || status === 'streaming';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const texto = input.trim();
        if (!texto || isLoading) return;
        sendMessage({ text: texto });
        setInput('');
    };

    const handleQuickQuestion = (texto: string) => {
        if (isLoading) return;
        sendMessage({ text: texto });
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [mensajesAMostrar, isLoading]);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {!abierto && (
                <button
                    onClick={() => setAbierto(true)}
                    className="flex items-center gap-2.5 bg-[#314235] hover:bg-[#253328] text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-sm font-medium">Asistente SuMate</span>
                </button>
            )}

            {abierto && (
                <div className="w-[380px] h-[560px] bg-white border border-stone-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="bg-[#314235] text-white px-4 py-3.5 flex items-center justify-between shadow-sm">
                        <div className="flex gap-2.5 items-center">
                            <div className="w-8 h-8 rounded-full bg-emerald-900/60 border border-emerald-400/30 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <span className="font-semibold text-sm block leading-tight">SuMate Bot</span>
                                <span className="text-[11px] text-emerald-300 font-normal flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    En línea • Soporte Oficial
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setAbierto(false)}
                            className="hover:bg-white/10 rounded-lg transition-colors p-1.5"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Área de Mensajes */}
                    <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#f8f3e9]/40">
                        {mensajesAMostrar.map((m: UIMessage) => {
                            const textoVisible = m.parts
                                ? m.parts
                                    .filter((part: any) => part.type === 'text' && typeof part.text === 'string')
                                    .map((part: any) => part.text)
                                    .join('')
                                    .trim()
                                : typeof (m as any).content === 'string'
                                    ? (m as any).content.trim()
                                    : '';

                            if (!textoVisible && m.role === 'assistant') {
                                return null;
                            }

                            const esUsuario = m.role === 'user';

                            return (
                                <div key={m.id} className={`flex gap-2 ${esUsuario ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[88%] px-4 py-3 rounded-2xl text-[13.5px] shadow-xs ${esUsuario
                                                ? 'bg-[#314235] text-white rounded-br-xs font-medium'
                                                : 'bg-white border border-stone-200/90 text-stone-700 rounded-bl-xs'
                                            }`}
                                    >
                                        {formatearMensajeRico(textoVisible, esUsuario)}
                                    </div>
                                </div>
                            );
                        })}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-stone-200 text-stone-500 text-xs px-3.5 py-2.5 rounded-2xl rounded-bl-xs flex items-center gap-2 shadow-2xs">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                                    <span>Consultando en SuMateCL...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Botones de acción rápida */}
                    <div className="px-3 py-2 bg-stone-50 border-t border-stone-200/70 flex gap-1.5 overflow-x-auto no-scrollbar">
                        <button
                            type="button"
                            onClick={() => handleQuickQuestion('¿Cómo puedo rastrear mi pedido?')}
                            className="text-[11px] bg-white border border-stone-200 hover:border-[#314235] hover:bg-emerald-50/40 text-stone-700 px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 transition-colors"
                        >
                            <Package className="w-3 h-3 text-[#314235]" />
                            Rastrear pedido
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickQuestion('¿Cuánto cuesta el despacho?')}
                            className="text-[11px] bg-white border border-stone-200 hover:border-[#314235] hover:bg-emerald-50/40 text-stone-700 px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 transition-colors"
                        >
                            <Truck className="w-3 h-3 text-[#314235]" />
                            Envíos ($2.650)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickQuestion('¿Qué mates tienen disponibles y qué precios tienen?')}
                            className="text-[11px] bg-white border border-stone-200 hover:border-[#314235] hover:bg-emerald-50/40 text-stone-700 px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 transition-colors"
                        >
                            <HelpCircle className="w-3 h-3 text-[#314235]" />
                            Ver mates
                        </button>
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-stone-200 flex gap-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe tu consulta o código SM-..."
                            className="flex-1 border border-stone-300 rounded-xl px-3.5 py-2 outline-none focus:border-[#314235] focus:ring-1 focus:ring-[#314235] text-sm"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="bg-[#314235] disabled:opacity-50 text-white p-2.5 rounded-xl hover:bg-[#253328] transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}