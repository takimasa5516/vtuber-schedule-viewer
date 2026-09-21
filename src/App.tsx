import React, { useState, useEffect, useMemo } from 'react';
import { StreamItem, SchedulePayload, TabKey } from './types';
import { 
  Search, 
  X, 
  RefreshCw, 
  Star, 
  Tv, 
  Calendar, 
  Radio, 
  Clock,
  Zap
} from 'lucide-react';
import { fetchLiveHololiveSchedule } from './services/hololiveApi';

const FAVORITES_KEY = 'vsc_vtuber_favorites';
const AUTO_REFRESH_KEY = 'vsc_vtuber_auto_refresh';

export default function App() {
  const [data, setData] = useState<SchedulePayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<TabKey>('hololive');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLiveOnly, setFilterLiveOnly] = useState<boolean>(false);
  const [filterTodayOnly, setFilterTodayOnly] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(AUTO_REFRESH_KEY);
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  }); // 0 = OFF, 60 = 1m, 180 = 3m, 300 = 5m

  // お気に入りの保存
  const toggleFavorite = (memberName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(memberName) 
        ? prev.filter(m => m !== memberName)
        : [...prev, memberName];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save favorites', err);
      }
      return next;
    });
  };

  const [refreshToast, setRefreshToast] = useState<string | null>(null);
  const [hololiveRealtimeLive, setHololiveRealtimeLive] = useState<boolean>(false);

  // データ取得関数
  const fetchData = async (triggerType: 'initial' | 'manual' | 'auto' = 'initial') => {
    setLoading(true);
    setError(null);
    try {
      // 1. 静的 schedule.json を取得 (キャッシュ無効化)
      const res = await fetch(`./data/schedule.json?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }
      let json: SchedulePayload = await res.json();

      // 2. ホロライブ公式API (CORS許可) をブラウザから直接取得してリアルタイム最新化
      try {
        const liveHoloItems = await fetchLiveHololiveSchedule();
        if (liveHoloItems && liveHoloItems.length > 0) {
          json = {
            ...json,
            counts: {
              ...json.counts,
              hololive: liveHoloItems.length,
              total: (json.counts?.nijisanji || 0) + (json.counts?.vspo || 0) + liveHoloItems.length
            },
            schedules: {
              ...json.schedules,
              hololive: liveHoloItems
            }
          };
          setHololiveRealtimeLive(true);
        }
      } catch (holoErr) {
        console.warn('Hololive direct API fetch failed, fallback to static data:', holoErr);
      }

      setData(json);
      if (triggerType === 'manual') {
        setRefreshToast(`手動更新を完了しました (${json.counts?.total || 0}件)`);
        setTimeout(() => setRefreshToast(null), 3000);
      } else if (triggerType === 'auto') {
        setRefreshToast(`自動同期を実行しました (${json.counts?.total || 0}件)`);
        setTimeout(() => setRefreshToast(null), 2500);
      }
    } catch (err: any) {
      console.error(err);
      setError('スケジュールの取得に失敗しました。時間をおいて再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData('initial');
  }, []);

  // 自動更新タイマー
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      fetchData('auto');
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  // 現在タブの生データ取得
  const currentTabRawItems = useMemo<StreamItem[]>(() => {
    if (!data || !data.schedules) return [];
    if (currentTab === 'favorites') {
      const all: StreamItem[] = [
        ...(data.schedules.hololive || []),
        ...(data.schedules.nijisanji || []),
        ...(data.schedules.vspo || [])
      ];
      return all.filter(item => favorites.includes(item.member));
    }
    return data.schedules[currentTab] || [];
  }, [data, currentTab, favorites]);

  // 今日の日付文字列 (YYYY/MM/DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  }, []);

  // フィルタリングとソート
  const filteredAndGroupedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    
    // 1. 絞り込み
    const filtered = currentTabRawItems.filter(item => {
      if (q) {
        const member = (item.member || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        if (!member.includes(q) && !title.includes(q)) return false;
      }
      if (filterLiveOnly && !item.is_live) return false;
      if (filterTodayOnly && item.date !== todayStr) return false;
      return true;
    });

    // 2. ソート (LIVE最優先 -> 日付 -> 時間)
    const sorted = [...filtered].sort((a, b) => {
      if (a.is_live !== b.is_live) return a.is_live ? -1 : 1;
      const dateA = a.date || '9999/99/99';
      const dateB = b.date || '9999/99/99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.time || '25:00';
      const timeB = b.time || '25:00';
      return timeA.localeCompare(timeB);
    });

    // 3. 日付/LIVEグループ化
    const groups: { title: string; isLive: boolean; items: StreamItem[] }[] = [];
    let currentGroup: { title: string; isLive: boolean; items: StreamItem[] } | null = null;

    for (const item of sorted) {
      const key = item.is_live ? '🔴 LIVE NOW' : (item.date || 'Unknown');
      if (!currentGroup || currentGroup.title !== key) {
        currentGroup = {
          title: key,
          isLive: item.is_live,
          items: [item]
        };
        groups.push(currentGroup);
      } else {
        currentGroup.items.push(item);
      }
    }

    return groups;
  }, [currentTabRawItems, searchQuery, filterLiveOnly, filterTodayOnly, todayStr]);

  // タブ情報
  const tabConfigs: { key: TabKey; label: string; count: number }[] = [
    { key: 'hololive', label: 'Hololive', count: data?.counts?.hololive ?? 0 },
    { key: 'nijisanji', label: 'Nijisanji', count: data?.counts?.nijisanji ?? 0 },
    { key: 'vspo', label: 'VSPO', count: data?.counts?.vspo ?? 0 },
    { key: 'favorites', label: '★ Favorites', count: favorites.length },
  ];

  // 自動更新ボタントグル (OFF -> 1分 -> 3分 -> 5分 -> OFF)
  const toggleAutoRefresh = () => {
    setAutoRefreshInterval(prev => {
      let next = 0;
      if (prev === 0) next = 60; // 1分
      else if (prev === 60) next = 180; // 3分
      else if (prev === 180) next = 300; // 5分
      else next = 0; // OFF

      try {
        localStorage.setItem(AUTO_REFRESH_KEY, String(next));
      } catch (err) {
        console.error('Failed to save auto-refresh setting', err);
      }
      return next;
    });
  };

  // データの鮮度判定
  const dataFreshness = useMemo(() => {
    if (!data || !data.updated_at) return null;
    const updatedTime = new Date(data.updated_at).getTime();
    const now = Date.now();
    const diffMinutes = Math.max(0, Math.floor((now - updatedTime) / (1000 * 60)));
    if (diffMinutes < 20) {
      return { status: 'fresh', text: '同期中 (最新)', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' };
    } else if (diffMinutes < 45) {
      return { status: 'normal', text: `${diffMinutes}分前`, color: 'text-cyan-300 bg-cyan-950/60 border-cyan-500/40' };
    } else {
      return { status: 'delayed', text: `${diffMinutes}分前 (更新待ち)`, color: 'text-amber-400 bg-amber-950/60 border-amber-500/40' };
    }
  }, [data]);

  return (
    <div className="min-h-screen bg-[#121212] text-gray-100 flex flex-col pb-12 relative">
      {/* Toast Notification */}
      {refreshToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-cyan-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg border border-cyan-400 flex items-center gap-2 animate-bounce">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          {refreshToast}
        </div>
      )}

      {/* Top App Bar (Sticky) */}
      <header className="sticky top-0 z-40 bg-[#1A1A1A]/95 backdrop-blur border-b border-zinc-800 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📺</span>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Vtuber Schedule Viewer
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/50">
                  Web V2.5
                </span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  {data ? `更新: ${data.updated_at_display}` : 'データ読み込み中...'}
                </p>
                {dataFreshness && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${dataFreshness.color}`}>
                    {dataFreshness.text}
                  </span>
                )}
                {hololiveRealtimeLive && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded border font-semibold text-emerald-400 bg-emerald-950/60 border-emerald-500/50 flex items-center gap-0.5" title="ホロライブ公式APIからアクセス時に最新データを直接取得しています">
                    <Zap className="w-2.5 h-2.5 text-yellow-400" />
                    ホロライブ直結
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto Refresh Toggle */}
            <button
              onClick={toggleAutoRefresh}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                autoRefreshInterval === 60
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                  : autoRefreshInterval === 180
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50'
                  : autoRefreshInterval === 300
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
              }`}
              title="自動更新間隔の切り替え (OFF / 1分 / 3分 / 5分)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefreshInterval > 0 ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">自動更新: </span>
              {autoRefreshInterval === 0 ? 'OFF' : `${autoRefreshInterval / 60}分`}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => fetchData('manual')}
              disabled={loading}
              className="p-2 rounded-lg bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white transition-all disabled:opacity-50"
              title="今すぐ再読み込み"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-4xl mx-auto px-4 pt-1 flex gap-2 overflow-x-auto no-scrollbar">
          {tabConfigs.map(tab => {
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setCurrentTab(tab.key)}
                className={`py-2 px-3.5 text-sm font-semibold whitespace-nowrap rounded-t-lg transition-all border-b-2 flex items-center gap-2 ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300 bg-zinc-800/80'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                }`}
              >
                {tab.key === 'favorites' && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                {tab.label}
                {tab.key !== 'favorites' && (
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-zinc-700/50 text-zinc-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 pt-4 w-full flex-1">
        {/* Search and Filters Bar */}
        <div className="bg-[#1E1E1E] p-3 rounded-xl border border-zinc-800 shadow-sm mb-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="配信者名・タイトルで検索..."
              className="w-full bg-[#141414] border border-zinc-700/70 rounded-lg pl-9 pr-9 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5"
                title="クリア"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFilterLiveOnly(prev => !prev)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
                filterLiveOnly
                  ? 'bg-red-950/70 text-red-300 border-red-500'
                  : 'bg-[#141414] text-zinc-400 border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
              LIVEのみ
            </button>

            <button
              onClick={() => setFilterTodayOnly(prev => !prev)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
                filterTodayOnly
                  ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500'
                  : 'bg-[#141414] text-zinc-400 border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              本日のみ
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl mb-4 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => fetchData('manual')} 
              className="text-xs underline ml-4 hover:text-white"
            >
              再試行
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAndGroupedItems.length === 0 && (
          <div className="bg-[#1A1A1A] border border-zinc-800/80 rounded-2xl p-10 text-center text-zinc-400 my-6">
            <Tv className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-base font-medium text-zinc-300">
              {currentTab === 'favorites' && favorites.length === 0
                ? 'お気に入りがまだ登録されていません'
                : '該当する配信が見つかりませんでした'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {currentTab === 'favorites' && favorites.length === 0
                ? '各配信カードの右上にある ★ アイコンを押してお気に入りに登録できます。'
                : '検索条件やフィルターをクリアしてお試しください。'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition"
              >
                検索ワードをクリア
              </button>
            )}
          </div>
        )}

        {/* Stream List Grouped by Date / LIVE */}
        <div className="space-y-6">
          {filteredAndGroupedItems.map(group => (
            <section key={group.title} className="space-y-2.5">
              {/* Group Header */}
              <div className="flex items-center gap-2 pt-2">
                <span className={`text-sm font-bold tracking-wide flex items-center gap-1.5 ${
                  group.isLive ? 'text-red-400' : 'text-cyan-300'
                }`}>
                  {group.isLive && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />}
                  {group.title}
                </span>
                <span className="text-xs text-zinc-500 font-normal">
                  ({group.items.length}件)
                </span>
                <div className="h-px bg-zinc-800 flex-1 ml-2" />
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 gap-2.5">
                {group.items.map((item, idx) => {
                  const isFav = favorites.includes(item.member);
                  const isTwitch = (item.platform || '').toLowerCase().includes('twitch');

                  return (
                    <div
                      key={`${item.member}-${item.time}-${idx}`}
                      onClick={() => item.url && window.open(item.url, '_blank')}
                      className={`group relative flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none hover:border-zinc-600 hover:shadow-lg ${
                        item.is_live
                          ? 'bg-[#2A161C] border-red-900/50 hover:bg-[#341B23]'
                          : 'bg-[#1E1E1E] border-zinc-800/80 hover:bg-[#252525]'
                      }`}
                    >
                      {/* Thumbnail Container (16:9) */}
                      <div className="w-24 sm:w-28 aspect-video bg-zinc-900 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center border border-zinc-800">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.member}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              // 画像読み込み失敗時はフォールバック
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-6 h-6 text-zinc-600" />
                        )}
                        {/* Live Overlay Badge on Image */}
                        {item.is_live && (
                          <span className="absolute bottom-1 right-1 bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded shadow">
                            LIVE
                          </span>
                        )}
                      </div>

                      {/* Content Info */}
                      <div className="flex-1 min-w-0 pr-8">
                        {/* Top Meta: Time + Platform */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-cyan-200 tracking-wider">
                            {item.time || '--:--'}
                          </span>
                          
                          {/* Platform Badge */}
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded text-white ${
                            isTwitch ? 'bg-[#9146FF]' : 'bg-[#CC0000]'
                          }`}>
                            {isTwitch ? 'Twitch' : 'YouTube'}
                          </span>

                          {/* Member Name */}
                          <span className="text-xs sm:text-sm font-semibold text-zinc-100 truncate flex-1">
                            {item.member}
                          </span>
                        </div>

                        {/* Stream Title (2 lines clamp) */}
                        <h3 className="text-xs sm:text-sm text-zinc-300 line-clamp-2 leading-snug group-hover:text-cyan-300 transition-colors">
                          {item.title || '(タイトルなし)'}
                        </h3>
                      </div>

                      {/* Favorite Button (Star) */}
                      <button
                        onClick={(e) => toggleFavorite(item.member, e)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-zinc-700/50 transition-colors z-10"
                        title={isFav ? 'お気に入りを解除' : 'お気に入りに追加'}
                      >
                        <Star className={`w-5 h-5 transition-transform active:scale-125 ${
                          isFav ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'
                        }`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-900 pt-6 text-center text-xs text-zinc-600">
        <p>Vtuber Schedule Viewer &bull; Powered by GitHub Pages & GitHub Actions</p>
      </footer>
    </div>
  );
}
