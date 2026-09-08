StarNet2 Photoshop Panel v0.9.3
Windows / Photoshop CEP Panel
============================================================

구성
----
StarNet-Panel\
  CSXS\manifest.xml
  client\index.html
  client\style.css
  client\main.js
  client\stretch-processor.js
  client\stretch-editor-window.html
  client\stretch-editor-window.css
  client\stretch-editor-window.js
  host\host.jsx

Install_Windows.bat
Uninstall_Windows.bat
tests\

주요 기능
---------
- StarNet2: Starless, Stars, Star Boost (Large) 레이어 생성
- 처리 범위: 보이는 레이어, 현재 레이어, 지정 영역
- Stretch: 활성 픽셀 레이어를 비압축 16-bit RGB TIFF로 스트리밍 처리
- Stretch Editor: 큰 Modeless 창에서 Preset, Strength, Saturation 미리보기
- Stretch 결과를 처리 시작 시 선택한 레이어 바로 위에 배치
- 지정 영역 사용 시 Photoshop 선택 영역을 우선 사용하고, 없으면 활성 레이어 마스크 사용
- 원본 문서와 원본 레이어는 직접 변경하지 않음

설치
----
1. Photoshop을 종료합니다.
2. Install_Windows.bat을 실행합니다.
3. Photoshop을 다시 시작합니다.
4. Window > Extensions (Legacy) > StarNet2를 엽니다.

StarNet2 사용
-------------
1. Photoshop에서 처리할 문서를 열고 레이어를 선택합니다.
2. StarNet2 탭에서 처리 범위를 선택합니다.
3. 필요하면 세부 설정에서 결과 레이어와 옵션을 조정합니다.
4. StarNet2 실행을 누릅니다.

현재 레이어와 지정 영역에는 일반 픽셀 레이어가 필요합니다.
지정 영역은 선택 영역 또는 활성 레이어 마스크를 결과 레이어 마스크로 적용합니다.
선택 영역과 레이어 마스크가 모두 있으면 선택 영역을 우선합니다.

Stretch 사용
------------
1. 일반 픽셀 레이어를 선택합니다.
2. Stretch 탭을 엽니다.
3. 빠르게 처리하려면 Stretched 레이어 생성을 누릅니다.
4. 큰 화면에서 비교하려면 Stretch Editor를 엽니다.
5. Preset, Strength, Saturation을 조정한 뒤 Stretched 레이어 생성을 누릅니다.

기본값은 15% Bg, 3 sigma / Strength 50% / Saturation 1.0입니다.
Stretch는 아직 밝기 조정을 하지 않은 어두운 선형 이미지에 사용하는 기능입니다.
이미 Stretch되었거나 일반 사진처럼 밝기가 조정된 레이어에는 결과가 과도할 수 있습니다.
Editor의 JPEG 이미지는 빠른 화면 미리보기이고, 실제 결과는 원본 활성 레이어를
비압축 16-bit RGB TIFF로 다시 처리하여 만듭니다.
처리는 작은 작업 단위로 진행되며 패널의 Stretch 처리 취소 버튼으로 중단할 수 있습니다.
Editor 미리보기 후 다른 문서나 레이어를 선택하면 안전을 위해 생성을 중단하며,
새 대상에 적용하려면 Stretch Editor를 다시 열어야 합니다.

Preset 의미
-----------
- Bg: Stretch 후 배경 밝기의 목표값입니다. 값이 클수록 배경과 중간톤이 밝아집니다.
- sigma: 배경 중앙값에서 몇 배의 MAD를 검정점으로 잡을지 정합니다.
- 10% Bg, 3 sigma: 비교적 어두운 결과
- 15% Bg, 3 sigma: 기본 결과
- 20% Bg, 3 sigma: 더 밝은 결과
- 30% Bg, 2 sigma: 가장 강한 Stretch
- Strength: 원본과 완전한 Stretch 결과를 혼합하는 비율
- Saturation: 1.0은 원래 채도, 0은 흑백, 1보다 크면 채도 강화

임시 파일과 색상 프로파일
-------------------------
- 입력 및 결과 TIFF는 작업 성공/실패 후 자동 정리합니다.
- 24시간 이상 지난 StarNet2/Stretch 임시 TIFF와 Preview JPEG도 시작 시 정리합니다.
- 처리 중 만든 Photoshop 임시 문서는 성공/실패와 관계없이 닫습니다.
- 입력 문서의 ICC 프로파일을 결과 레이어로 가져오는 과정에서 다시 지정합니다.

호환성
------
- Photoshop CEP Extensions (Legacy)
- StarNet2 CLI 2.5.x 및 2.6.x
- Windows DirectML 배포판 지원

제거
----
Photoshop을 종료한 뒤 Uninstall_Windows.bat을 실행합니다.
