
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../auth/useAuth';

export default function AppLayout() {
  const {
    realMe,
    loading,
    preview,
    setPreview,
    previewRanks,
  } = useAuth();

  type PreviewRank = NonNullable<
    Parameters<typeof setPreview>[0]
  >;

  const handlePreviewChange = (value: string) => {
    if (!value) {
      setPreview(null);
      return;
    }

    if (previewRanks.includes(value as PreviewRank)) {
      setPreview(value as PreviewRank);
    }
  };

  if (loading) {
    return (
      <div className="center">
        Checking secure session…
      </div>
    );
  }

  if (!realMe) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className="shell">
      <Sidebar />

      <main>
        <header>
          <div />

          <div className="user">
            <div>
              <b>{realMe.user.displayName}</b>
              <span>
                {realMe.staff.rank} ·{' '}
                {realMe.staff.minecraftUsername ||
                  'Minecraft unlinked'}
              </span>
            </div>

            <a href="/auth/logout">Sign out</a>
          </div>
        </header>

        {preview && (
          <div className="role-preview-banner">
            <strong>Currently showing as</strong>

            <select
              aria-label="Preview staff rank"
              value={preview}
              onChange={(e) =>
                handlePreviewChange(e.target.value)
              }
            >
              {previewRanks.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>

            <span>Read-only preview</span>

            <button
              type="button"
              onClick={() => setPreview(null)}
            >
              Exit
            </button>
          </div>
        )}

        {!preview && previewRanks.length > 0 && (
          <div className="role-preview-start">
            <label>
              View as role{' '}
              <select
                aria-label="Select staff rank to preview"
                value=""
                onChange={(e) =>
                  handlePreviewChange(e.target.value)
                }
              >
                <option value="">Select role…</option>

                {previewRanks.map((rank) => (
                  <option key={rank} value={rank}>
                    {rank}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div
          onClickCapture={(event) => {
            if (!preview) return;

            const target = event.target;

            if (!(target instanceof Element)) return;

            const button = target.closest('button');

            if (button) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onSubmitCapture={(event) => {
            if (!preview) return;

            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
