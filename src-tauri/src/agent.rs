use serde_json::{Value, json};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, ipc::Channel};

#[cfg(test)]
#[path = "agent_tests.rs"]
mod tests;

type Pending = Arc<Mutex<HashMap<String, Channel<Value>>>>;
struct Host {
    child: Child,
    input: Arc<Mutex<ChildStdin>>,
    pending: Pending,
    #[cfg(windows)]
    _job: ProcessJob,
}
#[cfg(windows)]
struct ProcessJob(isize);
#[cfg(windows)]
impl ProcessJob {
    fn attach(child: &Child) -> Result<Self, String> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::System::JobObjects::*;
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if handle.is_null() {
                return Err("Cannot create runtime process group".into());
            }
            let job = Self(handle as isize);
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                std::mem::size_of_val(&info) as u32,
            ) == 0
                || AssignProcessToJobObject(handle, child.as_raw_handle() as _) == 0
            {
                return Err("Cannot isolate runtime process group".into());
            }
            Ok(job)
        }
    }
}
#[cfg(windows)]
impl Drop for ProcessJob {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0 as _);
        }
    }
}
#[derive(Default)]
pub struct AgentState {
    host: Mutex<Option<Host>>,
}

fn send(input: &Arc<Mutex<ChildStdin>>, value: &Value) -> Result<(), String> {
    let mut pipe = input.lock().map_err(|_| "Runtime pipe lock failed")?;
    serde_json::to_writer(&mut *pipe, value).map_err(|_| "Runtime write failed")?;
    pipe.write_all(b"\n")
        .and_then(|_| pipe.flush())
        .map_err(|_| "Runtime pipe closed".to_string())
}

fn runtime_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let bundled = app
        .path()
        .resource_dir()
        .map_err(|_| "Resource directory unavailable")?
        .join("runtime");
    if bundled.join("node.exe").is_file() {
        return Ok(bundled);
    }
    #[cfg(debug_assertions)]
    {
        let local = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("runtime");
        if local.join("node.exe").is_file() {
            return Ok(local);
        }
    }
    Err("Bundled runtime tidak ditemukan. Jalankan prepare:desktop lalu build ulang.".into())
}

impl AgentState {
    fn start(&self, app: &AppHandle) -> Result<(), String> {
        self.start_directory(runtime_directory(app)?)
    }
    fn start_directory(&self, directory: PathBuf) -> Result<(), String> {
        let mut host = self.host.lock().map_err(|_| "Runtime lock failed")?;
        if let Some(existing) = host.as_mut() {
            if existing.child.try_wait().ok().flatten().is_none() {
                return Ok(());
            }
        }
        let mut runtime_paths = vec![directory.clone()];
        runtime_paths.extend(std::env::split_paths(
            &std::env::var_os("PATH").unwrap_or_default(),
        ));
        let mut command = Command::new(directory.join("node.exe"));
        command
            .arg(directory.join("agent/desktopAgentHost.mjs"))
            .env("CODEX_RUNTIME_PATH", directory.join("codex/codex.exe"))
            .env(
                "PATH",
                std::env::join_paths(runtime_paths).map_err(|_| "Invalid runtime PATH")?,
            )
            .env_remove("NODE_OPTIONS")
            .env_remove("NODE_PATH")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command
            .spawn()
            .map_err(|_| "Bundled Node runtime gagal dimulai")?;
        #[cfg(windows)]
        let job = match ProcessJob::attach(&child) {
            Ok(job) => job,
            Err(error) => {
                let _ = child.kill();
                return Err(error);
            }
        };
        let input = Arc::new(Mutex::new(
            child.stdin.take().ok_or("Runtime stdin unavailable")?,
        ));
        let output = child.stdout.take().ok_or("Runtime stdout unavailable")?;
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
        let reader_pending = pending.clone();
        let reader_input = input.clone();
        thread::spawn(move || {
            for line in BufReader::new(output).lines() {
                let Ok(line) = line else {
                    break;
                };
                let Ok(event) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                let Some(id) = event.get("id").and_then(Value::as_str) else {
                    continue;
                };
                let Ok(mut requests) = reader_pending.lock() else {
                    break;
                };
                let failed = requests
                    .get(id)
                    .is_some_and(|channel| channel.send(event.clone()).is_err());
                if failed
                    || matches!(
                        event.get("type").and_then(Value::as_str),
                        Some("end" | "error")
                    )
                {
                    requests.remove(id);
                }
                drop(requests);
                if failed {
                    let _ = send(&reader_input, &json!({"id":id,"cancel":true}));
                }
            }
            if let Ok(mut requests) = reader_pending.lock() {
                for (_, channel) in requests.drain() {
                    let _ = channel.send(json!({"type":"error","error":"Runtime desktop berhenti. Hubungkan ulang."}));
                }
            }
        });
        *host = Some(Host {
            child,
            input,
            pending,
            #[cfg(windows)]
            _job: job,
        });
        Ok(())
    }
    pub fn shutdown(&self) {
        let Ok(mut state) = self.host.lock() else {
            return;
        };
        if let Some(mut host) = state.take() {
            let _ = send(&host.input, &json!({"shutdown":true}));
            let deadline = Instant::now() + Duration::from_secs(8);
            while Instant::now() < deadline {
                if host.child.try_wait().ok().flatten().is_some() {
                    return;
                }
                thread::sleep(Duration::from_millis(50));
            }
            let _ = host.child.kill();
            let _ = host.child.wait();
        }
    }
}

#[tauri::command]
pub fn native_agent_request(
    app: AppHandle,
    state: tauri::State<'_, AgentState>,
    request_id: String,
    payload: Value,
    on_event: Channel<Value>,
) -> Result<(), String> {
    if request_id.is_empty()
        || request_id.len() > 100
        || !request_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
    {
        return Err("Invalid request id".into());
    }
    if payload.to_string().len() > 32 * 1024 * 1024 {
        return Err("Permintaan terlalu besar.".into());
    }
    let action = payload.get("action").and_then(Value::as_str).unwrap_or("");
    if ![
        "status",
        "computerInfo",
        "pickFolder",
        "projectInfo",
        "projectFiles",
        "projectFile",
        "projectGit",
        "connect",
        "close",
        "stop",
        "approve",
        "turn",
    ]
    .contains(&action)
    {
        return Err("Unsupported agent action".into());
    }
    state.start(&app)?;
    let host = state.host.lock().map_err(|_| "Runtime lock failed")?;
    let host = host.as_ref().ok_or("Runtime unavailable")?;
    {
        let mut pending = host.pending.lock().map_err(|_| "Request lock failed")?;
        if pending.len() >= 16 || pending.contains_key(&request_id) {
            return Err("Terlalu banyak permintaan runtime.".into());
        }
        pending.insert(request_id.clone(), on_event);
    }
    if let Err(error) = send(&host.input, &json!({"id":request_id,"payload":payload})) {
        if let Ok(mut pending) = host.pending.lock() {
            pending.remove(&request_id);
        }
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
pub fn native_agent_cancel(
    state: tauri::State<'_, AgentState>,
    request_id: String,
) -> Result<(), String> {
    let host = state.host.lock().map_err(|_| "Runtime lock failed")?;
    if let Some(host) = host.as_ref() {
        send(&host.input, &json!({"id":request_id,"cancel":true}))?;
        if let Ok(mut pending) = host.pending.lock() {
            pending.remove(&request_id);
        }
    }
    Ok(())
}
