import { UpdatePasswordForm } from "./UpdatePasswordForm";

export default function ActualizarPasswordPage() {
  return (
    <div className="glass-panel animate-panel-in p-7">
      <h1 className="text-xl font-semibold text-white/95">Nueva contraseña</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Define la contraseña con la que entrarás de ahora en adelante.
      </p>
      <UpdatePasswordForm />
    </div>
  );
}
