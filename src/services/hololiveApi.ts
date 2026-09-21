import { StreamItem } from '../types';

interface HololiveApiVideo {
  displayDate?: string;
  datetime?: string;
  isLive?: boolean;
  status?: number;
  platformType?: number;
  url?: string;
  thumbnail?: string;
  title?: string;
  name?: string;
  talent?: {
    name?: string;
    iconImageUrl?: string;
  };
}

interface HololiveApiDateGroup {
  displayDate?: string;
  datetime?: string;
  videoList?: HololiveApiVideo[];
}

interface HololiveApiResponse {
  dateGroupList?: HololiveApiDateGroup[];
}

/**
 * ホロライブ公式API (https://schedule.hololive.tv/api/list) から
 * ブラウザ直接通信（CORS許可済み）で最新スケジュール・LIVE状態を取得します。
 */
export async function fetchLiveHololiveSchedule(): Promise<StreamItem[]> {
  const url = `https://schedule.hololive.tv/api/list?_t=${Date.now()}`;
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Hololive API returned HTTP ${response.status}`);
  }

  const data: HololiveApiResponse = await response.json();
  const items: StreamItem[] = [];
  const currentYear = new Date().getFullYear();

  for (const group of data.dateGroupList || []) {
    const parts = (group.displayDate || '').split('.');
    let dateStr = 'Unknown';
    if (parts.length === 2) {
      dateStr = `${currentYear}/${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
    }

    for (const v of group.videoList || []) {
      const isLive = Boolean(v.isLive);
      const memberName = v.name || v.talent?.name || 'Hololive Member';
      const streamUrl = v.url || '';
      const platform = streamUrl.includes('twitch.tv') ? 'twitch' : 'youtube';

      items.push({
        date: dateStr,
        time: v.displayDate || '--:--',
        is_live: isLive,
        member: memberName.trim(),
        title: v.title || '(タイトルなし)',
        url: streamUrl,
        thumbnail: v.thumbnail || '',
        platform
      });
    }
  }

  return items;
}
