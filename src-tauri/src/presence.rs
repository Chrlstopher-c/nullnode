// Client WebSocket de présence du daemon fantôme.
// Tient la présence "online" au relay quand la GUI est fermée. Sur `envelope` reçu →
// notification desktop (le payload est chiffré, JAMAIS déchiffré ni ACK : le relay le
// re-flushera à la GUI quand elle se connectera). Reconnexion auto avec backoff.

use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Mutex;
use tokio::time::{interval, sleep};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

use crate::config::PresenceConfig;

const PING_INTERVAL_SECS: u64 = 25;
const BACKOFF_START_SECS: u64 = 1;
const BACKOFF_MAX_SECS: u64 = 30;

/// Poignée du daemon : un superviseur tokio dont on peut demander l'arrêt.
/// L'arrêt (`stop`) fait tomber le `cancel` que la boucle observe entre deux étapes.
#[derive(Clone)]
pub struct PresenceHandle {
    cancel: Arc<Mutex<Option<tokio::sync::watch::Sender<bool>>>>,
    app: AppHandle,
}

impl PresenceHandle {
    pub fn new(app: AppHandle) -> Self {
        Self {
            cancel: Arc::new(Mutex::new(None)),
            app,
        }
    }

    /// (Re)démarre le daemon avec la config donnée. Arrête toute instance précédente.
    pub async fn start(&self, cfg: PresenceConfig) {
        self.stop().await;
        let (tx, rx) = tokio::sync::watch::channel(false);
        {
            let mut guard = self.cancel.lock().await;
            *guard = Some(tx);
        }
        let app = self.app.clone();
        tokio::spawn(async move {
            supervise(app, cfg, rx).await;
        });
    }

    /// Ferme la WS de présence et laisse la place au client JS (handoff vers la GUI).
    pub async fn stop(&self) {
        let mut guard = self.cancel.lock().await;
        if let Some(tx) = guard.take() {
            let _ = tx.send(true);
        }
    }
}

/// Superviseur : (re)connecte avec backoff tant que l'arrêt n'est pas demandé.
async fn supervise(
    app: AppHandle,
    cfg: PresenceConfig,
    mut cancel: tokio::sync::watch::Receiver<bool>,
) {
    let mut backoff = BACKOFF_START_SECS;
    loop {
        if *cancel.borrow() {
            return;
        }
        match run_connection(&app, &cfg, &mut cancel).await {
            ConnExit::Cancelled => return,
            ConnExit::Dropped => {
                log::warn!("presence: WS tombée, reconnexion dans {backoff}s");
            }
            ConnExit::Failed(err) => {
                log::warn!("presence: connexion échouée ({err}), retry dans {backoff}s");
            }
        }
        // Attente avec backoff, interruptible par un stop.
        tokio::select! {
            _ = sleep(Duration::from_secs(backoff)) => {}
            _ = cancel.changed() => { if *cancel.borrow() { return; } }
        }
        backoff = (backoff * 2).min(BACKOFF_MAX_SECS);
    }
}

enum ConnExit {
    Cancelled,
    Dropped,
    Failed(String),
}

/// Une session WS : connecte, envoie `hello`, ping périodique, traite les messages.
async fn run_connection(
    app: &AppHandle,
    cfg: &PresenceConfig,
    cancel: &mut tokio::sync::watch::Receiver<bool>,
) -> ConnExit {
    let (ws, _) = match connect_async(&cfg.relay_url).await {
        Ok(pair) => pair,
        Err(e) => return ConnExit::Failed(e.to_string()),
    };
    let (mut writer, mut reader) = ws.split();

    let hello = serde_json::json!({ "t": "hello", "addr": cfg.address });
    if let Err(e) = writer.send(Message::Text(hello.to_string())).await {
        return ConnExit::Failed(format!("hello: {e}"));
    }
    log::info!("presence: online ({})", cfg.address);

    let mut ping = interval(Duration::from_secs(PING_INTERVAL_SECS));
    ping.tick().await; // consomme le tick immédiat

    loop {
        tokio::select! {
            _ = cancel.changed() => {
                if *cancel.borrow() {
                    let _ = writer.send(Message::Close(None)).await;
                    return ConnExit::Cancelled;
                }
            }
            _ = ping.tick() => {
                let ping_msg = serde_json::json!({ "t": "ping" }).to_string();
                if writer.send(Message::Text(ping_msg)).await.is_err() {
                    return ConnExit::Dropped;
                }
            }
            incoming = reader.next() => {
                match incoming {
                    Some(Ok(Message::Text(txt))) => handle_text(app, &txt),
                    Some(Ok(Message::Close(_))) | None => return ConnExit::Dropped,
                    Some(Ok(_)) => {} // binary/ping/pong de bas niveau ignorés
                    Some(Err(e)) => {
                        log::warn!("presence: erreur lecture WS: {e}");
                        return ConnExit::Dropped;
                    }
                }
            }
        }
    }
}

/// Route un message serveur→client. Seul `envelope` déclenche une action (notification).
fn handle_text(app: &AppHandle, txt: &str) {
    let parsed: Value = match serde_json::from_str(txt) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("presence: message non-JSON ignoré: {e}");
            return;
        }
    };
    match parsed.get("t").and_then(Value::as_str) {
        Some("envelope") => notify_new_message(app),
        Some("welcome") | Some("presence") | Some("pong") => {}
        Some("error") => {
            let code = parsed.get("code").and_then(Value::as_str).unwrap_or("?");
            log::warn!("presence: relay error code={code}");
        }
        _ => {}
    }
}

/// Notification desktop : le daemon ne lit pas le contenu (payload chiffré).
fn notify_new_message(app: &AppHandle) {
    let res = app
        .notification()
        .builder()
        .title("NULLNODE")
        .body("nouveau message")
        .show();
    if let Err(e) = res {
        log::warn!("presence: notification échouée: {e}");
    }
}
