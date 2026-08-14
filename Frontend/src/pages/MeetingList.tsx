import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { meetingApi } from '../api/api';
import type { MeetingListItem } from '../types/meeting';
import './Meetings.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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

const STATUS_LABEL: Record<MeetingListItem['status'], string> = {
  active: 'Recording',
  processing: 'Processing',
  ended: 'Ready',
  failed: 'Failed',
};

export default function MeetingList() {
  const [meetings, setMeetings] = useState<MeetingListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    meetingApi
      .getAll()
      .then(setMeetings)
      .catch(() => setError('Could not load your meetings.'));
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>Meetings</h1>
        <Link to="/record" className="btn btn-primary">
          + New recording
        </Link>
      </div>

      {error && <p className="page-error">{error}</p>}

      {!meetings && !error && (
        <div className="meeting-list-skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="meeting-card meeting-card-skeleton" />
          ))}
        </div>
      )}

      {meetings && meetings.length === 0 && (
        <div className="empty-state card">
          <h2>No meetings yet</h2>
          <p className="text-secondary">
            Start a recording and it'll show up here — transcribed, summarized, and searchable.
          </p>
          <Link to="/record" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
            Start your first recording
          </Link>
        </div>
      )}

      {meetings && meetings.length > 0 && (
        <div className="meeting-list">
          {meetings.map((m) => (
            <Link to={`/meetings/${m._id}`} key={m._id} className="meeting-card card">
              <div className="meeting-card-top">
                <h3 className="meeting-card-title">{m.title}</h3>
                <span className={`meeting-status meeting-status-${m.status}`}>
                  {STATUS_LABEL[m.status]}
                </span>
              </div>

              <p className="meeting-card-summary text-secondary">
                {m.summary ?? 'Summary not ready yet.'}
              </p>

              {m.keyTopics.length > 0 && (
                <div className="meeting-card-topics">
                  {m.keyTopics.slice(0, 3).map((t) => (
                    <span key={t} className="meeting-topic-pill text-mono">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="meeting-card-meta text-faint text-mono">
                <span>{formatDate(m.startedAt)}</span>
                <span>·</span>
                <span>{formatDuration(m.durationSeconds)}</span>
                <span>·</span>
                <span>{m.participants.length} participant{m.participants.length !== 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
