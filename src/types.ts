export interface StreamItem {
  member: string;
  title: string;
  date: string;
  time: string;
  is_live: boolean;
  platform: 'youtube' | 'twitch' | string;
  thumbnail: string;
  url: string;
}

export interface SchedulePayload {
  updated_at: string;
  updated_at_display: string;
  counts: {
    hololive: number;
    nijisanji: number;
    vspo: number;
    total: number;
  };
  schedules: {
    hololive: StreamItem[];
    nijisanji: StreamItem[];
    vspo: StreamItem[];
  };
}

export type TabKey = 'hololive' | 'nijisanji' | 'vspo' | 'favorites';
