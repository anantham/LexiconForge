import os
import json
import re

ST_BASE = "../ST/novel-analyzer/vault/Forty Millenniums of Cultivation"
LF_BASE = "data/Novels/forty-millenniums-of-cultivation"

os.makedirs(LF_BASE, exist_ok=True)

# 1. Parse Glossary.md
glossary_entries = []
with open(f"{ST_BASE}/Glossary/Glossary.md", "r") as f:
    content = f.read()
    # Find table rows
    rows = re.findall(r"\| (.*?) \| (.*?) \| (.*?) \|", content)
    for eng, chi, exp in rows[1:]: # skip header and separator
        if eng.strip() == "English": continue
        glossary_entries.append({
            "source": eng.strip(),
            "target": f"{exp.strip()} ({chi.strip()})",
            "type": "terminology"
        })

# 2. Parse Character Cards
char_dir = f"{ST_BASE}/Character Cards"
for filename in os.listdir(char_dir):
    if filename.endswith(".md"):
        with open(f"{char_dir}/{filename}", "r") as f:
            content = f.read()
            # Extract basic info
            title_match = re.search(r"title: (.*)", content)
            chapter_range_match = re.search(r"chapter_range: (.*)", content)
            personality_match = re.search(r"## Personality\n\[Li Yao's Personality= (.*?)\]", content) # This was specific to Li Yao in my read_file but let's be more general
            
            # Let's just grab the title and chapter range for now as a glossary entry
            if title_match:
                name = title_match.group(1).strip()
                glossary_entries.append({
                    "source": name,
                    "target": f"Character: {name}. Version: {chapter_range_match.group(1).strip() if chapter_range_match else 'unknown'}",
                    "type": "character"
                })

# 3. Create glossary.json
glossary_layer = {
    "format": "lexiconforge-glossary",
    "tier": "book",
    "id": "fmc-st-glossary",
    "entries": glossary_entries
}

with open(f"{LF_BASE}/glossary.json", "w") as f:
    json.dump(glossary_layer, f, indent=2, ensure_ascii=False)

# 4. Create metadata.json (using fetched NovelUpdates info)
metadata = {
    "id": "forty-millenniums-of-cultivation",
    "title": "Forty Millenniums of Cultivation",
    "alternateTitles": [
        "Forty Thousand Years Of Cultivation",
        "Xiuzhen Si Wan Nian",
        "Starry Sky Forty Thousand Years (星域四万年)"
    ],
    "metadata": {
        "originalLanguage": "Chinese",
        "chapterCount": 3521,
        "genres": ["Action", "Adventure", "Fantasy", "Mecha", "School Life", "Sci-fi", "Seinen", "Xuanhuan"],
        "description": "In a world teeming with cultivators, Li Yao, who makes his living collecting scrap metal, encounters the soul of a titan powerhouse from forty thousand years in the past. Even if this universe is truly nothing more than a brutal bloody shadowy forest, we Cultivators will burn all that we have just to give off a single weak flickering spark in the darkness!",
        "author": "The Enlightened Master Crouching Cow (卧牛真人)",
        "sourceLinks": {
            "novelUpdates": "https://www.novelupdates.com/series/forty-millenniums-of-cultivation/"
        },
        "tags": ["Academy", "Artifact Crafting", "Cultivation", "Cunning Protagonist", "Futuristic Setting", "Genius Protagonist", "Money Grubber", "Outer Space", "Philosophical"],
        "publicationStatus": "Completed",
        "lastUpdated": "2026-04-08"
    },
    "versions": [
        {
            "versionId": "v1-st-enhanced",
            "displayName": "ST-Enhanced AI Translation",
            "translator": {
                "name": "LexiconForge (ST Bridge)",
                "link": "https://github.com/anantham/LexiconForge"
            },
            "sessionJsonUrl": "./session.json",
            "targetLanguage": "English",
            "style": "faithful",
            "features": ["glossary", "character-cards"],
            "chapterRange": {"from": 1, "to": 3521},
            "completionStatus": "In Progress",
            "lastUpdated": "2026-04-08",
            "stats": {
                "downloads": 0,
                "fileSize": "0MB",
                "content": {
                    "totalImages": 0,
                    "totalFootnotes": 0,
                    "totalRawChapters": 3521,
                    "totalTranslatedChapters": 0,
                    "avgImagesPerChapter": 0,
                    "avgFootnotesPerChapter": 0
                },
                "translation": {
                    "translationType": "ai",
                    "feedbackCount": 0
                }
            },
            "glossaryLayers": [
                {
                    "tier": "book",
                    "id": "fmc-st-glossary",
                    "url": "./glossary.json"
                }
            ]
        }
    ]
}

with open(f"{LF_BASE}/metadata.json", "w") as f:
    json.dump(metadata, f, indent=2, ensure_ascii=False)

print(f"Generated metadata.json and glossary.json in {LF_BASE}")
