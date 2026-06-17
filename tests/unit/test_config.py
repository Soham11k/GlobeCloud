
from globe.config import parse_peer_urls


def test_parse_peer_urls():
    raw = "eu-west-1:https://eu.example.com,ap-south-1:https://ap.example.com"
    peers = parse_peer_urls(raw)
    assert peers["eu-west-1"] == "https://eu.example.com"
    assert peers["ap-south-1"] == "https://ap.example.com"


def test_parse_peer_urls_empty():
    assert parse_peer_urls("") == {}
