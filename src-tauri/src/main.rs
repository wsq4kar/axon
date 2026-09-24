// Axon — тонкий слой ОС. Вся логика (разбор подписок, генерация конфигов, маршруты)
// живёт в TypeScript; здесь только то, чего браузер не умеет: процессы ядер,
// системный прокси Windows, трей, права администратора, файл состояния.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Default)]
struct Cores {
    children: Mutex<Vec<(String, Child)>>,
    proxy_on: Mutex<bool>,
}

#[derive(Serialize)]
struct HttpResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

fn exe_name(name: &str) -> String {
    if cfg!(windows) { format!("{name}.exe") } else { name.to_string() }
}

fn core_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let file = exe_name(name);
    let mut places: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        places.push(dir.join("binaries").join(&file));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            places.push(dir.join("binaries").join(&file));
            places.push(dir.join(&file));
        }
    }
    places.push(PathBuf::from("binaries").join(&file));
    places
        .into_iter()
        .find(|p| p.exists())
        .ok_or_else(|| format!("не найдено ядро {file} — переустановите Axon"))
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn hidden(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

fn pipe_logs<R: Read + Send + 'static>(app: AppHandle, tag: &'static str, stream: R) {
    std::thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            let _ = app.emit("core-log", format!("[{tag}] {line}"));
        }
    });
}

fn spawn_core(app: &AppHandle, name: &'static str, args: &[&str], cwd: &PathBuf) -> Result<Child, String> {
    let bin = core_path(app, name)?;
    let mut cmd = Command::new(&bin);
    cmd.args(args).current_dir(cwd).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = hidden(&mut cmd).spawn().map_err(|e| format!("{name}: {e}"))?;
    if let Some(out) = child.stdout.take() {
        pipe_logs(app.clone(), name, out);
    }
    if let Some(err) = child.stderr.take() {
        pipe_logs(app.clone(), name, err);
    }
    Ok(child)
}

fn kill_all(cores: &Cores) {
    let mut list = cores.children.lock().unwrap();
    for (_, child) in list.iter_mut() {
        let _ = child.kill();
        let _ = child.wait();
    }
    list.clear();
}

#[tauri::command]
async fn fetch_url(url: String, user_agent: String) -> Result<HttpResponse, String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("поддерживаются только http(s) ссылки".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(25)).redirects(8).build();
        let resp = match agent.get(&url).set("User-Agent", &user_agent).set("Accept", "*/*").call() {
            Ok(r) => r,
            Err(ureq::Error::Status(_, r)) => r,
            Err(e) => return Err(e.to_string()),
        };
        let status = resp.status();
        let mut headers = HashMap::new();
        for name in resp.headers_names() {
            if let Some(v) = resp.header(&name) {
                headers.insert(name.to_lowercase(), v.to_string());
            }
        }
        let body = resp.into_string().map_err(|e| e.to_string())?;
        Ok(HttpResponse { status, headers, body })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn start_cores(app: AppHandle, singbox: String, xray: Option<String>) -> Result<(), String> {
    let cores = app.state::<Cores>();
    kill_all(&cores);
    let dir = data_dir(&app)?.join("run");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("sing-box.json"), &singbox).map_err(|e| e.to_string())?;
    let mut started: Vec<(String, Child)> = Vec::new();
    if let Some(x) = xray {
        std::fs::write(dir.join("xray.json"), &x).map_err(|e| e.to_string())?;
        started.push(("xray".into(), spawn_core(&app, "xray", &["run", "-c", "xray.json"], &dir)?));
    }
    match spawn_core(&app, "sing-box", &["run", "-c", "sing-box.json", "-D", "."], &dir) {
        Ok(c) => started.push(("sing-box".into(), c)),
        Err(e) => {
            for (_, mut c) in started {
                let _ = c.kill();
            }
            return Err(e);
        }
    }
    // Если ядро упало сразу — это почти всегда ошибка конфига: вернём её, а не «зависшее подключение».
    std::thread::sleep(Duration::from_millis(400));
    let dead = started.iter_mut().find_map(|(name, child)| match child.try_wait() {
        Ok(Some(code)) => Some(format!("{name} завершился с кодом {code} — подробности в «Логах»")),
        _ => None,
    });
    if let Some(msg) = dead {
        for (_, c) in started.iter_mut() {
            let _ = c.kill();
        }
        return Err(msg);
    }
    *cores.children.lock().unwrap() = started;
    Ok(())
}

#[tauri::command]
fn stop_cores(state: State<Cores>) {
    kill_all(&state);
}

#[cfg(windows)]
mod winproxy {
    use std::ffi::c_void;
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    #[link(name = "wininet")]
    extern "system" {
        fn InternetSetOptionW(h: *mut c_void, option: u32, buffer: *mut c_void, len: u32) -> i32;
    }
    #[link(name = "shell32")]
    extern "system" {
        fn IsUserAnAdmin() -> i32;
    }

    const KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings";
    const BYPASS: &str = "localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*;<local>";

    pub fn set(enable: bool, port: u16) -> std::io::Result<()> {
        let (key, _) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(KEY)?;
        if enable {
            key.set_value("ProxyServer", &format!("127.0.0.1:{port}"))?;
            key.set_value("ProxyOverride", &BYPASS.to_string())?;
        }
        key.set_value("ProxyEnable", &(enable as u32))?;
        unsafe {
            InternetSetOptionW(std::ptr::null_mut(), 39, std::ptr::null_mut(), 0); // SETTINGS_CHANGED
            InternetSetOptionW(std::ptr::null_mut(), 37, std::ptr::null_mut(), 0); // REFRESH
        }
        Ok(())
    }

    pub fn elevated() -> bool {
        unsafe { IsUserAnAdmin() != 0 }
    }
}

#[tauri::command]
fn set_system_proxy(state: State<Cores>, enable: bool, port: u16) -> Result<(), String> {
    #[cfg(windows)]
    winproxy::set(enable, port).map_err(|e| e.to_string())?;
    #[cfg(not(windows))]
    let _ = port;
    *state.proxy_on.lock().unwrap() = enable;
    Ok(())
}

#[tauri::command]
fn load_state(app: AppHandle) -> Option<String> {
    std::fs::read_to_string(data_dir(&app).ok()?.join("state.json")).ok()
}

#[tauri::command]
fn save_state(app: AppHandle, json: String) -> Result<(), String> {
    let dir = data_dir(&app)?;
    let tmp = dir.join("state.json.tmp");
    std::fs::write(&tmp, json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, dir.join("state.json")).map_err(|e| e.to_string())
}

#[tauri::command]
async fn tcp_ping(host: String, port: u16, timeout_ms: u64) -> Option<u64> {
    tauri::async_runtime::spawn_blocking(move || {
        let addr = (host.as_str(), port).to_socket_addrs().ok()?.next()?;
        let t = Instant::now();
        TcpStream::connect_timeout(&addr, Duration::from_millis(timeout_ms)).ok()?;
        Some(t.elapsed().as_millis() as u64)
    })
    .await
    .ok()
    .flatten()
}

#[tauri::command]
fn is_elevated() -> bool {
    #[cfg(windows)]
    return winproxy::elevated();
    #[cfg(not(windows))]
    return false;
}

#[tauri::command]
async fn relaunch_as_admin(app: AppHandle) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let path = exe.to_string_lossy().replace('\'', "''");
    let script = format!("Start-Process -FilePath '{path}' -ArgumentList '--connect' -Verb RunAs");
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
    let ok = hidden(&mut cmd).status().map(|s| s.success()).unwrap_or(false);
    if !ok {
        return Err("запрос прав администратора отклонён".into());
    }
    shutdown(&app);
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn startup_args() -> Vec<String> {
    std::env::args().skip(1).collect()
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("можно открывать только http(s) ссылки".into());
    }
    #[cfg(windows)]
    {
        let mut cmd = Command::new("rundll32");
        cmd.args(["url.dll,FileProtocolHandler", &url]);
        hidden(&mut cmd).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
    if let Some(m) = app.get_webview_window("mini") {
        let _ = m.hide();
    }
}

#[tauri::command]
fn window_action(app: AppHandle, window: WebviewWindow, action: String) {
    match action.as_str() {
        "minimize" => {
            let _ = window.minimize();
        }
        "maximize" if window.label() == "mini" => show_main(&app),
        "maximize" => {
            if window.is_maximized().unwrap_or(false) {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
        }
        "hide" => {
            let _ = window.hide();
        }
        "quit" => {
            shutdown(&app);
            app.exit(0);
        }
        _ => {}
    }
}

fn version_of(app: &AppHandle, name: &str) -> String {
    let Ok(bin) = core_path(app, name) else { return "не установлен".into() };
    let mut cmd = Command::new(bin);
    cmd.arg("version");
    let Ok(out) = hidden(&mut cmd).output() else { return "ошибка запуска".into() };
    let text = String::from_utf8_lossy(&out.stdout);
    let first = text.lines().next().unwrap_or("").to_string();
    // «sing-box version 1.11.15» / «Xray 26.3.27 (Xray, Penetrates Everything.) …»
    let version = first
        .split_whitespace()
        .find(|w| w.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false))
        .map(str::to_string)
        .unwrap_or_else(|| first.clone());
    version
}

#[tauri::command]
async fn core_versions(app: AppHandle) -> HashMap<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut m = HashMap::new();
        m.insert("sing-box".to_string(), version_of(&app, "sing-box"));
        m.insert("xray".to_string(), version_of(&app, "xray"));
        m.insert("axon".to_string(), app.package_info().version.to_string());
        m
    })
    .await
    .unwrap_or_default()
}

fn shutdown(app: &AppHandle) {
    let cores = app.state::<Cores>();
    kill_all(&cores);
    let was_on = std::mem::replace(&mut *cores.proxy_on.lock().unwrap(), false);
    if was_on {
        #[cfg(windows)]
        let _ = winproxy::set(false, 0);
    }
}

fn mini_window(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(w) = app.get_webview_window("mini") {
        return Some(w);
    }
    let w = WebviewWindowBuilder::new(app, "mini", WebviewUrl::App("index.html".into()))
        .title("Axon")
        .inner_size(300.0, 380.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .initialization_script("window.__AXON_MINI__ = true;")
        .build()
        .ok()?;
    let handle = w.clone();
    w.on_window_event(move |e| {
        if let WindowEvent::Focused(false) = e {
            let _ = handle.hide();
        }
    });
    Some(w)
}

fn toggle_mini(app: &AppHandle, x: f64, y: f64) {
    let Some(w) = mini_window(app) else { return };
    if w.is_visible().unwrap_or(false) {
        let _ = w.hide();
        return;
    }
    let size = w.outer_size().map(|s| (s.width as f64, s.height as f64)).unwrap_or((300.0, 380.0));
    // Трей обычно внизу справа: окно встаёт над иконкой и не вылезает за край.
    let px = (x - size.0 / 2.0).max(8.0);
    let py = if y > size.1 { y - size.1 - 12.0 } else { y + 12.0 };
    let _ = w.set_position(tauri::PhysicalPosition::new(px, py));
    let _ = w.show();
    let _ = w.set_focus();
}

fn main() {
    tauri::Builder::default()
        .manage(Cores::default())
        .invoke_handler(tauri::generate_handler![
            fetch_url,
            start_cores,
            stop_cores,
            set_system_proxy,
            load_state,
            save_state,
            tcp_ping,
            is_elevated,
            relaunch_as_admin,
            startup_args,
            open_external,
            window_action,
            core_versions
        ])
        .setup(|app| {
            let handle = app.handle();
            let show = MenuItem::with_id(handle, "show", "Открыть Axon", true, None::<&str>)?;
            let toggle = MenuItem::with_id(handle, "toggle", "Подключить / отключить", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(handle)?;
            let quit = MenuItem::with_id(handle, "quit", "Выйти", true, None::<&str>)?;
            let menu = Menu::with_items(handle, &[&show, &toggle, &sep, &quit])?;
            let mut tray = TrayIconBuilder::with_id("axon").tooltip("Axon").menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            #[allow(deprecated)]
            let tray = tray.menu_on_left_click(false);
            tray.on_menu_event(|app, event| match event.id.as_ref() {
                "show" => show_main(app),
                "toggle" => {
                    let _ = app.emit("tray-action", "toggle");
                }
                "quit" => {
                    shutdown(app);
                    app.exit(0);
                }
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, position, .. } = event {
                    toggle_mini(tray.app_handle(), position.x, position.y);
                }
            })
            .build(handle)?;
            // Закрытие главного окна прячет его в трей: VPN продолжает работать.
            if let Some(main) = app.get_webview_window("main") {
                let w = main.clone();
                main.on_window_event(move |e| {
                    if let WindowEvent::CloseRequested { api, .. } = e {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }
            let _ = mini_window(handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("не удалось запустить Axon")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                shutdown(app);
            }
        });
}
