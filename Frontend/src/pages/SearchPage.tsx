import { useState } from 'react';
import type { FormEvent } from 'react';
import { queryApi } from '../api/api';
import type { QueryResponse } from '../types/summary';
import QueryAnswer from '../components/QueryAnswer';
import './SearchPage.css';

const SUGGESTIONS = [
  'What decisions did we make this week?',
  'What did we say about pricing?',
  'What are my open action items?',
];

export default function SearchPage() {
  const [input, setInput] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runQuery(question: string) {
    if (!question.trim() || loading) return;
    setAskedQuestion(question);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const data = await queryApi.ask(question);
      setResult(data);
    } catch {
      setError('Something went wrong answering that — try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runQuery(input);
  }

  return (
    <div className="search-page">
      <div className="search-hero">
        <h1 className="search-heading">Ask your meetings anything</h1>
        <p className="text-secondary">Searches across every meeting you've recorded.</p>

        <form onSubmit={handleSubmit} className="search-form">
          <input
            className="search-input"
            placeholder="What did we decide about pricing?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
            Ask
          </button>
        </form>

        {!askedQuestion && (
          <div className="search-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-ghost search-suggestion"
                onClick={() => {
                  setInput(s);
                  runQuery(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="search-results">
        <QueryAnswer question={askedQuestion} result={result} loading={loading} error={error} />
      </div>
    </div>
  );
}
