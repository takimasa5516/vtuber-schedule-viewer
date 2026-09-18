import abc
from typing import List, Dict

class BaseScraper(abc.ABC):
    @abc.abstractmethod
    def get_schedule(self) -> List[Dict[str, str]]:
        """
        Fetches the schedule and returns a list of dictionaries.
        Each dictionary should have:
        - time: str (HH:MM format if possible)
        - member: str (Name of the streamer)
        - title: str (Stream title)
        - url: str (Stream URL)
        - thumbnail: str (URL to thumbnail image, optional)
        """
        pass
