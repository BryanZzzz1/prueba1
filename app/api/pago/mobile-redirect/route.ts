import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orden = searchParams.get('orden');
  const monto = searchParams.get('monto');
  const status = searchParams.get('status'); 

  if (status === 'approved') {
    return NextResponse.redirect(`suemate://pago/exito?orden=${orden}&monto=${monto}&metodo=mercadopago`, 303);
  } else {
    return NextResponse.redirect(`suemate://pago/fracaso?motivo=${status}`, 303);
  }
}

export async function POST(request: Request) {
  // Leemos como texto puro para evitar errores de parseo de Next.js con Webpay
  const bodyText = await request.text();
  const params = new URLSearchParams(bodyText);
  const token_ws = params.get('token_ws');
  const tbk_token = params.get('TBK_TOKEN');

  let targetUrl = '';

  if (tbk_token) {
    targetUrl = `suemate://pago/fracaso?motivo=cancelado_webpay`;
  } else if (token_ws) {
    targetUrl = `suemate://pago/exito?token_ws=${token_ws}&metodo=webpay`;
  } else {
    targetUrl = `suemate://pago/fracaso?motivo=error_desconocido`;
  }

  // Plantilla HTML a prueba de bloqueos de Android con botón de respaldo
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Confirmando Pago...</title>
        <meta http-equiv="refresh" content="0;url=${targetUrl}">
        <style>
          body { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; background: #f8f3e9; margin: 0; text-align: center; padding: 20px;}
          .btn { margin-top: 20px; padding: 15px 30px; background: #314235; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h2 { color: #111827; }
          p { color: #4b5563; }
        </style>
      </head>
      <body>
        <h2>Procesando tu pago...</h2>
        <p>Estamos validando la transacción con Webpay.</p>
        <p>Si la aplicación no se abre automáticamente, presiona el botón de abajo.</p>
        <a href="${targetUrl}" class="btn" id="redirectBtn">Volver a SuMateCL</a>
        <script>
          setTimeout(() => {
            document.getElementById('redirectBtn').click();
            window.location.href = "${targetUrl}";
          }, 800);
        </script>
      </body>
    </html>
  `;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}