import os
import re
import requests
from bs4 import BeautifulSoup
import json
import time

HEROS_URL = "https://overwatch.weirdgloop.org/w/Heroes"

def get_heros():
    response = requests.get(HEROS_URL)

    if response.status_code != 200:
        raise Exception(f"Failed to fetch heroes. Status code: {response.status_code}")

    soup = BeautifulSoup(response.content, "html.parser")
    heros_table = soup.find("table", class_="navbox").find("tbody").find_all("li")

    heros_data = {}
    current_role = None
    current_sub_role = None
    for hero in reversed(heros_table):
        hero_name = hero.text.strip()
        img_url = hero.find('img').get('src')
        img_url = img_url.split('?')[0]

        if "[" in hero_name:
            hero_name, role_info = hero_name.split("[", 1)
            match = re.search(r'Sub-Role\s+(\w+)\s+(\w+)', role_info)
            if match:
                current_role = match.group(1)
                current_sub_role = match.group(2)

        heros_data[hero_name] = {
            "role": current_role,
            "sub_role": current_sub_role,
            "img": "https://overwatch.weirdgloop.org" + img_url
        }

    return heros_data

def get_sprays():
    BASE = "https://overhub.gg/v1/cosmetics"
    HEADERS = {
        "Accept": "*/*",
        "Referer": "https://overhub.gg/cosmetics?type=Spray",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    "Version/18.6 Safari/605.1.15",
    }

    PAGE_SIZE = 100   # server max
    all_sprays = []
    page = 1

    while True:
        params = {
            "type": "Spray",
            "sort": "name",
            "page": page,
            "pageSize": PAGE_SIZE,
        }
        r = requests.get(BASE, params=params, headers=HEADERS, timeout=30)
        r.raise_for_status()
        data = r.json()

        items = data.get("items", [])
        total = data.get("total")
        total_pages = data.get("totalPages")

        print(f"page {page}/{total_pages}: got {len(items)} items (total={total})")

        all_sprays.extend(items)

        if not items:
            break
        if total is not None and len(all_sprays) >= total:
            break
        if total_pages is not None and page >= total_pages:
            break

        page += 1
        time.sleep(0.25)   # be polite; bump to 0.5-1.0 if you get 429s

    # Safety de-dupe on guid
    seen = set()
    unique = [s for s in all_sprays if not (s["guid"] in seen or seen.add(s["guid"]))]

    return unique

def load_existing(path):
    """Return {guid: item} for whatever is already saved, or {} if none."""
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: {path} is not valid JSON, starting fresh.")
            return {}
    # handle both {"items": [...]} and bare [...]
    items = data["items"] if isinstance(data, dict) and "items" in data else data
    return {item["guid"]: item for item in items if "guid" in item}


if __name__ == "__main__":
    # heros = get_heros()
    get_sprays()