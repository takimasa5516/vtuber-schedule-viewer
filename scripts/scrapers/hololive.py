import requests
from bs4 import BeautifulSoup
import datetime
from .base import BaseScraper
from typing import List, Dict
import concurrent.futures

class HololiveScraper(BaseScraper):
    def __init__(self):
        super().__init__()
        self._title_cache = {}

    def get_schedule(self) -> List[Dict[str, str]]:
        url = "https://schedule.hololive.tv/"
        schedule_data = []
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Find all links in the main area
            all_pane = soup.find('div', {'id': 'all'})
            
            raw_items = []
            current_date_str = "Unknown"
            
            if all_pane:
                for child in all_pane.children:
                    if child.name == 'div':
                        classes = child.get('class', [])
                        
                        # Track the current date header
                        if 'navbar-text' in classes:
                            header_text = child.get_text(strip=True)
                            # e.g., "01/31 (火)" -> "2026/01/31"
                            # We'll just keep the raw "MM/DD" or try to parse
                            import re
                            # match "02/28"
                            m = re.search(r'(\d{1,2})\s*/\s*(\d{1,2})', header_text)
                            if m:
                                import datetime
                                year = datetime.datetime.now().year
                                current_date_str = f"{year}/{int(m.group(1)):02d}/{int(m.group(2)):02d}"
                        
                        # Collect links under this date
                        links = child.find_all('a', href=True)
                        for a in links:
                            href = a['href']
                            if 'youtube.com/watch' not in href and 'youtu.be' not in href:
                                continue
                            
                            datetime_div = a.find('div', class_='datetime')
                            name_div = a.find('div', class_='name')
                            
                            time_str = "Unknown"
                            name = "Unknown"
                            
                            if datetime_div:
                                time_str = datetime_div.get_text(strip=True)
                                import re
                                m = re.search(r'\d{2}:\d{2}', time_str)
                                if m:
                                    time_str = m.group(0)
                            
                            if name_div:
                                name = name_div.get_text(strip=True)
                            
                            # Fallback
                            if time_str == "Unknown" or name == "Unknown":
                                text = a.get_text(separator="\n", strip=True)
                                lines = text.split('\n')
                                if len(lines) >= 2:
                                    for line in lines:
                                         if re.match(r'\d{2}:\d{2}', line):
                                             time_str = line
                                         elif name == "Unknown" and line != time_str:
                                             name = line

                            # Thumbnail Extraction (YouTube thumbnail, not the small youtube.png icon)
                            thumbnail = ""
                            for img_tag in a.find_all('img'):
                                src = img_tag.get('src', '')
                                if 'img.youtube.com' in src or 'i.ytimg.com' in src:
                                    thumbnail = src
                                    break
                            if not thumbnail:
                                m_id = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', href)
                                if m_id:
                                    thumbnail = f"https://i.ytimg.com/vi/{m_id.group(1)}/mqdefault.jpg"
                            
                            # Live Status Check
                            # Hololive adds a red border style `border: 3px solid red` to live items
                            style = a.get('style', '')
                            is_live = False
                            if 'border' in style.lower() and ('red' in style.lower() or '3px' in style.lower()):
                                is_live = True

                            platform = 'twitch' if 'twitch.tv' in href else 'youtube'
                            raw_items.append({
                                'date': current_date_str,
                                'time': time_str,
                                'is_live': is_live,
                                'member': name,
                                'url': href,
                                'thumbnail': thumbnail,
                                'platform': platform
                            })
            else:
                 # Fallback if structure changes
                 pass
            
            # Now fetch titles using thread pool
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                # map URL to future
                future_to_item = {executor.submit(self.fetch_oembed_title, item['url']): item for item in raw_items}
                
                for future in concurrent.futures.as_completed(future_to_item):
                    item = future_to_item[future]
                    try:
                        title = future.result()
                    except Exception as e:
                        title = "Title Unavailable"
                    
                    item['title'] = title
                    schedule_data.append(item)
            
            # Do NOT sort by time string. Trust the scraping order (which follows page order).
            
            return schedule_data

        except Exception as e:
            print(f"Error scraping Hololive: {e}")
            return []

    def fetch_oembed_title(self, video_url):
        if video_url in self._title_cache:
            return self._title_cache[video_url]
            
        # YouTube oEmbed endpoint
        oembed_url = f"https://www.youtube.com/oembed?url={video_url}&format=json"
        try:
             res = requests.get(oembed_url, timeout=3)
             if res.status_code == 200:
                 data = res.json()
                 title = data.get('title', 'Title Unavailable')
                 self._title_cache[video_url] = title
                 return title
        except:
            pass
        return "Title Unavailable"
