'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useNavConfig } from '@/components/nav-config-context';
import { MASTER_BY_ROUTE } from '@/lib/nav/master';
import { iconToEmoji } from '@/lib/nav/icon-to-emoji';

/**
 * Reads the user's nav config icon for the current route and prepends
 * the corresponding emoji to document.title on every navigation.
 * Priority: user-defined icon override → MASTER_NAV defaultIcon → no prefix.
 * Renders nothing — side-effect only.
 */
export function NavIconTitleSync() {
  const pathname = usePathname();
  const { config } = useNavConfig();

  useEffect(() => {
    const userItem = config?.items.find(item => item.routeKey === pathname);
    const iconName = userItem?.icon ?? MASTER_BY_ROUTE[pathname]?.defaultIcon ?? null;
    const emoji = iconToEmoji(iconName);

    if (!emoji) return;

    // Avoid double-prefixing if this effect fires more than once for the same title.
    // Next.js resets document.title on each navigation before this effect runs.
    if (!document.title.startsWith(emoji)) {
      document.title = `${emoji} ${document.title}`;
    }
  }, [pathname, config]);

  return null;
}
