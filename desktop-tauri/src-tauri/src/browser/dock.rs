//! Native embedding of the real browser window inside the T-Line window.
//!
//! The browser keeps its own process, renderer, input handling, media pipeline
//! and CDP endpoint; only the top-level window handle is reparented so the
//! user sees genuine Chrome/Edge/Brave pixels inside the application instead
//! of a streamed JPEG. Windows is the only supported host for this technique.
use serde::Deserialize;

#[derive(Clone, Copy, Debug, Deserialize)]
pub struct DockBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Converts CSS pixels reported by the trusted UI into physical window
/// coordinates, clamped so a bad rect can never move the browser off-surface.
pub(crate) fn scaled_bounds(bounds: DockBounds, scale: f64) -> (i32, i32, i32, i32) {
    let scale = if scale.is_finite() && scale > 0.0 { scale } else { 1.0 };
    let finite = |value: f64| if value.is_finite() { value } else { 0.0 };
    let x = (finite(bounds.x) * scale).round().max(0.0) as i32;
    let y = (finite(bounds.y) * scale).round().max(0.0) as i32;
    let width = (finite(bounds.width) * scale).round().max(1.0) as i32;
    let height = (finite(bounds.height) * scale).round().max(1.0) as i32;
    (x, y, width, height)
}

#[cfg(windows)]
mod imp {
    use super::{scaled_bounds, DockBounds};
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::SetFocus;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetClassNameW, GetParent, GetWindow, GetWindowLongPtrW, GetWindowThreadProcessId,
        IsWindowVisible, SetForegroundWindow, SetParent, SetWindowLongPtrW, SetWindowPos,
        ShowWindow, GWL_STYLE, GW_OWNER, HWND_TOP, SW_HIDE, SWP_FRAMECHANGED, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, SW_SHOW,
        WS_CAPTION, WS_CHILD, WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_OVERLAPPEDWINDOW, WS_POPUP,
        WS_SYSMENU, WS_THICKFRAME, WS_VISIBLE,
    };

    /// Chromium-family browser top-level window class (Chrome, Edge, Brave, Chromium).
    const CHROMIUM_WINDOW_CLASS: &str = "Chrome_WidgetWin_1";

    fn raw(hwnd: isize) -> HWND {
        hwnd as HWND
    }

    struct Finder {
        pid: u32,
        found: HWND,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let finder = &mut *(lparam as *mut Finder);
        let mut owner = 0u32;
        GetWindowThreadProcessId(hwnd, &mut owner);
        if owner != finder.pid || IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        if !GetWindow(hwnd, GW_OWNER).is_null() {
            return 1;
        }
        let mut class = [0u16; 64];
        let length = GetClassNameW(hwnd, class.as_mut_ptr(), class.len() as i32);
        if length <= 0 {
            return 1;
        }
        let name = String::from_utf16_lossy(&class[..length as usize]);
        if name != CHROMIUM_WINDOW_CLASS {
            return 1;
        }
        finder.found = hwnd;
        0
    }

    pub fn find(pid: u32) -> Option<isize> {
        let mut finder = Finder {
            pid,
            found: std::ptr::null_mut(),
        };
        let _ = unsafe { EnumWindows(Some(enum_proc), &mut finder as *mut Finder as LPARAM) };
        if finder.found.is_null() {
            None
        } else {
            Some(finder.found as isize)
        }
    }

    pub fn attach(parent: isize, child: isize) -> Result<(), String> {
        let child_hwnd = raw(child);
        let parent_hwnd = raw(parent);
        if child_hwnd.is_null() || parent_hwnd.is_null() {
            return Err("Invalid browser or application window handle.".into());
        }
        unsafe {
            let style = GetWindowLongPtrW(child_hwnd, GWL_STYLE) as u32;
            let child_style =
                (style & !(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX))
                    | WS_CHILD
                    | WS_VISIBLE;
            SetWindowLongPtrW(child_hwnd, GWL_STYLE, child_style as isize);
            SetParent(child_hwnd, parent_hwnd);
            if GetParent(child_hwnd) != parent_hwnd {
                return Err("The browser window could not be embedded in T-Line.".into());
            }
            SetWindowPos(
                child_hwnd,
                HWND_TOP,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_NOACTIVATE,
            );
            ShowWindow(child_hwnd, SW_HIDE);
        }
        Ok(())
    }

    pub fn set_bounds(child: isize, bounds: DockBounds, scale: f64) -> Result<(), String> {
        let child_hwnd = raw(child);
        let (x, y, width, height) = scaled_bounds(bounds, scale);
        let ok = unsafe {
            SetWindowPos(child_hwnd, HWND_TOP, x, y, width, height, SWP_NOACTIVATE | SWP_SHOWWINDOW)
        };
        if ok == 0 {
            Err("Cannot position the embedded browser surface.".into())
        } else {
            Ok(())
        }
    }

    pub fn set_visible(child: isize, visible: bool) {
        unsafe {
            ShowWindow(raw(child), if visible { SW_SHOW } else { SW_HIDE });
        }
    }

    pub fn focus(child: isize) {
        unsafe {
            let hwnd = raw(child);
            ShowWindow(hwnd, SW_SHOW);
            SetFocus(hwnd);
        }
    }

    pub fn focus_top_level(child: isize) {
        unsafe {
            let hwnd = raw(child);
            ShowWindow(hwnd, SW_SHOW);
            SetForegroundWindow(hwnd);
        }
    }

    /// Returns the window to standalone desktop behaviour and window styles.
    pub fn detach(child: isize) {
        let hwnd = raw(child);
        if hwnd.is_null() {
            return;
        }
        unsafe {
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            let restored = (style & !WS_CHILD) | WS_OVERLAPPEDWINDOW | WS_VISIBLE;
            SetWindowLongPtrW(hwnd, GWL_STYLE, restored as isize);
            SetParent(hwnd, std::ptr::null_mut());
            SetWindowPos(
                hwnd,
                HWND_TOP,
                160,
                120,
                1280,
                860,
                SWP_FRAMECHANGED | SWP_SHOWWINDOW | SWP_NOACTIVATE,
            );
            ShowWindow(hwnd, SW_SHOW);
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use super::DockBounds;

    pub fn find(_pid: u32) -> Option<isize> {
        None
    }

    pub fn attach(_parent: isize, _child: isize) -> Result<(), String> {
        Err("Embedded browsing inside T-Line is currently supported on Windows only.".into())
    }

    pub fn set_bounds(_child: isize, _bounds: DockBounds, _scale: f64) -> Result<(), String> {
        Err("Embedded browsing inside T-Line is currently supported on Windows only.".into())
    }

    pub fn set_visible(_child: isize, _visible: bool) {}

    pub fn focus(_child: isize) {}

    pub fn focus_top_level(_child: isize) {}

    pub fn detach(_child: isize) {}
}

pub fn find_chromium_window(pid: u32) -> Option<isize> {
    imp::find(pid)
}

pub fn attach(parent: isize, child: isize) -> Result<(), String> {
    imp::attach(parent, child)
}

pub fn set_bounds(child: isize, bounds: DockBounds, scale: f64) -> Result<(), String> {
    imp::set_bounds(child, bounds, scale)
}

pub fn set_visible(child: isize, visible: bool) {
    imp::set_visible(child, visible)
}

pub fn focus(child: isize) {
    imp::focus(child)
}

pub fn focus_top_level(child: isize) {
    imp::focus_top_level(child)
}

pub fn detach(child: isize) {
    imp::detach(child)
}

/// The trusted application window that hosts the embedded browser.
pub fn parent_handle(webview: &tauri::Webview) -> Result<isize, String> {
    #[cfg(windows)]
    {
        webview
            .window()
            .hwnd()
            .map(|hwnd| hwnd.0 as isize)
            .map_err(|_| "Cannot read the T-Line window handle.".to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = webview;
        Err("Embedded browsing inside T-Line is currently supported on Windows only.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounds_are_scaled_and_clamped() {
        let bounds = DockBounds {
            x: 12.4,
            y: 60.6,
            width: 640.2,
            height: 400.7,
        };
        assert_eq!(scaled_bounds(bounds, 1.0), (12, 61, 640, 401));
        assert_eq!(scaled_bounds(bounds, 1.5), (19, 91, 960, 601));
        let invalid = DockBounds {
            x: -40.0,
            y: f64::NAN,
            width: 0.0,
            height: f64::INFINITY,
        };
        let (x, y, width, height) = scaled_bounds(invalid, 0.0);
        assert_eq!((x, y), (0, 0));
        assert!(width >= 1 && height >= 1);
    }
}

#[cfg(all(test, windows))]
mod live_dock_tests {
    use super::*;
    use crate::browser::{engine, launch, session};
    use std::process::{Command, Stdio};
    use std::time::Duration;
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DestroyWindow, GetParent, GetWindowRect, IsWindowVisible, ShowWindow,
        WS_OVERLAPPEDWINDOW, WS_VISIBLE,
    };

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Opt-in native docking check: a real host window, a real installed
    /// browser, real reparenting, real bounds/visibility, and a clean detach.
    /// Run with: cargo test --lib -- --ignored dock_embeds_real_browser
    #[test]
    #[ignore = "spawns the installed Chromium-family browser and a Win32 host window"]
    fn dock_embeds_real_browser() {
        let engines = engine::discover();
        assert!(!engines.is_empty(), "no installed Chromium-family browser");
        let class = wide("STATIC");
        let title = wide("t-line dock test host");
        let parent = unsafe {
            CreateWindowExW(
                0,
                class.as_ptr(),
                title.as_ptr(),
                WS_OVERLAPPEDWINDOW | WS_VISIBLE,
                100,
                100,
                900,
                700,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        assert!(!parent.is_null(), "host window creation failed");
        unsafe { ShowWindow(parent, 5) };

        let profile = std::env::temp_dir().join(format!("tline-dock-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&profile);
        std::fs::create_dir_all(&profile).unwrap();
        let mut child = Command::new(&engines[0].executable)
            .args(launch::launch_args(&profile, "about:blank", true))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn browser");
        let pid = child.id();

        let result = (|| -> Result<(), String> {
            session::await_endpoint(&profile, Duration::from_secs(25))
                .ok_or("verified CDP endpoint did not appear")?;
            let mut chrome = None;
            for _ in 0..60 {
                if let Some(hwnd) = find_chromium_window(pid) {
                    chrome = Some(hwnd);
                    break;
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            let child_hwnd = chrome.ok_or("browser window did not appear")?;
            attach(parent as isize, child_hwnd)?;
            let expected_parent: HWND = parent;
            assert_eq!(unsafe { GetParent(child_hwnd as HWND) }, expected_parent, "not reparented");

            let mut first = unsafe { std::mem::zeroed::<windows_sys::Win32::Foundation::RECT>() };
            set_bounds(child_hwnd, DockBounds { x: 10.0, y: 20.0, width: 640.0, height: 480.0 }, 1.0)?;
            unsafe { GetWindowRect(child_hwnd as HWND, &mut first) };
            assert_eq!(first.right - first.left, 640, "width not applied");
            assert_eq!(first.bottom - first.top, 480, "height not applied");

            let mut second = unsafe { std::mem::zeroed::<windows_sys::Win32::Foundation::RECT>() };
            set_bounds(child_hwnd, DockBounds { x: 50.0, y: 60.0, width: 800.0, height: 600.0 }, 1.0)?;
            unsafe { GetWindowRect(child_hwnd as HWND, &mut second) };
            assert_eq!(second.right - second.left, 800, "width not updated");
            assert_eq!(second.bottom - second.top, 600, "height not updated");
            assert_eq!(second.left - first.left, 40, "x delta not applied");
            assert_eq!(second.top - first.top, 40, "y delta not applied");

            set_visible(child_hwnd, false);
            assert_eq!(unsafe { IsWindowVisible(child_hwnd as HWND) }, 0, "hide failed");
            set_visible(child_hwnd, true);
            assert_ne!(unsafe { IsWindowVisible(child_hwnd as HWND) }, 0, "show failed");

            detach(child_hwnd);
            assert!(unsafe { GetParent(child_hwnd as HWND) }.is_null(), "detach failed");
            Ok(())
        })();

        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        let _ = child.wait();
        unsafe { DestroyWindow(parent) };
        std::thread::sleep(Duration::from_millis(300));
        let _ = std::fs::remove_dir_all(&profile);
        result.expect("native docking check failed");
    }
}