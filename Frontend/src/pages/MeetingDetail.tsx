import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { meetingApi, queryApi } from '../api/api';
import type { Meeting } from '../types/meeting';
import type { QueryResponse } from '../types/summary';
import QueryAnswer from '../components/QueryAnswer';
import './Meetings.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const [input, setInput] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    meetingApi
      .getById(id)
      .then(setMeeting)
      .catch(() => setLoadError('Could not load this meeting.'));
  }, [id]);

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || asking || !id) return;
    setAskedQuestion(input);
    setResult(null);
    setAskError(null);
    setAsking(true);
    try {
      const data = await queryApi.ask(input, id);
      setResult(data);
    } catch {
      setAskError('Something went wrong answering that — try again.');
    } finally {
      setAsking(false);
    }
  }

  if (loadError) {
    return (
      <div className="page-shell">
        <p className="page-error">{loadError}</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="page-shell">
        <div className="meeting-card-skeleton" style={{ height: 60, marginBottom: 24 }} />
        <div className="meeting-card-skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <Link to="/" className="text-secondary detail-back-link">
        ← All meetings
      </Link>

      <div className="detail-header">
        <h1>{meeting.title}</h1>
        <span className={`meeting-status meeting-status-${meeting.status}`}>{meeting.status}</span>
      </div>

      <div className="detail-meta text-faint text-mono">
        <span>{formatDate(meeting.startedAt)}</span>
        <span>·</span>
        <span>{formatDuration(meeting.durationSeconds)}</span>
        <span>·</span>
        <span>
          {meeting.participants.length > 0 ? meeting.participants.join(', ') : 'No participants listed'}
        </span>
      </div>

      {meeting.summary && (
        <div className="detail-section card">
          <h2>Summary</h2>
          <p className="detail-summary-text">{meeting.summary}</p>
        </div>
      )}

      {meeting.keyDecisions.length > 0 && (
        <div className="detail-section card">
          <h2>Key decisions</h2>
          <ul className="detail-list">
            {meeting.keyDecisions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {meeting.actionItems.length > 0 && (
        <div className="detail-section card">
          <h2>Action items</h2>
          <ul className="detail-action-list">
            {meeting.actionItems.map((item) => (
              <li key={item._id} className={item.done ? 'detail-action-done' : ''}>
                <span className="detail-action-text">{item.text}</span>
                <span className="text-faint text-mono">
                  {item.owner ?? 'Unassigned'}
                  {item.dueDate ? ` · ${new Date(item.dueDate).toLocaleDateString()}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="detail-section card">
        <button className="btn btn-ghost" onClick={() => setShowTranscript((v) => !v)}>
          {showTranscript ? 'Hide transcript' : 'Show transcript'}
        </button>
        {showTranscript && (
          <p className="detail-transcript text-mono">
            {meeting.rawTranscript || 'No transcript available.'}
          </p>
        )}
      </div>

      <div className="detail-section card">
        <h2>Ask this meeting</h2>
        <form onSubmit={handleAsk} className="detail-ask-form">
          <input
            className="search-input-inline"
            placeholder="What did we decide about pricing?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={asking || !input.trim()}>
            Ask
          </button>
        </form>
        <QueryAnswer question={askedQuestion} result={result} loading={asking} error={askError} />
      </div>
    </div>
  );
}
