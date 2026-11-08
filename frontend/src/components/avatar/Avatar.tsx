import type { CSSProperties, ReactNode } from 'react';
import { accountColorCss } from '../../domain/colors';
import { cx } from '../ui/cx';
import { initials } from './initials';
import './Avatar.css';

interface AvatarProps {
  name: string;
  image: string | null;
  /** Palette key for the initials when there is no picture. */
  color: string;
  size?: number;
  className?: string;
  /** Small round badge in the bottom right corner (e.g. a repeat icon). */
  badge?: ReactNode;
  title?: string;
}

/** Round profile picture, like in a messenger: the picture or coloured initials. */
export function Avatar({ name, image, color, size = 40, className, badge, title }: AvatarProps) {
  const style = {
    '--avatar-color': accountColorCss(color),
    '--avatar-size': `${size}px`,
  } as CSSProperties;
  return (
    <span className={cx('avatar', !image && 'avatar--initials', className)} style={style} title={title} aria-hidden>
      {image ? <img className="avatar__img" src={image} alt="" draggable={false} /> : <span className="avatar__text">{initials(name)}</span>}
      {badge && <span className="avatar__badge">{badge}</span>}
    </span>
  );
}
