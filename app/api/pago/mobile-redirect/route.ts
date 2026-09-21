import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orden = searchParams.get('orden');
  const monto = searchParams.get('monto');
  const status = searchParams.get('status'); 

  // Mercado Pago envía status=approved cuando el pago es exitoso
  if (status === 'approved') {
    // Redirige al teléfono forzando el protocolo de tu app
    return NextResponse.redirect(`suemate://pago/exito?orden=${orden}&monto=${monto}`);
  } else {
    return NextResponse.redirect(`suemate://pago/fracaso?motivo=${status}`);
  }
}