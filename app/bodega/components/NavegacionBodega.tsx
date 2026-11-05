"use client";

import Link from "next/link";
import { useAuth } from "@/src/lib/context/AuthContext";
import { destinoVolverDesdeBodega, esPersonal } from "@/src/lib/rutasPorRol";

/**
 * Barra superior de la portada de bodega, según el rol:
 *  - Administrador: «Volver al panel de administración».
 *  - Editor / Bodeguero: «Volver a la tienda» y acceso a Administración.
 */
export default function NavegacionBodega() {
  const { usuario, cargando } = useAuth();

  // Mientras se conoce el rol se reserva el espacio, para que el enlace no «salte» de destino
  if (cargando) {
    return <div className="mb-8 h-5" aria-hidden />;
  }

  const volver = destinoVolverDesdeBodega(usuario?.rol_id);

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <Link
        href={volver.href}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#5c5a50] transition hover:text-[#314235]"
      >
        <span>←</span>
        <span>{volver.texto}</span>
      </Link>

      {esPersonal(usuario?.rol_id) && usuario?.rol_id !== 1 && (
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-full border border-[#314235]/30 px-4 py-1.5 text-xs font-bold text-[#314235] transition hover:bg-[#314235] hover:text-white"
        >
          Ir a Administración →
        </Link>
      )}
    </div>
  );
}
