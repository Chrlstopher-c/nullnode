// Wiring de l'app desktop NULLNODE. Ghost daemon au boot, tray, handoff GUI.
// Modèle de handoff (le relay ne garde qu'UN socket par adresse) :
//  - boot (sans GUI) : si config présente → daemon ouvre la WS présence ; sinon idle.
//  - ouverture GUI : gui_opened() → daemon ferme sa WS, le client JS prend le relais.
//  - masquage GUI : gui_closed() → daemon réouvre la WS depuis la config.
//  - WS tombée : reconnexion auto avec backoff (1s → max 30s).

mod commands;
mod config;
mod presence;
mod state;
mod tray;
mod window;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

use crate::presence::PresenceHandle;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let handle = app.handle().clone();
            let presence = PresenceHandle::new(handle.clone());
            app.manage(AppState::new(presence.clone()));

            tray::build(&handle).map_err(|e| std::io::Error::other(e))?;
            window::attach_close_to_hide(&handle);

            // Boot fantôme : si une config existe, on arme la présence sans fenêtre.
            match config::load(&handle) {
                Ok(Some(cfg)) => {
                    let p = presence.clone();
                    tauri::async_runtime::spawn(async move { p.start(cfg).await });
                }
                Ok(None) => log::info!("boot: aucune config, daemon idle"),
                Err(e) => log::warn!("boot: lecture config échouée: {e}"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::configure_presence,
            commands::gui_opened,
            commands::gui_closed,
        ])
        .run(tauri::generate_context!())
        .expect("erreur fatale au démarrage de l'app NULLNODE");
}
