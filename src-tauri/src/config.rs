// Persistance de la config présence : { address, relay_url } en clair dans le app config dir.
// L'adresse NULLNODE est publique (partageable) — aucune seed/clé privée ne transite ici.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

const CONFIG_FILE: &str = "presence.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceConfig {
    pub address: String,
    pub relay_url: String,
}

/// Chemin du fichier de config, dans le app config dir résolu par Tauri.
fn config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("app_config_dir indisponible: {e}"))?;
    Ok(dir.join(CONFIG_FILE))
}

/// Lit la config persistée. `Ok(None)` si jamais loggé (fichier absent) — pas une erreur.
pub fn load<R: Runtime>(app: &AppHandle<R>) -> Result<Option<PresenceConfig>, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("lecture config: {e}"))?;
    let cfg: PresenceConfig =
        serde_json::from_str(&raw).map_err(|e| format!("parse config: {e}"))?;
    Ok(Some(cfg))
}

/// Écrit la config (crée le dossier au besoin). Écrase la précédente.
pub fn save<R: Runtime>(app: &AppHandle<R>, cfg: &PresenceConfig) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create config dir: {e}"))?;
    }
    let raw = serde_json::to_string_pretty(cfg).map_err(|e| format!("serialize config: {e}"))?;
    fs::write(&path, raw).map_err(|e| format!("write config: {e}"))?;
    Ok(())
}
