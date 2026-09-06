# -*- coding: utf-8 -*-
"""거래소 정적 데이터로 아이템 DB의 빈 곳을 채운다 — 게임 데이터 추출 없이.

전체 파이프라인(main.py --pull)은 `pathofexile-dat`로 게임 클라이언트를 뜯어야 한다.
리그가 바뀌면 화폐·조각·룬·소울 코어 같은 '정적' 아이템이 먼저 늘어나는데, 그건
거래소의 /api/trade2/data/static 만으로 9개 언어 이름·아이콘·거래 태그를 다 알 수 있다.
2026-09-07 유저 제보("신성한 꽃"이 알 수 없는 아이템)로 만들었다 — 그때 63개가 비어 있었다.

    python dataParser/src/fill_from_static.py            # 빠진 것을 9개 언어 items.ndjson 끝에 덧붙인다
    python dataParser/src/fill_from_static.py --dry      # 무엇이 빠졌는지만 본다

끝나면 renderer 에서 `npm run make-index-files` (package 스크립트가 알아서 돈다).
category 는 같은 부류의 기존 항목에서 물려받는다 — 룬은 Iron Rune, 소울 코어는
Soul Core of Azcapa, 열쇠는 Azmeri Reliquary Key, 계보 젬은 Zarokh's Refrain, 그 밖은 Chaos Orb.
"""
import json
import sys
import urllib.request
from pathlib import Path

LANG_URLS = {
    "en": "https://www.pathofexile.com",
    "ru": "https://ru.pathofexile.com",
    "ko": "https://poe.game.daum.net",
    "cmn-Hant": "https://pathofexile.tw",
    "ja": "https://jp.pathofexile.com",
    "de": "https://de.pathofexile.com",
    "es": "https://es.pathofexile.com",
    "pt": "https://br.pathofexile.com",
    "fr": "https://fr.pathofexile.com",
}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OAuth poe2-sise/1.1 (contact: skekdi4561@gmail.com)"
DATA = Path(__file__).resolve().parents[2] / "renderer" / "public" / "data"


def fetch_static(lang):
    req = urllib.request.Request(LANG_URLS[lang] + "/api/trade2/data/static",
                                 headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def entries(static):
    out = {}
    for g in static["result"]:
        for e in g.get("entries", []):
            if e["id"] == "sep":                 # 거래소 목록의 구분선
                continue
            out[e["id"]] = (g["id"], e["text"], e.get("image", ""))
    return out


def sibling(by_ref, tag, group, text):
    if "soul-core" in tag:
        return by_ref["Soul Core of Azcapa"]
    if group == "Runes":
        return by_ref["Iron Rune"]
    if "Reliquary Key" in text:
        return by_ref["Azmeri Reliquary Key"]
    if group == "LineageSupportGems":
        return by_ref["Zarokh's Refrain"]
    if group == "Ritual" and "splinter" not in tag and "omen" not in tag:
        return by_ref["Simulacrum"]             # 지도 조각류 (신성한 꽃)
    return by_ref["Chaos Orb"]


def main(dry=False):
    static = {l: fetch_static(l) for l in LANG_URLS}
    en = entries(static["en"])
    db_en = [json.loads(l) for l in (DATA / "en/items.ndjson").read_text(encoding="utf-8").splitlines() if l.strip()]
    have_tags = {x.get("tradeTag") for x in db_en}
    have_names = {x.get("refName") for x in db_en}
    by_ref = {x["refName"]: x for x in db_en if "refName" in x}
    missing = {k: v for k, v in en.items() if k not in have_tags and v[1] not in have_names}
    print("거래소 정적 %d개 중 DB에 없는 것 %d개" % (len(en), len(missing)))
    new = {l: [] for l in LANG_URLS}
    for tag, (group, text, image) in sorted(missing.items(), key=lambda kv: kv[1][1]):
        sib = sibling(by_ref, tag, group, text)
        print("  %-18s %-40s <- %s" % (group, text, sib["craftable"]["category"]))
        for l in LANG_URLS:
            e = entries(static[l]).get(tag)
            obj = {"name": e[1] if e else text, "refName": text, "namespace": sib["namespace"],
                   "icon": ("https://web.poecdn.com" + image) if image else sib["icon"],
                   "tags": [t for t in sib.get("tags", [])
                            if not t.endswith("_normal") and not t.startswith("soul_core_tier")],
                   "tradeTag": tag, "craftable": dict(sib.get("craftable", {})), "w": 1, "h": 1}
            if "gem" in sib:
                obj["gem"] = dict(sib["gem"])
            new[l].append(obj)
    if dry or not missing:
        return
    for l, objs in new.items():
        p = DATA / l / "items.ndjson"
        s = p.read_text(encoding="utf-8")
        if not s.endswith("\n"):
            s += "\n"
        p.write_text(s + "".join(json.dumps(o, ensure_ascii=False) + "\n" for o in objs),
                     encoding="utf-8")
    print("덧붙임: 언어당 %d개. 이제 renderer 에서 npm run make-index-files" % len(missing))


if __name__ == "__main__":
    main(dry="--dry" in sys.argv)
