import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function SignupPage() {
  const { signup, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signup(name, email, password);
      navigate('/', { replace: true });
    } catch {
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Create your account</h1>
        <p style={styles.subheading}>Start capturing what your meetings decide</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="name">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) clearError();
            }}
            style={styles.input}
          />

          <label style={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) clearError();
            }}
            style={styles.input}
          />

          <label style={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) clearError();
            }}
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--ink-bg)',
    fontFamily: 'var(--font-sans)',
    padding: '1.5rem',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: 'var(--ink-surface)',
    border: '1px solid var(--ink-border)',
    borderRadius: 12,
    padding: '2rem',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.75rem',
    color: 'var(--text-primary)',
    margin: '0 0 0.35rem',
  },
  subheading: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    margin: '0 0 1.75rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    marginTop: '0.75rem',
  },
  input: {
    background: 'var(--ink-surface-2)',
    border: '1px solid var(--ink-border)',
    borderRadius: 8,
    padding: '0.65rem 0.75rem',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  error: {
    color: 'var(--danger)',
    background: 'var(--danger-dim)',
    borderRadius: 8,
    padding: '0.6rem 0.75rem',
    fontSize: '0.85rem',
    margin: '0.5rem 0 0',
  },
  button: {
    marginTop: '1.25rem',
    background: 'var(--indigo)',
    color: 'var(--ink-bg)',
    border: 'none',
    borderRadius: 8,
    padding: '0.7rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  footer: {
    marginTop: '1.5rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  link: {
    color: 'var(--indigo)',
    textDecoration: 'none',
  },
};
