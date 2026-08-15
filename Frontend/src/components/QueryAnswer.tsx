import type { QueryResponse } from '../types/summary';
import './QueryAnswer.css';

interface QueryAnswerProps {
  question: string;
  result: QueryResponse | null;
  loading: boolean;
  error?: string | null;
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function QueryAnswer({ question, result, loading, error }: QueryAnswerProps) {
  if (!question && !loading) return null;

  return (
    <div className="query-answer">
      <p className="query-answer-question">{question}</p>

      {loading && (
        <div className="query-answer-card query-answer-loading" aria-live="polite" aria-label="Thinking">
          <span className="query-answer-dot" />
          <span className="query-answer-dot" />
          <span className="query-answer-dot" />
        </div>
      )}

      {error && !loading && <div className="query-answer-card query-answer-error">{error}</div>}

      {result && !loading && !error && (
        <div className="query-answer-card">
          <p className="query-answer-text">{result.answer}</p>

          {result.sources && result.sources.length > 0 && (
            <div className="query-answer-sources">
              {result.sources.map((s) => (
                <span key={s.meetingId} className="query-answer-pill text-mono">
                  {s.title ?? 'Meeting'}
                  {s.startedAt ? ` · ${formatDate(s.startedAt)}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
