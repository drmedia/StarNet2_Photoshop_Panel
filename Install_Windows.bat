@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

echo ============================================================
echo StarNet2 Photoshop Panel - Installer
echo ============================================================
echo.

set "SRC=%~dp0StarNet-Panel"
set "CEP_ROOT=%APPDATA%\Adobe\CEP\extensions"
set "DST=%CEP_ROOT%\StarNet-Panel"
set "STAGE=%CEP_ROOT%\StarNet-Panel.installing"
set "BACKUP=%CEP_ROOT%\StarNet-Panel.backup"
set "INSTALL_SWAPPED="
set "HAD_EXISTING="
set "REGEXE=%SystemRoot%\System32\reg.exe"
set "XCOPYEXE=%SystemRoot%\System32\xcopy.exe"
set "FCEXE=%SystemRoot%\System32\fc.exe"
set "FINDSTREXE=%SystemRoot%\System32\findstr.exe"
set "TASKLISTEXE=%SystemRoot%\System32\tasklist.exe"
set "FINDEXE=%SystemRoot%\System32\find.exe"
set "CHOICEEXE=%SystemRoot%\System32\choice.exe"

if not defined APPDATA (
    echo [ERROR] APPDATA 환경 변수를 찾을 수 없습니다.
    goto :fail
)

if not exist "%SRC%\CSXS\manifest.xml" (
    echo [ERROR] 확장 소스 폴더를 찾을 수 없습니다:
    echo         %SRC%
    goto :fail
)

for %%T in ("%REGEXE%" "%XCOPYEXE%" "%FCEXE%" "%FINDSTREXE%" "%TASKLISTEXE%" "%FINDEXE%" "%CHOICEEXE%") do (
    if not exist "%%~T" (
        echo [ERROR] Windows 필수 도구를 찾을 수 없습니다:
        echo         %%~T
        goto :fail
    )
)

"%TASKLISTEXE%" /FI "IMAGENAME eq Photoshop.exe" 2>nul | "%FINDEXE%" /I "Photoshop.exe" >nul
if not errorlevel 1 (
    echo [ERROR] Photoshop이 실행 중입니다.
    echo         Photoshop을 완전히 종료한 뒤 다시 실행하세요.
    goto :fail
)

set "DEBUG_READY=1"
for %%V in (9 10 11 12 13 14 15) do (
    call :check_debug %%V
    if errorlevel 1 set "DEBUG_READY=0"
)

if "%DEBUG_READY%"=="1" (
    echo [OK] CEP 개발자 모드가 이미 활성화되어 있습니다.
    echo      보안 동의와 레지스트리 설정을 건너뜁니다.
) else (
    echo 이 패널은 서명되지 않은 CEP 확장입니다.
    echo 설치하려면 현재 Windows 사용자의 Adobe CEP PlayerDebugMode를 활성화해야 합니다.
    echo 이 설정은 CEP 확장 서명 검사를 완화합니다.
    echo.
    "%CHOICEEXE%" /C YN /N /M "CEP 개발자 모드를 활성화하고 설치하시겠습니까? [Y/N]: "
    if errorlevel 2 (
        echo.
        echo [CANCEL] 변경 사항 없이 설치를 취소했습니다.
        goto :cancel
    )
)

echo.
echo [1/4] CEP 패널 설치 폴더 확인 중...
if not exist "%CEP_ROOT%" mkdir "%CEP_ROOT%" >nul 2>&1
if not exist "%CEP_ROOT%" (
    echo [ERROR] CEP 패널 설치 폴더를 만들지 못했습니다:
    echo         %CEP_ROOT%
    goto :fail
)

echo [2/4] 새 패널 임시 복사 및 검증 중...
if exist "%STAGE%" rmdir /S /Q "%STAGE%" 2>nul
if exist "%STAGE%" (
    echo [ERROR] 이전 임시 설치 폴더를 제거하지 못했습니다:
    echo         %STAGE%
    goto :fail
)
mkdir "%STAGE%" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 임시 설치 폴더를 만들지 못했습니다:
    echo         %STAGE%
    goto :fail
)

"%XCOPYEXE%" "%SRC%\*" "%STAGE%\" /E /I /H /K /Y >nul
if errorlevel 1 goto :copy_failed

set "VERIFY_ROOT=%STAGE%"
set "COPY_FAILED="
for %%F in ("CSXS\manifest.xml" "client\index.html" "client\style.css" "client\main.js" "host\host.jsx") do (
    call :verify_file "%%~F"
    if errorlevel 1 set "COPY_FAILED=1"
)
if defined COPY_FAILED (
    echo [ERROR] 설치 파일 검증에 실패했습니다.
    goto :fail
)

echo [3/4] 검증된 패널로 교체 중...
if exist "%BACKUP%" rmdir /S /Q "%BACKUP%" 2>nul
if exist "%BACKUP%" (
    echo [ERROR] 이전 백업 폴더를 제거하지 못했습니다:
    echo         %BACKUP%
    goto :fail
)
if exist "%DST%" (
    move /Y "%DST%" "%BACKUP%" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] 기존 설치본을 백업하지 못했습니다:
        echo         %DST%
        goto :fail
    )
    set "HAD_EXISTING=1"
)
move /Y "%STAGE%" "%DST%" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 검증된 패널을 설치 위치로 이동하지 못했습니다.
    goto :fail
)
set "INSTALL_SWAPPED=1"

echo [4/4] CEP 개발자 모드 설정 및 검증 중...
if "%DEBUG_READY%"=="1" (
    echo [SKIP] PlayerDebugMode가 이미 설정되어 있습니다.
) else (
    set "REG_FAILED="
    for %%V in (9 10 11 12 13 14 15) do (
        call :enable_and_verify_debug %%V
        if errorlevel 1 set "REG_FAILED=1"
    )
    if defined REG_FAILED (
        echo [ERROR] 하나 이상의 CEP PlayerDebugMode 설정 또는 검증에 실패했습니다.
        echo         위에 표시된 CSXS 버전과 현재 사용자 레지스트리 권한을 확인하세요.
        goto :fail
    )
)

if exist "%BACKUP%" rmdir /S /Q "%BACKUP%" 2>nul
if exist "%BACKUP%" (
    echo [WARNING] 설치는 완료했지만 이전 설치 백업을 제거하지 못했습니다:
    echo           %BACKUP%
)

echo.
echo [OK] 설치 및 검증 완료:
echo      %DST%
echo.
echo Photoshop을 다시 실행한 뒤 다음 메뉴를 확인하세요:
echo Window ^> Extensions ^(Legacy^) ^> StarNet
echo.
pause
exit /b 0

:copy_failed
echo [ERROR] 패널 파일 복사에 실패했습니다.
goto :fail

:fail
call :rollback_install
echo.
echo 설치에 실패했습니다. 위의 [ERROR] 내용을 확인하세요.
echo.
pause
exit /b 1

:cancel
echo.
pause
exit /b 2

:verify_file
if not exist "%VERIFY_ROOT%\%~1" (
    echo [ERROR] 설치 파일 누락: %~1
    exit /b 1
)
"%FCEXE%" /B "%SRC%\%~1" "%VERIFY_ROOT%\%~1" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 설치 파일 불일치: %~1
    exit /b 1
)
echo [OK] 파일 검증: %~1
exit /b 0

:rollback_install
if defined INSTALL_SWAPPED (
    if exist "%DST%" rmdir /S /Q "%DST%" 2>nul
)
if defined HAD_EXISTING (
    if exist "%BACKUP%" move /Y "%BACKUP%" "%DST%" >nul 2>&1
)
if exist "%STAGE%" rmdir /S /Q "%STAGE%" 2>nul
exit /b 0

:check_debug
"%REGEXE%" query "HKCU\Software\Adobe\CSXS.%~1" /v PlayerDebugMode 2>nul | "%FINDSTREXE%" /R /C:"PlayerDebugMode *REG_SZ *1$" >nul
exit /b %ERRORLEVEL%

:enable_and_verify_debug
"%REGEXE%" add "HKCU\Software\Adobe\CSXS.%~1" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
if errorlevel 1 (
    echo [ERROR] CSXS.%~1 PlayerDebugMode 등록 실패
    exit /b 1
)

"%REGEXE%" query "HKCU\Software\Adobe\CSXS.%~1" /v PlayerDebugMode 2>nul | "%FINDSTREXE%" /R /C:"PlayerDebugMode *REG_SZ *1$" >nul
if errorlevel 1 (
    echo [ERROR] CSXS.%~1 PlayerDebugMode 검증 실패
    exit /b 1
)

echo [OK] CSXS.%~1 PlayerDebugMode=1
exit /b 0
