@echo off
REM ================================================================
REM  build_qjs.bat  --  Build all QuickJS-related artefacts:
REM
REM    dist\neobasic.js       NeoBasic compiler CLI (runs under qjs)
REM    dist\neobasic.exe      Custom QuickJS binary with native Raylib
REM
REM  Prerequisites:
REM    Node.js + npm   https://nodejs.org/
REM    Python 3        https://python.org/
REM    MinGW-w64 gcc   https://www.mingw-w64.org/  (or C:\mingw32 / MSYS2)
REM
REM  Sources expected at:
REM    lib\quickjs-2025-09-13\
REM    lib\raylib-5.0\
REM ================================================================
setlocal EnableDelayedExpansion EnableExtensions

set SCRIPT_DIR=%~dp0

REM ── Helpers ──────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: 'node' not found. Install Node.js from https://nodejs.org/
    exit /b 1
)
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: 'npm' not found. Install Node.js from https://nodejs.org/
    exit /b 1
)

REM ── Step 1: build neobasic.js ────────────────────────────────────
echo === [1/2] Building neobasic.js ===

cd /d "%SCRIPT_DIR%"

if not exist "node_modules" (
    echo --^> Installing npm dependencies...
    npm install
    if %errorlevel% neq 0 ( echo FAILED: npm install & exit /b 1 )
)

REM Bundle CLI for QuickJS -> dist/neobasic.js
REM (esbuild transpiles TypeScript directly; no prior tsc needed)
echo --^> Bundling for QuickJS...
npm run bundle:qjs
if %errorlevel% neq 0 ( echo FAILED: bundle:qjs & exit /b 1 )

echo.
echo     dist\neobasic.js  OK

REM ── Step 2: build neobasic.exe ───────────────────────────────────
echo.
echo === [2/2] Building neobasic.exe ===

set BUILD_NBQJS=%SCRIPT_DIR%interpreter\build.bat
if not exist "%BUILD_NBQJS%" (
    echo ERROR: %BUILD_NBQJS% not found.
    exit /b 1
)

call "%BUILD_NBQJS%"
if %errorlevel% neq 0 ( echo FAILED: build_nbqjs.bat & exit /b 1 )

REM ── Done ─────────────────────────────────────────────────────────
echo.
echo === Build complete ===
echo     dist\neobasic.js
echo     dist\neobasic.exe

endlocal
