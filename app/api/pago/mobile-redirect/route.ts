import { NextResponse } from 'next/server';

// 1. Maneja Mercado Pago (que retorna vía GET)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orden = searchParams.get('orden');
  const monto = searchParams.get('monto');
  const status = searchParams.get('status'); 

  if (status === 'approved') {
    // Código 303 obliga a redirección segura hacia esquemas custom
    return NextResponse.redirect(`suemate://pago/exito?orden=${orden}&monto=${monto}&metodo=mercadopago`, 303);
  } else {
    return NextResponse.redirect(`suemate://pago/fracaso?motivo=${status}`, 303);
  }
}

// 2. Maneja Webpay (que retorna vía POST)
export async function POST(request: Request) {
  const formData = await request.formData();
  const token_ws = formData.get('token_ws');
  const tbk_token = formData.get('TBK_TOKEN');

  // Si existe TBK_TOKEN, significa que el usuario canceló el pago o la tarjeta fue rechazada
  if (tbk_token) {
    return NextResponse.redirect(`suemate://pago/fracaso?motivo=cancelado_webpay`, 303);
  }

  // Si existe token_ws, el usuario ingresó los datos y debemos ir a Ionic a CONFIRMAR el pago
  if (token_ws) {
    return NextResponse.redirect(`suemate://pago/exito?token_ws=${token_ws}&metodo=webpay`, 303);
  }

  return NextResponse.redirect(`suemate://pago/fracaso?motivo=error_desconocido`, 303);
}