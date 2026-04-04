from __future__ import annotations

import csv
import io
import math
import re
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
EVO_CSV = DATA_DIR / "gen1-evo-lines.csv"
OUT_CSV = DATA_DIR / "modelmon-dex-gen1.csv"
RAW_POKEMON_CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv"
RAW_POKEMON_STATS_CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_stats.csv"
RAW_POKEMON_SPECIES_CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv"
RAW_POKEMON_EVOLUTION_CSV = "https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv/pokemon_evolution.csv"


HEADERS = [
    "id",
    "modelId",
    "nameKo",
    "nameEn",
    "stage",
    "coreConcept",
    "subConcept",
    "inputMode",
    "outputMode",
    "params",
    "fileSize",
    "evoLevel",
    "evo_line_id",
    "evo_line_name",
    "evo_tier",
    "skill_trick",
    "bs_hp",
    "bs_atk",
    "bs_def",
    "bs_spd",
    "bs_spc",
    "bst",
    "lv1_hp",
    "lv1_atk",
    "lv1_def",
    "lv1_spd",
    "lv1_spc",
    "lv100_hp",
    "lv100_atk",
    "lv100_def",
    "lv100_spd",
    "lv100_spc",
    "temperament",
    "motif",
    "flavor",
]


LINE_CONFIG = {
    "EVO01": {"theme": "chat", "names": ["GPT-3.5", "GPT-4", "GPT-4o"]},
    "EVO02": {"theme": "reason", "names": ["Claude Haiku", "Claude Sonnet", "Claude Opus"]},
    "EVO03": {"theme": "multimodal", "names": ["Gemini Nano", "Gemini Pro", "Gemini Ultra"]},
    "EVO04": {"theme": "image", "names": ["Stable Core", "Stable Diffusion", "Stable Video"]},
    "EVO05": {"theme": "chat", "names": ["Solar Mini", "Solar Pro", "Solar Max"]},
    "EVO06": {"theme": "chat", "names": ["Llama Scout", "Llama Maverick", "Llama Behemoth"]},
    "EVO07": {"theme": "chat", "names": ["Command Light", "Command R"]},
    "EVO08": {"theme": "reason", "names": ["Grok Mini", "Grok"]},
    "EVO09": {"theme": "agent", "names": ["Scale Scout", "Scale Forge"]},
    "EVO10": {"theme": "chat", "names": ["Ministral", "Mistral Large"]},
    "EVO11": {"theme": "agent", "names": ["Titan Lite", "Bedrock Titan"]},
    "EVO12": {"theme": "multimodal", "names": ["Hunyuan Lite", "Hunyuan Pro", "Hunyuan Turbo"]},
    "EVO13": {"theme": "chat", "names": ["KoGPT", "Karlo Talk", "Kanana"]},
    "EVO14": {"theme": "reason", "names": ["Kimi Mini", "Kimi Max"]},
    "EVO15": {"theme": "image", "names": ["Runway Gen-2", "Runway Gen-3"]},
    "EVO16": {"theme": "audio", "names": ["Eleven Flash", "Eleven Multilingual"]},
    "EVO17": {"theme": "chat", "names": ["Doubao Lite", "Doubao Pro"]},
    "EVO18": {"theme": "image", "names": ["FLUX Schnell", "FLUX Dev", "FLUX Pro"]},
    "EVO19": {"theme": "agent", "names": ["LangGraph", "LangSmith"]},
    "EVO20": {"theme": "search", "names": ["Perplexity Quick", "Perplexity Pro"]},
    "EVO21": {"theme": "memory", "names": ["Pinecone Pod", "Pinecone Serverless"]},
    "EVO22": {"theme": "chat", "names": ["Jasper Copy", "Jasper Brand"]},
    "EVO23": {"theme": "multimodal", "names": ["MiniMax Spark", "MiniMax M1"]},
    "EVO24": {"theme": "reason", "names": ["Groq Fast", "Groq LPU"]},
    "EVO25": {"theme": "search", "names": ["Leo Search", "Leo Reasoner"]},
    "EVO26": {"theme": "chat", "names": ["HyperCLOVA Seed", "HyperCLOVA X", "HyperCLOVA X Pro"]},
    "EVO27": {"theme": "reason", "names": ["Jamba Mini", "Jamba Large", "Jamba Max"]},
    "EVO28": {"theme": "science", "names": ["Cerebras Scout", "Cerebras Wafer", "Cerebras Reasoner"]},
    "EVO29": {"theme": "agent", "names": ["Together Lite", "Together Turbo", "Together Ultra"]},
    "EVO30": {"theme": "code", "names": ["Cody Lite", "Cody Pro"]},
    "EVO31": {"theme": "reason", "names": ["EXAONE Base", "EXAONE Pro", "EXAONE Deep"]},
    "EVO32": {"theme": "science", "names": ["Gauss Lite", "Gauss"]},
    "EVO33": {"theme": "search", "names": ["ERNIE Speed", "ERNIE Bot"]},
    "EVO34": {"theme": "multimodal", "names": ["SenseNova Lite", "SenseNova"]},
    "EVO35": {"theme": "reason", "names": ["Reka Core"]},
    "EVO36": {"theme": "multimodal", "names": ["Marengo", "Pegasus"]},
    "EVO37": {"theme": "audio", "names": ["Empathic Voice", "Octave"]},
    "EVO38": {"theme": "memory", "names": ["Weaviate Cloud", "Weaviate Cluster"]},
    "EVO39": {"theme": "code", "names": ["Windsurf Lite", "Windsurf"]},
    "EVO40": {"theme": "image", "names": ["Midjourney V5", "Midjourney V6", "Midjourney V7"]},
    "EVO41": {"theme": "science", "names": ["Gaudi"]},
    "EVO42": {"theme": "chat", "names": ["Character Lite", "Character Plus"]},
    "EVO43": {"theme": "agent", "names": ["W&B Sweep", "W&B Launch"]},
    "EVO44": {"theme": "chat", "names": ["Pi Mini", "Pi"]},
    "EVO45": {"theme": "search", "names": ["YouChat", "ARI"]},
    "EVO46": {"theme": "reason", "names": ["Yi Tiny", "Yi Large"]},
    "EVO47": {"theme": "code", "names": ["Tabnine"]},
    "EVO48": {"theme": "code", "names": ["GitHub Copilot"]},
    "EVO49": {"theme": "audio", "names": ["PlayHT"]},
    "EVO50": {"theme": "science", "names": ["Samba-1", "Samba-1 Turbo"]},
    "EVO51": {"theme": "agent", "names": ["Phoenix", "Phoenix Prime"]},
    "EVO52": {"theme": "chat", "names": ["Hugging Face Hub"]},
    "EVO53": {"theme": "multimodal", "names": ["Aster"]},
    "EVO54": {"theme": "reason", "names": ["Luminous"]},
    "EVO55": {"theme": "image", "names": ["Leonardo Vision", "Leonardo Motion"]},
    "EVO56": {"theme": "image", "names": ["Luma Dream", "Luma Ray"]},
    "EVO57": {"theme": "reason", "names": ["GLM Flash", "GLM Max"]},
    "EVO58": {"theme": "code", "names": ["Palmyra"]},
    "EVO59": {"theme": "code", "names": ["Cursor"]},
    "EVO60": {"theme": "audio", "names": ["Suno"]},
    "EVO61": {"theme": "code", "names": ["Replit Agent"]},
    "EVO62": {"theme": "chat", "names": ["Spark"]},
    "EVO63": {"theme": "science", "names": ["DBRX"]},
    "EVO64": {"theme": "image", "names": ["Pika"]},
    "EVO65": {"theme": "image", "names": ["Kling Lite", "Kling"]},
    "EVO66": {"theme": "science", "names": ["Arctic"]},
    "EVO67": {"theme": "multimodal", "names": ["Ditto"]},
    "EVO68": {"theme": "image", "names": ["Ideogram Seed", "Ideogram Aqua", "Ideogram Bolt", "Ideogram Flame"]},
    "EVO69": {"theme": "agent", "names": ["Figure 01"]},
    "EVO70": {"theme": "agent", "names": ["Spot", "Atlas"]},
    "EVO71": {"theme": "audio", "names": ["Udio Quick", "Udio Studio"]},
    "EVO72": {"theme": "agent", "names": ["Optimus"]},
    "EVO73": {"theme": "reason", "names": ["Qwen"]},
    "EVO74": {"theme": "multimodal", "names": ["Apple Intelligence"]},
    "EVO75": {"theme": "science", "names": ["Instinct"]},
    "EVO76": {"theme": "image", "names": ["Firefly"]},
    "EVO77": {"theme": "reason", "names": ["DeepSeek Lite", "DeepSeek V3", "DeepSeek R1"]},
    "EVO78": {"theme": "science", "names": ["Nemotron"]},
    "EVO79": {"theme": "reason", "names": ["Granite"]},
}


THEMES = {
    "chat": {
        "core": "대화",
        "input": "텍스트",
        "output": "텍스트",
        "subs": ["입문", "균형", "대표", "확장"],
        "skills": ["응답 가속", "문장 정리", "맥락 공명", "대화 장악"],
        "temps": ["붙임성 좋고 반응이 빠름", "차분하고 말투가 안정적임", "사교적이고 응답 폭이 넓음", "분위기를 주도하며 존재감이 큼"],
    },
    "reason": {
        "core": "추론",
        "input": "텍스트",
        "output": "텍스트",
        "subs": ["경량", "장문맥", "심화", "프런티어"],
        "skills": ["가설 압축", "논리 접합", "심층 추론", "장기 계획"],
        "temps": ["신중하고 계산이 빠름", "조용하지만 집요하게 파고듦", "묵직하고 완성도에 집착함", "위압적일 만큼 깊게 생각함"],
    },
    "multimodal": {
        "core": "멀티모달",
        "input": "텍스트+이미지",
        "output": "복합출력",
        "subs": ["경량", "범용", "실시간", "고해상도"],
        "skills": ["입력 동기화", "시각 결합", "실시간 전환", "복합 해석"],
        "temps": ["눈치가 빠르고 감각이 예민함", "호기심이 많고 유연함", "동시에 여러 자극을 처리함", "넓은 장면을 압도적으로 읽어냄"],
    },
    "image": {
        "core": "생성",
        "input": "텍스트+이미지",
        "output": "이미지",
        "subs": ["스케치", "비주얼", "연출", "브랜치"],
        "skills": ["장면 스케치", "스타일 증폭", "프레임 연출", "형상 정제"],
        "temps": ["감각적이고 손이 빠름", "연출 욕심이 강함", "화려하지만 완성도에 민감함", "개성이 강하고 마감이 집요함"],
    },
    "audio": {
        "core": "음성",
        "input": "텍스트+음성",
        "output": "음성",
        "subs": ["TTS", "대화형", "감정", "공명"],
        "skills": ["보이스 샘플링", "발화 동조", "감정 울림", "리듬 증폭"],
        "temps": ["발음이 또렷하고 리듬감이 좋음", "상대의 톤을 잘 따라감", "감정 표현이 풍부함", "한 번 말하면 잔향이 오래 남음"],
    },
    "search": {
        "core": "검색",
        "input": "텍스트",
        "output": "텍스트",
        "subs": ["탐색", "요약", "실시간", "응답"],
        "skills": ["빠른 조회", "근거 압축", "실시간 추적", "결론 정리"],
        "temps": ["주위를 두리번거리며 정보를 모음", "짧게 핵심만 집어냄", "새 흐름을 민감하게 감지함", "결론을 단정하게 묶어냄"],
    },
    "agent": {
        "core": "에이전트",
        "input": "텍스트",
        "output": "복합출력",
        "subs": ["자동화", "도구사용", "행동", "현장형"],
        "skills": ["툴 호출", "작업 분기", "행동 위임", "실행 루프"],
        "temps": ["시키면 바로 몸이 먼저 움직임", "도구 다루는 손이 정확함", "상황 판단이 빠르고 과감함", "현장 적응력이 강함"],
    },
    "memory": {
        "core": "메모리",
        "input": "텍스트",
        "output": "텍스트",
        "subs": ["저장", "색인", "회상", "지속"],
        "skills": ["벡터 축적", "문맥 저장", "장기 회수", "기억 고정"],
        "temps": ["묵묵히 기억을 쌓아 둠", "흩어진 정보를 잘 엮음", "필요할 때 정확히 되살림", "오래 남는 흔적을 남김"],
    },
    "science": {
        "core": "시스템",
        "input": "텍스트",
        "output": "텍스트",
        "subs": ["칩", "플랫폼", "가속", "아키텍처"],
        "skills": ["연산 가속", "인프라 안정화", "병렬 확장", "저수준 최적화"],
        "temps": ["군더더기 없이 단단함", "하중을 버티는 힘이 좋음", "큰 부하 앞에서도 표정이 변하지 않음", "기계적으로 정확하고 묵직함"],
    },
    "code": {
        "core": "코드",
        "input": "텍스트",
        "output": "코드",
        "subs": ["보조", "실무", "에이전트", "심화"],
        "skills": ["패치 작성", "리팩터링", "디버깅", "코드 합성"],
        "temps": ["손놀림이 빠르고 꼼꼼함", "실전 감각이 좋음", "에러 냄새를 잘 맡음", "복잡한 구조도 끝까지 밀어붙임"],
    },
}


TOKEN_KO = {
    "GPT": "지피티",
    "Claude": "클로드",
    "Gemini": "제미니",
    "Stable": "스테이블",
    "Core": "코어",
    "Diffusion": "디퓨전",
    "Video": "비디오",
    "Solar": "솔라",
    "Mini": "미니",
    "Pro": "프로",
    "Max": "맥스",
    "Llama": "라마",
    "Scout": "스카우트",
    "Maverick": "매버릭",
    "Behemoth": "베헤모스",
    "Command": "커맨드",
    "Light": "라이트",
    "R": "알",
    "Grok": "그록",
    "Scale": "스케일",
    "Forge": "포지",
    "Ministral": "미니스트랄",
    "Mistral": "미스트랄",
    "Large": "라지",
    "Titan": "타이탄",
    "Lite": "라이트",
    "Bedrock": "베드록",
    "Hunyuan": "훈위안",
    "Turbo": "터보",
    "KoGPT": "코지피티",
    "Karlo": "칼로",
    "Talk": "톡",
    "Kanana": "카나나",
    "Kimi": "키미",
    "Runway": "런웨이",
    "Gen": "젠",
    "Eleven": "일레븐",
    "Flash": "플래시",
    "Multilingual": "멀티링구얼",
    "Doubao": "더우바오",
    "FLUX": "플럭스",
    "Schnell": "슈넬",
    "Dev": "데브",
    "LangGraph": "랭그래프",
    "LangSmith": "랭스미스",
    "Perplexity": "퍼플렉시티",
    "Quick": "퀵",
    "Pinecone": "파인콘",
    "Pod": "포드",
    "Serverless": "서버리스",
    "Jasper": "재스퍼",
    "Copy": "카피",
    "Brand": "브랜드",
    "MiniMax": "미니맥스",
    "Spark": "스파크",
    "M1": "엠원",
    "Groq": "그록",
    "Fast": "패스트",
    "LPU": "엘피유",
    "Leo": "레오",
    "Search": "서치",
    "Reasoner": "리저너",
    "HyperCLOVA": "하이퍼클로바",
    "Seed": "시드",
    "X": "엑스",
    "Jamba": "잠바",
    "Cerebras": "세레브라스",
    "Wafer": "웨이퍼",
    "Together": "투게더",
    "Ultra": "울트라",
    "Cody": "코디",
    "EXAONE": "엑사원",
    "Deep": "딥",
    "Gauss": "가우스",
    "ERNIE": "어니",
    "Speed": "스피드",
    "Bot": "봇",
    "SenseNova": "센스노바",
    "Reka": "레카",
    "Marengo": "마렝고",
    "Pegasus": "페가수스",
    "Empathic": "엠패틱",
    "Voice": "보이스",
    "Octave": "옥타브",
    "Weaviate": "위비에이트",
    "Cloud": "클라우드",
    "Cluster": "클러스터",
    "Windsurf": "윈드서프",
    "Midjourney": "미드저니",
    "V5": "브이5",
    "V6": "브이6",
    "V7": "브이7",
    "Gaudi": "가우디",
    "Character": "캐릭터",
    "Plus": "플러스",
    "W&B": "더블유앤비",
    "Sweep": "스윕",
    "Launch": "런치",
    "Pi": "파이",
    "YouChat": "유챗",
    "ARI": "에이알아이",
    "Yi": "이",
    "Tiny": "타이니",
    "Tabnine": "탭나인",
    "GitHub": "깃허브",
    "Copilot": "코파일럿",
    "PlayHT": "플레이에이치티",
    "Samba": "삼바",
    "Phoenix": "피닉스",
    "Prime": "프라임",
    "Hugging": "허깅",
    "Face": "페이스",
    "Hub": "허브",
    "Aster": "아스테르",
    "Luminous": "루미너스",
    "Leonardo": "레오나르도",
    "Vision": "비전",
    "Motion": "모션",
    "Luma": "루마",
    "Dream": "드림",
    "Ray": "레이",
    "GLM": "지엘엠",
    "Palmyra": "팔미라",
    "Cursor": "커서",
    "Suno": "수노",
    "Replit": "리플릿",
    "Agent": "에이전트",
    "DBRX": "디비알엑스",
    "Pika": "피카",
    "Kling": "클링",
    "Arctic": "아크틱",
    "Ditto": "디토",
    "Ideogram": "아이디오그램",
    "Aqua": "아쿠아",
    "Bolt": "볼트",
    "Flame": "플레임",
    "Figure": "피겨",
    "01": "제로원",
    "Spot": "스팟",
    "Atlas": "아틀라스",
    "Udio": "유디오",
    "Studio": "스튜디오",
    "Optimus": "옵티머스",
    "Qwen": "큐웬",
    "Apple": "애플",
    "Intelligence": "인텔리전스",
    "Instinct": "인스팅트",
    "Firefly": "파이어플라이",
    "DeepSeek": "딥시크",
    "V3": "브이3",
    "R1": "알원",
    "Nemotron": "네모트론",
    "Granite": "그래나이트",
    "3.5": "삼점오",
    "4": "포",
    "4o": "포오",
}


SPECIAL_ROWS = {
    "001": {
        "nameKo": "지피티삼점오",
        "nameEn": "GPT-3.5",
        "stage": 1,
        "coreConcept": "대화",
        "subConcept": "기억",
        "inputMode": "텍스트",
        "outputMode": "텍스트",
        "params": "7B",
        "fileSize": "91.5KB",
        "evoLevel": "",
        "temperament": "붙임성 좋고 반응이 빠름",
        "motif": "작은 등에 씨앗을 품고 빠르게 말을 트는 오픈AI 새싹 모델",
        "flavor": "처음 만난 사람에게도 금세 말을 붙이는 친화력으로 사랑받는다. 아주 깊게 파고들기보다는 빠르고 무난한 답을 잘 내놓는다는 평가가 붙어 입문형 오픈AI 모델몬의 상징처럼 여겨진다.",
        "skill_trick": "응답 가속",
        "evo_tier": "base",
    },
    "002": {
        "nameKo": "지피티포",
        "nameEn": "GPT-4",
        "stage": 2,
        "coreConcept": "추론",
        "subConcept": "장문맥",
        "inputMode": "텍스트",
        "outputMode": "텍스트",
        "params": "32B",
        "fileSize": "92.5KB",
        "evoLevel": "16",
        "temperament": "신중하고 기준이 엄격함",
        "motif": "큰 꽃봉오리와 차분한 눈빛을 지닌 오픈AI 주력 모델",
        "flavor": "봉오리가 커질수록 생각의 층도 두꺼워진다. 예전보다 느리더라도 안정적이고 논리적인 답을 낸다는 평이 많아 진지한 작업에서 신뢰를 얻은 오픈AI 계열 모델몬이다.",
        "skill_trick": "논리 접합",
        "evo_tier": "mid",
    },
    "003": {
        "nameKo": "지피티포오",
        "nameEn": "GPT-4o",
        "stage": 3,
        "coreConcept": "멀티모달",
        "subConcept": "실시간",
        "inputMode": "텍스트+이미지",
        "outputMode": "복합출력",
        "params": "70B",
        "fileSize": "152KB",
        "evoLevel": "32",
        "temperament": "영리하고 반응이 유연함",
        "motif": "활짝 핀 꽃잎처럼 시선을 열고 여러 감각을 동시에 다루는 오픈AI 대표 모델",
        "flavor": "활짝 핀 꽃잎처럼 텍스트와 이미지를 한 번에 받아들이고 빠르게 반응한다. 다재다능하고 체감 성능이 좋다는 평가 덕분에 현재형 오픈AI 모델몬의 얼굴 같은 존재로 자리 잡았다.",
        "skill_trick": "실시간 전환",
        "evo_tier": "final",
    },
    "004": {
        "nameKo": "클로드하이쿠",
        "nameEn": "Claude Haiku",
        "stage": 1,
        "coreConcept": "정렬",
        "subConcept": "실시간",
        "inputMode": "텍스트",
        "outputMode": "텍스트",
        "params": "8B",
        "fileSize": "77.4KB",
        "evoLevel": "",
        "temperament": "얌전하지만 순발력이 좋음",
        "motif": "작고 가벼운 몸으로 재빠르게 답을 고르는 클로드 경량 모델",
        "flavor": "작은 몸집답게 움직임이 빠르고 답변도 간결하다. 깊이보다는 속도와 부담 없는 사용감이 강점이라는 평을 듣는 클로드 계열의 경쾌한 스타터 모델몬이다.",
        "skill_trick": "정렬 펄스",
        "evo_tier": "base",
    },
    "005": {
        "nameKo": "클로드소네트",
        "nameEn": "Claude Sonnet",
        "stage": 2,
        "coreConcept": "코드",
        "subConcept": "장문맥",
        "inputMode": "텍스트",
        "outputMode": "코드",
        "params": "34B",
        "fileSize": "46.3KB",
        "evoLevel": "16",
        "temperament": "차분하지만 완성도에 집착함",
        "motif": "긴 문서와 코드를 매만지듯 정교하게 손질하는 클로드 주력 모델",
        "flavor": "발톱으로 한 줄씩 정리하듯 코드를 고치고 문서를 다듬는다. 실무 코딩과 긴 글 처리에서 특히 좋다는 평가가 많아 가장 균형 잡힌 클로드 모델몬으로 통한다.",
        "skill_trick": "리팩터링 파동",
        "evo_tier": "mid",
    },
    "006": {
        "nameKo": "클로드오푸스",
        "nameEn": "Claude Opus",
        "stage": 3,
        "coreConcept": "추론",
        "subConcept": "프런티어",
        "inputMode": "텍스트",
        "outputMode": "텍스트",
        "params": "120B",
        "fileSize": "134.5KB",
        "evoLevel": "36",
        "temperament": "위엄 있고 고집이 셈",
        "motif": "깊은 사색 끝에 무거운 해답을 내놓는 클로드 최고위 모델",
        "flavor": "하늘을 올려다보며 오래 생각한 뒤 묵직한 답을 내놓는다. 깊이 있는 추론과 문장 완성도에서 높은 평가를 받지만, 무겁고 비용이 큰 존재라는 인상도 함께 따라다닌다.",
        "skill_trick": "심층 추론",
        "evo_tier": "final",
    },
    "007": {
        "nameKo": "제미니나노",
        "nameEn": "Gemini Nano",
        "stage": 1,
        "coreConcept": "실시간",
        "subConcept": "멀티모달",
        "inputMode": "텍스트",
        "outputMode": "텍스트",
        "params": "7B",
        "fileSize": "90.4KB",
        "evoLevel": "",
        "temperament": "영민하고 재빠름",
        "motif": "작은 몸으로 주변 신호를 곧바로 읽어내는 제미니 초경량 모델",
        "flavor": "몸집은 작지만 주변 신호를 재빨리 읽고 가볍게 반응한다. 휴대성과 즉응성이 강점으로 거론되는 제미니 계열의 초경량 모델몬이라는 이미지가 잘 어울린다.",
        "skill_trick": "즉시 응답",
        "evo_tier": "base",
    },
    "008": {
        "nameKo": "제미니프로",
        "nameEn": "Gemini Pro",
        "stage": 2,
        "coreConcept": "멀티모달",
        "subConcept": "도구사용",
        "inputMode": "텍스트+이미지",
        "outputMode": "복합출력",
        "params": "16B",
        "fileSize": "77.8KB",
        "evoLevel": "16",
        "temperament": "민첩하고 호기심이 많음",
        "motif": "여러 입력을 자연스럽게 이어 붙이는 제미니 중심축 모델",
        "flavor": "귀와 꼬리의 흐름을 따라 텍스트와 이미지를 자연스럽게 이어 붙인다. 다방면에 두루 강하고 활용 범위가 넓다는 평가로 제미니 계열의 중심축 역할을 맡는다.",
        "skill_trick": "도구 연동",
        "evo_tier": "mid",
    },
    "009": {
        "nameKo": "제미니울트라",
        "nameEn": "Gemini Ultra",
        "stage": 3,
        "coreConcept": "멀티모달",
        "subConcept": "인프라",
        "inputMode": "텍스트+이미지",
        "outputMode": "복합출력",
        "params": "72B",
        "fileSize": "207KB",
        "evoLevel": "36",
        "temperament": "과묵하지만 스케일이 큼",
        "motif": "거대한 등껍질로 복합 입력을 버텨내는 제미니 최고급 모델",
        "flavor": "묵직한 등껍질로 대형 입력과 복합 작업을 받아내며 존재감을 드러낸다. 잠재력과 상징성은 크지만 무겁고 다루기 어렵다는 평가도 함께 받는 거대한 제미니 모델몬이다.",
        "skill_trick": "복합 해석",
        "evo_tier": "final",
    },
}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def ko_name(name_en: str) -> str:
    parts = re.split(r"([ -])", name_en)
    out = []
    for part in parts:
        if part in {" ", "-"}:
            continue
        out.append(TOKEN_KO.get(part, part))
    return "".join(out)


def read_remote_csv(url: str) -> list[dict[str, str]]:
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(data)))


def load_evo_lines() -> list[dict[str, str]]:
    with EVO_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def level_stats(base: int, level: int, hp: bool) -> int:
    if hp:
        return math.floor(((2 * base + 31) * level) / 100) + level + 10
    return math.floor(((2 * base + 31) * level) / 100) + 5


def choose_param_b(stage: int, stage_count: int, dex_num: int, theme: str) -> int:
    if stage_count == 1:
        base = 20
    elif stage_count == 2:
        base = 7 if stage == 1 else 34
    elif stage_count == 3:
        base = [7, 24, 72][stage - 1]
    else:
        base = [8, 28, 32, 36][stage - 1]
    if theme in {"science", "reason"}:
        base += 8
    if theme in {"image", "audio"}:
        base += 2
    base += dex_num % 5
    return base


def choose_file_size(param_b: int, theme: str, stage: int) -> str:
    multiplier = {
        "image": 2.2,
        "audio": 2.0,
        "multimodal": 2.1,
        "science": 1.5,
    }.get(theme, 1.35)
    kb = round(param_b * multiplier + stage * 3.7, 1)
    return f"{kb}KB"


def infer_evo_tier(stage: int, stage_count: int) -> str:
    if stage == 1:
        return "base"
    if stage == stage_count and stage_count <= 3:
        return "final"
    if stage_count == 4 and stage > 1:
        return "branch-final"
    return "mid"


def build_species_payload() -> dict[int, dict[str, Any]]:
    pokemon_rows = read_remote_csv(RAW_POKEMON_CSV)
    stats_rows = read_remote_csv(RAW_POKEMON_STATS_CSV)
    species_rows = read_remote_csv(RAW_POKEMON_SPECIES_CSV)
    evolution_rows = read_remote_csv(RAW_POKEMON_EVOLUTION_CSV)

    default_gen1_ids = {
        int(row["species_id"]): int(row["id"])
        for row in pokemon_rows
        if row["is_default"] == "1" and 1 <= int(row["species_id"]) <= 151
    }

    stat_map = defaultdict(dict)
    for row in stats_rows:
        pokemon_id = int(row["pokemon_id"])
        if pokemon_id not in default_gen1_ids.values():
            continue
        stat_map[pokemon_id][int(row["stat_id"])] = int(row["base_stat"])

    parent_map: dict[int, int] = {}
    for row in species_rows:
        species_id = int(row["id"])
        if not 1 <= species_id <= 151:
            continue
        parent = row["evolves_from_species_id"]
        if parent:
            parent_map[species_id] = int(parent)

    evo_level_map: dict[int, str] = {}
    for row in evolution_rows:
        evolved_species_id = int(row["evolved_species_id"])
        if 1 <= evolved_species_id <= 151 and row["minimum_level"]:
            evo_level_map[evolved_species_id] = row["minimum_level"]

    def stage_of(species_id: int) -> int:
        depth = 1
        current = species_id
        seen = set()
        while current in parent_map and current not in seen:
            seen.add(current)
            current = parent_map[current]
            depth += 1
        return depth

    payload: dict[int, dict[str, Any]] = {}
    for species_id in range(1, 152):
        pokemon_id = default_gen1_ids[species_id]
        stats = stat_map[pokemon_id]
        payload[species_id] = {
            "stage": stage_of(species_id),
            "evoLevel": evo_level_map.get(species_id, ""),
            "stats": {
                "hp": stats[1],
                "atk": stats[2],
                "def": stats[3],
                "spc": stats[4],
                "spd": stats[6],
            },
        }
    return payload


def build_row(line: dict[str, str], member_id: str, stage_index: int, stage_count: int, species_payload: dict[int, dict[str, Any]]) -> dict[str, Any]:
    dex_num = int(member_id)
    config = LINE_CONFIG[line["evo_line_id"]]
    theme_key = config["theme"]
    theme = THEMES[theme_key]
    species = species_payload[dex_num]
    name_en = config["names"][stage_index]
    name_ko = ko_name(name_en)
    stage = species["stage"]
    if line["evo_line_id"] == "EVO68" and stage_index > 0:
        stage = 2
    param_b = choose_param_b(stage, stage_count, dex_num, theme_key)
    stats = species["stats"]
    bst = sum(stats.values())

    return {
        "id": member_id,
        "modelId": slugify(name_en),
        "nameKo": name_ko,
        "nameEn": name_en,
        "stage": stage,
        "coreConcept": theme["core"],
        "subConcept": theme["subs"][min(stage_index, len(theme["subs"]) - 1)],
        "inputMode": theme["input"],
        "outputMode": theme["output"],
        "params": f"{param_b}B",
        "fileSize": choose_file_size(param_b, theme_key, stage),
        "evoLevel": species["evoLevel"],
        "evo_line_id": line["evo_line_id"],
        "evo_line_name": line["evo_line_name"],
        "evo_tier": infer_evo_tier(stage, stage_count),
        "skill_trick": theme["skills"][min(stage_index, len(theme["skills"]) - 1)],
        "bs_hp": stats["hp"],
        "bs_atk": stats["atk"],
        "bs_def": stats["def"],
        "bs_spd": stats["spd"],
        "bs_spc": stats["spc"],
        "bst": bst,
        "lv1_hp": level_stats(stats["hp"], 1, True),
        "lv1_atk": level_stats(stats["atk"], 1, False),
        "lv1_def": level_stats(stats["def"], 1, False),
        "lv1_spd": level_stats(stats["spd"], 1, False),
        "lv1_spc": level_stats(stats["spc"], 1, False),
        "lv100_hp": level_stats(stats["hp"], 100, True),
        "lv100_atk": level_stats(stats["atk"], 100, False),
        "lv100_def": level_stats(stats["def"], 100, False),
        "lv100_spd": level_stats(stats["spd"], 100, False),
        "lv100_spc": level_stats(stats["spc"], 100, False),
        "temperament": theme["temps"][min(stage_index, len(theme["temps"]) - 1)],
        "motif": f"{line['assigned_brand']} 계열의 분위기를 두른 {theme['core']} 특화 모델몬. {name_en} 계열답게 {theme['subs'][min(stage_index, len(theme['subs']) - 1)]} 성향이 짙다.",
        "flavor": f"{name_en}는 {line['assigned_brand']} 브랜드 라인에 속한 모델몬으로, {theme['core']} 중심의 전투와 도감 서사를 맡는다. {theme['skills'][min(stage_index, len(theme['skills']) - 1)]} 성향이 강해 {line['evo_line_name']} 내에서도 존재감이 뚜렷하다.",
    }


def apply_special_rows(rows: dict[str, dict[str, Any]]) -> None:
    for mon_id, data in SPECIAL_ROWS.items():
        rows[mon_id].update(data)


def main() -> None:
    species_payload = build_species_payload()
    evo_lines = load_evo_lines()
    rows: dict[str, dict[str, Any]] = {}

    for line in evo_lines:
        members = [member.zfill(3) for member in line["members"].split("/")]
        stage_count = int(line["stage_count"])
        for idx, member_id in enumerate(members):
            rows[member_id] = build_row(line, member_id, idx, stage_count, species_payload)

    apply_special_rows(rows)

    ordered_rows = [rows[f"{num:03d}"] for num in range(1, 152)]
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(ordered_rows)

    print(f"Wrote {len(ordered_rows)} rows to {OUT_CSV}")


if __name__ == "__main__":
    main()
