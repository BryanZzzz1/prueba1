// Enrutamiento según el rol del usuario (un solo lugar para no repetir reglas).
// Roles: 1 = Administrador, 2 = Editor / Bodeguero, 3 = Cliente.

export const ROL_ADMIN = 1;
export const ROL_EDITOR_BODEGA = 2;
export const ROL_CLIENTE = 3;

/** Administrador o Editor/Bodeguero: personal que puede entrar al backoffice. */
export const esPersonal = (rol?: number | null) => rol === ROL_ADMIN || rol === ROL_EDITOR_BODEGA;

/** Dónde aterriza cada rol al iniciar sesión (si no venía de otra página). */
export function rutaInicioPorRol(rol?: number | null): string {
  if (rol === ROL_ADMIN) return '/admin';
  if (rol === ROL_EDITOR_BODEGA) return '/bodega';
  return '/';
}

/** Enlace «volver» de la portada de bodega: el administrador vuelve a su panel; el resto, a la tienda. */
export function destinoVolverDesdeBodega(rol?: number | null): { href: string; texto: string } {
  if (rol === ROL_ADMIN) return { href: '/admin', texto: 'Volver al panel de administración' };
  return { href: '/', texto: 'Volver a la tienda' };
}
