import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Meeting } from '../types/meeting';
import './Meetings.css';

const API_BASE = 'http://localhost:5000/api';

const statusColor: Record<string, string> = {
  active: '#4dff8f',
  processing: '#ffcc4d',
  ended: '#8892a0',
  failed: '#ff4d5e',
};

export default function MeetingList() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/meetings`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        return res.json();
      })
      .then((data) => setMeetings(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  if (loading) return <div className="mm-page mm-center">Loading meetings…</div>;
  if (error) return <div className="mm-page mm-center mm-error">{error}</div>;

  return (
    <div className="mm-page">
      <div className="mm-header">
        <h1>Meetings</h1>
        <span className="mm-count">{meetings.length} total</span>
      </div>

      {meetings.length === 0 ? (
        <div className="mm-empty">No meetings recorded yet.</div>
      ) : (
        <div className="mm-list">
          {meetings.map((m) => (
            <Link to={`/meetings/${m._id}`} key={m._id} className="mm-card">
              <div className="mm-card-top">
                <h3>{m.title}</h3>
                <span
                  className="mm-pill"
                  style={{
                    color: statusColor[m.status],
                    borderColor: statusColor[m.status],
                  }}
                >
                  {m.status}
                </span>
              </div>
              {m.summary && <p className="mm-summary-preview">{m.summary}</p>}
              <div className="mm-card-meta">
                <span>{new Date(m.startedAt).toLocaleString()}</span>
                <span>{formatDuration(m.durationSeconds)}</span>
                <span>{m.participants.length} participants</span>
              </div>
              {m.keyTopics.length > 0 && (
                <div className="mm-tags">
                  {m.keyTopics.slice(0, 4).map((t, i) => (
                    <span key={i} className="mm-tag">{t}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}