import { useEffect, useMemo, useState } from 'react';
import { Camera, Eye, EyeOff, Megaphone, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { announcementsApi } from '../../api/client.js';
import AppShell from '../../components/AppShell.jsx';
import AsyncState from '../../components/AsyncState.jsx';
import ModuleCard from '../../components/ModuleCard.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate } from '../../utils/format.js';
import { IMAGE_UPLOAD_ACCEPT, prepareUploadFile } from '../../utils/imageUpload.js';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'payment', label: 'Payment' },
  { value: 'policy', label: 'Policy' },
  { value: 'event', label: 'Event' },
  { value: 'urgent', label: 'Urgent' },
];

const EMPTY_FORM = {
  title: '',
  body: '',
  category: 'general',
  expires_at: '',
  is_visible: true,
};

function categoryLabel(value) {
  return CATEGORY_OPTIONS.find((option) => option.value === value)?.label || 'General';
}

function isExpired(announcement) {
  if (!announcement?.expires_at) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${announcement.expires_at}T00:00:00`) < today;
}

export default function AnnouncementsPage() {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageStatus, setImageStatus] = useState('');
  const [preparingImage, setPreparingImage] = useState(false);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const selectedImagePreview = useMemo(() => {
    if (!imageFile) {
      return '';
    }

    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    return () => {
      if (selectedImagePreview) {
        URL.revokeObjectURL(selectedImagePreview);
      }
    };
  }, [selectedImagePreview]);

  async function loadAnnouncements() {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const payload = await announcementsApi.list();
      setState({
        loading: false,
        error: null,
        items: Array.isArray(payload.data) ? payload.data : [],
      });
    } catch (error) {
      setState({ loading: false, error, items: [] });
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadAnnouncements();
    });
  }, []);

  const stats = useMemo(() => {
    const visible = state.items.filter((item) => item.is_visible && !isExpired(item)).length;
    const hidden = state.items.filter((item) => !item.is_visible).length;
    return [
      { label: 'Active', value: String(visible), tone: 'mint' },
      { label: 'Hidden', value: String(hidden), tone: hidden > 0 ? 'amber' : 'neutral' },
      { label: 'Total', value: String(state.items.length), tone: 'neutral' },
    ];
  }, [state.items]);
  const defaultAnnouncementTitle = useMemo(
    () => `ANNOUNCEMENT ${state.items.length + 1}`,
    [state.items.length],
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setImageFile(null);
    setImagePreview('');
    setImageStatus('');
    setPreparingImage(false);
    setRemoveExistingImage(false);
  }

  function startEdit(announcement) {
    setEditingId(announcement.announcement_id);
    setForm({
      title: announcement.title || '',
      body: announcement.body || '',
      category: announcement.category || 'general',
      expires_at: announcement.expires_at || '',
      is_visible: Boolean(announcement.is_visible),
    });
    setImageFile(null);
    setImagePreview(announcement.image_url || '');
    setImageStatus('');
    setRemoveExistingImage(false);
  }

  async function onImageChange(event) {
    const file = event.target.files?.[0] || null;
    setImageStatus('');

    if (!file) {
      setImageFile(null);
      return;
    }

    setPreparingImage(true);
    try {
      const prepared = await prepareUploadFile(file, {
        maxSizeMB: 3,
        maxWidth: 1600,
        maxHeight: 1000,
        allowPdf: false,
      });
      setImageFile(prepared.file);
      setImageStatus(prepared.message || 'Image ready.');
      setRemoveExistingImage(false);
      event.target.value = '';
    } catch (error) {
      setImageFile(null);
      setImageStatus(error?.message || 'Unable to prepare image.');
      event.target.value = '';
    } finally {
      setPreparingImage(false);
    }
  }

  function clearSelectedImage() {
    setImageFile(null);
    setImageStatus('');
  }

  function removeCurrentImage() {
    setImageFile(null);
    setImagePreview('');
    setRemoveExistingImage(true);
    setImageStatus('Existing image will be removed after saving.');
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    setSaving(true);

    const payload = new FormData();
    payload.append('title', form.title.trim());
    payload.append('body', form.body.trim());
    payload.append('category', form.category);
    payload.append('expires_at', form.expires_at || '');
    payload.append('is_visible', form.is_visible ? '1' : '0');
    if (imageFile) {
      payload.append('image', imageFile);
    }
    if (removeExistingImage) {
      payload.append('remove_image', '1');
    }

    try {
      if (editingId) {
        await announcementsApi.update(editingId, payload);
        showToast('Announcement updated.', 'success');
      } else {
        await announcementsApi.create(payload);
        showToast('Announcement posted.', 'success');
      }
      resetForm();
      await loadAnnouncements();
    } catch (error) {
      showToast(error?.errors?.[0] || error?.message || 'Unable to save announcement.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(announcement) {
    try {
      await announcementsApi.toggleVisibility(announcement.announcement_id, !announcement.is_visible);
      await loadAnnouncements();
    } catch (error) {
      showToast(error?.errors?.[0] || error?.message || 'Unable to update visibility.', 'error');
    }
  }

  async function deleteAnnouncement(announcement) {
    if (!window.confirm(`Delete "${announcement.title}"?`)) {
      return;
    }

    try {
      await announcementsApi.remove(announcement.announcement_id);
      if (editingId === announcement.announcement_id) {
        resetForm();
      }
      await loadAnnouncements();
      showToast('Announcement deleted.', 'success');
    } catch (error) {
      showToast(error?.errors?.[0] || error?.message || 'Unable to delete announcement.', 'error');
    }
  }

  return (
    <AppShell
      title="Announcements"
      subtitle="Post property notices for approved tenants."
      quickStats={stats}
    >
      <ModuleCard
        id="announcement-form"
        title={editingId ? 'Edit Announcement' : 'New Announcement'}
        description="Visible announcements appear only for approved tenants."
        actions={
          editingId ? (
            <button type="button" className="button-light" onClick={resetForm}>
              <X size={16} />
              Cancel Edit
            </button>
          ) : null
        }
      >
        <form className="announcement-form" onSubmit={saveAnnouncement}>
          <div className="form-row announcement-basic-row">
            <div className="form-group">
              <label htmlFor="announcement-title">Title</label>
              <input
                id="announcement-title"
                type="text"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                placeholder={editingId ? 'Keep existing title' : defaultAnnouncementTitle}
                maxLength={160}
              />
              {!editingId && <small>Blank title becomes {defaultAnnouncementTitle}.</small>}
            </div>
            <div className="form-group">
              <label htmlFor="announcement-category">Category</label>
              <select
                id="announcement-category"
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="announcement-body">Message</label>
            <textarea
              id="announcement-body"
              value={form.body}
              onChange={(event) => updateForm('body', event.target.value)}
              rows={5}
              maxLength={3000}
              required
            />
          </div>

          <div className="announcement-options">
            <div className="form-group announcement-visibility-field">
              <label htmlFor="announcement-visible">Visibility</label>
              <label className="owner-checkbox announcement-toggle" htmlFor="announcement-visible">
                <input
                  id="announcement-visible"
                  type="checkbox"
                  checked={form.is_visible}
                  onChange={(event) => updateForm('is_visible', event.target.checked)}
                />
                <span>Visible to tenants</span>
              </label>
            </div>
            <div className="form-group">
              <label htmlFor="announcement-expiry">Expiry Date</label>
              <input
                id="announcement-expiry"
                type="date"
                value={form.expires_at}
                onChange={(event) => updateForm('expires_at', event.target.value)}
              />
            </div>
          </div>

          <div className="announcement-image-field">
            <div className="form-group">
              <label>Image</label>
              <label className="owner-upload-control">
                <Camera size={18} />
                <span>{preparingImage ? 'Preparing image...' : imageFile ? imageFile.name : 'Add optional image'}</span>
                <input type="file" accept={IMAGE_UPLOAD_ACCEPT} onChange={onImageChange} disabled={preparingImage} />
              </label>
              {imageStatus && <small className="re-upload-note">{imageStatus}</small>}
            </div>

            {(selectedImagePreview || imagePreview) && (
              <div className="announcement-image-preview">
                <img src={selectedImagePreview || imagePreview} alt="" />
                <button
                  type="button"
                  className="re-file-remove"
                  onClick={selectedImagePreview ? clearSelectedImage : removeCurrentImage}
                >
                  <X size={15} />
                  Remove image
                </button>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              <Megaphone size={16} />
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Post Announcement'}
            </button>
          </div>
        </form>
      </ModuleCard>

      <ModuleCard
        id="announcement-list"
        title="Posted Announcements"
        description="Manage current, hidden, and expired tenant notices."
        actions={
          <button type="button" className="button-light" onClick={loadAnnouncements} disabled={state.loading}>
            <RotateCcw size={16} />
            Refresh
          </button>
        }
      >
        <AsyncState
          loading={state.loading}
          error={state.error}
          isEmpty={state.items.length === 0}
          loadingText="Loading announcements..."
          emptyText="No announcements posted yet."
          onRetry={loadAnnouncements}
        >
          <div className="announcement-list">
            {state.items.map((announcement) => {
              const expired = isExpired(announcement);
              return (
                <article
                  className={`announcement-row ${announcement.is_visible ? 'is-visible' : 'is-hidden'} ${expired ? 'is-expired' : ''}`}
                  key={announcement.announcement_id}
                >
                  <div className="announcement-row-main">
                    <div className="announcement-row-meta">
                      <span>{categoryLabel(announcement.category)}</span>
                      <span>{announcement.is_visible ? 'Visible' : 'Hidden'}</span>
                      {expired && <span>Expired</span>}
                    </div>
                    <h3>{announcement.title}</h3>
                    {announcement.image_url && (
                      <img
                        className="announcement-row-image"
                        src={announcement.image_url}
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <p>{announcement.body}</p>
                    <small>
                      Posted {formatDate(announcement.created_at)}
                      {announcement.expires_at ? ` - Expires ${formatDate(announcement.expires_at)}` : ''}
                    </small>
                  </div>
                  <div className="announcement-row-actions">
                    <button type="button" className="button-light" onClick={() => startEdit(announcement)}>
                      <Pencil size={15} />
                      Edit
                    </button>
                    <button type="button" className="button-light" onClick={() => toggleVisibility(announcement)}>
                      {announcement.is_visible ? <EyeOff size={15} /> : <Eye size={15} />}
                      {announcement.is_visible ? 'Hide' : 'Show'}
                    </button>
                    <button type="button" className="button-light danger" onClick={() => deleteAnnouncement(announcement)}>
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </AsyncState>
      </ModuleCard>
    </AppShell>
  );
}
