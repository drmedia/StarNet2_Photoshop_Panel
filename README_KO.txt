StarNet2 Photoshop Panel v0.9.5
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
- Star Removal은 현재 선택한 일반 픽셀 레이어만 처리
- Star Removal 결과 마스크는 선택 영역, 현재 레이어 마스크, 마스크 없음 순서로 자동 결정
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
2. 처리할 일반 픽셀 레이어를 선택합니다.
3. 필요하면 세부 설정에서 결과 레이어와 옵션을 조정합니다.
4. StarNet2 실행을 누릅니다.

Star Removal에는 일반 픽셀 레이어가 필요합니다. 보이는 레이어의 합성 결과를 처리하려면
Photoshop에서 병합된 픽셀 레이어를 만든 뒤 그 레이어를 선택합니다.
선택 영역이 있으면 모든 결과 레이어의 마스크로 적용하며, 선택 영역이 없고 현재 레이어에
마스크가 있으면 그 마스크를 결과에 복사합니다. 둘 다 없으면 마스크 없이 생성합니다.

임시 파일과 색상 프로파일
-------------------------
- 입력 및 결과 TIFF는 작업 성공/실패 후 자동 정리합니다.
- 24시간 이상 지난 StarNet2 임시 파일도 시작 시 정리합니다.
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
