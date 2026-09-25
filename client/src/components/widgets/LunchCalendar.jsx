import { useEffect, useMemo, useRef, useState } from 'react';
import { usePolling } from '../../hooks/usePolling.js';
import { api } from '../../api.js';
import { formatMonthLabel, weekdayGridDays, toISODate, WEEKDAY_SHORT } from '../../lib/week.js';
import { stripDailyChoices } from '../../lib/lunchText.js';
import { getLunchPageView, setLunchPageView } from '../../lib/lunchPageSettings.js';

const WEEKDAYS_ONLY = WEEKDAY_SHORT.slice(0, 5);

// A plain <input> can never wrap text - long entree names just scroll out of
// view. This grows to fit whatever's typed instead of truncating it, and the
// calendar cell (and its whole grid row) grows right along with it.
function AutoGrowMenuInput({ value, onChange, onClick, className = 'lunch-cal-menu' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      placeholder="Menu…"
      rows={1}
      value={value}
      onClick={onClick}
      onChange={onChange}
    />
  );
}

export default function LunchCalendar({ childName }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [menuUrl, setMenuUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [copyMessage, setCopyMessage] = useState(null);
  const [viewMode, setViewMode] = useState(() => getLunchPageView());
  const previewRef = useRef(null);

  function chooseView(mode) {
    setViewMode(mode);
    setLunchPageView(mode);
  }

  useEffect(() => {
    api.lunchImportSettings().then((r) => setMenuUrl(r.url || '')).catch(() => {});
  }, []);

  const monthStart = toISODate(new Date(year, monthIndex, 1));
  const monthEnd = toISODate(new Date(year, monthIndex + 1, 1));
  const { data, setData, refresh } = usePolling(
    () => api.lunchRange(monthStart, monthEnd),
    [monthStart, monthEnd],
    30000
  );

  const byDate = useMemo(() => {
    const map = {};
    for (const d of data?.days || []) map[d.date] = d;
    return map;
  }, [data]);

  const cells = useMemo(() => weekdayGridDays(year, monthIndex), [year, monthIndex]);
  const weekRows = Math.ceil(cells.length / WEEKDAYS_ONLY.length);
  const schoolDays = useMemo(() => cells.filter(Boolean), [cells]);
  const todayKey = toISODate(now);

  function goMonth(offset) {
    let m = monthIndex + offset;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonthIndex(m);
    setYear(y);
  }

  async function updateDay(date, patch) {
    setData((prev) => ({
      days: (prev?.days || []).map((d) => (d.date === date ? { ...d, ...patch } : d)),
    }));
    await api.setLunchDay(date, patch);
    refresh();
  }

  function toggleStatus(date, currentStatus) {
    updateDay(date, { status: currentStatus === 'school' ? 'home' : 'school' });
  }

  async function handleCopyDetails() {
    const el = previewRef.current;
    if (!el) return;
    // Kiosk/embedded browsers on plain http:// often lack the Clipboard API
    // (it requires a secure context) - select the text and fall back to the
    // older execCommand, which works in more places, before giving up.
    el.focus();
    el.select();
    try {
      await navigator.clipboard.writeText(el.value);
      setCopyMessage('Copied!');
    } catch {
      try {
        const ok = document.execCommand('copy');
        setCopyMessage(ok ? 'Copied!' : 'Text selected — use your device\'s copy action.');
      } catch {
        setCopyMessage('Text selected — use your device\'s copy action.');
      }
    }
    setTimeout(() => setCopyMessage(null), 4000);
  }

  async function handleSync() {
    if (!menuUrl.trim()) return;
    setSyncing(true);
    setSyncResult(null);
    setShowDetails(false);
    try {
      const result = await api.importLunchMenu(menuUrl.trim());
      setSyncResult(result);
      if (result.success) refresh();
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="widget-card">
      <div className="widget-header">
        <h2>Lunch Calendar &mdash; {childName}</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="mode-toggle-row">
            <button
              type="button"
              className={`mode-toggle-btn${viewMode === 'square' ? ' active' : ''}`}
              onClick={() => chooseView('square')}
            >
              Square
            </button>
            <button
              type="button"
              className={`mode-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => chooseView('list')}
            >
              List
            </button>
          </div>
          <button className="btn-icon" onClick={() => goMonth(-1)}>&larr;</button>
          <span style={{ fontWeight: 700, minWidth: 140, textAlign: 'center' }}>{formatMonthLabel(year, monthIndex)}</span>
          <button className="btn-icon" onClick={() => goMonth(1)}>&rarr;</button>
        </div>
      </div>

      <div className="lunch-import-row">
        <input
          type="text"
          placeholder="School menu URL (e.g. Health-e Pro link)"
          value={menuUrl}
          onChange={(e) => setMenuUrl(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={handleSync} disabled={syncing || !menuUrl.trim()}>
          {syncing ? 'Syncing…' : 'Sync Menu'}
        </button>
      </div>
      {syncResult && (
        <div className={`lunch-import-result${syncResult.success ? ' success' : ' error'}`}>
          {syncResult.success ? (
            <span>✅ Imported {syncResult.imported} day{syncResult.imported === 1 ? '' : 's'} of menu items.</span>
          ) : (
            <>
              <span>⚠️ {syncResult.error}</span>
              {(syncResult.htmlPreview || syncResult.scriptBlocksFound !== undefined) && (
                <button className="see-all" onClick={() => setShowDetails((v) => !v)}>
                  {showDetails ? 'Hide details' : 'Show details'}
                </button>
              )}
              {showDetails && (
                <div className="lunch-import-details">
                  <textarea
                    ref={previewRef}
                    className="lunch-import-preview"
                    readOnly
                    value={
                      (syncResult.scriptBlocksFound !== undefined
                        ? `Embedded JSON blocks found: ${syncResult.scriptBlocksFound}\n`
                        : '') +
                      (syncResult.jsonResponsesFound !== undefined
                        ? `JSON network responses captured (real-browser render): ${syncResult.jsonResponsesFound}\n`
                        : '') +
                      '\n' +
                      (syncResult.htmlPreview || '')
                    }
                    onFocus={(e) => e.target.select()}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <button className="btn btn-secondary" onClick={handleCopyDetails}>Copy details</button>
                    {copyMessage && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{copyMessage}</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {viewMode === 'square' && (
        <>
          <div className="lunch-cal-weekdays">
            {WEEKDAYS_ONLY.map((w) => (
              <div key={w} className="lunch-cal-weekday">{w}</div>
            ))}
          </div>

          <div className="lunch-cal-grid" style={{ gridTemplateRows: `repeat(${weekRows}, 1fr)` }}>
            {cells.map((date, idx) => {
              if (!date) return <div className="lunch-cal-day empty" key={`empty-${idx}`} />;
              const day = byDate[date] || { status: 'home', no_school: false, menu_item: '' };
              const dayNum = Number(date.slice(-2));
              const isToday = date === todayKey;

              const statusClass = day.no_school ? 'no-school' : `status-${day.status}`;

              return (
                <div
                  className={`lunch-cal-day ${statusClass}${isToday ? ' today' : ''}`}
                  key={date}
                  onClick={() => !day.no_school && toggleStatus(date, day.status)}
                  title={day.no_school ? undefined : day.status === 'school' ? 'Tap to switch to Pack from home' : 'Tap to switch to School lunch'}
                >
                  <div className="lunch-cal-day-top">
                    <span className="lunch-cal-daynum">{dayNum}</span>
                    <button
                      className="lunch-cal-noschool-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDay(date, { no_school: !day.no_school });
                      }}
                      title={day.no_school ? 'Mark as a school day' : 'Mark as no school'}
                    >
                      {day.no_school ? '↩' : '🚫'}
                    </button>
                  </div>
                  {day.no_school ? (
                    <div className="lunch-cal-noschool-label">No School</div>
                  ) : (
                    <AutoGrowMenuInput
                      value={stripDailyChoices(day.menu_item)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateDay(date, { menu_item: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {viewMode === 'list' && (
        <div className="lunch-list">
          {schoolDays.map((date) => {
            const day = byDate[date] || { status: 'home', no_school: false, menu_item: '' };
            const isToday = date === todayKey;
            const statusClass = day.no_school ? 'no-school' : `status-${day.status}`;
            const dateObj = new Date(`${date}T00:00:00`);

            return (
              <div className={`lunch-list-row ${statusClass}${isToday ? ' today' : ''}`} key={date}>
                <div className="lunch-list-date">
                  <span className="lunch-list-weekday">{dateObj.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  <span className="lunch-list-daynum">{dateObj.getDate()}</span>
                </div>

                {day.no_school ? (
                  <div className="lunch-cal-noschool-label">No School</div>
                ) : (
                  <AutoGrowMenuInput
                    className="lunch-list-menu"
                    value={stripDailyChoices(day.menu_item)}
                    onChange={(e) => updateDay(date, { menu_item: e.target.value })}
                  />
                )}

                <div className="lunch-list-actions">
                  {!day.no_school && (
                    <button
                      type="button"
                      className={`btn btn-secondary lunch-list-status-btn ${statusClass}`}
                      onClick={() => toggleStatus(date, day.status)}
                    >
                      {day.status === 'school' ? '🏫 School' : '🥪 Home'}
                    </button>
                  )}
                  <button
                    className="lunch-cal-noschool-btn"
                    onClick={() => updateDay(date, { no_school: !day.no_school })}
                    title={day.no_school ? 'Mark as a school day' : 'Mark as no school'}
                  >
                    {day.no_school ? '↩' : '🚫'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
