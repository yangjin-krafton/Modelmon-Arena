# Modelmon Arena

AI 시대의 다양한 모델들을 몬스터로 재해석한  
**3D 턴제 배틀 게임 프로토타입**입니다.

이 프로젝트는 전통적인 몬스터 배틀 게임의 감성을 참고하되,  
캐릭터/속성/스킬/상성 체계를 **AI 개념**으로 치환해  
완전히 새로운 세계관과 전투 구조를 만드는 것을 목표로 합니다.

---

## Overview

**Modelmon Arena**는  
대형 언어 모델, 이미지 생성 모델, 음성 모델, 검색/RAG, 에이전트, 추론 모델 같은  
현대 AI 시스템들을 몬스터처럼 의인화/재해석한 배틀 게임입니다.

플레이어는 각기 다른 AI 특성을 가진 몬스터를 팀으로 편성하고,  
속성 상성, 상태이상, 스킬 조합, 시너지 효과를 활용해 전투를 진행합니다.

---

## Core Concept

기존 몬스터 배틀 게임의 구조를 다음처럼 치환합니다.

| 기존 개념 | Modelmon Arena 개념 |
|---|---|
| 몬스터 | AI 모델/AI 시스템 기반 크리처 |
| 타입 | AI 능력 개념 |
| 기술 | 추론, 생성, 검색, 정렬, 코드 실행, 실시간 반응 등 |
| 진화 | 모델 계열의 업그레이드/고도화 |
| 상태이상 | Hallucination, Lag, Drift, Overfit 등 |
| 상성 | 어떤 AI 개념이 어떤 AI 개념에 강한가 |
| 파티 시너지 | 모델 조합에 따른 상승 효과 |

---

## Worldbuilding

Modelmon Arena의 세계에서는  
AI 모델이 단순한 도구가 아니라 **디지털 생명체**로 존재합니다.

이들은 각자 다른 학습 방식, 추론 방식, 감각 체계, 출력 스타일을 갖고 있으며,  
플레이어는 이들을 수집하고 팀을 구성해  
가상 연구 경기장인 **Arena**에서 배틀을 벌입니다.

---

## Design Direction

이 프로젝트는 다음 방향을 지향합니다.

- 포켓몬식 직관적인 팀 배틀 감성
- 완전 오리지널 AI 기반 세계관
- 3D GLB 몬스터 중심의 HTML/Three.js 프로토타입
- 짧은 개발 기간 안에 구현 가능한 단순하고 강한 전투 루프
- “AI 모델을 게임 캐릭터로 해석한다”는 명확한 콘셉트

---

## Starter Trio

초기 스타터 라인은 대표 AI 계열의 성격을 기반으로 설계합니다.

| Starter Line | AI Motif | 특징 |
|---|---|---|
| GPT Line | 범용 대화형 모델 | 밸런스형, 안정적인 기본기 |
| Gemini Line | 멀티모달/생성형 모델 | 공격적, 빠른 전개 |
| Claude Line | 정렬/안정성 중심 모델 | 탱커형, 장기전 특화 |

예시:

- **GPT Sprout**
- **Gemini Ember**
- **Claude Shell**

---

## AI Types

기존 RPG 타입 체계를 AI 개념 기반 타입으로 변환합니다.

| Type | 설명 |
|---|---|
| General | 범용 대화, 평균적인 성능 |
| Generation | 텍스트/이미지/영상 생성, 고출력 공격 |
| Alignment | 안정성, 보호, 회복, 제어 |
| Context | 장문 기억, 누적 버프, 지속 효과 |
| Realtime | 저지연, 선공, 인터럽트 |
| Vision | 이미지 이해, 관측, 정밀 타격 |
| Code | 실행, 수정, 패치, 구조 파괴 |
| Hallucination | 왜곡, 혼란, 디버프 |
| Retrieval | 검색, 인덱싱, 약점 탐색 |
| Agent | 툴 호출, 연계 행동, 멀티스텝 |
| Reasoning | 추론, 예측, 카운터 |
| Swarm | 다수 개체, 누적, 병렬 압박 |
| Infrastructure | 내구, 무거운 성능, 방어 특화 |
| Latent | 은신, 복제, 숨은 상태 |
| Frontier | 최상위 모델급 특수 타입 |

---

## Battle Roles

각 Modelmon은 하나 이상의 전투 역할을 가집니다.

- **Bruiser**: 단단하면서 꾸준히 압박
- **Burst Dealer**: 짧은 턴에 큰 데미지
- **Tank**: 방어와 유지력
- **Support**: 버프, 회복, 시너지 강화
- **Control**: 상태이상, 행동 방해
- **Scout**: 빠른 정보 획득, 약점 노출
- **Trickster**: 복제, 변환, 예측 불가 플레이

---

## Example Modelmon

| Name | Motif | Type | Role |
|---|---|---|---|
| GPT Sprout | GPT 계열 | General / Context | Balanced |
| Gemini Ember | Gemini 계열 | Generation / Realtime | Burst |
| Claude Shell | Claude 계열 | Alignment / Context | Tank |
| Grok Volt | Grok 계열 | Realtime / Agent | Speed Attacker |
| R1 Sage | Reasoning 모델 | Reasoning | Counter Mage |
| Gemma Node | 오픈 모델 계열 | General / Code | Flexible |
| Omni Mimic | 멀티모달 복제형 | Latent / General | Trickster |
| Imagen Frost | 이미지 생성 계열 | Vision / Generation | Precision Damage |
| Veo Blaze | 영상 생성 계열 | Generation / Vision | AoE |
| Agent Prime | 고급 에이전트형 | Frontier / Reasoning | Boss |

---

## Skills

스킬은 AI 시스템의 동작 원리를 전투 기술로 치환해 설계합니다.

| Skill Name | Category | Description |
|---|---|---|
| Token Burst | Basic Attack | 기본 단일 공격 |
| Diffusion Blast | Generation | 광역 생성형 공격 |
| Guardrail Surge | Alignment | 강한 공격 + 안정화 효과 |
| Context Bind | Context | 지속 피해 + 속도 저하 |
| Low-Latency Strike | Realtime | 선공기 |
| Prompt Injection | Hallucination | 혼란/제어 |
| Session Shift | Agent | 전술 교체 |
| Safety Filter | Alignment | 피해 경감 |
| Modal Copy | Latent | 적 스킬/속성 복제 |
| Checkpoint Restore | Support | 체력 회복 |
| Parameter Tuning | Code | 공격 버프 |
| Chain-of-Thought Focus | Reasoning | 추론 강화, 명중률 증가 |
| Index Collapse | Retrieval | 검색형 대상 강타 |
| Vision Freeze | Vision | 정밀 타격 + 행동 지연 |

---

## Status Effects

전통적인 RPG 상태이상을 AI 문제/특성으로 재구성합니다.

| Status | Description |
|---|---|
| Lag | 속도 감소 |
| Hallucinate | 잘못된 행동 혹은 랜덤 스킬 발동 |
| Drift | 턴이 갈수록 정확도 감소 |
| Overfit | 특정 행동은 강해지지만 유연성 감소 |
| Silenced | 일부 스킬 사용 불가 |
| Prompted | 다음 공격 강화 |
| Cached | 반복 스킬 효율 증가 |
| Corrupted | 지속 피해 |
| Locked | 교체 불가 |

---

## Type Advantage

핵심 상성 구조 예시:

| Attack Type | Strong Against | Weak Against |
|---|---|---|
| Context | General, Swarm | Retrieval, Hallucination |
| Realtime | Generation, Agent | Infrastructure, Alignment |
| Alignment | Hallucination, Generation | Reasoning, Code |
| Reasoning | Alignment, Infrastructure | Realtime, Swarm |
| Retrieval | Context, Latent | Generation, Swarm |
| Code | Infrastructure, Alignment | Realtime, Hallucination |
| Vision | Latent, Agent | Realtime, Hallucination |
| Hallucination | Reasoning, Vision | Alignment, Retrieval |
| Agent | Retrieval, Code | Realtime, Vision |
| Frontier | Most Types | High cost / limited usage |

---

## Synergy Table

좋은 팀은 단순히 강한 개체를 모으는 것이 아니라  
서로 상승 작용을 내는 조합으로 완성됩니다.

| Combo | Synergy |
|---|---|
| Context + Retrieval | 약점 탐지와 정보 축적 강화 |
| Reasoning + Code | 계산 후 즉시 실행 |
| Alignment + Generation | 생성 안정성 증가 |
| Realtime + Agent | 선공 + 연속 행동 |
| Vision + Retrieval | 관측 + 탐색 시너지 |
| Swarm + Context | 누적 압박 강화 |
| Infrastructure + Alignment | 단단한 장기전 운영 |
| Hallucination + Generation | 고위험 고화력 조합 |
| Latent + Agent | 은신 후 기습 전술 |
| Frontier + Any | 리더 오라/팀 전체 증폭 |

---

## Gameplay Loop

1. 팀 편성
2. 상대 팀과 매치
3. 턴마다 스킬 선택
4. 속도 순으로 행동 처리
5. 상태이상/버프/디버프 갱신
6. 마지막까지 생존한 팀 승리

기본 MVP는 다음을 목표로 합니다.

- 3 vs 3 턴제 배틀
- 몬스터 8~12종
- 각 몬스터당 스킬 3개 + 패시브 1개
- 타입 상성
- 상태이상
- 간단한 AI 상대 로직

---

## Visual Direction

- SD 스타일의 귀엽고 명확한 실루엣
- AI 모델 특징을 상징적으로 반영한 디자인
- GLB 기반 3D 몬스터
- 전투 전용 소형 아레나
- 복잡한 필드 탐험 없이 배틀 연출 중심

---

## Technical Stack

예상 기술 스택:

- **Three.js**
- **GLTFLoader**
- **HTML / CSS / JavaScript**
- **GLB 3D assets**
- **Local state battle system**
- 필요 시 **Blender**를 통한 모델 정리

---

## MVP Scope

### Included
- 전투 씬 1종
- 몬스터 8~12종
- 타입 시스템
- 스킬 시스템
- 상태이상
- 팀 선택 화면
- 승패 결과 화면

### Not Included
- 오픈월드 탐험
- 온라인 PvP
- 도감/육성 심화
- 복잡한 스토리 모드
- 대형 라이브 서비스 구조

---

## Roadmap

### Phase 1
- 세계관 정리
- 타입/상성표 고정
- 스타터 3종 정의
- 전투 프로토타입 구현

### Phase 2
- 몬스터 추가
- 스킬 이펙트 보강
- UI/UX 정리
- 밸런싱

### Phase 3
- 팀 빌드 심화
- 더 많은 상태이상과 시너지
- PvE 챌린지 모드
- 도감 및 수집 시스템

---

## Inspiration

이 프로젝트는 고전적인 몬스터 배틀 게임의 전투 감성에서 영감을 받았지만,  
실제 구현과 세계관은 **AI 시대의 개념**을 중심으로 새롭게 설계됩니다.

즉, 목표는 “기존 IP 재현”이 아니라  
**AI 모델을 몬스터 배틀 장르로 재해석한 오리지널 프로젝트**입니다.

---

## Disclaimer

This project is an original fan-inspired prototype.

It is **not affiliated with, endorsed by, or connected to** any existing monster-battle game franchise.  
All character concepts, systems, and worldbuilding directions are intended to be reinterpreted into an original IP.

---

## Future Ideas

- 모델 계열별 진화 트리
- 프롬프트/툴 기반 장비 시스템
- 에이전트 체인 궁극기
- 환각/정렬 중심 메타 변화
- 싱글 플레이 토너먼트 모드
- 도감형 UI와 배틀 로그 리플레이

---