import { Star, X } from 'lucide-react';
import { audio } from '../audio/AudioManager';

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const t = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${t}`;
}

/** Game button with click/hover feedback sounds. */
export function Button({ variant = '', className = '', onClick, children, sound = 'click', ...rest }) {
  return (
    <button
      type="button"
      className={`btn ${variant} ${className}`}
      onMouseEnter={() => audio.play('hover')}
      onClick={(e) => {
        audio.unlock();
        audio.play(sound);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Panel({ title, onClose, narrow = false, children }) {
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`panel ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {onClose && (
          <button
            type="button"
            className="icon-btn panel-close"
            aria-label="Close"
            onClick={() => {
              audio.play('menuClose');
              onClose();
            }}
          >
            <X size={24} strokeWidth={3} />
          </button>
        )}
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Stars({ count, size = 18 }) {
  return (
    <span className="stars" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} strokeWidth={2.5} className={i < count ? 'star-on' : 'star-off'} />
      ))}
    </span>
  );
}
