#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{async_runtime::spawn, Manager};

/// Start the Dendrite binary as a sidecar and stream its stdout/stderr to the host logs.
// Shared state kept in the Tauri App so we can control the sidecar lifecycle
struct SidecarState {
  child: Mutex<Option<std::process::Child>>,
}

fn start_dendrite_sidecar(app_handle: tauri::AppHandle, state: &tauri::State<SidecarState>) {
  // Avoid starting if already running
  if let Ok(guard) = state.child.lock() {
    if guard.is_some() {
      println!("[sidecar] start requested but dendrite is already running");
      return;
    }
  }
  // We'll run the sidecar in a background thread so the main runtime is not blocked.
  let handle = app_handle.clone();

  // Use an Arc/Mutex so we can later extend the code to store the child handle if needed.
  // Store the child in the managed `SidecarState` so other hooks can access it.

  spawn(async move {
    // Spawn a blocking thread to run the sidecar and read its output using blocking IO.
    let handle_for_thread = handle.clone();

    thread::spawn(move || {
      // Determine sidecar path: prefer the bundled resource, otherwise fall back to PATH (dev mode)
      let maybe_resource = handle_for_thread.path_resolver().resource_dir();

      let mut dendrite_path = maybe_resource
        .map(|p| {
          // typical Tauri sidecar layout is resources/sidecar/<name> or resources/<name>
          // try both
          let mut p1 = p.join("sidecar").join("dendrite");
          if cfg!(windows) {
            p1.set_extension("exe");
          }
          if p1.exists() { return p1; }

          let mut p2 = p.join("dendrite");
          if cfg!(windows) {
            p2.set_extension("exe");
          }
          p2
        })
        .unwrap_or_else(|| PathBuf::from("dendrite"));

      // If the path isn't an absolute/bundled path, we'll attempt to run simply "dendrite" from PATH
      let final_path = if dendrite_path.exists() { dendrite_path } else { PathBuf::from("dendrite") };

      // Log the resolved path so developers know what we attempted to run
      println!("[sidecar] starting dendrite from {:?}", final_path);

      let mut cmd = Command::new(final_path.as_os_str());
      // Example args - change as needed for your dendrite configuration or make them configurable.
      //cmd.arg("--some-flag");

      cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

      let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
          eprintln!("[sidecar] failed to spawn dendrite: {}", e);
          return;
        }
      };

      // Take stdout/stderr handles so we can spawn readers even after moving the child
      let stdout_handle = child.stdout.take();
      let stderr_handle = child.stderr.take();

      // Put the child into shared state so we can kill it from other hooks
      if let Ok(mut guard) = state.child.lock() {
        *guard = Some(child);
      }

      // Spawn a watcher thread that polls for child exit using try_wait and clears state when done
      {
        let state_for_watcher = state.clone();
        thread::spawn(move || {
          loop {
            // Check whether the child has exited
            if let Ok(mut guard) = state_for_watcher.child.lock() {
              if let Some(ref mut child_ref) = *guard {
                match child_ref.try_wait() {
                  Ok(Some(status)) => {
                    println!("[sidecar] dendrite exited with status: {:?}", status.code());
                    // clear the shared child
                    *guard = None;
                    break;
                  }
                  Ok(None) => {
                    // still running
                  }
                  Err(e) => {
                    eprintln!("[sidecar] error while polling dendrite: {}", e);
                    // on error, clear and exit watcher
                    *guard = None;
                    break;
                  }
                }
              } else {
                // no child in state
                break;
              }
            }
            std::thread::sleep(Duration::from_millis(250));
          }
        });
      }

      if let Some(out) = stdout_handle {
        let handle = handle_for_thread.clone();
        thread::spawn(move || {
          let reader = BufReader::new(out);
          for line in reader.lines().flatten() {
            // Print to host stdout and also emit an event to the webview (optional)
            println!("[dendrite stdout] {}", line);
            // If desired, the app can emit real-time events to the frontend:
            let _ = handle.emit_all("dendrite-stdout", line.clone());
          }
        });
      }

      // Read stderr
      if let Some(err) = stderr_handle {
        let handle = handle_for_thread.clone();
        thread::spawn(move || {
          let reader = BufReader::new(err);
          for line in reader.lines().flatten() {
            eprintln!("[dendrite stderr] {}", line);
            let _ = handle.emit_all("dendrite-stderr", line.clone());
          }
        });
      }

      // The watcher above will observe the child and clear the shared state when it exits.
    });
  });
}

// Tauri command: stop the running dendrite sidecar
#[tauri::command]
fn stop_dendrite(state: tauri::State<SidecarState>) -> Result<String, String> {
  // take ownership of the child if present
  let mut child_opt = match state.child.lock() {
    Ok(mut guard) => guard.take(),
    Err(e) => return Err(format!("failed to acquire sidecar lock: {}", e)),
  };

  let mut child = match child_opt {
    Some(c) => c,
    None => return Err("dendrite is not running".into()),
  };

  println!("[sidecar] stop_dendrite requested: attempting to terminate child");

  // Try graceful kill
  if let Err(e) = child.kill() {
    // restore state to ensure we didn't accidentally drop control
    if let Ok(mut guard) = state.child.lock() {
      *guard = Some(child);
    }
    return Err(format!("failed to kill dendrite: {}", e));
  }

  // Wait a short period for process to exit (polling try_wait)
  let mut waited = 0u64;
  while waited < 5_000 {
    match child.try_wait() {
      Ok(Some(status)) => {
        println!("[sidecar] dendrite exited after stop request: {:?}", status.code());
        return Ok("stopped".into());
      }
      Ok(None) => {
        std::thread::sleep(Duration::from_millis(200));
        waited += 200;
      }
      Err(e) => {
        eprintln!("[sidecar] error waiting for dendrite: {}", e);
        break;
      }
    }
  }

  // If we get here the child didn't exit fast enough; try to force kill (best effort)
  if let Err(e) = child.kill() {
    eprintln!("[sidecar] force kill failed: {}", e);
  }

  // Finally ensure we cleaned up
  match child.try_wait() {
    Ok(Some(_)) | Ok(None) | Err(_) => {
      // child may be dead or still reported; in either case we treat as stopped
      Ok("stopped".into())
    }
  }
}

// Tauri command: start dendrite (returns early if already running)
#[tauri::command]
fn start_dendrite(app_handle: tauri::AppHandle, state: tauri::State<SidecarState>) -> Result<String, String> {
  // If already running, return error
  if let Ok(guard) = state.child.lock() {
    if guard.is_some() {
      return Err("dendrite is already running".into());
    }
  }

  // Spawn the sidecar like setup does
  start_dendrite_sidecar(app_handle, &state);
  Ok("starting".into())
}

// Tauri command: query whether dendrite is currently running
#[tauri::command]
fn status_dendrite(state: tauri::State<SidecarState>) -> Result<String, String> {
  match state.child.lock() {
    Ok(guard) => {
      if guard.is_some() {
        Ok("running".into())
      } else {
        Ok("stopped".into())
      }
    }
    Err(e) => Err(format!("failed to query sidecar state: {}", e)),
  }
}

fn main() {
  tauri::Builder::default()
    // register the shared state to manage the sidecar child
    .manage(SidecarState {
      child: Mutex::new(None),
    })
    .invoke_handler(tauri::generate_handler![start_dendrite, stop_dendrite, status_dendrite])
    .setup(|app| {
      // Start dendrite sidecar when the Tauri app starts
      let state = app.state::<SidecarState>();
      start_dendrite_sidecar(app.handle(), state);

      Ok(())
    })
    // Attempt to gracefully stop the sidecar when windows request close
    .on_window_event(|event| {
      use tauri::WindowEvent;

      // Access the app handle and sidecar state
      let app = event.window().app_handle();
      let state = app.state::<SidecarState>();

      if let WindowEvent::CloseRequested { api, .. } = event.event() {
        // Prevent default close for a moment while we attempt graceful shutdown
        api.prevent_close();

        // Try to stop the sidecar child before allowing exit
        if let Ok(mut guard) = state.child.lock() {
          if let Some(mut child) = guard.take() {
            println!("[sidecar] shutting down dendrite (CloseRequested)");

            // Try a graceful termination sequence: kill the child and wait a short while
            if let Err(e) = child.kill() {
              eprintln!("[sidecar] failed to kill dendrite: {}", e);
            } else {
              // wait up to a few seconds for the child to exit
              match child.wait() {
                Ok(status) => println!("[sidecar] dendrite terminated, status={:?}", status.code()),
                Err(e) => eprintln!("[sidecar] error waiting for dendrite after kill: {}", e),
              }
            }
          }
        }

        // give the system a moment to settle, then allow the close to proceed
        std::thread::sleep(Duration::from_millis(250));
        // Now allow the window to close
        event.window().close().ok();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
