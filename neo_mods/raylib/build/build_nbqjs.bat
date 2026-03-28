@echo off
REM ================================================================
REM  build_nbqjs.bat  —  Build nbqjs.exe (NeoBasic QuickJS with Raylib)
REM  Requires: MinGW-w64 gcc on PATH  (or 32-bit MinGW at C:\mingw32\bin)
REM  Sources:
REM    QuickJS  — ../../../lib/quickjs-2025-09-13/
REM    Raylib   — ../../../lib/raylib-5.0/src/
REM    Module   — . (this directory)
REM ================================================================

setlocal EnableExtensions

REM ── locate gcc ──────────────────────────────────────────────────
where gcc >nul 2>&1
if %errorlevel% == 0 (
    set GCC=gcc
) else if exist "C:\mingw32\bin\gcc.exe" (
    set GCC=C:\mingw32\bin\gcc.exe
    set PATH=C:\mingw32\bin;%PATH%
) else if exist "C:\msys64\mingw64\bin\gcc.exe" (
    set GCC=C:\msys64\mingw64\bin\gcc.exe
    set PATH=C:\msys64\mingw64\bin;%PATH%
) else (
    echo ERROR: gcc not found. Install MinGW (https://www.mingw-w64.org/) and add it to PATH.
    exit /b 1
)
echo Using compiler: %GCC%

REM ── paths ───────────────────────────────────────────────────────
set SCRIPT_DIR=%~dp0
set BUILD_DIR=%SCRIPT_DIR%obj
set QJS_DIR=%SCRIPT_DIR%..\..\..\lib\quickjs-2025-09-13
set RL_SRC=%SCRIPT_DIR%..\..\..\lib\raylib-5.0\src
set DIST=%SCRIPT_DIR%..\..\..\dist

REM ── If raylib_qjs_module.c is missing, regenerate ───────────────
if not exist "%SCRIPT_DIR%raylib_qjs_module.c" (
    echo Generating raylib_qjs_module.c...
    python "%SCRIPT_DIR%gen_qjs_module.py"
    if %errorlevel% neq 0 (
        echo ERROR: gen_qjs_module.py failed.  Install Python 3 and retry.
        exit /b 1
    )
)

mkdir "%BUILD_DIR%" 2>nul
mkdir "%DIST%" 2>nul

set CFLAGS=-O2 -DPLATFORM_DESKTOP -DGRAPHICS_API_OPENGL_33 -D_WIN32_WINNT=0x0501 -I"%QJS_DIR%" -I"%RL_SRC%" -I"%RL_SRC%\external\glfw\include" -I"%SCRIPT_DIR%" -DCONFIG_VERSION="2025-09-13"

REM ── Step 1: compile Raylib ───────────────────────────────────────
echo [1/5] Compiling Raylib sources...

set RL_OBJS=
for %%f in (rcore rshapes rtextures rtext rmodels raudio utils rglfw) do (
    echo   %%f.c
    "%GCC%" %CFLAGS% -DSUPPORT_WINMM_HIGHRES_TIMER -c "%RL_SRC%\%%f.c" -o "%BUILD_DIR%\%%f.o"
    if %errorlevel% neq 0 exit /b 1
    set RL_OBJS=%RL_OBJS% "%BUILD_DIR%\%%f.o"
)

REM ── Step 2: compile QuickJS core ────────────────────────────────
echo [2/5] Compiling QuickJS...

for %%f in (quickjs dtoa libregexp libunicode cutils quickjs-libc) do (
    echo   %%f.c
    "%GCC%" %CFLAGS% -c "%QJS_DIR%\%%f.c" -o "%BUILD_DIR%\%%f.o"
    if %errorlevel% neq 0 exit /b 1
)

REM ── Step 3: compile QJS module + main ───────────────────────────
echo [3/5] Compiling raylib QJS module...
REM raylib_qjs_module.c includes raylib_bridge.c via #include, so compile as one TU
"%GCC%" %CFLAGS% -c "%SCRIPT_DIR%raylib_qjs_module.c" -o "%BUILD_DIR%\raylib_qjs_module.o"
if %errorlevel% neq 0 exit /b 1

echo [4/5] Compiling nbqjs_main.c...
"%GCC%" %CFLAGS% -c "%SCRIPT_DIR%nbqjs_main.c" -o "%BUILD_DIR%\nbqjs_main.o"
if %errorlevel% neq 0 exit /b 1

echo [4b] Compiling qjsc_stubs.c...
"%GCC%" %CFLAGS% -c "%SCRIPT_DIR%qjsc_stubs.c" -o "%BUILD_DIR%\qjsc_stubs.o"
if %errorlevel% neq 0 exit /b 1

REM ── Step 4: link ────────────────────────────────────────────────
echo [5/5] Linking nbqjs.exe...
"%GCC%" -o "%DIST%\nbqjs.exe" ^
    "%BUILD_DIR%\nbqjs_main.o" ^
    "%BUILD_DIR%\raylib_qjs_module.o" ^
    "%BUILD_DIR%\quickjs.o" "%BUILD_DIR%\dtoa.o" ^
    "%BUILD_DIR%\libregexp.o" "%BUILD_DIR%\libunicode.o" ^
    "%BUILD_DIR%\cutils.o" "%BUILD_DIR%\quickjs-libc.o" ^
    "%BUILD_DIR%\qjsc_stubs.o" ^
    %RL_OBJS% ^
    -lopengl32 -lgdi32 -lwinmm -lm -lpthread
if %errorlevel% neq 0 (
    echo LINK FAILED
    exit /b 1
)

echo.
echo === nbqjs.exe built successfully: %DIST%\nbqjs.exe ===
endlocal
