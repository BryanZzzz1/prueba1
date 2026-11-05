"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/src/lib/context/AuthContext";
import { esPersonal } from "@/src/lib/rutasPorRol";

export default function BodegaLayout({ children }: { children: React.ReactNode }) {
  const [esMovil, setEsMovil] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { usuario, cargando, rolVerificado } = useAuth();

  // Guardia por rol: sin sesión → login (y vuelve aquí); cliente o cuenta suspendida → tienda.
  // Solo se expulsa cuando el rol se LEYÓ de la base de datos: un fallo de lectura pasajero
  // no debe sacar al personal de la bodega.
  useEffect(() => {
    if (cargando) return;
    if (!usuario) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/bodega")}`);
      return;
    }
    if (rolVerificado && (!usuario.activo || !esPersonal(usuario.rol_id))) {
      router.replace("/");
    }
  }, [cargando, usuario, rolVerificado, router, pathname]);

  useEffect(() => {
    setIsMounted(true);
    const checkViewport = () => {
      setEsMovil(window.innerWidth < 1024);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  if (!isMounted) return null;

  if (esMovil) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-600">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="brand-serif text-2xl font-bold text-stone-900 mb-3">
          Acceso Restringido en Móvil
        </h1>
        <p className="text-stone-600 text-sm max-w-sm mb-8">
          El panel de logística y bodega está diseñado exclusivamente para uso en escritorio. Por favor, accede desde un computador para operar la bodega.
        </p>
        <Link href="/" className="rounded-full bg-[#314235] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243127]">
          Volver a la tienda
        </Link>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#f6f1e7] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-[#314235] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-stone-600">Verificando credenciales...</p>
      </div>
    );
  }

  // Sin sesión, o cliente / cuenta suspendida confirmados: la redirección ya está en curso
  if (!usuario || (rolVerificado && (!usuario.activo || !esPersonal(usuario.rol_id)))) {
    return null;
  }

  // Hay sesión pero no se pudo confirmar el rol: se avisa en lugar de expulsar
  if (!rolVerificado) {
    return (
      <div className="min-h-screen bg-[#f6f1e7] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="brand-serif text-2xl font-bold text-stone-900 mb-3">No pudimos verificar tu rol</h1>
        <p className="text-stone-600 text-sm max-w-sm mb-6">
          Hubo un problema al leer tu perfil. Revisa tu conexión y vuelve a intentarlo.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#314235] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#243127] cursor-pointer"
          >
            Reintentar
          </button>
          <Link href="/" className="rounded-full border border-stone-300 px-6 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50">
            Ir a la tienda
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
