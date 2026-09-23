# 원작(Exiled Exchange 2) 번역 수정 제안 — 2026-09-24 판

- Weblate: <https://translate.codeberg.org/engage/exiled-exchange-2/>
- **이 포크는 원작에 코드를 보내지 않습니다.** 아래 번역 제안은 사람(사용자)이 Weblate 에서 직접 합니다.
  Weblate 로 못 고치는 것(영어 원문·키 이름 문제)은 마지막 절의 영어 이슈 초안으로 원작 저장소에 올립니다.
- 기준 코드: 원작 `upstream/dev` `d95f53e1`(2026-09-17). 로컬 fetch 는 2026-09-23 입니다.
  `upstream/master` `cca30662` 과 `app_i18n` 차이는 en `settings.alpha_beta_coe` 한 줄뿐이고, 아래 결함은 master·dev 어디서도 안 고쳐졌습니다.
- **Weblate 자체는 확인하지 못했습니다(네트워크 없음).** 올리기 전에 같은 키에 이미 대기 중인 제안이 있는지 먼저 보세요.
- **이 포크에는 같은 값을 이미 적용했습니다**(커밋 `6d7300a3`, v1.3.2 부터). 원작이 같은 값을 받아들이면
  다음 머지 때 그대로 맞고, 다르게 고치면 원작 값을 따릅니다.
- 이 문서는 저장소에 둡니다 — 2026-09-09 판은 바탕화면 폴더째 사라져 세션 기록에서 복구했습니다.
- 2026-09-09 판의 제안 13건(분류명)은 오늘 전부 다시 쟀고, 13건 모두 그대로 유효합니다. 표에 **(09-09 제안, 09-24 재확인)** 로 표시했습니다.

## 근거를 잡은 방법

근거는 **전부 원작 저장소에 들어 있는 게임 자체 현지화 데이터**입니다. 경로는 `renderer/public/data/<언어>/` 이고, 원작 `upstream/dev` 기준으로 쟀습니다.

- `items.ndjson`: 한 분류(`craftable.category`)에 속한 베이스 아이템 이름을 전부 모아, 현재 번역어와 제안어가 몇 개 이름에 나오는지 셉니다.
- `stats.ndjson`: 영어 `ref` 가 그 낱말을 포함하는 스탯을 고른 뒤, 같은 `ref` 의 그 언어 문구에 번역어가 나오는지 셉니다.
- `client_strings.js`: 게임이 아이템 툴팁에 쓰는 낱말입니다. 예를 들어 `RARITY_MAGIC`, `SOCKETS`, `CRIT_CHANCE` 가 여기 있습니다.
- 게임 데이터에 낱말이 없는 문장은 같은 파일에 이미 있는 표현을 따랐거나 자연스러운 문장으로 썼고, 그 경우 "게임 용어 없음"이라고 적었습니다.

제안값 90개 모두 자리표시자(`{0}` 등) 집합이 en 과 같습니다. 모두 vue-i18n 특수문자 `| @ { }` 가 자리표시자 밖에 없다는 것도 스크립트로 확인했습니다.

**언어별 건수** (Weblate 에서 언어 하나씩 처리할 때 참고)

| pt | ko | de | es | fr | 正體中文 | ru | ja | th |
|---|---|---|---|---|---|---|---|---|
| 17 | 16 | 11 | 11 | 10 | 9 | 8 | 7 | 1 |

---

## 1. 아이템 분류명 (`item_category.*`) — 가장 자주 보입니다

마법·희귀 무기나 방어구를 가격 검사할 때마다 필터 줄에 `유형: …` / `Category: …` 로 뜹니다(`FilterName.vue`).
트레이드 검색 자체는 내부 id(`weapon.warstaff` 등)로 하므로 **검색 결과는 맞고, 보이는 이름만 틀립니다.**

### 1-1. Warstaff → Quarterstaff (09-09 제안, 09-24 재확인)

PoE2 는 이 무기 분류를 Quarterstaff 로 개명했습니다. 36개 베이스 아이템 이름 **전부**가 새 이름을 쓰고, 현재 라벨은 9개 언어 모두 **0/36** 입니다.

| 언어 | 키 | 현재 | 제안 | 근거 (베이스 36개 중 제안어 포함 / 관련 스탯 6개) |
|---|---|---|---|---|
| English | `weapon_warstaff` | `Warstaff` | **`Quarterstaff`** | 36/36 `Aegis Quarterstaff`, `Arcing Quarterstaff`. **원문이라 Weblate 가 아니라 §8 이슈로 올립니다** |
| 한국어 | `weapon_warstaff` | `전쟁 지팡이` | **`육척봉`** | 36/36 `비호 육척봉`, `전호의 육척봉` / 스탯 6/6 |
| 日本語 | `weapon_warstaff` | `ウォースタッフ` | **`クォータースタッフ`** | 36/36 `イージスクォータースタッフ` / 스탯 6/6 |
| 正體中文 | `weapon_warstaff` | `征戰長杖` | **`細杖`** | 36/36 `神禦細杖`, `電弧細杖` / 스탯 6/6 |
| Deutsch | `weapon_warstaff` | `Kriegsstab` | **`Kampfstab`** | 36/36 `Ägis-Kampfstab` / 스탯 `Kampfstäben` 6/6 |
| Français | `weapon_warstaff` | `Bâton de guerre` | **`Bâton de combat`** | 36/36 `Bâton de combat égide` / 스탯 `Bâtons de combat` 6/6 |
| Русский | `weapon_warstaff` | `Воинский посох` | **`Боевой посох`** | 36/36(대소문자 무시; 이름 중간에선 `Дуговой боевой посох` 처럼 소문자) / 스탯 `боевыми посохами` 6/6 |
| Español | `weapon_warstaff` | `Bastón de guerra` | **`Bastón`** | 36/36 `Bastón de égida` / 스탯 `bastones` 6/6 |
| Português | `weapon_warstaff` | `Cajado de guerra` | **`Bastão`** | 36/36 `Bastão-égide`, `Bastão Arqueado` / 스탯 `bastões` 5/6(나머지 1개는 게임 데이터가 `machados` 로 잘못 씀) |

- th `ไม้เท้าศึก` 은 원작에 th 게임 데이터가 없어 검증할 수 없어서 제안하지 않습니다.
- **Español 은 1-2 의 `weapon_staff` 와 반드시 같이** 올려야 합니다. `Bastón` 만 바꾸면 지금의 staff 라벨과 똑같아져 오히려 나빠집니다.

### 1-2. 서로 다른 분류가 같은 이름을 쓰는 것 (Staff / Wand / Charm / Talisman)

| 언어 | 키 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| Español | `weapon_staff` | `Bastón` | **`Báculo`** | Staff 베이스 13/13 `Báculo ceniciento`, `Báculo gélido`. `Bastón` 은 Staff 0/13, 대신 Quarterstaff 36/36 **(09-09 제안, 09-24 재확인)** |
| 正體中文 | `weapon_staff` | `法杖` | **`長杖`** | Staff 13/13 `灰燼長杖`, `鳴響長杖`. `法杖` 은 Staff 0/13, 대신 Wand 이름 9/13 이고 `weapon_wand` 도 `法杖`(완드 쪽은 그대로 둠) **(09-09 제안, 09-24 재확인)** |
| 한국어 | `weapon_staff` | `기본 지팡이` | **`지팡이`** | Staff 13/13 `잿빛 지팡이`, `극한의 지팡이`, 현재 0/13. **1-1 의 `육척봉` 을 먼저 반영한 뒤에만** 올릴 것(지금 `전쟁 지팡이` 와 겹침) |
| 한국어 | `flask_charm` | `부적` | **`호신부`** | Charm 12/12 `자수정 호신부`, `해독 호신부` / 스탯 25/25. `부적` 은 Talisman 이름 28/28 이고 `weapon_talisman` 도 `부적` 이라 두 분류가 같은 이름 |
| Русский | `flask_charm` | `Оберег Азмери` | **`Оберег`** | 12/12 `Оберег противоядия` / 스탯 25/25. 현재 0/12, 0/25 |
| 正體中文 | `flask_charm` | `阿茲麥麗符咒` | **`護符`** | 12/12 `紫晶護符`, `解毒護符` / 스탯 25/25. 현재 0/12 |
| Deutsch | `flask_charm` | `Azmeri-Talisman` | **`Phiole`** | 12/12 `Amethyst-Phiole` / 스탯 25/25. 현재 0/12 |
| Español | `flask_charm` | `Talismán Azmeri` | **`Vial`** | 12/12 `Vial de amatista` / 스탯 25/25. 현재 0/12 |
| Português | `flask_charm` | `Amuleto Azmeri` | **`Patuá`** | 12/12 `Patuá de Ametista` / 스탯 25/25. 현재 0/12 |

- 제안어가 다른 분류의 베이스 이름에 나오지 않는 것도 확인했습니다. 예: ko `지팡이` 는 Staff 에만, `호신부` 는 Charm 에만, es `Báculo` 는 Staff 에만, `Bastón` 은 Quarterstaff 에만 나옵니다.
- fr `Charme`, ja `チャーム` 은 12/12 로 맞습니다.

### 1-3. 게임 베이스 이름과 안 맞는 나머지 분류명

| 언어 | 키 | 현재 | 제안 | 근거 (현재 → 제안) |
|---|---|---|---|---|
| Русский | `weapon_crossbow` | `Арбалет` | **`Самострел`** | 이름 0/29 → 28/29 `Металлический самострел`; 스탯 0/10 → 10/10 **(09-09 제안, 09-24 재확인)** |
| 正體中文 | `weapon_spear` | `長鋒` | **`長矛`** | 이름 0/36 → 36/36 `艾古亞長矛`, `鉤刺長矛`; 스탯 0/8 → 8/8 **(09-09 제안, 09-24 재확인)** |
| 正體中文 | `armour_focus` | `法器2` | **`法器`** | 끝의 `2` 는 오타. 이름 0/45 → 45/45 `靈鹿法器`; 스탯 0/3 → 3/3 |
| Français | `armour_buckler` | `Rondache` | **`Bocle`** | 이름 0/49 → 48/49 `Bocle antique` |
| Français | `accessory_ring` | `Anneau` | **`Bague`** | 이름 0/28 → 27/28 `Bague d'améthyste`; 스탯 1/7 → 6/7 |
| Français | `flask` | `Flasque` | **`Flacon`** | 이름 0/18 → 18/18 `Flacon de vie colossal`; 스탯 0/56 → 54/56 |
| 日本語 | `armour_shield` | `盾` | **`シールド`** | 이름 0/130 → 89/130(en `Shield` 도 89/130); 스탯 11/99 → 90/99 |
| 日本語 | `armour_gloves` | `グローブ` | **`手袋`** | 이름 0/180 → 34/180(en `Gloves` 도 34/180); 스탯 0/2 → 2/2 |
| Português | `armour_helmet` | `Capacete` | **`Elmo`** | 이름 0/235 → 72/235(en `Helm` 도 72/235) `Elmo Cassis`; 스탯 0/6 → 6/6 |
| Português | `armour_chest` | `Armadura de torso` | **`Peitoral`** | 이름은 둘 다 0(베이스 이름에 분류어가 없음). 스탯 0/6 → `peitoral/peitorais` 6/6 |
| Русский | `armour_chest` | `Нательная броня` | **`Нательный доспех`** | 스탯 `нательная броня` 0/6 → 격변화형(`нательного доспеха` 등) 5/6. 이름에 `доспех` 65/315. **스탯 근거를 제안에 같이 붙일 것** |
| Deutsch | `map_tablet` | `Kartentafel` | **`Tafel`** | 이름 0/8 → 8/8 `Abgrund-Tafel`, `Riss-Tafel`; 스탯 `Tafeln` 1/1 |
| Español | `map_tablet` | `Tableta` | **`Tablilla`** | 이름 0/8 → 8/8 `Tablilla de abismo`; 스탯 1/1 |

### 1-4. 번역이 아예 없어 영어가 뜨는 분류 (en 에는 키가 있으므로 Weblate 에 빈칸으로 보입니다)

| 언어 | 키 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| 한국어 | `armour_focus` | (없음 → `Focus`) | **`집중구`** | 이름 45/45 `사슴 뿔 집중구`, `결정 집중구`; 스탯 3/3 |
| Русский | `armour_focus` | (없음 → `Focus`) | **`Фокус`** | 45/45 `Фокус из рогов`; 스탯 3/3 |
| 日本語 | `armour_focus` | (없음 → `Focus`) | **`フォーカス`** | 45/45 `枝角のフォーカス`; 스탯 3/3 |
| 한국어 | `map_tablet` | (없음 → `Tablet`) | **`서판`** | 8/8 `심연 서판`, `균열 서판`; 스탯 1/1 |
| Русский | `map_tablet` | (없음 → `Tablet`) | **`Плитка`** | 8/8 `Плитка Бездны`; 스탯 `плиток` 1/1 |
| 日本語 | `map_tablet` | (없음 → `Tablet`) | **`石板`** | 8/8 `アビスの石板`; 스탯 1/1 |
| Português | `map_tablet` | (없음 → `Tablet`) | **`Tábua`** | 8/8 `Tábua do Abismo`; 스탯 1/1 |

---

## 2. 희귀도 버튼 `Magic`

마법 아이템을 검사할 때마다 필터 줄에 뜨는 버튼입니다(`FiltersBlock.vue` 의 `text="Magic"`).
같은 파일의 희귀도 줄, 그리고 게임과도 말이 다릅니다.

| 언어 | 키 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| 한국어 | `Magic` | `매직` | **`마법`** | `client_strings` `RARITY_MAGIC: '마법'`; 같은 파일 `item.rarity_magic` = `아이템 희귀도: 마법`; Magic 관련 스탯 9개 중 `마법` 9, `매직` 0 |
| Русский | `Magic` | `Магический` | **`Волшебный`** | `RARITY_MAGIC: 'Волшебный'`; 같은 파일 `item.rarity_magic` = `Редкость: Волшебный`; 스탯 9개 중 `волшебн` 9, `магическ` 0 |

---

## 3. 아이템 속성·필터 이름이 게임 용어와 다른 것

| 언어 | 키 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| 한국어 | `item.stock` | `홈: {0}` | **`재고: {0}`** | 화폐·대량 거래의 수량 필터 라벨인데 `홈` 은 게임에서 **소켓**입니다(`SOCKETS: '홈: '`). 같은 파일 `trade_result.stock` = `재고`. (대안: 게임의 `STACK_SIZE: '중첩 개수: '`) |
| 한국어 | `item.gem_sockets` | (없음 → `Sockets: {0}`) | **`홈: {0}`** | `SOCKETS: '홈: '`; Socket 관련 스탯 23개 중 `홈` 16(`채운 홈 하나당…`), `소켓` 0 |
| 한국어 | `item.augment_sockets` | (없음 → `Sockets: {0}`) | **`홈: {0}`** | 위와 같음. en 도 두 키 모두 `Sockets: {0}` |
| 한국어 | `trade_result.gem_sockets` | (없음 → `Sockets`) | **`홈`** | 위와 같음(`TradeListing.vue` 열 제목) |
| Deutsch | `item.spirit` | `Geist: {0}` | **`Wille: {0}`** | `BASE_SPIRIT: 'Wille: '`; 자원 Spirit 스탯 24개 전부 `Wille`, `Geist` 0(게임의 `Geist` 는 `Azmeri-Geist`, `Geist des Bären` 같은 정령 뜻으로만 쓰임) |
| Español | `item.crit` | `Probabilidad de golpe crítico: {0}%` | **`Probabilidad de impacto crítico: {0}%`** | `CRIT_CHANCE`; Critical Hit Chance 스탯 29개 중 `impacto crítico` 29, `golpe crítico` 0 |
| Português | `item.crit` | `Chance de acerto crítico: {0}%` | **`Chance de Golpe Crítico: {0}%`** | `CRIT_CHANCE: 'Chance de Golpe Crítico: '`; 29/29, `acerto crítico` 0 |
| Français | `item.crit` | `Chance de coup critique : {0}%` | **`Chances de Touche critique : {0}%`** | `CRIT_CHANCE: 'Chances de Touche critique: '`; `touche critique` 27/29, `coup critique` 1/29. 콜론 앞 공백은 지금처럼 NBSP 유지 |
| Español | `item.evasion_rating` | `Índice de evasión: {0}` | **`Evasión: {0}`** | `EVASION: 'Evasión: '`; Evasion Rating 스탯 23/23, `Índice de evasión` 0 |
| Português | `item.evasion_rating` | `Índice de evasão: {0}` | **`Evasão: {0}`** | `EVASION: 'Evasão: '`; 23/23, 현재 0 |
| Deutsch | `item.evasion_rating` | `Ausweichwertung: {0}` | **`Ausweichwert: {0}`** | `EVASION: 'Ausweichwert: '`; 23/23, `Ausweichwertung` 0 |
| Español | `item.has_elemental_cold_affix` | `Frío` | **`Hielo`** | `COLD_TAG: 'Hielo'`; Cold 스탯 70/70, `Frío` 0 |
| Español | `item.has_elemental_lightning_affix` | `Relampago` | **`Rayo`** | `LIGHTNING_TAG: 'Rayo'`; Lightning 스탯 84/84, `Relámpago` 0(현재 값은 억양 부호도 빠짐) |
| Português | `item.has_elemental_cold_affix` | `Gelo` | **`Frio`** | `COLD_TAG: 'Frio'`; 69/70, `Gelo` 2/70 |
| Português | `item.has_elemental_lightning_affix` | `Raio` | **`Eletricidade`** | `LIGHTNING_TAG: 'Eletricidade'`; `elétric-` 79/84, `raio` 5/84 |
| Español | `item.gem_sockets` | `Zócalos: {0}` | **`Engarces: {0}`** | `SOCKETS: 'Engarces: '`; Socket 스탯 23개 중 `engarce/engarzar` 23, `zócalo` 0, `casillero` 0 |
| Español | `item.augment_sockets` | `Zócalo: {0}` | **`Engarces: {0}`** | 위와 같음(현재는 단수·복수도 두 키가 서로 다름) |
| Español | `trade_result.gem_sockets` | `Casilleros` | **`Engarces`** | 위와 같음 |
| Português | `item.gem_sockets` | `Engastes: {0}` | **`Encaixes: {0}`** | `SOCKETS: 'Encaixes: '`; Socket 스탯 23개 중 `encaix-` 23, `engast-` 0 |
| Português | `item.augment_sockets` | `Engastes: {0}` | **`Encaixes: {0}`** | 위와 같음 |
| Português | `trade_result.gem_sockets` | `Engastes` | **`Encaixes`** | 위와 같음 |
| Português | `tips.tip_9` | `…preencher os engastes vazios de runa…` | **`…preencher os encaixes vazios de runa…`** | 위와 같음. 이 낱말 하나만 바꿈 |
| Português | `filters.empty_rune_socket` | `Vazio no Engaste de Runas` | **`Vazio no Encaixe de Runas`** | 위와 같음. 현재 코드에서 이 키를 쓰는 곳은 0건이라 우선순위 낮음 |

---

## 4. 자리표시자가 틀려 문장이 깨지는 것 — `app.thanks_3rd_party`

en 원문은 `This tool relies on {0}, consider supporting them!` 이고, 코드(`CheckedItem.vue`)는 `poe.ninja` 링크 하나만 `{0}` 으로 넘깁니다.
아래 5개 언어는 `{1}` 을 기대해서, 가격 검사 14번에 한 번 뜨는 안내 문구가 깨집니다.
설치된 vue-i18n 10.0.8 로 렌더링해 보면 ko 는 `…poe.ninja과 의 도움을…`(빈칸 뒤 조사만 남음)이고, ru 는 **poe.ninja 링크가 통째로 사라집니다.**

| 언어 | 키 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| 한국어 | `app.thanks_3rd_party` | `이 프로그램은 {0}과 {1}의 도움을 받고 있습니다. 이들을 도우는 것도 고려해주세요` | **`이 프로그램은 {0}의 도움을 받고 있습니다. 이들을 후원하는 것도 고려해주세요!`** | en 자리표시자는 `{0}` 하나. 게임 용어 없음 |
| 日本語 | `app.thanks_3rd_party` | `このツールは {0} と {1} に依存しています、ぜひ支援することを検討ください` | **`このツールは {0} に依存しています、ぜひ支援することを検討ください`** | ` と {1}` 만 삭제 |
| Deutsch | `app.thanks_3rd_party` | `Dieses Tool basiert auf {0} und {1}. Bitte unterstütze diese ebenfalls` | **`Dieses Tool basiert auf {0}. Bitte unterstütze diese ebenfalls`** | 대상이 하나라 단수로 |
| Português | `app.thanks_3rd_party` | `Esta ferramenta é baseada em {0} e {1}. Por favor, apoie-os também` | **`Esta ferramenta é baseada em {0}. Por favor, apoie-os também`** | 대상이 하나라 단수로 |
| Русский | `app.thanks_3rd_party` | `Это приложение полагается на сайт {1}, можете поддержать и его` | **`Это приложение полагается на сайт {0}, можете поддержать и его`** | `{1}` → `{0}` 만 바꿈 |

---

## 5. 다른 언어·다른 문자가 섞인 것

### 5-1. 한국어 파일 안의 일본어 5개

원작 ko 파일에는 일본어 문장이 그대로 들어 있고, 다른 언어 파일에는 이런 사례가 0건입니다(가나 U+3040–30FF 검사).
그중 두 키는 원작 코드가 실제로 씁니다: `filters.hide_anointment`, `price_check.always_show_tier`.
**이 포크는 이미 로컬에서 고쳤습니다**(`fa0c638f`, v1.3.1 에 포함). 원작 사용자는 아직 일본어를 봅니다.

| 언어 | 키 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| 한국어 | `app.deprecated` | `この機能は非推奨でありバージョン {0} のアップデートで削除されます` | **`이 기능은 더 이상 권장되지 않으며 {0} 업데이트에서 삭제됩니다`** | 게임 용어 없음(포크 값 그대로) |
| 한국어 | `filters.hide_anointment` | `購入者はおそらくアノイントを変更するでしょう` | **`구매자가 속성 주입을 바꿀 가능성이 높습니다`** | en `Buyer will likely change instilment`. 게임은 Instilled Modifiers 를 `속성 주입` 이라 부름(`추가 속성 주입 #회 가능`) |
| 한국어 | `filters.hybrid_note` | `ハイブリッドモッドであるためティアが誤っている可能性があります` | **`하이브리드 속성일 수 있어 티어가 정확하지 않을 수 있습니다`** | 원작 ko 파일은 mod 를 `속성`(`item.mod_explicit` = `부여된 속성`), tier 를 `티어`(`item.mod_tier`)로 씀 |
| 한국어 | `price_check.always_show_tier` | `常にティアを表示` | **`항상 티어 표시`** | `티어` 는 같은 파일 용어 |
| 한국어 | `price_check.remember_ratio` | `通貨比率を記憶する` | **`환율 기억하기`** | 게임 용어 없음(포크 값 그대로) |

### 5-2. 번체 중국어 파일 안의 간체자 3개

번체 게임 데이터(아이템·스탯·client_strings)에 한 번도 안 나오는 글자를 뽑아 직접 확인했습니다. 간체자는 모두 이 세 키에 몰려 있습니다.

| 언어 | 키 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| 正體中文 | `filters.hide_revives` | `仅在数值不为 0，而且你不打算用崇高石时才选择吗？` | **`僅在數值不為 0，而且你不打算用崇高石時才選擇嗎？`** | 게임 데이터에서 간체는 `仅` 0·`数` 0·`为` 0·`时` 0·`选` 0이고, 번체는 `僅` 4·`數` 145·`為` 201·`時` 770·`選` 3 |
| 正體中文 | `filters.fill_rune_iron` | `镶嵌满鍛鐵符文` | **`鑲嵌滿鍛鐵符文`** | 게임 데이터 `鑲嵌` 66회, `镶嵌` 0회. 현재 코드에서 쓰는 곳은 0건이라 우선순위 낮음 |
| 正體中文 | `tips.tip_23` | `…請在POE游戏設定中禁用…` | **`…請在POE遊戲設定中禁用…`** | `游戏` → `遊戲` 만 바꿈. 같은 파일 `app.toggle_browser_hint` 가 `遊戲` 를 씀 |

---

## 6. 아이템 상태 라벨이 게임과 다른 것

| 언어 | 키 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| Deutsch | `item.mirrored` | `Spiegelbildlich` | **`Gespiegelt`** | `MIRRORED: 'Gespiegelt'` |
| Deutsch | `item.not_mirrored` | `Nicht spiegelbildlich` | **`Nicht gespiegelt`** | 위와 짝 |
| Français | `item.mirrored` | `Miroiré` | **`Reflété`** | `MIRRORED: 'Reflété'` |
| Français | `item.not_mirrored` | `Non miroiré` | **`Non reflété`** | 위와 짝 |
| Deutsch | `item.mod_fractured` | `Frakturiert` | **`Brüchig`** | `FRACTURED_MODIFIER: 'Brüchig'`, `FRACTURED_ITEM: 'Brüchiger Gegenstand'`, 스탯 `# Brüchige Modifikatoren`. `frakturiert` 는 게임 데이터에 0회 |
| Deutsch | `filters.tag_fractured` | `gebrochen` | **`brüchig`** | 위와 같음(태그는 소문자 관례) |
| Français | `item.mod_fractured` | `Fracturé` | **`Fissuré`** | `FRACTURED_MODIFIER: 'Fissuré'`, `FRACTURED_ITEM: 'Objet fissuré'`, 스탯 `# de Mods fissurés`. `fracturé` 0회 |
| Français | `filters.tag_fractured` | `fracturé` | **`fissuré`** | 위와 같음 |
| Deutsch | `item.foil_unique` | `Foil Unique` | **`Foil-Relikt`** | 현재 값은 번역되지 않은 영어. `FOIL_UNIQUE: 'Foil-Relikt'` |
| Português | `item.map_revives` | `Ressurreições: {0}` | **`Renascimentos Disponíveis: {0}`** | `WAYSTONE_REVIVES: 'Renascimentos Disponíveis: '` |
| Français | `item.map_revives` | `Réanimations disponibles : {0}` | **`Résurrections disponibles : {0}`** | `WAYSTONE_REVIVES: 'Résurrections disponibles: '`. 콜론 앞 NBSP 유지 |

---

## 7. 번역이 안 됐거나 키 이름이 틀려 번역이 안 뜨는 것

| 언어 | 키 | 현재 | 제안 | 근거 |
|---|---|---|---|---|
| 日本語 | `price_check.default_all_selected` | `Default all filters to enabled` | **`すべてのフィルターをデフォルトで有効にする`** | ja 파일에서 en 과 똑같은 유일한 문장이고 설정 화면에 뜸. 같은 파일이 `フィルター` 를 6회 씀. 게임 용어 없음 |
| 正體中文 | `item.mod_rune` | `Augment` | **`符文`** | 영어가 그대로 남아 있음. 같은 파일의 형제 키 `filters.tag_rune`, `filters.tag_added_rune` 이 `符文`(게임은 Augment Socket 을 `增幅插槽` 이라 부르니, 셋을 `增幅` 으로 통일하는 것도 근거 있는 대안) |
| Português | `filters.tag_crafted` | (없음 → `crafted`) | **`criado`** | pt 번역 `fabricado` 가 잘못된 키 `filters.tag_crafts` 에 들어 있어 화면에 안 뜸. 게임은 `# Modificadores Criados`, `modificadores criados adicionais` |
| ไทย | `item_category.flask_charm` | (없음 → `Charm`) | **`เครื่องราง`** | th 번역이 잘못된 키 `item_category.azmeri_charm` 에 들어 있어 안 뜸. 원작에 th 게임 데이터가 없어 **게임 용어 없음**(기존 번역을 옮기기만 함) |

잘못된 키 두 개(`tag_crafts`, `azmeri_charm`)를 파일에서 지우는 일은 Weblate 로 못 하므로 §8 이슈에 넣었습니다.

---

## 8. Weblate 로 못 고치는 것 — 원작 이슈로

아래 다섯 종류는 Weblate 번역으로는 고칠 수 없습니다.

- en 원문에 키가 없는 것: 코드가 쓰는데 en 파일에 없는 키 45개입니다. 원작 upstream/master 기준으로 코드의 리터럴 키를 뽑아 대조했고, 뽑은 키 목록은 원작 감사와 같았습니다.
- en 원문 자체가 틀린 것: `Warstaff`, `Marital` 입니다.
- 번역 파일에만 있고 en·코드 어디에도 없는 키.
- 이름이 틀린 키.
- 코드가 만들어 쓰는데 어느 언어 파일에도 없는 키(숨김 사유 4개, 수정자 유형) — 모든 언어에서 키 이름이 그대로 뜸.

영어 이슈 초안(코드 없이, 근거 확인 방법 포함)은 아래와 같습니다.

> **Title:** Translation source: 45 UI strings missing from en/app_i18n.json, two English source fixes, and a few orphan/misnamed keys
>
> Hi, and thank you for Exiled Exchange 2. While preparing translation suggestions on Weblate I found some things that can't be fixed from Weblate, because they live in the English source file or in the key names. Everything below was checked against the `dev` branch at d95f53e1 (2026-09-17); `master` has the same translation files apart from one unrelated English string. I couldn't check Weblate itself, so apologies if some of this is already in progress.
>
> **How I checked.** I listed every translation key that the UI asks for by its literal name, plus three that come from a default label or a switch ("Trade", "Normal", "Offline"), and compared that list with en/app_i18n.json. For category names, I took every base item of that class from the game's own localized item list shipped in the repository (`renderer/public/data/<language>/items.ndjson`) and counted how many base names contain the label.
>
> **1. Strings the UI uses that are not in en/app_i18n.json (45)**
> These strings are not in the English source, so as far as I can tell Weblate never offers them to translators. Every language then shows the English text, because the key itself is displayed as the fallback. Some of them are on the price-check window and show up on every check: the min/max inputs, the listing-type choices, the "Trade" button and the "Normal" rarity button.
> - Price check: `min`, `max`, `Instant or Online`, `Instant`, `Online`, `Offline`, `Trade`, `Normal`, `Search`, `Not recognized modifier`, `Unable to determine fractured stat`, `Gone`, `in demand`, `You`, `Browser`, `Retry`, `Retry Item`, `Loading...`, `Reload fallback data`
> - Settings: `Save`, `Cancel`, `Refresh`, `No`, `None`, `Both`, `Currency / Hour`, `Items / Hour`, `milliseconds`, `Disabled`, `Restart required`, `Hotcool`, `Remove`, `Add`
> - Item search: `Select`
> - Profile settings: `Recording settings`, `added mods column`, `removed mods column`, `keep explicit mods`, `keep implicit mods`, `keep enchant mods`, `keep augment mods`, `show tier`, `show roll`, `show ref`, `show type`
>
> The Russian file already contains 18 of these as top-level keys (`Add`, `Browser`, `Cancel`, `Disabled`, `No`, `Not recognized modifier`, `Offline`, `Online`, `Refresh`, `Remove`, `Restart required`, `Retry`, `Save`, `Search`, `Select`, `You`, `max`, `min`). Those could serve as a starting point once the keys exist in English.
>
> **2. English source text**
> - `item_category.weapon_warstaff`: "Warstaff" → "Quarterstaff". PoE2 calls this weapon class Quarterstaff: all 36 base items of the class in en/items.ndjson are named "… Quarterstaff", and none contains "Warstaff". Only the label needs to change; the trade id `weapon.warstaff` is fine. I'll suggest the matching translations on Weblate.
> - `item_editor.marital_weapon`: "Marital Weapons" → "Martial Weapons". This is a typo: "marital" means "related to marriage". Only the displayed text needs to change. The internal value is saved in user settings, so it is probably best left as it is.
>
> **3. Keys that exist in translation files but not in English or in the code**
> - `item_search.target_replica`: in all 9 translation files, but not in English and not used by the code.
> - German has 4 unused keys: `trade_result.travel`, `price_check.travel_to_hideout`, `price_check.travel_option_button`, `price_check.travel_option_row`. French has the same 4 plus `price_check.travel_option_disabled`. None of them is in English or used by the code.
> - Russian: `Enabled` and `Yes` are not used anywhere.
> - Two keys have misspelled names, so their translations never show up:
>   - Portuguese `filters.tag_crafts` should be `filters.tag_crafted`.
>   - Thai `item_category.azmeri_charm` should be `item_category.flask_charm`.
>
>   Translators can enter the text again under the correct key on Weblate, but the old keys have to be removed from the files.
>
> **4. Keys built in code that no language file has**
> These are passed to `t()` but exist in no `app_i18n.json` (not even English), so the tooltip shows the raw key name in every language:
> - `hide_harvest_and_instilling` (`create-stat-filters.ts`), `hide_attr_same_2nd_n_3rd` and `hide_attr_smallest_total` (`pseudo/index.ts`), `low_tier_reflection` (`pseudo/reflection-rules.ts`) — shown as the hidden-filter reason in `FilterModifier.vue` (`t(props.filter.hidden!)`).
> - `UnknownModifier.vue` renders `t(stat.type)` with values like `explicit` / `implicit` / `rune`, which are not keys; the existing `filters.tag_*` strings could be used instead.
>
> Thanks for your time!

---

## 안 담은 것 (재 봤지만 제안하지 않음)

- **현재 번역이 맞다고 나온 것**:
  - fr `Bouclier`: 방패 스탯 100/100 이 이 낱말을 씀.
  - 正體中文 `盾牌`: 스탯 11/97.
  - ko `item.crit` `치명타 확률`: 대표 스탯을 포함해 6/29 가 씀.
  - ru `item.crit`: 29/29.
  - pt `Trincado`: 유일한 Fractured 스탯 `# Modificadores Trincados` 와 일치.
- **게임 데이터끼리 서로 달라 판단을 보류한 것**: es body armour(스탯이 `armadura corporal`, `armadura en el pecho`, 그냥 `armadura` 로 제각각), 正體中文 boots(`鞋子` 1/2, `長靴` 1/2).
- **en 조차 베이스 이름에 분류어가 없는 분류**: 투구·갑옷·장화 등의 베이스 이름 0건은 결함 근거가 아닙니다. 스탯까지 틀린 pt/ru 만 1-3 에 넣었습니다. Body Armour, One-Handed X, Sanctum Relic 같은 복합 라벨은 이 방법으로 검증할 수 없습니다.
- **대소문자만 다른 것**(`Копьё`/`копьё` 등): 현재 번역이 맞습니다.
- **Foil 라벨**: ko/fr/ru/pt 는 `FOIL_UNIQUE` 전체 문구와 다르지만 줄인 표현일 수 있어 뺐습니다. 영어가 그대로 남은 de 만 6 에 넣었습니다.
- **th**: 원작에 th 게임 데이터가 없어, 키 이름 오류(7) 말고는 검증할 수 없습니다.
- **`stats.ndjson` 자체의 문제**: ru Stun Buildup 의 negate 플래그, 正體中文/es 의 ref 이름 차이 같은 것입니다. 번역문이 아니라 게임 데이터 생성 쪽이라 Weblate 대상이 아닙니다.
- **팁·도움말 긴 문장의 품질**: 파일로 증명할 수 없어 평가하지 않았습니다.
- **ko 에 빠진 키 125개**(그중 103개는 코드가 씀): 여기서는 위에 증거를 댄 것만 넣었습니다. 나머지는 Weblate 에서 en 원문을 보고 번역하면 됩니다.

## 확인 방법 (원작 저장소에서 그대로 됩니다)

```python
# 한 분류의 베이스 이름 중 라벨이 들어간 개수를 센다 (ru 쇠뇌 예)
import json
rows = [json.loads(l) for l in open("renderer/public/data/ru/items.ndjson", encoding="utf-8")]
names = [r["name"] for r in rows if r.get("namespace") == "ITEM"
         and (r.get("craftable") or {}).get("category") == "Crossbow"]
for w in ["Арбалет", "Самострел"]:
    print(w, sum(w.lower() in n.lower() for n in names), "/", len(names))
# -> Арбалет 0 / 29,  Самострел 28 / 29
```

## 참고 — 이 포크의 상태

- 이 문서의 제안값은 **포크에 이미 적용했습니다**(`6d7300a3`, 그 뒤 `속성` 용어 정리). 5-1 의 한국어
  두 값(`속성 주입`, `하이브리드 속성`)도 이 문서의 제안과 같은 값으로 맞췄습니다.
  원작이 같은 값을 받아들이면 다음 머지 때 저절로 맞고, 다르게 고치면 원작 값을 따릅니다.
- en `Warstaff` 처럼 원문(영어) 문제는 Weblate 가 아니라 원작 이슈로 알려야 합니다(§8).
  포크의 en 파일은 이미 `Quarterstaff` 입니다.
- 포크 자체 결함(ko `wrong_language` 키 위치 등)은 원작 문제가 아니라 이 문서에서 뺐습니다.
