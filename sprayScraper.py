import requests
from bs4 import BeautifulSoup

HEROS_URL = "https://overwatch.weirdgloop.org/w/Heroes"
SPRAYS_URL = "https://overwatch.weirdgloop.org/w/Sprays"

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
        