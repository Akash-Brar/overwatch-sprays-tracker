import re
import requests
from bs4 import BeautifulSoup

HEROS_URL = "https://overwatch.weirdgloop.org/w/Heroes"
SPRAYS_URL = "https://overwatch.weirdgloop.org/w/Sprays"

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

def get_sprays(heros):
    response = requests.get(SPRAYS_URL)

    if response.status_code != 200:
        raise Exception(f"Failed to fetch sprays. Status code: {response.status_code}")

    soup = BeautifulSoup(response.content, "html.parser")
    tables_list = soup.find_all("table", class_="wikitable")

    sprays_data = {}
    category = None
    sub_category = None
    for table in tables_list:
        table = table.find("tbody").find_all("tr")
