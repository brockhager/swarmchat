// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::api::process::{Command, CommandEvent};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Start the Dendrite sidecar process
            let (mut rx, _child) = Command::new_sidecar("dendrite")
                .expect("failed to create `dendrite` binary command")
                .spawn()
                .expect("Failed to spawn dendrite sidecar");

            // Handle the sidecar output in a separate task
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[Dendrite] {}", line);
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[Dendrite Error] {}", line);
                        }
                        CommandEvent::Error(error) => {
                            eprintln!("[Dendrite Process Error] {}", error);
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[Dendrite] Process terminated with code: {:?}", payload.code);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
