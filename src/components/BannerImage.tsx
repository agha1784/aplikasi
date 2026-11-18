import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { BANNER_THEMES, BannerKey } from '../types/classroom';

export function ClassBanner({
  bannerKey,
  alt,
  className = '',
}: {
  bannerKey: BannerKey;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const theme = BANNER_THEMES[bannerKey] || BANNER_THEMES.informatika;

  if (failed) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br ${theme.fallbackGradient} flex items-center justify-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <BookOpen className="w-10 h-10 text-white/30" />
      </div>
    );
  }

  return (
    <img
      src={theme.imageUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover ${className}`}
    />
  );
}

export function UserAvatar({
  name,
  photoURL,
  size = 'md',
}: {
  name: string;
  photoURL?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass =
    size === 'sm'
      ? 'w-7 h-7 text-xs'
      : size === 'lg'
        ? 'w-11 h-11 text-sm'
        : 'w-9 h-9 text-xs';

  const initials = (name || 'P')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  if (!photoURL || failed) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-slate-200 text-slate-700 font-semibold flex items-center justify-center shrink-0 select-none`}
        aria-hidden="true"
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={photoURL}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover bg-slate-200 shrink-0`}
    />
  );
}
