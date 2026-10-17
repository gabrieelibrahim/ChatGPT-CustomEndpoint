#[cfg(desktop)]
mod agent;
#[cfg(desktop)]
use tauri::Manager;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init());
    #[cfg(desktop)]
    let builder = builder
        .manage(agent::AgentState::default())
        .invoke_handler(tauri::generate_handler![
            agent::native_agent_request,
            agent::native_agent_cancel
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(monitor) = window.current_monitor()? {
                    let scale = monitor.scale_factor();
                    let area = monitor.work_area();
                    let frame_height = window
                        .outer_size()?
                        .height
                        .saturating_sub(window.inner_size()?.height)
                        as f64
                        / scale;
                    let width = (area.size.width as f64 / scale - 24.0)
                        .min(1280.0)
                        .max(640.0);
                    let height = (area.size.height as f64 / scale - frame_height - 24.0)
                        .min(860.0)
                        .max(480.0);
                    window.set_size(tauri::LogicalSize::new(width, height))?;
                    window.center()?;
                }
                window.show()?;
            }
            Ok(())
        });
    builder.build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(desktop)]
            if matches!(event, tauri::RunEvent::Exit) {
                app.state::<agent::AgentState>().shutdown();
            }
            #[cfg(mobile)]
            let _ = (app, event);
        });
}
