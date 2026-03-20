// ═══════════════════════════════════════════════════════════════════
// NeoBasic Raylib Bridge — C wrapper layer
// Flattens struct arguments so JS can call with scalar values only.
// ═══════════════════════════════════════════════════════════════════

#include "raylib.h"
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>

// ── Handle table for opaque types ─────────────────────────────────

#define MAX_HANDLES 4096

typedef enum {
    HT_NONE = 0,
    HT_IMAGE,
    HT_TEXTURE,
    HT_RENDER_TEXTURE,
    HT_FONT,
    HT_SOUND,
    HT_MUSIC,
    HT_WAVE,
    HT_AUDIO_STREAM,
    HT_SHADER,
    HT_MODEL,
    HT_MESH,
    HT_MATERIAL,
    HT_MODEL_ANIMATION,
} HandleType;

typedef struct {
    HandleType type;
    union {
        Image image;
        Texture2D texture;
        RenderTexture2D renderTexture;
        Font font;
        Sound sound;
        Music music;
        Wave wave;
        AudioStream audioStream;
        Shader shader;
        Model model;
        Mesh mesh;
        Material material;
        ModelAnimation modelAnimation;
    } data;
} Handle;

static Handle handles[MAX_HANDLES];
static int nextHandle = 1;

static int allocHandle(HandleType type) {
    if (nextHandle >= MAX_HANDLES) return 0;
    int id = nextHandle++;
    handles[id].type = type;
    return id;
}

static void freeHandle(int id) {
    if (id > 0 && id < MAX_HANDLES) {
        handles[id].type = HT_NONE;
    }
}

// ═══════════════════════════════════════════════════════════════════
// Window management
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_InitWindow(int w, int h, const char* title) {
    InitWindow(w, h, title);
}

EMSCRIPTEN_KEEPALIVE void bridge_CloseWindow(void) {
    CloseWindow();
}

EMSCRIPTEN_KEEPALIVE int bridge_WindowShouldClose(void) {
    return WindowShouldClose();
}

EMSCRIPTEN_KEEPALIVE int bridge_IsWindowReady(void) { return IsWindowReady(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsWindowFullscreen(void) { return IsWindowFullscreen(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsWindowHidden(void) { return IsWindowHidden(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsWindowMinimized(void) { return IsWindowMinimized(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsWindowMaximized(void) { return IsWindowMaximized(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsWindowFocused(void) { return IsWindowFocused(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsWindowResized(void) { return IsWindowResized(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsWindowState(int flag) { return IsWindowState(flag); }
EMSCRIPTEN_KEEPALIVE void bridge_SetWindowState(int flags) { SetWindowState(flags); }
EMSCRIPTEN_KEEPALIVE void bridge_ClearWindowState(int flags) { ClearWindowState(flags); }
EMSCRIPTEN_KEEPALIVE void bridge_ToggleFullscreen(void) { ToggleFullscreen(); }
EMSCRIPTEN_KEEPALIVE void bridge_ToggleBorderlessWindowed(void) { ToggleBorderlessWindowed(); }
EMSCRIPTEN_KEEPALIVE void bridge_MaximizeWindow(void) { MaximizeWindow(); }
EMSCRIPTEN_KEEPALIVE void bridge_MinimizeWindow(void) { MinimizeWindow(); }
EMSCRIPTEN_KEEPALIVE void bridge_RestoreWindow(void) { RestoreWindow(); }
EMSCRIPTEN_KEEPALIVE void bridge_SetWindowTitle(const char* t) { SetWindowTitle(t); }
EMSCRIPTEN_KEEPALIVE void bridge_SetWindowPosition(int x, int y) { SetWindowPosition(x, y); }
EMSCRIPTEN_KEEPALIVE void bridge_SetWindowMonitor(int m) { SetWindowMonitor(m); }
EMSCRIPTEN_KEEPALIVE void bridge_SetWindowMinSize(int w, int h) { SetWindowMinSize(w, h); }
EMSCRIPTEN_KEEPALIVE void bridge_SetWindowMaxSize(int w, int h) { SetWindowMaxSize(w, h); }
EMSCRIPTEN_KEEPALIVE void bridge_SetWindowSize(int w, int h) { SetWindowSize(w, h); }
EMSCRIPTEN_KEEPALIVE void bridge_SetWindowOpacity(float o) { SetWindowOpacity(o); }
EMSCRIPTEN_KEEPALIVE void bridge_SetWindowFocused(void) { SetWindowFocused(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetScreenWidth(void) { return GetScreenWidth(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetScreenHeight(void) { return GetScreenHeight(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetRenderWidth(void) { return GetRenderWidth(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetRenderHeight(void) { return GetRenderHeight(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetMonitorCount(void) { return GetMonitorCount(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetCurrentMonitor(void) { return GetCurrentMonitor(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetMonitorWidth(int m) { return GetMonitorWidth(m); }
EMSCRIPTEN_KEEPALIVE int bridge_GetMonitorHeight(int m) { return GetMonitorHeight(m); }
EMSCRIPTEN_KEEPALIVE int bridge_GetMonitorPhysicalWidth(int m) { return GetMonitorPhysicalWidth(m); }
EMSCRIPTEN_KEEPALIVE int bridge_GetMonitorPhysicalHeight(int m) { return GetMonitorPhysicalHeight(m); }
EMSCRIPTEN_KEEPALIVE int bridge_GetMonitorRefreshRate(int m) { return GetMonitorRefreshRate(m); }
EMSCRIPTEN_KEEPALIVE const char* bridge_GetMonitorName(int m) { return GetMonitorName(m); }
EMSCRIPTEN_KEEPALIVE void bridge_SetClipboardText(const char* t) { SetClipboardText(t); }
EMSCRIPTEN_KEEPALIVE const char* bridge_GetClipboardText(void) { return GetClipboardText(); }
EMSCRIPTEN_KEEPALIVE void bridge_EnableEventWaiting(void) { EnableEventWaiting(); }
EMSCRIPTEN_KEEPALIVE void bridge_DisableEventWaiting(void) { DisableEventWaiting(); }

// ═══════════════════════════════════════════════════════════════════
// Cursor
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_ShowCursor(void) { ShowCursor(); }
EMSCRIPTEN_KEEPALIVE void bridge_HideCursor(void) { HideCursor(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsCursorHidden(void) { return IsCursorHidden(); }
EMSCRIPTEN_KEEPALIVE void bridge_EnableCursor(void) { EnableCursor(); }
EMSCRIPTEN_KEEPALIVE void bridge_DisableCursor(void) { DisableCursor(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsCursorOnScreen(void) { return IsCursorOnScreen(); }

// ═══════════════════════════════════════════════════════════════════
// Drawing control
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_ClearBackground(int r, int g, int b, int a) {
    ClearBackground((Color){r, g, b, a});
}

EMSCRIPTEN_KEEPALIVE void bridge_BeginDrawing(void) { BeginDrawing(); }

EMSCRIPTEN_KEEPALIVE void bridge_EndDrawing(void) {
    EndDrawing();
    emscripten_sleep(0); // yield to browser event loop
}

EMSCRIPTEN_KEEPALIVE void bridge_BeginMode2D(float ox, float oy, float tx, float ty, float rot, float zoom) {
    Camera2D cam = { {ox, oy}, {tx, ty}, rot, zoom };
    BeginMode2D(cam);
}

EMSCRIPTEN_KEEPALIVE void bridge_EndMode2D(void) { EndMode2D(); }

EMSCRIPTEN_KEEPALIVE void bridge_BeginMode3D(
    float px, float py, float pz,
    float tx, float ty, float tz,
    float ux, float uy, float uz,
    float fovy, int projection
) {
    Camera3D cam = { {px,py,pz}, {tx,ty,tz}, {ux,uy,uz}, fovy, projection };
    BeginMode3D(cam);
}

EMSCRIPTEN_KEEPALIVE void bridge_EndMode3D(void) { EndMode3D(); }

EMSCRIPTEN_KEEPALIVE void bridge_BeginTextureMode(int handle) {
    if (handle > 0 && handle < MAX_HANDLES && handles[handle].type == HT_RENDER_TEXTURE)
        BeginTextureMode(handles[handle].data.renderTexture);
}

EMSCRIPTEN_KEEPALIVE void bridge_EndTextureMode(void) { EndTextureMode(); }

EMSCRIPTEN_KEEPALIVE void bridge_BeginShaderMode(int handle) {
    if (handle > 0 && handle < MAX_HANDLES && handles[handle].type == HT_SHADER)
        BeginShaderMode(handles[handle].data.shader);
}

EMSCRIPTEN_KEEPALIVE void bridge_EndShaderMode(void) { EndShaderMode(); }
EMSCRIPTEN_KEEPALIVE void bridge_BeginBlendMode(int mode) { BeginBlendMode(mode); }
EMSCRIPTEN_KEEPALIVE void bridge_EndBlendMode(void) { EndBlendMode(); }
EMSCRIPTEN_KEEPALIVE void bridge_BeginScissorMode(int x, int y, int w, int h) { BeginScissorMode(x, y, w, h); }
EMSCRIPTEN_KEEPALIVE void bridge_EndScissorMode(void) { EndScissorMode(); }

// ═══════════════════════════════════════════════════════════════════
// Timing
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_SetTargetFPS(int fps) { SetTargetFPS(fps); }
EMSCRIPTEN_KEEPALIVE int bridge_GetFPS(void) { return GetFPS(); }
EMSCRIPTEN_KEEPALIVE float bridge_GetFrameTime(void) { return GetFrameTime(); }
EMSCRIPTEN_KEEPALIVE double bridge_GetTime(void) { return GetTime(); }

// ═══════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_SetConfigFlags(int flags) { SetConfigFlags(flags); }
EMSCRIPTEN_KEEPALIVE void bridge_SetTraceLogLevel(int level) { SetTraceLogLevel(level); }
EMSCRIPTEN_KEEPALIVE void bridge_TakeScreenshot(const char* fn) { TakeScreenshot(fn); }
EMSCRIPTEN_KEEPALIVE void bridge_OpenURL(const char* url) { OpenURL(url); }
EMSCRIPTEN_KEEPALIVE void bridge_SetRandomSeed(int seed) { SetRandomSeed(seed); }
EMSCRIPTEN_KEEPALIVE int bridge_GetRandomValue(int min, int max) { return GetRandomValue(min, max); }

// ═══════════════════════════════════════════════════════════════════
// Input: Keyboard
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE int bridge_IsKeyPressed(int key) { return IsKeyPressed(key); }
EMSCRIPTEN_KEEPALIVE int bridge_IsKeyPressedRepeat(int key) { return IsKeyPressedRepeat(key); }
EMSCRIPTEN_KEEPALIVE int bridge_IsKeyDown(int key) { return IsKeyDown(key); }
EMSCRIPTEN_KEEPALIVE int bridge_IsKeyReleased(int key) { return IsKeyReleased(key); }
EMSCRIPTEN_KEEPALIVE int bridge_IsKeyUp(int key) { return IsKeyUp(key); }
EMSCRIPTEN_KEEPALIVE int bridge_GetKeyPressed(void) { return GetKeyPressed(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetCharPressed(void) { return GetCharPressed(); }

// ═══════════════════════════════════════════════════════════════════
// Input: Mouse
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE int bridge_IsMouseButtonPressed(int b) { return IsMouseButtonPressed(b); }
EMSCRIPTEN_KEEPALIVE int bridge_IsMouseButtonDown(int b) { return IsMouseButtonDown(b); }
EMSCRIPTEN_KEEPALIVE int bridge_IsMouseButtonReleased(int b) { return IsMouseButtonReleased(b); }
EMSCRIPTEN_KEEPALIVE int bridge_IsMouseButtonUp(int b) { return IsMouseButtonUp(b); }
EMSCRIPTEN_KEEPALIVE int bridge_GetMouseX(void) { return GetMouseX(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetMouseY(void) { return GetMouseY(); }

// Shared float buffer for returning small structs
static float _fbuf[16];

EMSCRIPTEN_KEEPALIVE float* bridge_GetMousePosition(void) {
    Vector2 v = GetMousePosition();
    _fbuf[0] = v.x; _fbuf[1] = v.y;
    return _fbuf;
}

EMSCRIPTEN_KEEPALIVE float* bridge_GetMouseDelta(void) {
    Vector2 v = GetMouseDelta();
    _fbuf[0] = v.x; _fbuf[1] = v.y;
    return _fbuf;
}

EMSCRIPTEN_KEEPALIVE void bridge_SetMousePosition(int x, int y) { SetMousePosition(x, y); }
EMSCRIPTEN_KEEPALIVE void bridge_SetMouseOffset(int ox, int oy) { SetMouseOffset(ox, oy); }
EMSCRIPTEN_KEEPALIVE void bridge_SetMouseScale(float sx, float sy) { SetMouseScale(sx, sy); }
EMSCRIPTEN_KEEPALIVE float bridge_GetMouseWheelMove(void) { return GetMouseWheelMove(); }

EMSCRIPTEN_KEEPALIVE float* bridge_GetMouseWheelMoveV(void) {
    Vector2 v = GetMouseWheelMoveV();
    _fbuf[0] = v.x; _fbuf[1] = v.y;
    return _fbuf;
}

EMSCRIPTEN_KEEPALIVE void bridge_SetMouseCursor(int cursor) { SetMouseCursor(cursor); }

// ═══════════════════════════════════════════════════════════════════
// Input: Gamepad
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE int bridge_IsGamepadAvailable(int gp) { return IsGamepadAvailable(gp); }
EMSCRIPTEN_KEEPALIVE const char* bridge_GetGamepadName(int gp) { return GetGamepadName(gp); }
EMSCRIPTEN_KEEPALIVE int bridge_IsGamepadButtonPressed(int gp, int btn) { return IsGamepadButtonPressed(gp, btn); }
EMSCRIPTEN_KEEPALIVE int bridge_IsGamepadButtonDown(int gp, int btn) { return IsGamepadButtonDown(gp, btn); }
EMSCRIPTEN_KEEPALIVE int bridge_IsGamepadButtonReleased(int gp, int btn) { return IsGamepadButtonReleased(gp, btn); }
EMSCRIPTEN_KEEPALIVE int bridge_IsGamepadButtonUp(int gp, int btn) { return IsGamepadButtonUp(gp, btn); }
EMSCRIPTEN_KEEPALIVE int bridge_GetGamepadButtonPressed(void) { return GetGamepadButtonPressed(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetGamepadAxisCount(int gp) { return GetGamepadAxisCount(gp); }
EMSCRIPTEN_KEEPALIVE float bridge_GetGamepadAxisMovement(int gp, int axis) { return GetGamepadAxisMovement(gp, axis); }

// ═══════════════════════════════════════════════════════════════════
// Input: Touch
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE int bridge_GetTouchX(void) { return GetTouchX(); }
EMSCRIPTEN_KEEPALIVE int bridge_GetTouchY(void) { return GetTouchY(); }

EMSCRIPTEN_KEEPALIVE float* bridge_GetTouchPosition(int idx) {
    Vector2 v = GetTouchPosition(idx);
    _fbuf[0] = v.x; _fbuf[1] = v.y;
    return _fbuf;
}

EMSCRIPTEN_KEEPALIVE int bridge_GetTouchPointId(int idx) { return GetTouchPointId(idx); }
EMSCRIPTEN_KEEPALIVE int bridge_GetTouchPointCount(void) { return GetTouchPointCount(); }

// ═══════════════════════════════════════════════════════════════════
// Shapes: Basic drawing
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_DrawPixel(int x, int y, int r, int g, int b, int a) {
    DrawPixel(x, y, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawPixelV(float px, float py, int r, int g, int b, int a) {
    DrawPixelV((Vector2){px,py}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawLine(int sx, int sy, int ex, int ey, int r, int g, int b, int a) {
    DrawLine(sx, sy, ex, ey, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawLineV(float sx, float sy, float ex, float ey, int r, int g, int b, int a) {
    DrawLineV((Vector2){sx,sy}, (Vector2){ex,ey}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawLineEx(float sx, float sy, float ex, float ey, float thick, int r, int g, int b, int a) {
    DrawLineEx((Vector2){sx,sy}, (Vector2){ex,ey}, thick, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawLineBezier(float sx, float sy, float ex, float ey, float thick, int r, int g, int b, int a) {
    DrawLineBezier((Vector2){sx,sy}, (Vector2){ex,ey}, thick, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCircle(int cx, int cy, float radius, int r, int g, int b, int a) {
    DrawCircle(cx, cy, radius, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCircleV(float cx, float cy, float radius, int r, int g, int b, int a) {
    DrawCircleV((Vector2){cx,cy}, radius, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCircleLines(int cx, int cy, float radius, int r, int g, int b, int a) {
    DrawCircleLines(cx, cy, radius, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCircleLinesV(float cx, float cy, float radius, int r, int g, int b, int a) {
    DrawCircleLinesV((Vector2){cx,cy}, radius, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCircleSector(float cx, float cy, float radius, float startAngle, float endAngle, int segments, int r, int g, int b, int a) {
    DrawCircleSector((Vector2){cx,cy}, radius, startAngle, endAngle, segments, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCircleSectorLines(float cx, float cy, float radius, float startAngle, float endAngle, int segments, int r, int g, int b, int a) {
    DrawCircleSectorLines((Vector2){cx,cy}, radius, startAngle, endAngle, segments, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCircleGradient(int cx, int cy, float radius, int r1, int g1, int b1, int a1, int r2, int g2, int b2, int a2) {
    DrawCircleGradient(cx, cy, radius, (Color){r1,g1,b1,a1}, (Color){r2,g2,b2,a2});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawEllipse(int cx, int cy, float rh, float rv, int r, int g, int b, int a) {
    DrawEllipse(cx, cy, rh, rv, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawEllipseLines(int cx, int cy, float rh, float rv, int r, int g, int b, int a) {
    DrawEllipseLines(cx, cy, rh, rv, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRing(float cx, float cy, float inner, float outer, float startAngle, float endAngle, int segments, int r, int g, int b, int a) {
    DrawRing((Vector2){cx,cy}, inner, outer, startAngle, endAngle, segments, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRingLines(float cx, float cy, float inner, float outer, float startAngle, float endAngle, int segments, int r, int g, int b, int a) {
    DrawRingLines((Vector2){cx,cy}, inner, outer, startAngle, endAngle, segments, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangle(int x, int y, int w, int h, int r, int g, int b, int a) {
    DrawRectangle(x, y, w, h, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleV(float px, float py, float sx, float sy, int r, int g, int b, int a) {
    DrawRectangleV((Vector2){px,py}, (Vector2){sx,sy}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleRec(float rx, float ry, float rw, float rh, int r, int g, int b, int a) {
    DrawRectangleRec((Rectangle){rx,ry,rw,rh}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectanglePro(float rx, float ry, float rw, float rh, float ox, float oy, float rotation, int r, int g, int b, int a) {
    DrawRectanglePro((Rectangle){rx,ry,rw,rh}, (Vector2){ox,oy}, rotation, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleGradientV(int x, int y, int w, int h, int r1, int g1, int b1, int a1, int r2, int g2, int b2, int a2) {
    DrawRectangleGradientV(x, y, w, h, (Color){r1,g1,b1,a1}, (Color){r2,g2,b2,a2});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleGradientH(int x, int y, int w, int h, int r1, int g1, int b1, int a1, int r2, int g2, int b2, int a2) {
    DrawRectangleGradientH(x, y, w, h, (Color){r1,g1,b1,a1}, (Color){r2,g2,b2,a2});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleGradientEx(float rx, float ry, float rw, float rh, int r1, int g1, int b1, int a1, int r2, int g2, int b2, int a2, int r3, int g3, int b3, int a3, int r4, int g4, int b4, int a4) {
    DrawRectangleGradientEx((Rectangle){rx,ry,rw,rh}, (Color){r1,g1,b1,a1}, (Color){r2,g2,b2,a2}, (Color){r3,g3,b3,a3}, (Color){r4,g4,b4,a4});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleLines(int x, int y, int w, int h, int r, int g, int b, int a) {
    DrawRectangleLines(x, y, w, h, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleLinesEx(float rx, float ry, float rw, float rh, float thick, int r, int g, int b, int a) {
    DrawRectangleLinesEx((Rectangle){rx,ry,rw,rh}, thick, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleRounded(float rx, float ry, float rw, float rh, float roundness, int segments, int r, int g, int b, int a) {
    DrawRectangleRounded((Rectangle){rx,ry,rw,rh}, roundness, segments, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleRoundedLines(float rx, float ry, float rw, float rh, float roundness, int segments, int r, int g, int b, int a) {
    DrawRectangleRoundedLines((Rectangle){rx,ry,rw,rh}, roundness, segments, 1.0f, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawRectangleRoundedLinesEx(float rx, float ry, float rw, float rh, float roundness, int segments, float thick, int r, int g, int b, int a) {
    DrawRectangleRoundedLines((Rectangle){rx,ry,rw,rh}, roundness, segments, thick, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawTriangle(float x1, float y1, float x2, float y2, float x3, float y3, int r, int g, int b, int a) {
    DrawTriangle((Vector2){x1,y1}, (Vector2){x2,y2}, (Vector2){x3,y3}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawTriangleLines(float x1, float y1, float x2, float y2, float x3, float y3, int r, int g, int b, int a) {
    DrawTriangleLines((Vector2){x1,y1}, (Vector2){x2,y2}, (Vector2){x3,y3}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawPoly(float cx, float cy, int sides, float radius, float rotation, int r, int g, int b, int a) {
    DrawPoly((Vector2){cx,cy}, sides, radius, rotation, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawPolyLines(float cx, float cy, int sides, float radius, float rotation, int r, int g, int b, int a) {
    DrawPolyLines((Vector2){cx,cy}, sides, radius, rotation, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawPolyLinesEx(float cx, float cy, int sides, float radius, float rotation, float thick, int r, int g, int b, int a) {
    DrawPolyLinesEx((Vector2){cx,cy}, sides, radius, rotation, thick, (Color){r,g,b,a});
}

// ═══════════════════════════════════════════════════════════════════
// Shapes: Splines
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_DrawSplineLinear(float x1, float y1, float x2, float y2, float thick, int r, int g, int b, int a) {
    Vector2 pts[2] = {{x1,y1},{x2,y2}};
    DrawSplineLinear(pts, 2, thick, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawSplineBasis(float x1, float y1, float x2, float y2, float x3, float y3, float x4, float y4, float thick, int r, int g, int b, int a) {
    Vector2 pts[4] = {{x1,y1},{x2,y2},{x3,y3},{x4,y4}};
    DrawSplineBasis(pts, 4, thick, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawSplineCatmullRom(float x1, float y1, float x2, float y2, float x3, float y3, float x4, float y4, float thick, int r, int g, int b, int a) {
    Vector2 pts[4] = {{x1,y1},{x2,y2},{x3,y3},{x4,y4}};
    DrawSplineCatmullRom(pts, 4, thick, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawSplineBezierQuadratic(float x1, float y1, float x2, float y2, float x3, float y3, float thick, int r, int g, int b, int a) {
    Vector2 pts[3] = {{x1,y1},{x2,y2},{x3,y3}};
    DrawSplineBezierQuadratic(pts, 3, thick, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawSplineBezierCubic(float x1, float y1, float x2, float y2, float x3, float y3, float x4, float y4, float thick, int r, int g, int b, int a) {
    Vector2 pts[4] = {{x1,y1},{x2,y2},{x3,y3},{x4,y4}};
    DrawSplineBezierCubic(pts, 4, thick, (Color){r,g,b,a});
}

// ═══════════════════════════════════════════════════════════════════
// Collision detection (2D)
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE int bridge_CheckCollisionRecs(float x1, float y1, float w1, float h1, float x2, float y2, float w2, float h2) {
    return CheckCollisionRecs((Rectangle){x1,y1,w1,h1}, (Rectangle){x2,y2,w2,h2});
}

EMSCRIPTEN_KEEPALIVE int bridge_CheckCollisionCircles(float cx1, float cy1, float r1, float cx2, float cy2, float r2) {
    return CheckCollisionCircles((Vector2){cx1,cy1}, r1, (Vector2){cx2,cy2}, r2);
}

EMSCRIPTEN_KEEPALIVE int bridge_CheckCollisionCircleRec(float cx, float cy, float radius, float rx, float ry, float rw, float rh) {
    return CheckCollisionCircleRec((Vector2){cx,cy}, radius, (Rectangle){rx,ry,rw,rh});
}

EMSCRIPTEN_KEEPALIVE int bridge_CheckCollisionPointRec(float px, float py, float rx, float ry, float rw, float rh) {
    return CheckCollisionPointRec((Vector2){px,py}, (Rectangle){rx,ry,rw,rh});
}

EMSCRIPTEN_KEEPALIVE int bridge_CheckCollisionPointCircle(float px, float py, float cx, float cy, float radius) {
    return CheckCollisionPointCircle((Vector2){px,py}, (Vector2){cx,cy}, radius);
}

EMSCRIPTEN_KEEPALIVE int bridge_CheckCollisionPointTriangle(float px, float py, float x1, float y1, float x2, float y2, float x3, float y3) {
    return CheckCollisionPointTriangle((Vector2){px,py}, (Vector2){x1,y1}, (Vector2){x2,y2}, (Vector2){x3,y3});
}

EMSCRIPTEN_KEEPALIVE int bridge_CheckCollisionPointLine(float px, float py, float x1, float y1, float x2, float y2, int threshold) {
    return CheckCollisionPointLine((Vector2){px,py}, (Vector2){x1,y1}, (Vector2){x2,y2}, threshold);
}

EMSCRIPTEN_KEEPALIVE float* bridge_GetCollisionRec(float x1, float y1, float w1, float h1, float x2, float y2, float w2, float h2) {
    Rectangle rec = GetCollisionRec((Rectangle){x1,y1,w1,h1}, (Rectangle){x2,y2,w2,h2});
    _fbuf[0] = rec.x; _fbuf[1] = rec.y; _fbuf[2] = rec.width; _fbuf[3] = rec.height;
    return _fbuf;
}

// ═══════════════════════════════════════════════════════════════════
// Texture: Image loading & manipulation
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE int bridge_LoadImage(const char* fn) {
    int id = allocHandle(HT_IMAGE);
    if (id) handles[id].data.image = LoadImage(fn);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadImageRaw(const char* fn, int w, int h, int fmt, int hdrSz) {
    int id = allocHandle(HT_IMAGE);
    if (id) handles[id].data.image = LoadImageRaw(fn, w, h, fmt, hdrSz);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadImageSvg(const char* fn, int w, int h) {
    int id = allocHandle(HT_IMAGE);
    if (id) handles[id].data.image = LoadImageSvg(fn, w, h);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadImageFromTexture(int texHandle) {
    if (texHandle <= 0 || texHandle >= MAX_HANDLES || handles[texHandle].type != HT_TEXTURE) return 0;
    int id = allocHandle(HT_IMAGE);
    if (id) handles[id].data.image = LoadImageFromTexture(handles[texHandle].data.texture);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadImageFromScreen(void) {
    int id = allocHandle(HT_IMAGE);
    if (id) handles[id].data.image = LoadImageFromScreen();
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_IsImageReady(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_IMAGE) return 0;
    return IsImageReady(handles[h].data.image);
}

EMSCRIPTEN_KEEPALIVE void bridge_UnloadImage(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE) {
        UnloadImage(handles[h].data.image);
        freeHandle(h);
    }
}

EMSCRIPTEN_KEEPALIVE int bridge_ExportImage(int h, const char* fn) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_IMAGE) return 0;
    return ExportImage(handles[h].data.image, fn);
}

EMSCRIPTEN_KEEPALIVE int bridge_Image_GetWidth(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_IMAGE) return 0;
    return handles[h].data.image.width;
}

EMSCRIPTEN_KEEPALIVE int bridge_Image_GetHeight(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_IMAGE) return 0;
    return handles[h].data.image.height;
}

EMSCRIPTEN_KEEPALIVE int bridge_Image_GetMipmaps(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_IMAGE) return 0;
    return handles[h].data.image.mipmaps;
}

EMSCRIPTEN_KEEPALIVE int bridge_Image_GetFormat(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_IMAGE) return 0;
    return handles[h].data.image.format;
}

// ── Image generation ──────────────────────────────────────────

EMSCRIPTEN_KEEPALIVE int bridge_GenImageColor(int w, int h, int r, int g, int b, int a) {
    int id = allocHandle(HT_IMAGE);
    if (id) handles[id].data.image = GenImageColor(w, h, (Color){r,g,b,a});
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_GenImageGradientLinear(int w, int h, int dir, int r1, int g1, int b1, int a1, int r2, int g2, int b2, int a2) {
    int id = allocHandle(HT_IMAGE);
    if (id) handles[id].data.image = GenImageGradientLinear(w, h, dir, (Color){r1,g1,b1,a1}, (Color){r2,g2,b2,a2});
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_GenImageChecked(int w, int h, int cx, int cy, int r1, int g1, int b1, int a1, int r2, int g2, int b2, int a2) {
    int id = allocHandle(HT_IMAGE);
    if (id) handles[id].data.image = GenImageChecked(w, h, cx, cy, (Color){r1,g1,b1,a1}, (Color){r2,g2,b2,a2});
    return id;
}

// ── Image manipulation (operates on handle, creates new handle) ──

EMSCRIPTEN_KEEPALIVE int bridge_ImageCopy(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_IMAGE) return 0;
    int id = allocHandle(HT_IMAGE);
    if (id) handles[id].data.image = ImageCopy(handles[h].data.image);
    return id;
}

EMSCRIPTEN_KEEPALIVE void bridge_ImageResize(int h, int w, int newH) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageResize(&handles[h].data.image, w, newH);
}

EMSCRIPTEN_KEEPALIVE void bridge_ImageFlipVertical(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageFlipVertical(&handles[h].data.image);
}

EMSCRIPTEN_KEEPALIVE void bridge_ImageFlipHorizontal(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageFlipHorizontal(&handles[h].data.image);
}

EMSCRIPTEN_KEEPALIVE void bridge_ImageRotate(int h, int degrees) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageRotate(&handles[h].data.image, degrees);
}

EMSCRIPTEN_KEEPALIVE void bridge_ImageColorInvert(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageColorInvert(&handles[h].data.image);
}

EMSCRIPTEN_KEEPALIVE void bridge_ImageColorGrayscale(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageColorGrayscale(&handles[h].data.image);
}

// ── Image drawing ─────────────────────────────────────────────

EMSCRIPTEN_KEEPALIVE void bridge_ImageClearBackground(int h, int r, int g, int b, int a) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageClearBackground(&handles[h].data.image, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_ImageDrawPixel(int h, int px, int py, int r, int g, int b, int a) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageDrawPixel(&handles[h].data.image, px, py, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_ImageDrawRectangle(int h, int px, int py, int w, int ht2, int r, int g, int b, int a) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageDrawRectangle(&handles[h].data.image, px, py, w, ht2, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_ImageDrawText(int h, const char* text, int px, int py, int fontSize, int r, int g, int b, int a) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_IMAGE)
        ImageDrawText(&handles[h].data.image, text, px, py, fontSize, (Color){r,g,b,a});
}

// ═══════════════════════════════════════════════════════════════════
// Texture loading & drawing
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE int bridge_LoadTexture(const char* fn) {
    int id = allocHandle(HT_TEXTURE);
    if (id) handles[id].data.texture = LoadTexture(fn);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadTextureFromImage(int imgHandle) {
    if (imgHandle <= 0 || imgHandle >= MAX_HANDLES || handles[imgHandle].type != HT_IMAGE) return 0;
    int id = allocHandle(HT_TEXTURE);
    if (id) handles[id].data.texture = LoadTextureFromImage(handles[imgHandle].data.image);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadRenderTexture(int w, int h) {
    int id = allocHandle(HT_RENDER_TEXTURE);
    if (id) handles[id].data.renderTexture = LoadRenderTexture(w, h);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_IsTextureReady(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_TEXTURE) return 0;
    return IsTextureReady(handles[h].data.texture);
}

EMSCRIPTEN_KEEPALIVE void bridge_UnloadTexture(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_TEXTURE) {
        UnloadTexture(handles[h].data.texture);
        freeHandle(h);
    }
}

EMSCRIPTEN_KEEPALIVE int bridge_IsRenderTextureReady(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_RENDER_TEXTURE) return 0;
    return IsRenderTextureReady(handles[h].data.renderTexture);
}

EMSCRIPTEN_KEEPALIVE void bridge_UnloadRenderTexture(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_RENDER_TEXTURE) {
        UnloadRenderTexture(handles[h].data.renderTexture);
        freeHandle(h);
    }
}

EMSCRIPTEN_KEEPALIVE void bridge_SetTextureFilter(int h, int filter) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_TEXTURE)
        SetTextureFilter(handles[h].data.texture, filter);
}

EMSCRIPTEN_KEEPALIVE void bridge_SetTextureWrap(int h, int wrap) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_TEXTURE)
        SetTextureWrap(handles[h].data.texture, wrap);
}

EMSCRIPTEN_KEEPALIVE int bridge_Texture_GetId(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_TEXTURE) return 0;
    return handles[h].data.texture.id;
}

EMSCRIPTEN_KEEPALIVE int bridge_Texture_GetWidth(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_TEXTURE) return 0;
    return handles[h].data.texture.width;
}

EMSCRIPTEN_KEEPALIVE int bridge_Texture_GetHeight(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_TEXTURE) return 0;
    return handles[h].data.texture.height;
}

// ── Texture drawing ──────────────────────────────────────────

EMSCRIPTEN_KEEPALIVE void bridge_DrawTexture(int h, int x, int y, int r, int g, int b, int a) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_TEXTURE)
        DrawTexture(handles[h].data.texture, x, y, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawTextureV(int h, float px, float py, int r, int g, int b, int a) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_TEXTURE)
        DrawTextureV(handles[h].data.texture, (Vector2){px,py}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawTextureEx(int h, float px, float py, float rot, float scale, int r, int g, int b, int a) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_TEXTURE)
        DrawTextureEx(handles[h].data.texture, (Vector2){px,py}, rot, scale, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawTextureRec(int h, float sx, float sy, float sw, float sh, float px, float py, int r, int g, int b, int a) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_TEXTURE)
        DrawTextureRec(handles[h].data.texture, (Rectangle){sx,sy,sw,sh}, (Vector2){px,py}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawTexturePro(int h, float sx, float sy, float sw, float sh, float dx, float dy, float dw, float dh, float ox, float oy, float rot, int r, int g, int b, int a) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_TEXTURE)
        DrawTexturePro(handles[h].data.texture, (Rectangle){sx,sy,sw,sh}, (Rectangle){dx,dy,dw,dh}, (Vector2){ox,oy}, rot, (Color){r,g,b,a});
}

// ═══════════════════════════════════════════════════════════════════
// Text: Font loading
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE int bridge_GetFontDefault(void) {
    int id = allocHandle(HT_FONT);
    if (id) handles[id].data.font = GetFontDefault();
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadFont(const char* fn) {
    int id = allocHandle(HT_FONT);
    if (id) handles[id].data.font = LoadFont(fn);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_IsFontReady(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_FONT) return 0;
    return IsFontReady(handles[h].data.font);
}

EMSCRIPTEN_KEEPALIVE void bridge_UnloadFont(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_FONT) {
        UnloadFont(handles[h].data.font);
        freeHandle(h);
    }
}

EMSCRIPTEN_KEEPALIVE int bridge_Font_GetBaseSize(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_FONT) return 0;
    return handles[h].data.font.baseSize;
}

EMSCRIPTEN_KEEPALIVE int bridge_Font_GetGlyphCount(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_FONT) return 0;
    return handles[h].data.font.glyphCount;
}

// ═══════════════════════════════════════════════════════════════════
// Text: Drawing & metrics
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_DrawFPS(int x, int y) { DrawFPS(x, y); }

EMSCRIPTEN_KEEPALIVE void bridge_DrawText(const char* text, int x, int y, int fontSize, int r, int g, int b, int a) {
    DrawText(text, x, y, fontSize, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawTextEx(int fontHandle, const char* text, float px, float py, float fontSize, float spacing, int r, int g, int b, int a) {
    if (fontHandle <= 0 || fontHandle >= MAX_HANDLES || handles[fontHandle].type != HT_FONT) return;
    DrawTextEx(handles[fontHandle].data.font, text, (Vector2){px,py}, fontSize, spacing, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawTextPro(int fontHandle, const char* text, float px, float py, float ox, float oy, float rot, float fontSize, float spacing, int r, int g, int b, int a) {
    if (fontHandle <= 0 || fontHandle >= MAX_HANDLES || handles[fontHandle].type != HT_FONT) return;
    DrawTextPro(handles[fontHandle].data.font, text, (Vector2){px,py}, (Vector2){ox,oy}, rot, fontSize, spacing, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_SetTextLineSpacing(int spacing) { SetTextLineSpacing(spacing); }

EMSCRIPTEN_KEEPALIVE int bridge_MeasureText(const char* text, int fontSize) {
    return MeasureText(text, fontSize);
}

EMSCRIPTEN_KEEPALIVE float* bridge_MeasureTextEx(int fontHandle, const char* text, float fontSize, float spacing) {
    if (fontHandle <= 0 || fontHandle >= MAX_HANDLES || handles[fontHandle].type != HT_FONT) {
        _fbuf[0] = 0; _fbuf[1] = 0; return _fbuf;
    }
    Vector2 v = MeasureTextEx(handles[fontHandle].data.font, text, fontSize, spacing);
    _fbuf[0] = v.x; _fbuf[1] = v.y;
    return _fbuf;
}

// ── Text helpers ──────────────────────────────────────────────

EMSCRIPTEN_KEEPALIVE const char* bridge_TextToUpper(const char* t) { return TextToUpper(t); }
EMSCRIPTEN_KEEPALIVE const char* bridge_TextToLower(const char* t) { return TextToLower(t); }
EMSCRIPTEN_KEEPALIVE int bridge_TextToInteger(const char* t) { return TextToInteger(t); }

// ═══════════════════════════════════════════════════════════════════
// 3D: Basic shapes
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_DrawLine3D(float sx, float sy, float sz, float ex, float ey, float ez, int r, int g, int b, int a) {
    DrawLine3D((Vector3){sx,sy,sz}, (Vector3){ex,ey,ez}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawPoint3D(float x, float y, float z, int r, int g, int b, int a) {
    DrawPoint3D((Vector3){x,y,z}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCube(float px, float py, float pz, float w, float h, float l, int r, int g, int b, int a) {
    DrawCube((Vector3){px,py,pz}, w, h, l, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCubeWires(float px, float py, float pz, float w, float h, float l, int r, int g, int b, int a) {
    DrawCubeWires((Vector3){px,py,pz}, w, h, l, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawSphere(float px, float py, float pz, float radius, int r, int g, int b, int a) {
    DrawSphere((Vector3){px,py,pz}, radius, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawSphereEx(float px, float py, float pz, float radius, int rings, int slices, int r, int g, int b, int a) {
    DrawSphereEx((Vector3){px,py,pz}, radius, rings, slices, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawSphereWires(float px, float py, float pz, float radius, int rings, int slices, int r, int g, int b, int a) {
    DrawSphereWires((Vector3){px,py,pz}, radius, rings, slices, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawCylinder(float px, float py, float pz, float radTop, float radBot, float h, int slices, int r, int g, int b, int a) {
    DrawCylinder((Vector3){px,py,pz}, radTop, radBot, h, slices, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawPlane(float px, float py, float pz, float sx, float sy, int r, int g, int b, int a) {
    DrawPlane((Vector3){px,py,pz}, (Vector2){sx,sy}, (Color){r,g,b,a});
}

EMSCRIPTEN_KEEPALIVE void bridge_DrawGrid(int slices, float spacing) { DrawGrid(slices, spacing); }

// ═══════════════════════════════════════════════════════════════════
// Audio
// ═══════════════════════════════════════════════════════════════════

EMSCRIPTEN_KEEPALIVE void bridge_InitAudioDevice(void) { InitAudioDevice(); }
EMSCRIPTEN_KEEPALIVE void bridge_CloseAudioDevice(void) { CloseAudioDevice(); }
EMSCRIPTEN_KEEPALIVE int bridge_IsAudioDeviceReady(void) { return IsAudioDeviceReady(); }
EMSCRIPTEN_KEEPALIVE void bridge_SetMasterVolume(float vol) { SetMasterVolume(vol); }
EMSCRIPTEN_KEEPALIVE float bridge_GetMasterVolume(void) { return GetMasterVolume(); }

EMSCRIPTEN_KEEPALIVE int bridge_LoadWave(const char* fn) {
    int id = allocHandle(HT_WAVE);
    if (id) handles[id].data.wave = LoadWave(fn);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadSound(const char* fn) {
    int id = allocHandle(HT_SOUND);
    if (id) handles[id].data.sound = LoadSound(fn);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadSoundFromWave(int waveHandle) {
    if (waveHandle <= 0 || waveHandle >= MAX_HANDLES || handles[waveHandle].type != HT_WAVE) return 0;
    int id = allocHandle(HT_SOUND);
    if (id) handles[id].data.sound = LoadSoundFromWave(handles[waveHandle].data.wave);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_IsSoundReady(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_SOUND) return 0;
    return IsSoundReady(handles[h].data.sound);
}

EMSCRIPTEN_KEEPALIVE void bridge_UnloadSound(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_SOUND) {
        UnloadSound(handles[h].data.sound);
        freeHandle(h);
    }
}

EMSCRIPTEN_KEEPALIVE void bridge_PlaySound(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_SOUND)
        PlaySound(handles[h].data.sound);
}

EMSCRIPTEN_KEEPALIVE void bridge_StopSound(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_SOUND)
        StopSound(handles[h].data.sound);
}

EMSCRIPTEN_KEEPALIVE void bridge_PauseSound(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_SOUND)
        PauseSound(handles[h].data.sound);
}

EMSCRIPTEN_KEEPALIVE void bridge_SetSoundVolume(int h, float vol) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_SOUND)
        SetSoundVolume(handles[h].data.sound, vol);
}

EMSCRIPTEN_KEEPALIVE int bridge_LoadMusicStream(const char* fn) {
    int id = allocHandle(HT_MUSIC);
    if (id) handles[id].data.music = LoadMusicStream(fn);
    return id;
}

EMSCRIPTEN_KEEPALIVE int bridge_IsMusicReady(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_MUSIC) return 0;
    return IsMusicReady(handles[h].data.music);
}

EMSCRIPTEN_KEEPALIVE void bridge_UnloadMusicStream(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_MUSIC) {
        UnloadMusicStream(handles[h].data.music);
        freeHandle(h);
    }
}

EMSCRIPTEN_KEEPALIVE void bridge_PlayMusicStream(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_MUSIC)
        PlayMusicStream(handles[h].data.music);
}

EMSCRIPTEN_KEEPALIVE void bridge_UpdateMusicStream(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_MUSIC)
        UpdateMusicStream(handles[h].data.music);
}

EMSCRIPTEN_KEEPALIVE void bridge_StopMusicStream(int h) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_MUSIC)
        StopMusicStream(handles[h].data.music);
}

EMSCRIPTEN_KEEPALIVE void bridge_SetMusicVolume(int h, float vol) {
    if (h > 0 && h < MAX_HANDLES && handles[h].type == HT_MUSIC)
        SetMusicVolume(handles[h].data.music, vol);
}

EMSCRIPTEN_KEEPALIVE float bridge_GetMusicTimeLength(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_MUSIC) return 0;
    return GetMusicTimeLength(handles[h].data.music);
}

EMSCRIPTEN_KEEPALIVE float bridge_GetMusicTimePlayed(int h) {
    if (h <= 0 || h >= MAX_HANDLES || handles[h].type != HT_MUSIC) return 0;
    return GetMusicTimePlayed(handles[h].data.music);
}
