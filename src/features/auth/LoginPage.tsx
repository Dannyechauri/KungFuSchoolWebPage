import { FormEvent, useState } from 'react';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { login, loginError } = useAuth();
  const [email, setEmail] = useState('admin.demo@iwushu.local');
  const [password, setPassword] = useState('password');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    await login(email, password);
    setIsSubmitting(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <img src="/logo-instituto-wushu.png" alt="Escudo del Instituto de Wu-shu de Barcelona" />
          <div>
            <p className="eyebrow">Instituto de Wu-shu de Barcelona</p>
            <h1>Panel interno</h1>
          </div>
        </div>

        <p className="login-intro">
          Una entrada sencilla para revisar alumnos, calendario y conocimiento de la escuela.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Correo electrónico
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>

          <label>
            Contraseña
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </label>

          {loginError ? <p className="form-error">{loginError}</p> : null}

          <button className="primary-action" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
