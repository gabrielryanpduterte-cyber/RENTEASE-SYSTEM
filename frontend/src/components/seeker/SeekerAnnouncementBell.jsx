import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { announcementsApi } from '../../api/client.js';
import { formatDate } from '../../utils/format.js';

function notificationCountLabel(count) {
  if (count > 99) {
    return '99+';
  }

  return String(count);
}

function normalizeAnnouncementPayload(payload) {
  const data = payload?.data;

  if (Array.isArray(data)) {
    return {
      items: data,
      unreadCount: data.filter((announcement) => !announcement.is_read).length,
    };
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    items,
    unreadCount: Number(data?.unread_announcements_count ?? items.filter((announcement) => !announcement.is_read).length),
  };
}

async function fetchSeekerAnnouncementNotifications() {
  const payload = await announcementsApi.list({ limit: 20, include_count: 1 });
  return normalizeAnnouncementPayload(payload);
}

export default function SeekerAnnouncementBell({ userId, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    loading: false,
    error: '',
    items: [],
    unreadCount: 0,
  });
  const notificationRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setNotifications({ loading: false, error: '', items: [], unreadCount: 0 });
      return undefined;
    }

    setNotifications((current) => ({ ...current, loading: true, error: '' }));

    fetchSeekerAnnouncementNotifications()
      .then((nextNotifications) => {
        if (!cancelled) {
          setNotifications({ loading: false, error: '', ...nextNotifications });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setNotifications((current) => ({
            ...current,
            loading: false,
            error: error?.errors?.[0] || error?.message || 'Unable to load announcements.',
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function closeFromOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function closeFromKeyboard(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);

    return () => {
      document.removeEventListener('mousedown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [open]);

  async function refreshNotifications() {
    setNotifications((current) => ({ ...current, error: '' }));
    const nextNotifications = await fetchSeekerAnnouncementNotifications();
    setNotifications({ loading: false, error: '', ...nextNotifications });
  }

  async function toggleNotifications() {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen && userId) {
      try {
        await refreshNotifications();
      } catch (error) {
        setNotifications((current) => ({
          ...current,
          loading: false,
          error: error?.errors?.[0] || error?.message || 'Unable to load announcements.',
        }));
      }
    }
  }

  async function markAnnouncementRead(announcementId) {
    setActionLoading(true);
    setNotifications((current) => ({ ...current, error: '' }));

    try {
      await announcementsApi.markRead(announcementId);
      await refreshNotifications();
    } catch (error) {
      setNotifications((current) => ({
        ...current,
        error: error?.errors?.[0] || error?.message || 'Unable to update announcement.',
      }));
    } finally {
      setActionLoading(false);
    }
  }

  async function markAllAnnouncementsRead() {
    setActionLoading(true);
    setNotifications((current) => ({ ...current, error: '' }));

    try {
      await announcementsApi.markAllRead();
      await refreshNotifications();
    } catch (error) {
      setNotifications((current) => ({
        ...current,
        error: error?.errors?.[0] || error?.message || 'Unable to update announcements.',
      }));
    } finally {
      setActionLoading(false);
    }
  }

  const unreadCount = Math.max(Number(notifications.unreadCount || 0), 0);

  return (
    <div className={`seeker-notification-wrap align-${align}`} ref={notificationRef}>
      <button
        type="button"
        className={`notification-bell-button ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={toggleNotifications}
        aria-label={unreadCount > 0 ? `${unreadCount} unread announcements` : 'Announcements'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Announcements"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{notificationCountLabel(unreadCount)}</span>
        )}
      </button>

      {open && (
        <section className="seeker-notification-menu" role="dialog" aria-label="Announcement notifications">
          <div className="notification-menu-header">
            <div>
              <p className="re-eyebrow">Announcements</p>
              <h3>Notifications</h3>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-mark-all"
                onClick={markAllAnnouncementsRead}
                disabled={actionLoading}
              >
                <CheckCheck size={15} />
                Read all
              </button>
            )}
          </div>

          {notifications.error && (
            <div className="notification-state notification-error">
              {notifications.error}
            </div>
          )}

          {notifications.loading ? (
            <div className="notification-state">Loading announcements...</div>
          ) : notifications.items.length > 0 ? (
            <div className="notification-list">
              {notifications.items.map((announcement) => (
                <article
                  className={`notification-item ${announcement.is_read ? 'is-read' : 'is-unread'}`}
                  key={announcement.announcement_id}
                >
                  <span className="notification-unread-dot" aria-hidden="true" />
                  <div className="notification-item-body">
                    <div className="notification-item-meta">
                      <span>{announcement.category || 'general'}</span>
                      <span>{formatDate(announcement.created_at)}</span>
                    </div>
                    <strong>{announcement.title}</strong>
                    {announcement.image_url && (
                      <img
                        className="notification-image"
                        src={announcement.image_url}
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <p>{announcement.body}</p>
                    {announcement.expires_at && <small>Expires {formatDate(announcement.expires_at)}</small>}
                  </div>
                  {!announcement.is_read && (
                    <button
                      type="button"
                      className="notification-read-button"
                      onClick={() => markAnnouncementRead(announcement.announcement_id)}
                      disabled={actionLoading}
                      aria-label={`Mark ${announcement.title || 'announcement'} as read`}
                    >
                      <Check size={14} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="notification-state">
              No announcements yet.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
