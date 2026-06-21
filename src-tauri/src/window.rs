// Gestion de la fenêtre principale. La fermeture ne quitte PAS l'app : on l'intercepte
// (preventDefault) et on masque la fenêtre. Le retour au mode fantôme (réouverture WS)
// est piloté côté JS via `gui_closed()` sur l'event de masquage.

use tauri::{AppHandle, Manager, Runtime, WindowEvent};

const MAIN: &str = "main";

/// Montre et focus la fenêtre principale (depuis le tray).
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window(MAIN) {
        if let Err(e) = win.show() {
            log::warn!("window show: {e}");
        }
        if let Err(e) = win.set_focus() {
            log::warn!("window focus: {e}");
        }
    }
}

/// Câble l'intercept de fermeture : close → hide (l'app survit en tray).
pub fn attach_close_to_hide<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window(MAIN) {
        let handle = win.clone();
        win.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(e) = handle.hide() {
                    log::warn!("window hide on close: {e}");
                }
            }
        });
    }
}
