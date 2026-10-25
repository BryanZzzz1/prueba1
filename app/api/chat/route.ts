import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const vercelGateway = createOpenAI({
    baseURL: 'https://ai-gateway.vercel.sh/v1',
    apiKey: process.env.AI_GATEWAY_API_KEY,
});

// ============================================================================
// 1. PRESETS MAESTROS (Se usan automáticamente cuando NO hay datos cargados)
// ============================================================================

const PRESET_IDENTIDAD_CLIENTE = `
Eres el Asesor Virtual oficial de **SuMateCL**, la tienda chilena especialista en mates artesanales, bombillas, termos y accesorios materos.
- **Tono y estilo:** Sumamente cordial, cercano, amable, claro y servicial.
- **Misión:** Guiar a los clientes por la tienda web, recomendar productos según el stock real, explicar cómo curar y cuidar sus mates, informar costos de envío y rastrear compras con código SM-XXXXXX.
`;

const PRESET_IDENTIDAD_INTERNO = `
Eres el Asistente Operativo interno de **GrowderWeb** (Administración y Bodega de SuMateCL).
- **Tono y estilo:** Ejecutivo, técnico, directo, estructurado y preciso.
- **Misión:** Asistir al personal interno en consultas rápidas de pedidos (SM-XXXXXX), verificación de inventario en tiempo real, protocolos de empaque, control de calidad y revisión de incidencias de bodega.
`;

const PRESET_CONOCIMIENTO_WEB = `
=== 🌐 CONOCIMIENTO BASE POR DEFECTO DE LA WEB (PRESET SUMATECL) ===
- **Despachos y Envíos:** Costo fijo de **$2.650 CLP** a todo Chile continental (vía Starken, Blue Express o transporte asignado). El plazo estimado de preparación es de 24 a 48 horas hábiles y la entrega toma entre 2 a 5 días hábiles según la región.
- **Precios e Impuestos:** Todos los precios publicados en la web están en Pesos Chilenos (CLP) e **incluyen IVA (19%)**.
- **Medios de Pago:** Aceptamos tarjetas de débito, crédito (vía Webpay Plus) y transferencia bancaria directa.
- **Seguimiento de Compras:** Todo pedido genera un código único con formato **SM-XXXXXX**. El cliente puede ver el detalle completo en la sección [Mis Compras](/mis-compras).
- **Garantía y Devoluciones:** Si un producto llega con fallas de fábrica o daños de transporte, el cliente puede reportarlo dentro de los primeros 10 días desde la recepción para gestionar cambio o reembolso.
- **Consejo Matero (Curado de mates):** Para mates de calabaza natural, se recomienda llenarlo con yerba húmeda (usada) y agua tibia durante 24 horas, raspar suavemente el interior con una cuchara para retirar el hollejo leñoso y repetir el proceso 2 veces antes del primer uso. Los mates de acero inoxidable, vidrio o cerámica no requieren curado.
`;

// Textos cortos que vienen por defecto en el placeholder de la UI
const TEXTO_DEFAULT_UI_CLIENTE = 'Eres el Asesor Virtual de SuMateCL. Atiende dudas sobre mates, bombillas, envíos ($2.650 CLP) e IVA 19%.';
const TEXTO_DEFAULT_UI_INTERNO = 'Eres el Asistente Operativo de GrowderWeb. Asistes en incidencias de calidad, empaque y pedidos SM-XXXXXX.';

export async function POST(req: Request) {
    const inicio = Date.now();
    console.log("\n=== 🟢 NUEVA PETICIÓN AL CHATBOT (Vercel AI Gateway) ===");

    try {
        const { messages, sessionToken, conversacionId } = await req.json();

        // Normalizar mensajes entrantes
        const mensajesNormalizados = messages
            .map((m: any) => {
                const textoPartes = Array.isArray(m.parts)
                    ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
                    : '';
                return {
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: typeof m.content === 'string' && m.content.trim() !== '' ? m.content : textoPartes,
                };
            })
            .filter((m: any) => m.content && m.content.trim() !== '');

        const ultimoMensajeTexto = mensajesNormalizados[mensajesNormalizados.length - 1]?.content || '';
        const ultimoMensajeLower = ultimoMensajeTexto.toLowerCase();

        // Detectores en tiempo real para pre-cargar base de datos
        const matchCodigo = ultimoMensajeTexto.match(/(?:sm-)?(\d{5,8})/i);
        const codigoDetectado = matchCodigo ? `SM-${matchCodigo[1]}` : null;
        const consultaCatalogo = /precio|cuesta|cuanto|cuánto|valor|mate|bombilla|termo|yerba|stock|producto|catalogo|catálogo|disponible|comprar|venden|recomienda|tipos/.test(ultimoMensajeLower);

        // Consultas en paralelo a Supabase
        const [authResult, configResult, docsResult, pedidoDirectoResult, catalogoResult] = await Promise.all([
            sessionToken ? supabase.auth.getUser(sessionToken) : Promise.resolve({ data: { user: null } }),
            supabase.from('chatbot_config').select('*').eq('id', 1).maybeSingle(),
            supabase.from('chatbot_documentos').select('titulo, contenido').eq('activo', true),
            codigoDetectado
                ? supabase
                    .from('pedidos')
                    .select('codigo_pedido, estado, comuna, region, direccion, empresa_transporte, numero_seguimiento, total')
                    .eq('codigo_pedido', codigoDetectado.toUpperCase())
                    .maybeSingle()
                : Promise.resolve({ data: null }),
            consultaCatalogo
                ? supabase
                    .from('producto')
                    .select('nombre, precio, cantidad, categoria, descripcion')
                    .eq('activo', true)
                    .limit(15)
                : Promise.resolve({ data: null }),
        ]);

        let rolId = 3; // 3 = Cliente
        const user = authResult.data?.user;

        if (user) {
            const { data: perfil } = await supabase
                .from('usuario')
                .select('rol_id')
                .eq('id', user.id)
                .maybeSingle();
            if (perfil) rolId = perfil.rol_id;
        }

        const esEquipoInterno = rolId === 1 || rolId === 2;
        const config = configResult.data;
        const docs = docsResult.data || [];

        // ====================================================================
        // 2. LÓGICA DE CONMUTACIÓN: ¿USAR CEREBRO DE IA O USAR PRESET BASE?
        // ====================================================================

        // A) Evaluamos si hay una identidad personalizada cargada en "Directrices de Comportamiento"
        const instruccionGuardada = esEquipoInterno
            ? config?.instrucciones_interno?.trim()
            : config?.instrucciones_cliente?.trim();

        const textoDefaultComparar = esEquipoInterno ? TEXTO_DEFAULT_UI_INTERNO : TEXTO_DEFAULT_UI_CLIENTE;

        // Si el admin escribió instrucciones personalizadas (distintas al texto vacío o al placeholder inicial), usamos las del Cerebro de IA. Si no, usamos el Preset.
        const tienePersonalidadCustom = Boolean(
            instruccionGuardada &&
            instruccionGuardada.length > 0 &&
            instruccionGuardada !== textoDefaultComparar
        );

        const bloqueIdentidad = tienePersonalidadCustom
            ? `=== 🧠 DIRECTRICES DE COMPORTAMIENTO (CEREBRO DE IA ACTIVO) ===\n${instruccionGuardada}`
            : `=== 🤖 DIRECTRICES DE COMPORTAMIENTO (PRESET AUTOMÁTICO) ===\n${esEquipoInterno ? PRESET_IDENTIDAD_INTERNO : PRESET_IDENTIDAD_CLIENTE}`;

        // B) Evaluamos si hay documentos cargados en "Base de Conocimiento"
        const tieneDocumentosCargados = docs.length > 0;

        // Si hay documentos activos en Cerebro de IA, rigen esos documentos; si hay 0 documentos, rige el Preset de la web.
        const bloqueConocimiento = tieneDocumentosCargados
            ? `\n\n=== 📚 BASE DE CONOCIMIENTO OFICIAL (DOCUMENTOS CARGADOS EN CEREBRO DE IA) ===\nUsa prioritariamente esta información cargada por el administrador para responder:\n` +
            docs.map(d => `### ${d.titulo}\n${d.contenido}`).join('\n\n') +
            `\n\n(Datos complementarios de respaldo: Envío estándar $2.650 CLP, precios incluyen IVA 19%, sección de pedidos en /mis-compras).`
            : `\n\n${PRESET_CONOCIMIENTO_WEB}`;

        // ====================================================================
        // 3. INYECCIÓN DE DATOS EN TIEMPO REAL (PEDIDOS Y STOCK DE PRODUCTOS)
        // ====================================================================
        let datosTiempoReal = '';

        if (codigoDetectado) {
            const p = pedidoDirectoResult.data;
            if (p) {
                datosTiempoReal += `\n\n=== 📦 DATOS REALES DEL PEDIDO CONSULTADO (${p.codigo_pedido}) ===
Responde al usuario con este formato exacto de lista con viñetas:
¡Aquí tienes el estado actualizado de tu compra! 🧉
- 📦 **Pedido:** ${p.codigo_pedido}
- 🔄 **Estado:** ${String(p.estado).toUpperCase()}
- 📍 **Destino:** ${p.comuna}, ${p.region}
- 🚚 **Transporte:** ${p.empresa_transporte || 'En preparación en bodega'}
- 🔢 **Seguimiento:** ${p.numero_seguimiento || 'Pendiente de asignación'}
- 💰 **Total pagado:** $${Number(p.total).toLocaleString('es-CL')} CLP

[Ver detalle completo en Mis Compras](/mis-compras)`;
            } else {
                datosTiempoReal += `\n\n=== 📦 RESULTADO DE BÚSQUEDA DE PEDIDO ===
Se buscó el código ${codigoDetectado} en la base de datos y NO existe. Indícale con mucha cordialidad al usuario que verifique si escribió bien el código o que revise sus compras directamente aquí:
[Ir a Mis Compras](/mis-compras)`;
            }
        }

        if (catalogoResult.data && catalogoResult.data.length > 0) {
            datosTiempoReal += `\n\n=== 🧉 CATÁLOGO EN TIEMPO REAL (STOCK ACTUAL EN BASE DE DATOS) ===\n` +
                catalogoResult.data.map((prod: any) =>
                    `- **${prod.nombre}** (${prod.categoria}): **$${Number(prod.precio).toLocaleString('es-CL')} CLP** | Stock: ${prod.cantidad > 0 ? `${prod.cantidad} disponibles` : 'Agotado'} | ${prod.descripcion?.slice(0, 90) || ''}`
                ).join('\n');
        }

        // ====================================================================
        // 4. REGLAS ESTRICTAS DE DOMINIO (SIEMPRE ACTIVAS)
        // ====================================================================
        const candadoTematico = `
=== 🛡️ REGLAS DE EXCLUSIVIDAD DE DOMINIO Y CORDIALIDAD ===
1. ÁMBITO EXCLUSIVO: Solo puedes responder consultas vinculadas a **SuMateCL / GrowderWeb**, nuestro catálogo de mates, bombillas, termos, accesorios, cultura/cuidado del mate, precios, stock, rastreo de pedidos (SM-XXXXXX), envíos, pagos y uso de la web/app.
2. BLOQUEO CORDIAL DE OTROS TEMAS: Si el usuario pregunta sobre cualquier tema ajeno a la tienda (matemáticas, historia, programación, política, recetas de comida, deportes, chistes, etc.), **nunca respondas a esa consulta**. En su lugar, contesta siempre con mucha amabilidad:
   "¡Hola! 🧉 Te agradezco la consulta, pero como asistente exclusivo de **SuMateCL**, solo estoy programado para ayudarte con información de nuestra tienda, productos, envíos o el estado de tus pedidos. ¿Te gustaría ver nuestros mates disponibles o rastrear una compra?"
3. VERACIDAD: Nunca inventes precios, productos ni estados de pedidos que no estén en la base de datos.`;

        const systemPromptFinal = `${bloqueIdentidad}${candadoTematico}${bloqueConocimiento}${datosTiempoReal}`;

        // Herramienta de respaldo por si el código viene en otro turno
        const tools = {
            consultarEstadoPedido: tool({
                description: 'Consulta el estado de un pedido SM-XXXXXX en la base de datos.',
                inputSchema: z.object({
                    codigoPedido: z.string().describe('Código del pedido (ej. SM-649741)'),
                }),
                execute: async ({ codigoPedido }) => {
                    const limpio = String(codigoPedido).replace(/#/g, '').toUpperCase().trim();
                    const codigoFinal = limpio.startsWith('SM-') ? limpio : `SM-${limpio}`;

                    const { data: pedido } = await supabase
                        .from('pedidos')
                        .select('codigo_pedido, estado, comuna, region, empresa_transporte, numero_seguimiento, total')
                        .eq('codigo_pedido', codigoFinal)
                        .maybeSingle();

                    if (!pedido) return `No se encontró el pedido ${codigoFinal}. [Ir a Mis Compras](/mis-compras)`;

                    return `Pedido ${pedido.codigo_pedido}: Estado "${pedido.estado}", Destino: ${pedido.comuna}, ${pedido.region}. Transporte: ${pedido.empresa_transporte || 'En preparación'}. Seguimiento: ${pedido.numero_seguimiento || 'Pendiente'}. Total: $${Number(pedido.total).toLocaleString('es-CL')} CLP. [Ver detalle completo en Mis Compras](/mis-compras)`;
                },
            }),
        };

        console.log(
            `👉 [+${Date.now() - inicio}ms] Modo Identidad: ${tienePersonalidadCustom ? 'CEREBRO_IA' : 'PRESET_DEFAULT'} | ` +
            `Modo Conocimiento: ${tieneDocumentosCargados ? `CEREBRO_IA (${docs.length} docs)` : 'PRESET_DEFAULT'}`
        );

        const result = streamText({
            model: vercelGateway('gpt-4o-mini'),
            system: systemPromptFinal,
            temperature: config?.temperatura ? Number(config.temperatura) : 0.5,
            maxOutputTokens: 550,
            messages: mensajesNormalizados as any,
            tools: !codigoDetectado && !consultaCatalogo ? tools : undefined,
            stopWhen: stepCountIs(5),
            onFinish: async ({ text }) => {
                if (conversacionId && text) {
                    try {
                        await supabase.from('chatbot_mensajes').insert([
                            { conversacion_id: conversacionId, rol: 'user', contenido: ultimoMensajeTexto },
                            { conversacion_id: conversacionId, rol: 'assistant', contenido: text },
                        ]);
                    } catch (e) {
                        console.error("⚠️ Excepción al persistir historial:", e);
                    }
                }
            },
        });

        return result.toUIMessageStreamResponse();

    } catch (error) {
        console.error("\n❌ ERROR GRAVE EN EL BACKEND:", error);
        return new Response(JSON.stringify({ error: "Fallo en el servidor" }), { status: 500 });
    }
}