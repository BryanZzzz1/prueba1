import { Suspense } from 'react';
import { RecuperarPasswordForm } from './components/RecuperarPasswordForm';

export const metadata = {
  title: 'Recuperar Contraseña | SuMateCL',
  description: 'Solicita el restablecimiento de tu contraseña de acceso en SuMateCL.',
};

export default function RecuperarPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8f3e9] flex items-center justify-center">
          <p className="text-stone-600 font-semibold text-sm">Cargando...</p>
        </div>
      }
    >
      <RecuperarPasswordForm />
    </Suspense>
  );
}
