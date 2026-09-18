import requests
from bs4 import BeautifulSoup
import json
import datetime
import re
from .base import BaseScraper
from typing import List, Dict

class NijisanjiScraper(BaseScraper):
    def get_schedule(self) -> List[Dict[str, str]]:
        url = "https://www.nijisanji.jp/streams"
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Extract __NEXT_DATA__
            m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', response.text)
            if not m:
                print("Nijisanji: __NEXT_DATA__ not found")
                return []
                
            data = json.loads(m.group(1))
            streams = data.get('props', {}).get('pageProps', {}).get('streams', [])
            
            schedule_data = []
            for stream in streams:
                try:
                    # Time parsing (ISO 8601 with timezone)
                    # Example: 2026-01-24T00:00:00.000+09:00
                    start_at = stream.get('start-at', '')
                    time_str = "Unknown"
                    date_str = "Unknown"
                    if start_at:
                        dt = datetime.datetime.fromisoformat(start_at)
                        time_str = dt.strftime("%H:%M")
                        date_str = dt.strftime("%Y/%m/%d")

                    # Live status
                    status = stream.get('status', '')
                    is_live = (status.lower() == 'on_air')
                    
                    # Extract Member Name
                    channel_info = stream.get('channel') or stream.get('youtube-channel') or {}
                    member_name = channel_info.get('name')
                    if not member_name:
                        # Fallback to event-livers if available
                        event_livers = stream.get('event-livers', [])
                        if event_livers and isinstance(event_livers, list):
                            member_name = event_livers[0].get('name')
                    if not member_name:
                        member_name = 'Nijisanji Member'
                    member_name = member_name.strip()
                    
                    platform = stream.get('platform', '')
                    if not platform:
                        stream_url = stream.get('url', '')
                        platform = 'twitch' if 'twitch.tv' in stream_url else 'youtube'

                    item = {
                        'date': date_str,
                        'time': time_str,
                        'is_live': is_live,
                        'member': member_name,
                        'title': stream.get('title', 'No Title'),
                        'url': stream.get('url', ''),
                        'thumbnail': stream.get('thumbnail-url', ''),
                        'platform': platform.lower()
                    }
                    schedule_data.append(item)
                except Exception as e:
                    print(f"Error parsing nijisanji stream item: {e}")
                    continue
            
            return schedule_data

        except Exception as e:
            print(f"Error scraping Nijisanji: {e}")
            return []
