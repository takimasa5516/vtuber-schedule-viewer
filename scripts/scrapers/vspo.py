import requests
from bs4 import BeautifulSoup
import json
import datetime
import re
from .base import BaseScraper
from typing import List, Dict

class VspoScraper(BaseScraper):
    def get_schedule(self) -> List[Dict[str, str]]:
        url = "https://www.vspo-schedule.com/ja/schedule/all"
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            livestreams = []

            # 1. Try __NEXT_DATA__ (Next.js Pages Router)
            m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', response.text)
            if m:
                try:
                    data = json.loads(m.group(1))
                    livestreams = data.get('props', {}).get('pageProps', {}).get('livestreams', [])
                except Exception as e:
                    print(f"VSPO __NEXT_DATA__ parse error: {e}")

            # 2. Try RSC Flight data (Next.js App Router: self.__next_f.push)
            if not livestreams:
                pushes = re.findall(r'self\.__next_f\.push\(\[(\d+),\s*("(?:[^"\\]|\\.)*")\]\)', response.text)
                if pushes:
                    try:
                        full_flight_data = "".join(json.loads(raw_str) for _, raw_str in pushes)
                        idx = full_flight_data.find('"livestreams":[')
                        if idx != -1:
                            start_bracket = idx + len('"livestreams":')
                            open_brackets = 0
                            in_string = False
                            escape = False
                            end_bracket = -1
                            for i in range(start_bracket, len(full_flight_data)):
                                ch = full_flight_data[i]
                                if escape:
                                    escape = False
                                    continue
                                if ch == '\\':
                                    escape = True
                                    continue
                                if ch == '"':
                                    in_string = not in_string
                                    continue
                                if not in_string:
                                    if ch == '[':
                                        open_brackets += 1
                                    elif ch == ']':
                                        open_brackets -= 1
                                        if open_brackets == 0:
                                            end_bracket = i + 1
                                            break
                            if end_bracket != -1:
                                livestreams = json.loads(full_flight_data[start_bracket:end_bracket])
                    except Exception as e:
                        print(f"VSPO flight data parse error: {e}")

            if not livestreams:
                print("VSPO: No livestreams found")
                return []
            
            schedule_data = []
            for stream in livestreams:
                try:
                    # Time parsing (UTC ISO 8601)
                    # Example: 2026-01-23T15:09:18Z
                    scheduled_time = stream.get('scheduledStartTime', '')
                    time_str = "Unknown"
                    date_str = "Unknown"
                    
                    if scheduled_time:
                         if scheduled_time.endswith('Z'):
                             scheduled_time = scheduled_time[:-1] + '+00:00'
                         
                         dt = datetime.datetime.fromisoformat(scheduled_time)
                         # Convert to JST
                         jst = datetime.timezone(datetime.timedelta(hours=9))
                         dt_jst = dt.astimezone(jst)
                         time_str = dt_jst.strftime("%H:%M")
                         date_str = dt_jst.strftime("%Y/%m/%d")

                    # Live status
                    is_live = (stream.get('status') == 'live')
                    
                    platform = stream.get('platform', '')
                    if not platform:
                        stream_link = stream.get('link', '')
                        platform = 'twitch' if 'twitch.tv' in stream_link else 'youtube'

                    item = {
                        'date': date_str,
                        'time': time_str,
                        'is_live': is_live,
                        'member': stream.get('channelTitle', 'VSPO Member'),
                        'title': stream.get('title', 'No Title'),
                        'url': stream.get('link', ''),
                        'thumbnail': stream.get('thumbnailUrl', ''),
                        'platform': platform.lower()
                    }
                    schedule_data.append(item)
                except Exception as e:
                    print(f"Error parsing VSPO item: {e}")
                    continue

            return schedule_data

        except Exception as e:
            print(f"Error scraping VSPO: {e}")
            return []
