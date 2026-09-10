# StarNet2 Photoshop Panel

StarNet2 CLI를 Photoshop 안에서 실행하고, 별 제거 결과와 천체 사진용 Stretch 결과를 레이어로 가져오는 Windows CEP 패널입니다.

현재 버전: **v0.9.4**

## 주요 기능

- 선택한 일반 픽셀 레이어를 StarNet2로 처리
- `Starless`, `Stars`, `Star Boost (Large)` 결과 레이어 생성
- 선택 영역 또는 현재 레이어 마스크를 결과에 자동 적용
- 원본 레이어를 직접 변경하지 않는 비파괴 작업 흐름
- 비압축 16-bit RGB TIFF 기반 Stretch 처리
- 큰 화면의 Stretch Editor에서 원본·결과·좌우 비교 제공
- Stretch 미리보기 확대·축소, 화면 맞춤 및 비교 구분선 이동
- 처리 취소, 실패 시 결과 롤백 및 임시 파일 자동 정리

## 요구 사항

- Windows
- Adobe Photoshop CEP Extensions (Legacy) 지원 버전
- StarNet2 CLI 2.5.x 또는 2.6.x
- Windows DirectML용 StarNet2 배포판

일반 사용자는 **Node.js를 별도로 설치할 필요가 없습니다.** 패널 실행에는 Photoshop CEP에 포함된 Node 런타임을 사용합니다.

> 이 저장소에는 StarNet2 실행 파일과 모델이 포함되어 있지 않습니다. StarNet2 CLI를 별도로 준비해야 합니다.

## 설치

1. Photoshop을 완전히 종료합니다.
2. 저장소 전체를 내려받아 압축을 풉니다.
3. [`Install_Windows.bat`](./Install_Windows.bat)을 실행합니다.
4. 설치가 끝나면 Photoshop을 다시 실행합니다.
5. **Window > Extensions (Legacy) > StarNet2**를 엽니다.

설치 위치는 다음과 같습니다.

```text
%APPDATA%\Adobe\CEP\extensions\StarNet-Panel
```

현재 패널은 서명되지 않은 CEP 확장입니다. 설치 프로그램은 필요한 경우 현재 Windows 사용자의 `PlayerDebugMode` 활성화 여부를 묻고, 이미 활성화되어 있으면 해당 단계를 건너뜁니다.

## StarNet2 실행 파일 설정

1. 패널 오른쪽 위의 설정 아이콘을 누릅니다.
2. **StarNet2 실행 파일**에서 `starnet2.exe`의 전체 경로를 지정합니다.
3. **저장**을 눌러 실행 파일 확인을 완료합니다.

`starnet2.exe`가 Windows `PATH`에 등록되어 있다면 파일명만 사용할 수도 있습니다.

## Star Removal 사용법

1. Photoshop에서 처리할 문서를 엽니다.
2. 처리할 일반 픽셀 레이어를 선택합니다.
3. **Star Removal** 탭을 엽니다.
4. 필요하면 **세부 설정 보기**에서 생성할 결과와 처리 품질을 조정합니다.
5. **StarNet2 실행**을 누릅니다.

보이는 여러 레이어의 합성 결과를 처리하려면 Photoshop에서 합성 픽셀 레이어를 만든 뒤 그 레이어를 선택하세요.

### 결과 레이어

| 레이어 | 혼합 모드 | 용도 |
|---|---|---|
| `Starless` | 표준 | 별이 제거된 이미지 |
| `Stars` | 스크린 | 모든 별을 기본 상태로 복원 |
| `Star Boost (Large)` | 스크린 | 큰 별만 추가로 강조 |

`큰 별 강조 강도`는 `Star Boost (Large)` 레이어의 불투명도를 조절합니다. 기본값은 **60%**입니다.

`2× Upsample`은 작은 별이나 어려운 별 형상의 처리를 개선할 수 있지만 처리 시간과 메모리 사용량이 늘어납니다.

## 결과 마스크 자동 처리

Star Removal과 Stretch는 처리 시작 시 다음 순서로 결과 마스크를 결정합니다.

1. Photoshop 선택 영역이 있으면 선택 영역을 결과 레이어 마스크로 적용합니다.
2. 선택 영역이 없고 현재 레이어에 마스크가 있으면 해당 마스크를 결과에 복사합니다.
3. 둘 다 없으면 마스크 없이 결과 레이어를 생성합니다.

선택 영역과 레이어 마스크가 모두 있으면 **선택 영역이 우선**합니다. 입력 픽셀은 기존 레이어 마스크를 적용하지 않은 상태로 처리하고, 결정된 결과 마스크를 결과 레이어에 한 번만 적용합니다.

## Stretch 사용법

Stretch는 아직 밝기 조정을 하지 않은 어두운 선형 천체 이미지를 화면에서 확인하기 좋은 밝기로 펼치는 기능입니다.

1. 일반 픽셀 레이어를 선택합니다.
2. **Stretch** 탭을 엽니다.
3. 현재 설정을 그대로 사용하려면 **Stretched 레이어 생성**을 누릅니다.
4. 결과를 비교하거나 값을 조정하려면 **세부 설정 보기 > 미리보기 및 설정**을 누릅니다.
5. Stretch Editor에서 값을 조정한 뒤 **Stretched 레이어 생성**을 누릅니다.

기본 설정은 다음과 같습니다.

| 설정 | 기본값 | 의미 |
|---|---:|---|
| Background | 15% | Stretch 후 목표 배경 밝기 |
| Black Point | 3.0 sigma | 배경 중앙값과 MAD를 이용한 검정점 기준 |
| Saturation | 1.0 | 원래 채도 유지 |

### Stretch Preset

| Preset | 결과 성향 |
|---|---|
| `10% Bg, 3 sigma` | 비교적 어두운 결과 |
| `15% Bg, 3 sigma` | 기본 결과 |
| `20% Bg, 3 sigma` | 더 밝은 결과 |
| `30% Bg, 2 sigma` | 가장 강한 Stretch |

- Background 조절 범위: 5~40%
- Black Point 조절 범위: 1.0~5.0 sigma
- Saturation: 0은 흑백, 1.0은 원래 채도, 1보다 크면 채도 강화
- Background 또는 Black Point를 직접 조절하면 Preset이 `사용자 설정`으로 바뀝니다.

Stretch Editor의 JPEG 이미지는 빠른 화면 확인용 미리보기입니다. 실제 결과 레이어는 원본 활성 레이어를 비압축 16-bit RGB TIFF로 다시 처리해 생성하므로 미리보기와 약간 다를 수 있습니다.

Editor를 연 뒤 다른 문서나 레이어를 선택하면 잘못된 대상에 적용되지 않도록 결과 생성을 중단합니다. 새 대상에 적용하려면 Stretch Editor를 다시 여세요.

## 원본 보호와 임시 파일

- 원본 Photoshop 문서와 원본 레이어는 직접 변경하지 않습니다.
- 결과는 처리 시작 시 선택한 레이어 바로 위에 배치합니다.
- 입력·결과 TIFF는 성공, 실패 또는 취소 후 자동으로 정리합니다.
- 24시간 이상 지난 StarNet2/Stretch 임시 TIFF와 Preview JPEG는 패널 시작 시 정리합니다.
- 처리 중 생성한 Photoshop 임시 문서는 저장하지 않고 닫습니다.
- 입력 문서의 ICC 프로파일 정보를 결과 레이어를 가져오는 과정에서 다시 지정합니다.

## 제거

1. Photoshop을 완전히 종료합니다.
2. [`Uninstall_Windows.bat`](./Uninstall_Windows.bat)을 실행합니다.
3. 다른 서명되지 않은 CEP 패널을 사용 중이라면 `PlayerDebugMode`를 유지합니다.

## 개발 및 테스트

일반 사용에는 Node.js가 필요하지 않지만, 저장소의 Node 기반 테스트를 실행하려면 개발 환경에 Node.js가 필요합니다.

```powershell
node tests/run-tests.js
```

Photoshop을 실행한 상태에서 통합 테스트를 실행할 수 있습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\Run_Photoshop_Integration.ps1
```

통합 테스트는 테스트용 Photoshop 문서를 만든 뒤 저장하지 않고 자동으로 닫습니다.

## 라이선스

이 프로젝트는 [GNU General Public License v3.0](./LICENSE)에 따라 배포됩니다.

## 프로젝트 구조

```text
StarNet-Panel/
├─ CSXS/manifest.xml
├─ client/
│  ├─ index.html
│  ├─ style.css
│  ├─ main.js
│  ├─ stretch-processor.js
│  ├─ stretch-editor-window.html
│  ├─ stretch-editor-window.css
│  └─ stretch-editor-window.js
└─ host/host.jsx

Install_Windows.bat
Uninstall_Windows.bat
LICENSE
tests/
```
