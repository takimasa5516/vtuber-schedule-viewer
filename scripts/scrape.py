import os
import sys
import json
import datetime
import concurrent.futures

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.scrapers.hololive import HololiveScraper
from scripts.scrapers.nijisanji import NijisanjiScraper
from scripts.scrapers.vspo import VspoScraper

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

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    output_dir = os.path.join(base_dir, "public", "data")
    os.makedirs(output_dir, exist_ok=True)
    
    out_file = os.path.join(output_dir, "schedule.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, ensure_ascii=False, indent=2)

    print(f"=== Saved {output_payload['counts']['total']} items to {out_file} ===")

if __name__ == "__main__":
    main()
