// Tray (icône bouclier). Clic gauche → montre/focus la GUI. Menu : Ouvrir, statut, Quitter.
// Le statut ("actif"/"inactif") reflète la présence d'une config persistée au démarrage.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Runtime};

use crate::config;
use crate::window::show_main_window;

/// Construit et installe le tray. Appelé une fois au `setup`.
pub fn build<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let status_label = status_text(app);
    let open = MenuItem::with_id(app, "open", "Ouvrir", true, None::<&str>)
        .map_err(|e| format!("menu open: {e}"))?;
    let status = MenuItem::with_id(app, "status", status_label, false, None::<&str>)
        .map_err(|e| format!("menu status: {e}"))?;
    let sep = PredefinedMenuItem::separator(app).map_err(|e| format!("menu sep: {e}"))?;
    let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)
        .map_err(|e| format!("menu quit: {e}"))?;

    let menu = Menu::with_items(app, &[&open, &status, &sep, &quit])
        .map_err(|e| format!("menu build: {e}"))?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "icône de fenêtre par défaut absente".to_string())?;

    TrayIconBuilder::with_id("nullnode-tray")
        .icon(icon)
        .tooltip("NULLNODE")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)
        .map_err(|e| format!("tray build: {e}"))?;
    Ok(())
}

/// "actif" si une config présence est persistée (donc daemon armé), sinon "inactif".
fn status_text<R: Runtime>(app: &AppHandle<R>) -> &'static str {
    match config::load(app) {
        Ok(Some(_)) => "Statut : actif",
        _ => "Statut : inactif",
    }
}
