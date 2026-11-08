import { Tag as TagIcon } from 'lucide-react';
import { NO_TAG, subscriptionIdOfGroup } from '../../domain/spending';
import type { Subscription, Tag } from '../../domain/types';
import { Avatar } from '../../components/avatar/Avatar';
import { SubscriptionAvatar } from '../subscriptions/subscriptionUi';

export interface GroupInfo {
  key: string;
  name: string;
  tag: Tag | null;
  subscription: Subscription | null;
}

/** Name and picture of a spending group (tag, subscription or "Ohne Tag"). */
export function groupInfo(
  key: string,
  tags: ReadonlyMap<string, Tag>,
  subscriptions: ReadonlyMap<string, Subscription>,
): GroupInfo {
  if (key === NO_TAG) return { key, name: 'Ohne Tag', tag: null, subscription: null };
  const subId = subscriptionIdOfGroup(key);
  if (subId !== null) {
    const subscription = subscriptions.get(subId) ?? null;
    return { key, name: subscription?.name ?? 'Abo', tag: null, subscription };
  }
  const tag = tags.get(key) ?? null;
  return { key, name: tag?.name ?? 'Gelöschter Tag', tag, subscription: null };
}

export function GroupAvatar({ info, size = 36 }: { info: GroupInfo; size?: number }) {
  if (info.tag) return <Avatar name={info.tag.name} image={info.tag.image} color={info.tag.color} size={size} />;
  if (info.subscription) return <SubscriptionAvatar subscription={info.subscription} size={size} />;
  return (
    <span className="group-avatar--none" style={{ width: size, height: size }} aria-hidden>
      <TagIcon />
    </span>
  );
}
