// Commandes Tauri exposées au JS. Trois verbes pilotent le handoff daemon ↔ GUI :
// - configure_presence : l'identité est prête → persiste la config, (re)démarre le daemon si GUI fermée.
// - gui_opened : la GUI prend le relais → le daemon ferme sa WS de présence.
// - gui_closed : la GUI se masque → le daemon réouvre sa WS depuis la config.

use tauri::{AppHandle, State};

use crate::config::{self, PresenceConfig};
use crate::state::AppState;

/// Appelée par le JS quand l'identité est déverrouillée/prête.
/// Persiste { address, relay_url } et redémarre le daemon si la GUI est fermée.
#[tauri::command]
pub async fn configure_presence(
    app: AppHandle,
    state: State<'_, AppState>,
    address: String,
    relay_url: String,
) -> Result<(), String> {
    let cfg = PresenceConfig { address, relay_url };
    config::save(&app, &cfg)?;
    let gui_open = *state.gui_open.lock().await;
    if !gui_open {
        state.presence.start(cfg).await;
    }
    Ok(())
}

/// La GUI s'ouvre : elle tient désormais la présence, le daemon se tait.
#[tauri::command]
pub async fn gui_opened(state: State<'_, AppState>) -> Result<(), String> {
    *state.gui_open.lock().await = true;
    state.presence.stop().await;
    Ok(())
}

/// La GUI se masque : le daemon réouvre sa présence depuis la config persistée.
#[tauri::command]
pub async fn gui_closed(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    *state.gui_open.lock().await = false;
    match config::load(&app)? {
        Some(cfg) => state.presence.start(cfg).await,
        None => log::info!("gui_closed: aucune config, daemon idle"),
    }
    Ok(())
}
