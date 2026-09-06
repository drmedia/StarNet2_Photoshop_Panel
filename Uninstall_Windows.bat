@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

echo ============================================================
echo StarNet2 Photoshop Panel - Uninstaller
echo ============================================================
echo.

set "DST=%APPDATA%\Adobe\CEP\extensions\StarNet-Panel"
set "REGEXE=%SystemRoot%\System32\reg.exe"
set "TASKLISTEXE=%SystemRoot%\System32\tasklist.exe"
set "FINDEXE=%SystemRoot%\System32\find.exe"

if not defined APPDATA (
    echo [ERROR] APPDATA 환경 변수를 찾을 수 없습니다.
    goto :fail
)

for %%T in ("%REGEXE%" "%TASKLISTEXE%" "%FINDEXE%") do (
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

echo [1/2] 패널 설치 폴더 제거 중...
if exist "%DST%" (
    rmdir /S /Q "%DST%" 2>nul
    if exist "%DST%" (
        echo [ERROR] 패널 설치 폴더를 제거하지 못했습니다:
        echo         %DST%
        echo         파일을 사용 중인 Adobe 프로세스가 없는지 확인하세요.
        goto :fail
    )
    echo [OK] 패널 설치 폴더 제거 완료
) else (
    echo [SKIP] 설치된 패널 폴더가 없습니다:
    echo        %DST%
)

set "DEBUG_FOUND="
for %%V in (9 10 11 12 13 14 15) do (
    "%REGEXE%" query "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode >nul 2>&1
    if not errorlevel 1 set "DEBUG_FOUND=1"
)

if not defined DEBUG_FOUND (
    echo [2/2] CEP PlayerDebugMode 설정 없음 - 건너뜀
    goto :success
)

echo.
echo PlayerDebugMode는 서명되지 않은 모든 CEP 확장에 적용되는 공유 설정입니다.
echo RC-Astro BXT 등 다른 CEP 패널을 사용 중이라면 유지해야 합니다.
set "REMOVE_DEBUG=N"
set /P "REMOVE_DEBUG=PlayerDebugMode도 제거하시겠습니까? [y/N]: "

if /I not "%REMOVE_DEBUG%"=="Y" (
    echo [2/2] CEP PlayerDebugMode 유지
    goto :success
)

echo.
echo [2/2] CEP PlayerDebugMode 제거 및 검증 중...
set "REG_FAILED="
for %%V in (9 10 11 12 13 14 15) do (
    call :remove_debug_value %%V
    if errorlevel 1 set "REG_FAILED=1"
)
if defined REG_FAILED (
    echo [ERROR] 하나 이상의 PlayerDebugMode 값을 제거하지 못했습니다.
    echo         위에 표시된 CSXS 버전과 현재 사용자 레지스트리 권한을 확인하세요.
    goto :fail
)

:success
echo.
echo [OK] 제거 및 검증 완료
echo.
pause
exit /b 0

:fail
echo.
echo 제거에 실패했습니다. 위의 [ERROR] 내용을 확인하세요.
echo.
pause
exit /b 1

:remove_debug_value
"%REGEXE%" query "HKCU\Software\Adobe\CSXS.%~1" /v PlayerDebugMode >nul 2>&1
if errorlevel 1 (
    echo [SKIP] CSXS.%~1 PlayerDebugMode 없음
    exit /b 0
)

"%REGEXE%" delete "HKCU\Software\Adobe\CSXS.%~1" /v PlayerDebugMode /f >nul 2>&1
if errorlevel 1 (
    echo [ERROR] CSXS.%~1 PlayerDebugMode 삭제 실패
    exit /b 1
)

"%REGEXE%" query "HKCU\Software\Adobe\CSXS.%~1" /v PlayerDebugMode >nul 2>&1
if not errorlevel 1 (
    echo [ERROR] CSXS.%~1 PlayerDebugMode 삭제 검증 실패
    exit /b 1
)

echo [OK] CSXS.%~1 PlayerDebugMode 제거
exit /b 0
