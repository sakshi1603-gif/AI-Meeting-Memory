import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Meeting } from '../types/meeting';
import './Meetings.css';

const API_BASE = 'http://localhost:5000/api';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/meetings/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        return res.json();
      })
      .then((data) => setMeeting(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="mm-page mm-center">Loading meeting…</div>;
  if (error) return <div className="mm-page mm-center mm-error">{error}</div>;
  if (!meeting) return null;

  return (
    <div className="mm-page">
      <Link to="/" className="mm-back">← All meetings</Link>

      <div className="mm-detail-header">
        <h1>{meeting.title}</h1>
        <div className="mm-detail-meta">
          <span>{new Date(meeting.startedAt).toLocaleString()}</span>
          <span>{meeting.participants.join(', ') || 'No participants listed'}</span>
        </div>
      </div>

      {meeting.summary && (
        <section className="mm-panel">
          <h2>Summary</h2>
          <p>{meeting.summary}</p>
        </section>
      )}

      {meeting.keyDecisions.length > 0 && (
        <section className="mm-panel">
          <h2>Key Decisions</h2>
          <ul className="mm-list-plain">
            {meeting.keyDecisions.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </section>
      )}

      {meeting.actionItems.length > 0 && (
        <section className="mm-panel">
          <h2>Action Items</h2>
          <div className="mm-actions">
            {meeting.actionItems.map((a) => (
              <div key={a._id} className={`mm-action ${a.done ? 'mm-action-done' : ''}`}>
                <span className="mm-action-check">{a.done ? '✓' : '○'}</span>
                <span className="mm-action-text">{a.text}</span>
                {a.owner && <span className="mm-action-owner">{a.owner}</span>}
                {a.dueDate && <span className="mm-action-due">{a.dueDate}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mm-panel">
        <button className="mm-toggle" onClick={() => setShowTranscript((s) => !s)}>
          {showTranscript ? 'Hide' : 'Show'} Transcript
        </button>
        {showTranscript && (
          <pre className="mm-transcript">{meeting.rawTranscript || 'No transcript available.'}</pre>
        )}
      </section>
    </div>
  );
}