// ═══════════════════════════════════════════════════════════════════
// NeoBasic Raylib Wrappers — glues emscripten WASM to module.exports
// ═══════════════════════════════════════════════════════════════════

const _isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const _moduleOpts = _isBrowser ? { canvas: document.getElementById('canvas') } : {};
const M = await createRaylib(_moduleOpts);

// Helper: read Vector2 from float pointer
function _v2(ptr) { return { x: M.HEAPF32[ptr >> 2], y: M.HEAPF32[(ptr >> 2) + 1] }; }

// Helper: read Rectangle from float pointer
function _rect(ptr) {
  const i = ptr >> 2;
  return { x: M.HEAPF32[i], y: M.HEAPF32[i+1], width: M.HEAPF32[i+2], height: M.HEAPF32[i+3] };
}

// Helper: allocate UTF8 string, call fn, free
function _withStr(s, fn) {
  const ptr = M.stringToNewUTF8(s);
  try { return fn(ptr); } finally { M._free(ptr); }
}

// Helper: unpack Color fields (NeoBasic Color UDT → r,g,b,a args)
function _c(color) { return [color.r|0, color.g|0, color.b|0, color.a|0]; }

// ── Color constants ───────────────────────────────────────────────
function lightgray()  { return { r: 200, g: 200, b: 200, a: 255 }; }
function gray()       { return { r: 130, g: 130, b: 130, a: 255 }; }
function darkgray()   { return { r: 80,  g: 80,  b: 80,  a: 255 }; }
function yellow()     { return { r: 253, g: 249, b: 0,   a: 255 }; }
function gold()       { return { r: 255, g: 203, b: 0,   a: 255 }; }
function orange()     { return { r: 255, g: 161, b: 0,   a: 255 }; }
function pink()       { return { r: 255, g: 109, b: 194, a: 255 }; }
function red()        { return { r: 230, g: 41,  b: 55,  a: 255 }; }
function maroon()     { return { r: 190, g: 33,  b: 55,  a: 255 }; }
function green()      { return { r: 0,   g: 228, b: 48,  a: 255 }; }
function lime()       { return { r: 0,   g: 158, b: 47,  a: 255 }; }
function darkgreen()  { return { r: 0,   g: 117, b: 44,  a: 255 }; }
function skyblue()    { return { r: 102, g: 191, b: 255, a: 255 }; }
function blue()       { return { r: 0,   g: 121, b: 241, a: 255 }; }
function darkblue()   { return { r: 0,   g: 82,  b: 172, a: 255 }; }
function purple()     { return { r: 200, g: 122, b: 255, a: 255 }; }
function violet()     { return { r: 135, g: 60,  b: 190, a: 255 }; }
function darkpurple() { return { r: 112, g: 31,  b: 126, a: 255 }; }
function beige()      { return { r: 211, g: 176, b: 131, a: 255 }; }
function brown()      { return { r: 127, g: 106, b: 79,  a: 255 }; }
function darkbrown()  { return { r: 76,  g: 63,  b: 47,  a: 255 }; }
function white()      { return { r: 255, g: 255, b: 255, a: 255 }; }
function black()      { return { r: 0,   g: 0,   b: 0,   a: 255 }; }
function blank()      { return { r: 0,   g: 0,   b: 0,   a: 0   }; }
function magenta()    { return { r: 255, g: 0,   b: 255, a: 255 }; }
function raywhite()   { return { r: 245, g: 245, b: 245, a: 255 }; }

// ── Window management ─────────────────────────────────────────────
function _requireBrowser(fn) {
  if (!_isBrowser) throw new Error(`raylib: ${fn}() requires a browser environment (WebGL). Run the compiled .js in an HTML page.`);
}

function initWindow(w, h, title)  { _requireBrowser('InitWindow'); _withStr(title, p => M._bridge_InitWindow(w, h, p)); }
function closeWindow()            { M._bridge_CloseWindow(); }
function windowShouldClose()      { return !!M._bridge_WindowShouldClose(); }
function isWindowReady()          { return !!M._bridge_IsWindowReady(); }
function isWindowFullscreen()     { return !!M._bridge_IsWindowFullscreen(); }
function isWindowHidden()         { return !!M._bridge_IsWindowHidden(); }
function isWindowMinimized()      { return !!M._bridge_IsWindowMinimized(); }
function isWindowMaximized()      { return !!M._bridge_IsWindowMaximized(); }
function isWindowFocused()        { return !!M._bridge_IsWindowFocused(); }
function isWindowResized()        { return !!M._bridge_IsWindowResized(); }
function isWindowState(flag)      { return !!M._bridge_IsWindowState(flag); }
function setWindowState(flags)    { M._bridge_SetWindowState(flags); }
function clearWindowState(flags)  { M._bridge_ClearWindowState(flags); }
function toggleFullscreen()       { M._bridge_ToggleFullscreen(); }
function toggleBorderlessWindowed() { M._bridge_ToggleBorderlessWindowed(); }
function maximizeWindow()         { M._bridge_MaximizeWindow(); }
function minimizeWindow()         { M._bridge_MinimizeWindow(); }
function restoreWindow()          { M._bridge_RestoreWindow(); }
function setWindowTitle(t)        { _withStr(t, p => M._bridge_SetWindowTitle(p)); }
function setWindowPosition(x, y)  { M._bridge_SetWindowPosition(x, y); }
function setWindowMonitor(m)      { M._bridge_SetWindowMonitor(m); }
function setWindowMinSize(w, h)   { M._bridge_SetWindowMinSize(w, h); }
function setWindowMaxSize(w, h)   { M._bridge_SetWindowMaxSize(w, h); }
function setWindowSize(w, h)      { M._bridge_SetWindowSize(w, h); }
function setWindowOpacity(o)      { M._bridge_SetWindowOpacity(o); }
function setWindowFocused()       { M._bridge_SetWindowFocused(); }
function getScreenWidth()         { return M._bridge_GetScreenWidth(); }
function getScreenHeight()        { return M._bridge_GetScreenHeight(); }
function getRenderWidth()         { return M._bridge_GetRenderWidth(); }
function getRenderHeight()        { return M._bridge_GetRenderHeight(); }
function getMonitorCount()        { return M._bridge_GetMonitorCount(); }
function getCurrentMonitor()      { return M._bridge_GetCurrentMonitor(); }
function getMonitorWidth(m)       { return M._bridge_GetMonitorWidth(m); }
function getMonitorHeight(m)      { return M._bridge_GetMonitorHeight(m); }
function getMonitorPhysicalWidth(m)  { return M._bridge_GetMonitorPhysicalWidth(m); }
function getMonitorPhysicalHeight(m) { return M._bridge_GetMonitorPhysicalHeight(m); }
function getMonitorRefreshRate(m) { return M._bridge_GetMonitorRefreshRate(m); }
function getMonitorName(m)        { return M.UTF8ToString(M._bridge_GetMonitorName(m)); }
function setClipboardText(t)      { _withStr(t, p => M._bridge_SetClipboardText(p)); }
function getClipboardText()       { return M.UTF8ToString(M._bridge_GetClipboardText()); }
function enableEventWaiting()     { M._bridge_EnableEventWaiting(); }
function disableEventWaiting()    { M._bridge_DisableEventWaiting(); }

// ── Cursor ────────────────────────────────────────────────────────
function showCursor()       { M._bridge_ShowCursor(); }
function hideCursor()       { M._bridge_HideCursor(); }
function isCursorHidden()   { return !!M._bridge_IsCursorHidden(); }
function enableCursor()     { M._bridge_EnableCursor(); }
function disableCursor()    { M._bridge_DisableCursor(); }
function isCursorOnScreen() { return !!M._bridge_IsCursorOnScreen(); }

// ── Drawing control ───────────────────────────────────────────────
function clearBackground(c) { M._bridge_ClearBackground(..._c(c)); }
function beginDrawing()     { M._bridge_BeginDrawing(); }
async function endDrawing() {
  M._bridge_EndDrawing();
  await new Promise(r => (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : setTimeout)(r));
}
function beginMode2D(cam)   { M._bridge_BeginMode2D(cam.offsetx, cam.offsety, cam.targetx, cam.targety, cam.rotation, cam.zoom); }
function endMode2D()        { M._bridge_EndMode2D(); }
function beginMode3D(cam)   { M._bridge_BeginMode3D(cam.posx, cam.posy, cam.posz, cam.targetx, cam.targety, cam.targetz, cam.upx, cam.upy, cam.upz, cam.fovy, cam.projection); }
function endMode3D()        { M._bridge_EndMode3D(); }
function beginTextureMode(rt) { M._bridge_BeginTextureMode(rt.__handle); }
function endTextureMode()   { M._bridge_EndTextureMode(); }
function beginShaderMode(s) { M._bridge_BeginShaderMode(s.__handle); }
function endShaderMode()    { M._bridge_EndShaderMode(); }
function beginBlendMode(m)  { M._bridge_BeginBlendMode(m); }
function endBlendMode()     { M._bridge_EndBlendMode(); }
function beginScissorMode(x, y, w, h) { M._bridge_BeginScissorMode(x, y, w, h); }
function endScissorMode()   { M._bridge_EndScissorMode(); }

// ── Timing ────────────────────────────────────────────────────────
function setTargetFPS(fps) { M._bridge_SetTargetFPS(fps); }
function getFPS()          { return M._bridge_GetFPS(); }
function getFrameTime()    { return M._bridge_GetFrameTime(); }
function getTime()         { return M._bridge_GetTime(); }

// ── Configuration ─────────────────────────────────────────────────
function setConfigFlags(f)   { M._bridge_SetConfigFlags(f); }
function setTraceLogLevel(l) { M._bridge_SetTraceLogLevel(l); }
function takeScreenshot(fn)  { _withStr(fn, p => M._bridge_TakeScreenshot(p)); }
function openURL(url)        { _withStr(url, p => M._bridge_OpenURL(p)); }
function setRandomSeed(s)    { M._bridge_SetRandomSeed(s); }
function getRandomValue(min, max) { return M._bridge_GetRandomValue(min, max); }

// ── Input: Keyboard ───────────────────────────────────────────────
function isKeyPressed(k)       { return !!M._bridge_IsKeyPressed(k); }
function isKeyPressedRepeat(k) { return !!M._bridge_IsKeyPressedRepeat(k); }
function isKeyDown(k)          { return !!M._bridge_IsKeyDown(k); }
function isKeyReleased(k)      { return !!M._bridge_IsKeyReleased(k); }
function isKeyUp(k)            { return !!M._bridge_IsKeyUp(k); }
function getKeyPressed()       { return M._bridge_GetKeyPressed(); }
function getCharPressed()      { return M._bridge_GetCharPressed(); }

// ── Input: Mouse ──────────────────────────────────────────────────
function isMouseButtonPressed(b)  { return !!M._bridge_IsMouseButtonPressed(b); }
function isMouseButtonDown(b)     { return !!M._bridge_IsMouseButtonDown(b); }
function isMouseButtonReleased(b) { return !!M._bridge_IsMouseButtonReleased(b); }
function isMouseButtonUp(b)       { return !!M._bridge_IsMouseButtonUp(b); }
function getMouseX()              { return M._bridge_GetMouseX(); }
function getMouseY()              { return M._bridge_GetMouseY(); }
function getMousePosition()       { return _v2(M._bridge_GetMousePosition()); }
function getMouseDelta()          { return _v2(M._bridge_GetMouseDelta()); }
function setMousePosition(x, y)   { M._bridge_SetMousePosition(x, y); }
function setMouseOffset(ox, oy)   { M._bridge_SetMouseOffset(ox, oy); }
function setMouseScale(sx, sy)    { M._bridge_SetMouseScale(sx, sy); }
function getMouseWheelMove()      { return M._bridge_GetMouseWheelMove(); }
function getMouseWheelMoveV()     { return _v2(M._bridge_GetMouseWheelMoveV()); }
function setMouseCursor(c)        { M._bridge_SetMouseCursor(c); }

// ── Input: Gamepad ────────────────────────────────────────────────
function isGamepadAvailable(gp)         { return !!M._bridge_IsGamepadAvailable(gp); }
function getGamepadName(gp)             { return M.UTF8ToString(M._bridge_GetGamepadName(gp)); }
function isGamepadButtonPressed(gp, b)  { return !!M._bridge_IsGamepadButtonPressed(gp, b); }
function isGamepadButtonDown(gp, b)     { return !!M._bridge_IsGamepadButtonDown(gp, b); }
function isGamepadButtonReleased(gp, b) { return !!M._bridge_IsGamepadButtonReleased(gp, b); }
function isGamepadButtonUp(gp, b)       { return !!M._bridge_IsGamepadButtonUp(gp, b); }
function getGamepadButtonPressed()      { return M._bridge_GetGamepadButtonPressed(); }
function getGamepadAxisCount(gp)        { return M._bridge_GetGamepadAxisCount(gp); }
function getGamepadAxisMovement(gp, a)  { return M._bridge_GetGamepadAxisMovement(gp, a); }

// ── Input: Touch ──────────────────────────────────────────────────
function getTouchX()            { return M._bridge_GetTouchX(); }
function getTouchY()            { return M._bridge_GetTouchY(); }
function getTouchPosition(idx)  { return _v2(M._bridge_GetTouchPosition(idx)); }
function getTouchPointId(idx)   { return M._bridge_GetTouchPointId(idx); }
function getTouchPointCount()   { return M._bridge_GetTouchPointCount(); }

// ── Shapes: Basic drawing ─────────────────────────────────────────
function drawPixel(x, y, c)     { M._bridge_DrawPixel(x, y, ..._c(c)); }
function drawPixelV(p, c)       { M._bridge_DrawPixelV(p.x, p.y, ..._c(c)); }
function drawLine(sx, sy, ex, ey, c) { M._bridge_DrawLine(sx, sy, ex, ey, ..._c(c)); }
function drawLineV(s, e, c)     { M._bridge_DrawLineV(s.x, s.y, e.x, e.y, ..._c(c)); }
function drawLineEx(s, e, t, c) { M._bridge_DrawLineEx(s.x, s.y, e.x, e.y, t, ..._c(c)); }
function drawLineBezier(s, e, t, c) { M._bridge_DrawLineBezier(s.x, s.y, e.x, e.y, t, ..._c(c)); }
function drawCircle(cx, cy, r, c)   { M._bridge_DrawCircle(cx, cy, r, ..._c(c)); }
function drawCircleV(ctr, r, c)     { M._bridge_DrawCircleV(ctr.x, ctr.y, r, ..._c(c)); }
function drawCircleLines(cx, cy, r, c) { M._bridge_DrawCircleLines(cx, cy, r, ..._c(c)); }
function drawCircleLinesV(ctr, r, c)   { M._bridge_DrawCircleLinesV(ctr.x, ctr.y, r, ..._c(c)); }
function drawCircleSector(ctr, r, sa, ea, seg, c) { M._bridge_DrawCircleSector(ctr.x, ctr.y, r, sa, ea, seg, ..._c(c)); }
function drawCircleSectorLines(ctr, r, sa, ea, seg, c) { M._bridge_DrawCircleSectorLines(ctr.x, ctr.y, r, sa, ea, seg, ..._c(c)); }
function drawCircleGradient(cx, cy, r, c1, c2) { M._bridge_DrawCircleGradient(cx, cy, r, ..._c(c1), ..._c(c2)); }
function drawEllipse(cx, cy, rh, rv, c) { M._bridge_DrawEllipse(cx, cy, rh, rv, ..._c(c)); }
function drawEllipseLines(cx, cy, rh, rv, c) { M._bridge_DrawEllipseLines(cx, cy, rh, rv, ..._c(c)); }
function drawRing(ctr, ir, or2, sa, ea, seg, c) { M._bridge_DrawRing(ctr.x, ctr.y, ir, or2, sa, ea, seg, ..._c(c)); }
function drawRingLines(ctr, ir, or2, sa, ea, seg, c) { M._bridge_DrawRingLines(ctr.x, ctr.y, ir, or2, sa, ea, seg, ..._c(c)); }
function drawRectangle(x, y, w, h, c) { M._bridge_DrawRectangle(x, y, w, h, ..._c(c)); }
function drawRectangleV(pos, sz, c)    { M._bridge_DrawRectangleV(pos.x, pos.y, sz.x, sz.y, ..._c(c)); }
function drawRectangleRec(rec, c)      { M._bridge_DrawRectangleRec(rec.x, rec.y, rec.width, rec.height, ..._c(c)); }
function drawRectanglePro(rec, o, rot, c) { M._bridge_DrawRectanglePro(rec.x, rec.y, rec.width, rec.height, o.x, o.y, rot, ..._c(c)); }
function drawRectangleGradientV(x, y, w, h, c1, c2) { M._bridge_DrawRectangleGradientV(x, y, w, h, ..._c(c1), ..._c(c2)); }
function drawRectangleGradientH(x, y, w, h, c1, c2) { M._bridge_DrawRectangleGradientH(x, y, w, h, ..._c(c1), ..._c(c2)); }
function drawRectangleGradientEx(rec, c1, c2, c3, c4) { M._bridge_DrawRectangleGradientEx(rec.x, rec.y, rec.width, rec.height, ..._c(c1), ..._c(c2), ..._c(c3), ..._c(c4)); }
function drawRectangleLines(x, y, w, h, c) { M._bridge_DrawRectangleLines(x, y, w, h, ..._c(c)); }
function drawRectangleLinesEx(rec, t, c)   { M._bridge_DrawRectangleLinesEx(rec.x, rec.y, rec.width, rec.height, t, ..._c(c)); }
function drawRectangleRounded(rec, rnd, seg, c) { M._bridge_DrawRectangleRounded(rec.x, rec.y, rec.width, rec.height, rnd, seg, ..._c(c)); }
function drawRectangleRoundedLines(rec, rnd, seg, c) { M._bridge_DrawRectangleRoundedLines(rec.x, rec.y, rec.width, rec.height, rnd, seg, ..._c(c)); }
function drawRectangleRoundedLinesEx(rec, rnd, seg, t, c) { M._bridge_DrawRectangleRoundedLinesEx(rec.x, rec.y, rec.width, rec.height, rnd, seg, t, ..._c(c)); }
function drawTriangle(v1, v2, v3, c)      { M._bridge_DrawTriangle(v1.x, v1.y, v2.x, v2.y, v3.x, v3.y, ..._c(c)); }
function drawTriangleLines(v1, v2, v3, c) { M._bridge_DrawTriangleLines(v1.x, v1.y, v2.x, v2.y, v3.x, v3.y, ..._c(c)); }
function drawPoly(ctr, s, r, rot, c)      { M._bridge_DrawPoly(ctr.x, ctr.y, s, r, rot, ..._c(c)); }
function drawPolyLines(ctr, s, r, rot, c) { M._bridge_DrawPolyLines(ctr.x, ctr.y, s, r, rot, ..._c(c)); }
function drawPolyLinesEx(ctr, s, r, rot, t, c) { M._bridge_DrawPolyLinesEx(ctr.x, ctr.y, s, r, rot, t, ..._c(c)); }

// ── Shapes: Splines ───────────────────────────────────────────────
function drawSplineLinear(p1, p2, t, c) { M._bridge_DrawSplineLinear(p1.x, p1.y, p2.x, p2.y, t, ..._c(c)); }
function drawSplineBasis(p1, p2, p3, p4, t, c) { M._bridge_DrawSplineBasis(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y, t, ..._c(c)); }
function drawSplineCatmullRom(p1, p2, p3, p4, t, c) { M._bridge_DrawSplineCatmullRom(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y, t, ..._c(c)); }
function drawSplineBezierQuadratic(p1, p2, p3, t, c) { M._bridge_DrawSplineBezierQuadratic(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, t, ..._c(c)); }
function drawSplineBezierCubic(p1, p2, p3, p4, t, c) { M._bridge_DrawSplineBezierCubic(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y, t, ..._c(c)); }

// ── Collision detection (2D) ──────────────────────────────────────
function checkCollisionRecs(r1, r2) { return !!M._bridge_CheckCollisionRecs(r1.x, r1.y, r1.width, r1.height, r2.x, r2.y, r2.width, r2.height); }
function checkCollisionCircles(c1, rad1, c2, rad2) { return !!M._bridge_CheckCollisionCircles(c1.x, c1.y, rad1, c2.x, c2.y, rad2); }
function checkCollisionCircleRec(c, rad, rec) { return !!M._bridge_CheckCollisionCircleRec(c.x, c.y, rad, rec.x, rec.y, rec.width, rec.height); }
function checkCollisionPointRec(p, rec) { return !!M._bridge_CheckCollisionPointRec(p.x, p.y, rec.x, rec.y, rec.width, rec.height); }
function checkCollisionPointCircle(p, c, rad) { return !!M._bridge_CheckCollisionPointCircle(p.x, p.y, c.x, c.y, rad); }
function checkCollisionPointTriangle(p, v1, v2, v3) { return !!M._bridge_CheckCollisionPointTriangle(p.x, p.y, v1.x, v1.y, v2.x, v2.y, v3.x, v3.y); }
function checkCollisionPointLine(p, l1, l2, thr) { return !!M._bridge_CheckCollisionPointLine(p.x, p.y, l1.x, l1.y, l2.x, l2.y, thr); }
function getCollisionRec(r1, r2) { return _rect(M._bridge_GetCollisionRec(r1.x, r1.y, r1.width, r1.height, r2.x, r2.y, r2.width, r2.height)); }

// ── Texture: Image ────────────────────────────────────────────────
function _imgObj(h) { return { __handle: h, width: M._bridge_Image_GetWidth(h), height: M._bridge_Image_GetHeight(h), mipmaps: M._bridge_Image_GetMipmaps(h), format: M._bridge_Image_GetFormat(h) }; }

function loadImage(fn)         { return _withStr(fn, p => _imgObj(M._bridge_LoadImage(p))); }
function loadImageRaw(fn, w, h, fmt, hs) { return _withStr(fn, p => _imgObj(M._bridge_LoadImageRaw(p, w, h, fmt, hs))); }
function loadImageSvg(fn, w, h) { return _withStr(fn, p => _imgObj(M._bridge_LoadImageSvg(p, w, h))); }
function loadImageFromTexture(tex) { return _imgObj(M._bridge_LoadImageFromTexture(tex.__handle)); }
function loadImageFromScreen()  { return _imgObj(M._bridge_LoadImageFromScreen()); }
function isImageReady(img)      { return !!M._bridge_IsImageReady(img.__handle); }
function unloadImage(img)       { M._bridge_UnloadImage(img.__handle); }
function exportImage(img, fn)   { return _withStr(fn, p => !!M._bridge_ExportImage(img.__handle, p)); }

function genImageColor(w, h, c)  { return _imgObj(M._bridge_GenImageColor(w, h, ..._c(c))); }
function genImageGradientLinear(w, h, dir, c1, c2) { return _imgObj(M._bridge_GenImageGradientLinear(w, h, dir, ..._c(c1), ..._c(c2))); }
function genImageChecked(w, h, cx, cy, c1, c2) { return _imgObj(M._bridge_GenImageChecked(w, h, cx, cy, ..._c(c1), ..._c(c2))); }
function imageCopy(img)        { return _imgObj(M._bridge_ImageCopy(img.__handle)); }
function imageResize(img, w, h) { M._bridge_ImageResize(img.__handle, w, h); }
function imageFlipVertical(img)   { M._bridge_ImageFlipVertical(img.__handle); }
function imageFlipHorizontal(img) { M._bridge_ImageFlipHorizontal(img.__handle); }
function imageRotate(img, deg)    { M._bridge_ImageRotate(img.__handle, deg); }
function imageColorInvert(img)    { M._bridge_ImageColorInvert(img.__handle); }
function imageColorGrayscale(img) { M._bridge_ImageColorGrayscale(img.__handle); }
function imageClearBackground(img, c)  { M._bridge_ImageClearBackground(img.__handle, ..._c(c)); }
function imageDrawPixel(img, x, y, c)  { M._bridge_ImageDrawPixel(img.__handle, x, y, ..._c(c)); }
function imageDrawRectangle(img, x, y, w, h, c) { M._bridge_ImageDrawRectangle(img.__handle, x, y, w, h, ..._c(c)); }
function imageDrawText(img, text, x, y, fs, c) { _withStr(text, p => M._bridge_ImageDrawText(img.__handle, p, x, y, fs, ..._c(c))); }

// Stubs for unimplemented image functions
const NOT_IMPL = () => { throw new Error('Not yet implemented in WASM bridge'); };
const genImageGradientRadial = NOT_IMPL;
const genImageGradientSquare = NOT_IMPL;
const genImageWhiteNoise = NOT_IMPL;
const genImagePerlinNoise = NOT_IMPL;
const genImageCellular = NOT_IMPL;
const genImageText = NOT_IMPL;
const imageFromImage = NOT_IMPL;
const imageFormat = NOT_IMPL;
const imageToPOT = NOT_IMPL;
const imageCrop = NOT_IMPL;
const imageAlphaCrop = NOT_IMPL;
const imageAlphaClear = NOT_IMPL;
const imageAlphaPremultiply = NOT_IMPL;
const imageBlurGaussian = NOT_IMPL;
const imageResizeNN = NOT_IMPL;
const imageResizeCanvas = NOT_IMPL;
const imageMipmaps = NOT_IMPL;
const imageDither = NOT_IMPL;
const imageRotateCW = NOT_IMPL;
const imageRotateCCW = NOT_IMPL;
const imageColorTint = NOT_IMPL;
const imageColorContrast = NOT_IMPL;
const imageColorBrightness = NOT_IMPL;
const imageColorReplace = NOT_IMPL;
const imageDrawPixelV = NOT_IMPL;
const imageDrawLine = NOT_IMPL;
const imageDrawLineV = NOT_IMPL;
const imageDrawCircle = NOT_IMPL;
const imageDrawCircleV = NOT_IMPL;
const imageDrawCircleLines = NOT_IMPL;
const imageDrawCircleLinesV = NOT_IMPL;
const imageDrawRectangleV = NOT_IMPL;
const imageDrawRectangleRec = NOT_IMPL;
const imageDrawRectangleLines = NOT_IMPL;
const imageDraw = NOT_IMPL;
const imageDrawTextEx = NOT_IMPL;

// ── Texture: Loading & drawing ────────────────────────────────────
function _texObj(h) { return { __handle: h, id: M._bridge_Texture_GetId(h), width: M._bridge_Texture_GetWidth(h), height: M._bridge_Texture_GetHeight(h), mipmaps: 1, format: 7 }; }

function loadTexture(fn)         { return _withStr(fn, p => _texObj(M._bridge_LoadTexture(p))); }
function loadTextureFromImage(img) { return _texObj(M._bridge_LoadTextureFromImage(img.__handle)); }
function loadTextureCubemap(img, layout) { return NOT_IMPL(); }
function loadRenderTexture(w, h) {
  const hnd = M._bridge_LoadRenderTexture(w, h);
  return { __handle: hnd, id: hnd, texwidth: w, texheight: h, depthwidth: w, depthheight: h };
}
function isTextureReady(tex)   { return !!M._bridge_IsTextureReady(tex.__handle); }
function unloadTexture(tex)    { M._bridge_UnloadTexture(tex.__handle); }
function isRenderTextureReady(rt) { return !!M._bridge_IsRenderTextureReady(rt.__handle); }
function unloadRenderTexture(rt)  { M._bridge_UnloadRenderTexture(rt.__handle); }
function updateTexture(tex, img)  { /* not bridged yet */ }
function genTextureMipmaps(tex)   { /* not bridged yet */ }
function setTextureFilter(tex, f) { M._bridge_SetTextureFilter(tex.__handle, f); }
function setTextureWrap(tex, w)   { M._bridge_SetTextureWrap(tex.__handle, w); }

function drawTexture(tex, x, y, tint) { M._bridge_DrawTexture(tex.__handle, x, y, ..._c(tint)); }
function drawTextureV(tex, pos, tint)  { M._bridge_DrawTextureV(tex.__handle, pos.x, pos.y, ..._c(tint)); }
function drawTextureEx(tex, pos, rot, scale, tint) { M._bridge_DrawTextureEx(tex.__handle, pos.x, pos.y, rot, scale, ..._c(tint)); }
function drawTextureRec(tex, src, pos, tint) { M._bridge_DrawTextureRec(tex.__handle, src.x, src.y, src.width, src.height, pos.x, pos.y, ..._c(tint)); }
function drawTexturePro(tex, src, dst, origin, rot, tint) { M._bridge_DrawTexturePro(tex.__handle, src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height, origin.x, origin.y, rot, ..._c(tint)); }
const drawTextureNPatch = NOT_IMPL;

// ── Text: Font loading ────────────────────────────────────────────
function _fontObj(h) { return { __handle: h, basesize: M._bridge_Font_GetBaseSize(h), glyphcount: M._bridge_Font_GetGlyphCount(h), glyphpadding: 0 }; }

function getFontDefault()    { return _fontObj(M._bridge_GetFontDefault()); }
function loadFont(fn)        { return _withStr(fn, p => _fontObj(M._bridge_LoadFont(p))); }
function loadFontEx(fn, fs, cp, cnt) { return _withStr(fn, p => _fontObj(M._bridge_LoadFont(p))); } // simplified
function loadFontFromImage(img, key, first) { return NOT_IMPL(); }
function isFontReady(f)      { return !!M._bridge_IsFontReady(f.__handle); }
function unloadFont(f)       { M._bridge_UnloadFont(f.__handle); }

// ── Text: Drawing & metrics ───────────────────────────────────────
function drawFPS(x, y)       { M._bridge_DrawFPS(x, y); }
function drawText(text, x, y, fs, c) { _withStr(text, p => M._bridge_DrawText(p, x, y, fs, ..._c(c))); }
function drawTextEx(font, text, pos, fs, sp, tint) { _withStr(text, p => M._bridge_DrawTextEx(font.__handle, p, pos.x, pos.y, fs, sp, ..._c(tint))); }
function drawTextPro(font, text, pos, origin, rot, fs, sp, tint) { _withStr(text, p => M._bridge_DrawTextPro(font.__handle, p, pos.x, pos.y, origin.x, origin.y, rot, fs, sp, ..._c(tint))); }
function setTextLineSpacing(s) { M._bridge_SetTextLineSpacing(s); }
function measureText(text, fs) { return _withStr(text, p => M._bridge_MeasureText(p, fs)); }
function measureTextEx(font, text, fs, sp) { return _withStr(text, p => _v2(M._bridge_MeasureTextEx(font.__handle, p, fs, sp))); }

// ── Text helpers ──────────────────────────────────────────────────
function textSubtext(t, pos, len) { return t.substring(pos, pos + len); }
function textReplace(t, rep, by)  { return t.replaceAll(rep, by); }
function textInsert(t, ins, pos)  { return t.substring(0, pos) + ins + t.substring(pos); }
function textFindIndex(t, find)   { return t.indexOf(find); }
function textToUpper(t)  { return t.toUpperCase(); }
function textToLower(t)  { return t.toLowerCase(); }
function textToPascal(t) { return t.replace(/\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()); }
function textToInteger(t) { return parseInt(t, 10) || 0; }
function textToFloat(t)   { return parseFloat(t) || 0.0; }

// ── 3D shapes ─────────────────────────────────────────────────────
function drawLine3D(s, e, c) { M._bridge_DrawLine3D(s.x, s.y, s.z, e.x, e.y, e.z, ..._c(c)); }
function drawPoint3D(p, c)   { M._bridge_DrawPoint3D(p.x, p.y, p.z, ..._c(c)); }
function drawCircle3D(ctr, r, axis, angle, c) { NOT_IMPL(); }
function drawTriangle3D(v1, v2, v3, c) { NOT_IMPL(); }
function drawCube(pos, w, h, l, c)  { M._bridge_DrawCube(pos.x, pos.y, pos.z, w, h, l, ..._c(c)); }
function drawCubeV(pos, sz, c)      { M._bridge_DrawCube(pos.x, pos.y, pos.z, sz.x, sz.y, sz.z, ..._c(c)); }
function drawCubeWires(pos, w, h, l, c)  { M._bridge_DrawCubeWires(pos.x, pos.y, pos.z, w, h, l, ..._c(c)); }
function drawCubeWiresV(pos, sz, c)      { M._bridge_DrawCubeWires(pos.x, pos.y, pos.z, sz.x, sz.y, sz.z, ..._c(c)); }
function drawSphere(pos, r, c)      { M._bridge_DrawSphere(pos.x, pos.y, pos.z, r, ..._c(c)); }
function drawSphereEx(pos, r, rings, slices, c) { M._bridge_DrawSphereEx(pos.x, pos.y, pos.z, r, rings, slices, ..._c(c)); }
function drawSphereWires(pos, r, rings, slices, c) { M._bridge_DrawSphereWires(pos.x, pos.y, pos.z, r, rings, slices, ..._c(c)); }
function drawCylinder(pos, rt, rb, h, sl, c) { M._bridge_DrawCylinder(pos.x, pos.y, pos.z, rt, rb, h, sl, ..._c(c)); }
const drawCylinderEx = NOT_IMPL;
const drawCylinderWires = NOT_IMPL;
const drawCylinderWiresEx = NOT_IMPL;
const drawCapsule = NOT_IMPL;
const drawCapsuleWires = NOT_IMPL;
function drawPlane(pos, sz, c) { M._bridge_DrawPlane(pos.x, pos.y, pos.z, sz.x, sz.y, ..._c(c)); }
function drawRay(ray, c) { NOT_IMPL(); }
function drawGrid(sl, sp) { M._bridge_DrawGrid(sl, sp); }

// ── 3D: Model/mesh stubs ─────────────────────────────────────────
const loadModel = NOT_IMPL;
const loadModelFromMesh = NOT_IMPL;
const isModelReady = NOT_IMPL;
const unloadModel = NOT_IMPL;
const getModelBoundingBox = NOT_IMPL;
const genMeshPoly = NOT_IMPL;
const genMeshPlane = NOT_IMPL;
const genMeshCube = NOT_IMPL;
const genMeshSphere = NOT_IMPL;
const genMeshHemiSphere = NOT_IMPL;
const genMeshCylinder = NOT_IMPL;
const genMeshCone = NOT_IMPL;
const genMeshTorus = NOT_IMPL;
const genMeshKnot = NOT_IMPL;
const unloadMesh = NOT_IMPL;
const exportMesh = NOT_IMPL;
const getMeshBoundingBox = NOT_IMPL;
const genMeshTangents = NOT_IMPL;
const loadMaterialDefault = NOT_IMPL;
const isMaterialReady = NOT_IMPL;
const unloadMaterial = NOT_IMPL;
const setMaterialTexture = NOT_IMPL;
const setModelMeshMaterial = NOT_IMPL;
const updateModelAnimation = NOT_IMPL;
const unloadModelAnimation = NOT_IMPL;
const isModelAnimationValid = NOT_IMPL;

// ── 3D: Collision stubs ──────────────────────────────────────────
const checkCollisionSpheres = NOT_IMPL;
const checkCollisionBoxes = NOT_IMPL;
const checkCollisionBoxSphere = NOT_IMPL;
const getRayCollisionSphere = NOT_IMPL;
const getRayCollisionBox = NOT_IMPL;
const getRayCollisionMesh = NOT_IMPL;
const getRayCollisionTriangle = NOT_IMPL;
const getRayCollisionQuad = NOT_IMPL;

// ── Audio ─────────────────────────────────────────────────────────
function initAudioDevice()   { M._bridge_InitAudioDevice(); }
function closeAudioDevice()  { M._bridge_CloseAudioDevice(); }
function isAudioDeviceReady() { return !!M._bridge_IsAudioDeviceReady(); }
function setMasterVolume(v)  { M._bridge_SetMasterVolume(v); }
function getMasterVolume()   { return M._bridge_GetMasterVolume(); }

function loadWave(fn)          { return _withStr(fn, p => ({ __handle: M._bridge_LoadWave(p), framecount: 0, samplerate: 0, samplesize: 0, channels: 0 })); }
function isWaveReady(w)        { return false; } // simplified
function loadSound(fn)         { return _withStr(fn, p => ({ __handle: M._bridge_LoadSound(p), framecount: 0 })); }
function loadSoundFromWave(w)  { return { __handle: M._bridge_LoadSoundFromWave(w.__handle), framecount: 0 }; }
function loadSoundAlias(s)     { return NOT_IMPL(); }
function isSoundReady(s)       { return !!M._bridge_IsSoundReady(s.__handle); }
function unloadWave(w)         { /* simplified */ }
function unloadSound(s)        { M._bridge_UnloadSound(s.__handle); }
function unloadSoundAlias(s)   { /* no-op */ }
function exportWave(w, fn)     { return false; }
function playSound(s)          { M._bridge_PlaySound(s.__handle); }
function stopSound(s)          { M._bridge_StopSound(s.__handle); }
function pauseSound(s)         { M._bridge_PauseSound(s.__handle); }
function resumeSound(s)        { /* simplified */ }
function isSoundPlaying(s)     { return false; }
function setSoundVolume(s, v)  { M._bridge_SetSoundVolume(s.__handle, v); }
function setSoundPitch(s, p)   { /* simplified */ }
function setSoundPan(s, p)     { /* simplified */ }

function loadMusicStream(fn)   { return _withStr(fn, p => ({ __handle: M._bridge_LoadMusicStream(p), framecount: 0, looping: true })); }
function isMusicReady(m)       { return !!M._bridge_IsMusicReady(m.__handle); }
function unloadMusicStream(m)  { M._bridge_UnloadMusicStream(m.__handle); }
function playMusicStream(m)    { M._bridge_PlayMusicStream(m.__handle); }
function isMusicStreamPlaying(m) { return false; }
function updateMusicStream(m)  { M._bridge_UpdateMusicStream(m.__handle); }
function stopMusicStream(m)    { M._bridge_StopMusicStream(m.__handle); }
function pauseMusicStream(m)   { /* simplified */ }
function resumeMusicStream(m)  { /* simplified */ }
function seekMusicStream(m, p) { /* simplified */ }
function setMusicVolume(m, v)  { M._bridge_SetMusicVolume(m.__handle, v); }
function setMusicPitch(m, p)   { /* simplified */ }
function setMusicPan(m, p)     { /* simplified */ }
function getMusicTimeLength(m) { return M._bridge_GetMusicTimeLength(m.__handle); }
function getMusicTimePlayed(m) { return M._bridge_GetMusicTimePlayed(m.__handle); }

// AudioStream stubs
const loadAudioStream = NOT_IMPL;
const isAudioStreamReady = NOT_IMPL;
const unloadAudioStream = NOT_IMPL;
const isAudioStreamProcessed = NOT_IMPL;
const playAudioStream = NOT_IMPL;
const pauseAudioStream = NOT_IMPL;
const resumeAudioStream = NOT_IMPL;
const isAudioStreamPlaying = NOT_IMPL;
const stopAudioStream = NOT_IMPL;
const setAudioStreamVolume = NOT_IMPL;
const setAudioStreamPitch = NOT_IMPL;
const setAudioStreamPan = NOT_IMPL;

// ═══════════════════════════════════════════════════════════════════
// module.exports — maps NeoBasic function names to JS implementations
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  // Color constants
  lightgray, gray, darkgray, yellow, gold, orange, pink, red, maroon,
  green, lime, darkgreen, skyblue, blue, darkblue, purple, violet, darkpurple,
  beige, brown, darkbrown, white, black, blank, magenta, raywhite,
  // Window
  initWindow, closeWindow, windowShouldClose, isWindowReady, isWindowFullscreen,
  isWindowHidden, isWindowMinimized, isWindowMaximized, isWindowFocused, isWindowResized,
  isWindowState, setWindowState, clearWindowState, toggleFullscreen, toggleBorderlessWindowed,
  maximizeWindow, minimizeWindow, restoreWindow, setWindowTitle, setWindowPosition,
  setWindowMonitor, setWindowMinSize, setWindowMaxSize, setWindowSize, setWindowOpacity,
  setWindowFocused, getScreenWidth, getScreenHeight, getRenderWidth, getRenderHeight,
  getMonitorCount, getCurrentMonitor, getMonitorWidth, getMonitorHeight,
  getMonitorPhysicalWidth, getMonitorPhysicalHeight, getMonitorRefreshRate, getMonitorName,
  setClipboardText, getClipboardText, enableEventWaiting, disableEventWaiting,
  // Cursor
  showCursor, hideCursor, isCursorHidden, enableCursor, disableCursor, isCursorOnScreen,
  // Drawing
  clearBackground, beginDrawing, endDrawing, beginMode2D, endMode2D, beginMode3D, endMode3D,
  beginTextureMode, endTextureMode, beginShaderMode, endShaderMode, beginBlendMode, endBlendMode,
  beginScissorMode, endScissorMode,
  // Timing
  setTargetFPS, getFPS, getFrameTime, getTime,
  // Config
  setConfigFlags, setTraceLogLevel, takeScreenshot, openURL, setRandomSeed, getRandomValue,
  // Keyboard
  isKeyPressed, isKeyPressedRepeat, isKeyDown, isKeyReleased, isKeyUp, getKeyPressed, getCharPressed,
  // Mouse
  isMouseButtonPressed, isMouseButtonDown, isMouseButtonReleased, isMouseButtonUp,
  getMouseX, getMouseY, getMousePosition, getMouseDelta, setMousePosition, setMouseOffset,
  setMouseScale, getMouseWheelMove, getMouseWheelMoveV, setMouseCursor,
  // Gamepad
  isGamepadAvailable, getGamepadName, isGamepadButtonPressed, isGamepadButtonDown,
  isGamepadButtonReleased, isGamepadButtonUp, getGamepadButtonPressed, getGamepadAxisCount,
  getGamepadAxisMovement,
  // Touch
  getTouchX, getTouchY, getTouchPosition, getTouchPointId, getTouchPointCount,
  // Shapes
  drawPixel, drawPixelV, drawLine, drawLineV, drawLineEx, drawLineBezier,
  drawCircle, drawCircleV, drawCircleLines, drawCircleLinesV, drawCircleSector,
  drawCircleSectorLines, drawCircleGradient, drawEllipse, drawEllipseLines,
  drawRing, drawRingLines, drawRectangle, drawRectangleV, drawRectangleRec,
  drawRectanglePro, drawRectangleGradientV, drawRectangleGradientH, drawRectangleGradientEx,
  drawRectangleLines, drawRectangleLinesEx, drawRectangleRounded, drawRectangleRoundedLines,
  drawRectangleRoundedLinesEx, drawTriangle, drawTriangleLines, drawPoly, drawPolyLines,
  drawPolyLinesEx,
  // Splines
  drawSplineLinear, drawSplineBasis, drawSplineCatmullRom, drawSplineBezierQuadratic, drawSplineBezierCubic,
  // Collision
  checkCollisionRecs, checkCollisionCircles, checkCollisionCircleRec, checkCollisionPointRec,
  checkCollisionPointCircle, checkCollisionPointTriangle, checkCollisionPointLine, getCollisionRec,
  // Image
  loadImage, loadImageRaw, loadImageSvg, loadImageFromTexture, loadImageFromScreen,
  isImageReady, unloadImage, exportImage,
  genImageColor, genImageGradientLinear, genImageGradientRadial, genImageGradientSquare,
  genImageChecked, genImageWhiteNoise, genImagePerlinNoise, genImageCellular, genImageText,
  imageCopy, imageFromImage, imageFormat, imageToPOT, imageCrop, imageAlphaCrop, imageAlphaClear,
  imageAlphaPremultiply, imageBlurGaussian, imageResize, imageResizeNN, imageResizeCanvas,
  imageMipmaps, imageDither, imageFlipVertical, imageFlipHorizontal, imageRotate, imageRotateCW,
  imageRotateCCW, imageColorTint, imageColorInvert, imageColorGrayscale, imageColorContrast,
  imageColorBrightness, imageColorReplace, imageClearBackground, imageDrawPixel, imageDrawPixelV,
  imageDrawLine, imageDrawLineV, imageDrawCircle, imageDrawCircleV, imageDrawCircleLines,
  imageDrawCircleLinesV, imageDrawRectangle, imageDrawRectangleV, imageDrawRectangleRec,
  imageDrawRectangleLines, imageDraw, imageDrawText, imageDrawTextEx,
  // Texture
  loadTexture, loadTextureFromImage, loadTextureCubemap, loadRenderTexture,
  isTextureReady, unloadTexture, isRenderTextureReady, unloadRenderTexture,
  updateTexture, genTextureMipmaps, setTextureFilter, setTextureWrap,
  drawTexture, drawTextureV, drawTextureEx, drawTextureRec, drawTexturePro, drawTextureNPatch,
  // Font
  getFontDefault, loadFont, loadFontEx, loadFontFromImage, isFontReady, unloadFont,
  // Text
  drawFPS, drawText, drawTextEx, drawTextPro, setTextLineSpacing, measureText, measureTextEx,
  textSubtext, textReplace, textInsert, textFindIndex, textToUpper, textToLower,
  textToPascal, textToInteger, textToFloat,
  // 3D shapes
  drawLine3D, drawPoint3D, drawCircle3D, drawTriangle3D, drawCube, drawCubeV,
  drawCubeWires, drawCubeWiresV, drawSphere, drawSphereEx, drawSphereWires,
  drawCylinder, drawCylinderEx, drawCylinderWires, drawCylinderWiresEx,
  drawCapsule, drawCapsuleWires, drawPlane, drawRay, drawGrid,
  // 3D model/mesh
  loadModel, loadModelFromMesh, isModelReady, unloadModel, getModelBoundingBox,
  genMeshPoly, genMeshPlane, genMeshCube, genMeshSphere, genMeshHemiSphere,
  genMeshCylinder, genMeshCone, genMeshTorus, genMeshKnot, unloadMesh, exportMesh,
  getMeshBoundingBox, genMeshTangents,
  loadMaterialDefault, isMaterialReady, unloadMaterial, setMaterialTexture, setModelMeshMaterial,
  updateModelAnimation, unloadModelAnimation, isModelAnimationValid,
  // 3D collision
  checkCollisionSpheres, checkCollisionBoxes, checkCollisionBoxSphere,
  getRayCollisionSphere, getRayCollisionBox, getRayCollisionMesh,
  getRayCollisionTriangle, getRayCollisionQuad,
  // Audio
  initAudioDevice, closeAudioDevice, isAudioDeviceReady, setMasterVolume, getMasterVolume,
  loadWave, isWaveReady, loadSound, loadSoundFromWave, loadSoundAlias, isSoundReady,
  unloadWave, unloadSound, unloadSoundAlias, exportWave,
  playSound, stopSound, pauseSound, resumeSound, isSoundPlaying,
  setSoundVolume, setSoundPitch, setSoundPan,
  loadMusicStream, isMusicReady, unloadMusicStream, playMusicStream, isMusicStreamPlaying,
  updateMusicStream, stopMusicStream, pauseMusicStream, resumeMusicStream, seekMusicStream,
  setMusicVolume, setMusicPitch, setMusicPan, getMusicTimeLength, getMusicTimePlayed,
  loadAudioStream, isAudioStreamReady, unloadAudioStream, isAudioStreamProcessed,
  playAudioStream, pauseAudioStream, resumeAudioStream, isAudioStreamPlaying,
  stopAudioStream, setAudioStreamVolume, setAudioStreamPitch, setAudioStreamPan,
};
