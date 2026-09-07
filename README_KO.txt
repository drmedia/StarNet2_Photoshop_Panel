StarNet2 Photoshop Panel
Windows / Photoshop CEP Panel
============================================================

구성
----
StarNet-Panel\
  CSXS\manifest.xml
  client\index.html
  client\style.css
  client\main.js
  host\host.jsx

Install_Windows.bat
Uninstall_Windows.bat
tests\

기능
----
- Remove Stars: StarNet++로 별을 제거하는 작업 화면
- Extract Stars: 별 레이어를 분리하는 작업 화면
- 현재 Photoshop 문서 감지
- 현재 레이어 이름, 형식, 전체 프레임 여부 자동 감지
- 처리 범위 선택: 보이는 레이어, 현재 레이어(기본값) 또는 지정 영역
- 선택한 결과 레이어 생성 및 원본 레이어 보존
- StarNet2 실행 파일, 버전, 처리 백엔드 사전 확인
- 우측 상단 설정 버튼에서 실행 파일 찾아보기 및 선택 경로 자동 저장
- 우측 상단 사용 설명서 버튼에서 패널 기능과 기본 작업 순서 확인
- 실제 StarNet2 진행률과 경과 시간 표시
- TIFF 준비, CLI 처리, 결과 레이어 생성 단계의 작업 취소
- 원본 ICC 컬러 프로파일 보존 및 결과 TIFF 재할당

설치
----
1. Photoshop을 종료합니다.
2. Install_Windows.bat을 실행합니다.
3. Photoshop 재시작 후 Window > Extensions (Legacy) > StarNet2를 엽니다.

현재 상태
----------
StarNet2 CLI 2.5.x 및 2.6.x의 공식 인자를 사용합니다.

  starnet2 --input input.tif --output starless.tif --unscreen stars.tif --machine-progress

실행 시 원본 문서를 변경하지 않고 임시 복제 문서를 RGB 16-bit TIFF로 생성합니다.
'보이는 레이어'는 현재 보이는 모든 레이어를 합성한 이미지를 처리합니다. 기본값인 '현재 레이어'는
선택한 일반 픽셀 레이어만 처리하며, 전체 프레임을 채우는 레이어를 권장합니다.
부분 레이어의 빈 영역은 검정으로 채우고 처리 완료 메시지에 주의를 표시합니다.
'지정 영역'은 보이는 모든 레이어를 합성해 StarNet2로 처리한 뒤 생성된 모든 결과 레이어에
동일한 영역 마스크를 적용합니다. Photoshop 선택 영역을 우선 사용하고, 선택 영역이
없으면 현재 레이어의 사용자 마스크를 사용합니다. 둘 다 없으면 안전하게 중단합니다.
선택 영역은 처리 후 복원되며 임시 알파 채널은 성공, 실패 또는 취소 시 정리됩니다.
StarNet2 CLI가 Starless와 스크린 합성용 Stars TIFF를 생성하면 선택된 결과를 원본 문서의
새 레이어로 가져옵니다. Star Boost (Large)는 Stars 레이어를 복제한 뒤 큰 별만 선별하여
만듭니다. 별도 Star Mask TIFF는 생성하지 않습니다. 성공 또는 실패 후 입력/출력 임시
TIFF는 자동 삭제됩니다.
패널을 다시 열 때 24시간이 지난 잔여 임시 TIFF도 자동으로 정리합니다.
입력 TIFF에는 처리 문서의 ICC 컬러 프로파일을 포함합니다. StarNet2의 RGB 결과를
가져올 때는 RGB 값을 변환하지 않고 입력에 사용한 프로파일을 결과 문서에 다시 할당한
뒤 원본 문서로 복사하여 프로파일 유실로 인한 채도와 색조 변화를 방지합니다. 프로파일이
없는 원본은 결과에도 프로파일을 할당하지 않습니다.

결과 레이어는 위에서부터 Star Boost (Large), Stars, Starless 순서로 배치됩니다.
Stars에는 스크린 혼합 모드를 적용합니다. Star Boost (Large)는 Stars를 복제하고 Minimum과 Maximum 필터를
차례로 적용하여 작은 별 형상을 제거하고 큰 별 형상만 복원한 뒤 경계를 부드럽게
처리합니다. 크기 기준 반경은 이미지의 짧은 변에 따라 1~6px로 자동 조절됩니다.
크기로 선별된 큰 별에는 Levels 정규화를 적용해 마스크 밝기를 강화합니다.
Star Boost (Large)는 표시, 스크린 혼합 모드, 불투명도 60%가 기본이며 세부 설정의
'큰 별 강조 강도'로 10~100% 범위에서 조절할 수 있습니다. Starless는 표준입니다.

우측 상단 설정 버튼을 누르면 메인 작업 화면 대신 StarNet2 실행 파일 설정만 표시됩니다. 실행 파일 입력란은
기본적으로 PATH의 starnet2.exe를 사용하며, 필요하면 전체 경로를 입력하고 저장할 수
있습니다. 저장된 경로는 다음 실행부터 자동으로 불러옵니다.
패널은 --machine-info 또는 --version으로 StarNet2를 확인하며, 문서와 선택 레이어,
실행 파일 및 결과 선택이 유효할 때만 실행 버튼을 활성화합니다.
찾기 버튼으로 starnet2.exe를 선택하면 경로를 자동 저장하고 즉시 다시 확인합니다.
처리 중에는 StarNet2가 제공하는 실제 진행률과 전체 경과 시간을 표시합니다.
처리 취소 시 실행 프로세스와 임시 파일을 정리하며, 이미 가져온 결과 레이어가 있으면
이번 실행에서 추가된 레이어를 자동으로 제거합니다.
Windows 2.5.x 및 2.6.x 패키지는 DirectML을 우선 사용하며 공식 CLI에는 CPU 강제 옵션이 없습니다.
DirectML의 Resize 오류가 발생하면 GPU 드라이버를 업데이트하거나 CPU 전용/CPU 기본
StarNet2 실행 파일의 전체 경로를 입력란에 지정하세요.
실제 처리는 Photoshop CEP 환경에서만 실행되며, Photoshop 외부에서는 실행되지 않습니다.

보안 안내
---------
이 패널은 서명되지 않은 CEP 확장이므로 설치 시 현재 Windows 사용자의 Adobe CEP
PlayerDebugMode 활성화에 대한 동의를 요청합니다. 이 설정은 확장 서명 검사를 완화합니다.
배포용으로 사용할 때는 코드 서명된 확장 패키지로 전환하는 것을 권장합니다.

제거
----
Photoshop을 종료한 뒤 Uninstall_Windows.bat을 실행합니다.
