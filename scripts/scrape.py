import os
import sys
import json
import datetime
import concurrent.futures

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.scrapers.hololive import HololiveScraper
from scripts.scrapers.nijisanji import NijisanjiScraper
from scripts.scrapers.vspo import VspoScraper

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def fetch_group(name, scraper_cls):
    print(f"[{name}] Scraping started...")
    try:
        scraper = scraper_cls()
        data = scraper.get_schedule()
        print(f"[{name}] Successfully fetched {len(data)} items.")
        return name, data
    except Exception as e:
        print(f"[{name}] Error during scraping: {e}")
        return name, []

def main():
    print("=== VTuber Schedule Scraper ===")
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    output_dir = os.path.join(base_dir, "public", "data")
    os.makedirs(output_dir, exist_ok=True)
    out_file = os.path.join(output_dir, "schedule.json")

    # Load previous data for fallback if exists
    previous_schedules = {}
    if os.path.exists(out_file):
        try:
            with open(out_file, "r", encoding="utf-8") as f:
                prev = json.load(f)
                previous_schedules = prev.get("schedules", {})
        except Exception:
            pass

    scrapers = [
        ("hololive", HololiveScraper),
        ("nijisanji", NijisanjiScraper),
        ("vspo", VspoScraper),
    ]

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(fetch_group, name, cls) for name, cls in scrapers]
        for future in concurrent.futures.as_completed(futures):
            name, data = future.result()
            # If current scrape failed but previous exists, retain previous to prevent data wipe
            if not data and previous_schedules.get(name):
                print(f"[{name}] Using cached data from previous run ({len(previous_schedules[name])} items)")
                results[name] = previous_schedules[name]
            else:
                results[name] = data

    # JST timestamp
    jst_tz = datetime.timezone(datetime.timedelta(hours=9))
    now_jst = datetime.datetime.now(jst_tz)

    output_payload = {
        "updated_at": now_jst.isoformat(),
        "updated_at_display": now_jst.strftime("%Y/%m/%d %H:%M:%S (JST)"),
        "counts": {
            "hololive": len(results.get("hololive", [])),
            "nijisanji": len(results.get("nijisanji", [])),
            "vspo": len(results.get("vspo", [])),
            "total": sum(len(v) for v in results.values())
        },
        "schedules": results
    }

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, ensure_ascii=False, indent=2)

    print(f"=== Saved {output_payload['counts']['total']} items to {out_file} ===")

if __name__ == "__main__":
    main()
