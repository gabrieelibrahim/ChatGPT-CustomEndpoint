use super::*;
use base64::Engine;
use std::sync::mpsc;
use tauri::ipc::InvokeResponseBody;

fn round_trip(state: &AgentState, id: &str, payload: Value) -> Value {
    let (sender, receiver) = mpsc::channel();
    let channel = Channel::<Value>::new(move |body| {
        if let InvokeResponseBody::Json(body) = body {
            let _ = sender.send(serde_json::from_str::<Value>(&body).unwrap());
        }
        Ok(())
    });
    {
        let host = state.host.lock().unwrap();
        let host = host.as_ref().unwrap();
        host.pending.lock().unwrap().insert(id.into(), channel);
        send(&host.input, &json!({ "id": id, "payload": payload })).unwrap();
    }
    let mut body = Vec::new();
    loop {
        let event = receiver.recv_timeout(Duration::from_secs(30)).unwrap();
        match event["type"].as_str().unwrap() {
            "headers" => assert_eq!(event["status"], 200),
            "chunk" => body.extend(
                base64::engine::general_purpose::STANDARD
                    .decode(event["data"].as_str().unwrap())
                    .unwrap(),
            ),
            "end" => break,
            "error" => panic!("Native runtime error: {}", event["error"]),
            _ => panic!("Unexpected runtime event"),
        }
    }
    serde_json::from_slice(&body).unwrap()
}

#[test]
fn bundled_runtime_through_real_rust_channels_and_windows_job() {
    let state = AgentState::default();
    let directory = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("runtime");
    state.start_directory(directory).unwrap();
    let status = round_trip(&state, "rust-status", json!({"action":"status"}));
    assert_eq!(status["available"], true);
    let computer = round_trip(&state, "rust-computer", json!({"action":"computerInfo"}));
    assert_eq!(computer["execution"], "local");
    assert_eq!(computer["runtimeAvailable"], true);
    let project = round_trip(
        &state,
        "rust-project",
        json!({"action":"projectInfo","cwd":env!("CARGO_MANIFEST_DIR")}),
    );
    assert!(project["path"].as_str().unwrap().ends_with("src-tauri"));
    let preview = round_trip(
        &state,
        "rust-preview",
        json!({"action":"projectFile","cwd":env!("CARGO_MANIFEST_DIR"),"name":"Cargo.toml"}),
    );
    assert!(
        preview["text"]
            .as_str()
            .unwrap()
            .contains("name = \"sakelar\"")
    );
    let host_process = state.host.lock().unwrap().as_ref().unwrap().child.id();
    state.shutdown();
    assert!(state.host.lock().unwrap().is_none());
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::Threading::*;
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, host_process);
        if !handle.is_null() {
            let mut code = 0;
            assert_ne!(GetExitCodeProcess(handle, &mut code), 0);
            CloseHandle(handle);
            assert_ne!(code, 259, "Bundled Node must have exited");
        }
    }
}
