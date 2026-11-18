use std::{
    ffi::OsStr,
    path::{Path, PathBuf},
    sync::Mutex,
};

/// Holds the file path passed via file association (double-click in Explorer).
/// The frontend picks it up once on mount via `take_startup_file`.
struct PendingOpen(Mutex<Option<String>>);

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(OsStr::to_str)
        .map(|ext| {
            ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown")
        })
        .unwrap_or(false)
}

/// Extract a markdown file path from command-line arguments, if any.
fn startup_markdown_file() -> Option<String> {
    std::env::args_os()
        .skip(1) // skip the executable itself
        .map(PathBuf::from)
        .find_map(|path| {
            if !path.is_file() || !is_markdown(&path) {
                return None;
            }
            path.into_os_string().into_string().ok()
        })
}

/// Called once by the frontend on mount to retrieve the startup file path.
/// `take()` ensures the path is consumed only once.
#[tauri::command]
fn take_startup_file(state: tauri::State<'_, PendingOpen>) -> Option<String> {
    state.0.lock().ok()?.take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_file = startup_markdown_file();

    tauri::Builder::default()
        .manage(PendingOpen(Mutex::new(startup_file)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![export_pdf, take_startup_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Render the current page to a PDF file via WebView2 `PrintToPdf`, with no
/// print dialog. The caller shows a save-path dialog first; the print media
/// CSS in the editor produces the paper layout. Resolves once WebView2
/// reports the file written.
#[cfg(windows)]
#[tauri::command]
async fn export_pdf(window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    use std::time::Duration;

    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_7;
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING};

    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    let done = tx.clone();

    window
        .with_webview(move |webview| {
            let started = (|| -> Result<(), String> {
                let controller = webview.controller();
                // print lives on ICoreWebView2_7, newer than the controller's
                // base interface, so cast explicitly
                let core = unsafe { controller.CoreWebView2() }.map_err(|err| err.to_string())?;
                let print_view: ICoreWebView2_7 = core.cast().map_err(|err| err.to_string())?;
                let settings = print_settings(&core)?;
                let target = HSTRING::from(path.as_str());
                let handler = PrintToPdfCompletedHandler::create(Box::new(
                    move |error_code, succeeded| {
                        let ok = error_code.is_ok() && succeeded;
                        let _ = done.send(if ok {
                            Ok(())
                        } else {
                            Err(format!(
                                "PrintToPdf failed (hr={error_code:?}, success={succeeded})"
                            ))
                        });
                        Ok(())
                    },
                ));
                unsafe { print_view.PrintToPdf(&target, &settings, &handler) }
                    .map_err(|err| err.to_string())
            })();
            if let Err(err) = started {
                let _ = tx.send(Err(err));
            }
        })
        .map_err(|err| err.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(Duration::from_secs(120))
            .unwrap_or_else(|_| Err("PDF export timed out".to_string()))
    })
    .await
    .map_err(|err| err.to_string())?
}

/// A4 portrait with 12 mm margins and background graphics on — the paper
/// defaults the print dialog used to hand to the user.
#[cfg(windows)]
fn print_settings(
    core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2,
) -> Result<webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2PrintSettings, String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2_2,
    };
    use windows::core::Interface;

    const MM_PER_INCH: f64 = 25.4;

    unsafe {
        let environment = core
            .cast::<ICoreWebView2_2>()
            .and_then(|view| view.Environment())
            .map_err(|err| err.to_string())?;
        let environment6: ICoreWebView2Environment6 =
            environment.cast().map_err(|err| err.to_string())?;
        let settings = environment6
            .CreatePrintSettings()
            .map_err(|err| err.to_string())?;
        settings.SetPageWidth(210.0 / MM_PER_INCH).map_err(|e| e.to_string())?;
        settings.SetPageHeight(297.0 / MM_PER_INCH).map_err(|e| e.to_string())?;
        let margin = 12.0 / MM_PER_INCH;
        settings.SetMarginTop(margin).map_err(|e| e.to_string())?;
        settings.SetMarginBottom(margin).map_err(|e| e.to_string())?;
        settings.SetMarginLeft(margin).map_err(|e| e.to_string())?;
        settings.SetMarginRight(margin).map_err(|e| e.to_string())?;
        settings
            .SetShouldPrintBackgrounds(true)
            .map_err(|e| e.to_string())?;
        Ok(settings)
    }
}

#[cfg(not(windows))]
#[tauri::command]
async fn export_pdf(_window: tauri::WebviewWindow, _path: String) -> Result<(), String> {
    Err("direct PDF export is only implemented for the Windows WebView2 shell".into())
}
