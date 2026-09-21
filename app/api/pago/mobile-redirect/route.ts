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
  const formData = await request.formData();
  const token_ws = formData.get('token_ws');
  const tbk_token = formData.get('TBK_TOKEN');

  let targetUrl = '';

  if (tbk_token) {
    targetUrl = `suemate://pago/fracaso?motivo=cancelado_webpay`;
  } else if (token_ws) {
    targetUrl = `suemate://pago/exito?token_ws=${token_ws}&metodo=webpay`;
  } else {
    targetUrl = `suemate://pago/fracaso?motivo=error_desconocido`;
  }

  // Redirección infalible por HTML/JS para evadir el bloqueo de Android
  const html = `
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
        <p>Redirigiendo a la aplicación...</p>
        <script>
          window.location.href = "${targetUrl}";
        </script>
      </body>
    </html>
  `;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}