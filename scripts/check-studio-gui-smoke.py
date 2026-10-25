#!/usr/bin/env python3
"""Isolated Windows GUI smoke of the signed-off local NSIS app payload.

Does not install the application, mutate real user profiles, or close preexisting processes.
Creates a disposable user profile and only terminates the process tree it started.
"""
from __future__ import annotations
import argparse
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--installer", required=True)
    parser.add_argument("--timeout", type=int, default=22)
    args = parser.parse_args()
    if os.name != "nt":
        print(json.dumps({"status": "unsupported", "reason": "Windows GUI only"}))
        return 2

    try:
        import psutil
    except ImportError:
        print(json.dumps({"status": "unverified", "reason": "psutil is required"}))
        return 2

    sevenzip = next((p for p in [
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe"
    ] if os.path.isfile(p)), None)
    if not sevenzip:
        print(json.dumps({"status": "unverified", "reason": "7-Zip unavailable"}))
        return 2

    installer = Path(args.installer).resolve(strict=True)
    if not installer.is_file():
        raise ValueError("Expected a local NSIS installer")
    baseline_pids = {p.pid for p in psutil.process_iter(["pid"])}
    root = Path(tempfile.mkdtemp(prefix="studio-nsis-gui-"))
    proc = None
    report = {"status": "unverified", "installer": installer.name, "gui_window": None}
    try:
        payload = root / "payload"
        profile = root / "profile"
        for name in ["AppData/Roaming", "AppData/Local", "Temp"]:
            (profile / name).mkdir(parents=True, exist_ok=True)
        unpack = subprocess.run(
            [sevenzip, "x", "-y", "-o" + str(payload), str(installer),
             "app.exe", "backend/*", "bun-runtime/*"],
            capture_output=True, text=True, timeout=100
        )
        if unpack.returncode:
            report["reason"] = "NSIS extraction failed"
            return 2
        app = payload / "app.exe"
        expected = [
            app, payload / "backend" / "dist" / "server.js",
            payload / "bun-runtime" / "bun.exe",
        ]
        missing = [str(p.relative_to(payload)) for p in expected if not p.is_file()]
        if missing:
            report["reason"] = "Incomplete executable payload"
            report["missing"] = missing
            return 2

        env = os.environ.copy()
        env.update({
            "HOME": str(profile), "USERPROFILE": str(profile),
            "APPDATA": str(profile / "AppData" / "Roaming"),
            "LOCALAPPDATA": str(profile / "AppData" / "Local"),
            "TEMP": str(profile / "Temp"), "TMP": str(profile / "Temp"),
        })
        proc = subprocess.Popen([str(app)], cwd=str(payload), env=env,
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)
        user32 = ctypes.windll.user32
        enum_window_type = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

        def windows_by_pid(pids):
            found = []
            @enum_window_type
            def callback(hwnd, _):
                pid = wintypes.DWORD(0)
                user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                if pid.value in pids and user32.IsWindowVisible(hwnd):
                    title_len = user32.GetWindowTextLengthW(hwnd)
                    title = ctypes.create_unicode_buffer(title_len + 1)
                    user32.GetWindowTextW(hwnd, title, title_len + 1)
                    if title.value.strip():
                        found.append({"pid": pid.value, "title": title.value[:120]})
                return True
            user32.EnumWindows(callback, 0)
            return found

        for _ in range(max(1, args.timeout) * 2):
            if proc.poll() is not None:
                report["reason"] = "GUI process exited before opening a visible window"
                report["exitCode"] = proc.returncode
                break
            try:
                children = psutil.Process(proc.pid).children(recursive=True)
                owned = {proc.pid} | {p.pid for p in children}
            except psutil.NoSuchProcess:
                owned = {proc.pid}
            # Don't match any preexisting process; launch-only isolation.
            candidates = owned - baseline_pids
            windows = windows_by_pid(candidates)
            if windows:
                report.update(status="pass", gui_window=windows[0],
                              spawned_processes=len(candidates))
                break
            time.sleep(.5)
        else:
            report["reason"] = "No visible Tauri application window within smoke timeout"
    finally:
        if proc:
            try:
                parent = psutil.Process(proc.pid)
                owned = parent.children(recursive=True)
                for child in reversed(owned):
                    if child.pid not in baseline_pids:
                        child.terminate()
                if parent.pid not in baseline_pids:
                    parent.terminate()
                psutil.wait_procs(owned + [parent], timeout=4)
            except psutil.NoSuchProcess:
                pass
            except psutil.Error as error:
                report["cleanupWarning"] = type(error).__name__
        try:
            shutil.rmtree(root)
        except OSError:
            report["cleanupWarning"] = "Temporary payload retained by Windows handle"
        print(json.dumps(report, ensure_ascii=False))
    return 0 if report["status"] == "pass" else 1

if __name__ == "__main__":
    sys.exit(main())

