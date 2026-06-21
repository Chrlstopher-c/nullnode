// État partagé du daemon, géré par Tauri (`State`).
// Détient la poignée de présence et un drapeau "GUI ouverte" qui arbitre le handoff :
// le relay ne garde qu'UN socket par adresse, daemon et GUI ne sont jamais connectés
// en même temps.

use tokio::sync::Mutex;

use crate::presence::PresenceHandle;

pub struct AppState {
    pub presence: PresenceHandle,
    /// Vrai tant que la fenêtre GUI est visible : le daemon doit alors rester muet.
    pub gui_open: Mutex<bool>,
}

impl AppState {
    pub fn new(presence: PresenceHandle) -> Self {
        Self {
            presence,
            gui_open: Mutex::new(false),
        }
    }
}
