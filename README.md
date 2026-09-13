# TENDERWEIGHT · 구조의 무게

**구조할수록 기우는 배 위에 마을을 짓고, 평형추를 움직여 모두의 균형을 지킵니다.**

작은 3D 마을을 건설하고 폭풍 속에서 구조하는 물리 균형 게임입니다. 구조물의 무게와 부력, 걸어가는 주민의 위치, 갑판 위 평형추가 모두 배의 기울기에 영향을 줍니다. 성인 해양 기술자 미라가 세 항해와 여덟 폭풍을 지나 52명을 항구로 데려갑니다.

`index.html`을 직접 여시면 됩니다. 설치나 서버, 인터넷 연결이 필요하지 않습니다. GitHub Pages에서도 같은 파일과 상대 경로를 사용합니다.

## 조작

| 단계 | 조작 |
|---|---|
| 준비 | WASD/방향키: 건설 커서, 1/2/3: 부력통/쉼터/배수기 |
| 건설 | Space: 배치, Backspace: 철거, Enter: 출항 |
| 마우스 | 갑판 좌클릭: 배치, 우클릭: 철거 |
| 폭풍 | WASD/방향키: 평형추 이동, Shift: 정밀 조작 |
| 공통 | Esc: 일시정지, M: 음소거, 실패 후 R/Enter: 재시작 |
| 터치 | 화면 방향 버튼, 도구/배치/철거/출항 버튼, 정밀 버튼 |

높이 뜬 쪽으로 평형추를 옮기세요. 쉼터는 한 채에 여섯 명을 수용하고, 부력통은 배를 띄우며, 배수기는 들어온 물을 빼냅니다. 출항하려면 항해 전체의 주민을 수용할 쉼터가 필요합니다. 폭풍 사이에는 목재 4개를 받고 물을 일부 빼낸 뒤 배치를 보완할 수 있습니다. 주민이 배정된 쉼터는 철거할 수 없습니다.

침수가 100%에 이르거나 심한 기울기가 오래 지속되면 항해를 다시 시작합니다. 완수한 항해는 다음 항해를 열고, 표준/부드러운 모드의 기록을 각각 저장합니다. 진행 중인 항해는 저장되지 않습니다. 소리 크기와 모드 설정도 이 브라우저에 보관됩니다.

## 개발 및 검증

```sh
npm ci
npm run build
npm test
npm run test:browser
npm run test:interaction
npm run test:campaign
npm run pack
npm run test:package
```

`npm run serve`는 `http://127.0.0.1:4179/tenderweight/`를 제공합니다. 브라우저를 자동으로 열지 않습니다. 배포 검증은 `TENDER_URL`을 실제 Pages 주소로 설정하고 `npm run test:browser`를 실행합니다. `tests/campaign.cjs`는 실제 키보드 건설과 평형추 입력으로 전체 항해를 진행합니다. 진단 객체는 복사본만 제공하며 게임 상태를 바꾸는 테스트용 setter가 없습니다.

`dist/tenderweight-web.zip`은 itch.io HTML 업로드용입니다. 압축 해제 없이 업로드하고 **This file will be played in the browser**를 선택할 수 있습니다. 런타임에는 외부 CDN, API, 로그인 또는 결제가 없습니다.

검증 결과와 측정 범위는 [QA 기록](docs/QA.md)에 있습니다.

## 제작

Three.js로 만든 원본 3D 모델과 Web Audio로 합성하는 파도·바람·선율·효과음을 사용합니다. 타이틀 일러스트는 원본 ImageGen 제작물입니다. 원본과 프롬프트는 [아트 기록](docs/ART.md), 설계는 [구현 계약](docs/CONTRACT.md)에 있습니다. Three.js 라이선스는 [licenses/three.txt](licenses/three.txt)에 포함됩니다.
