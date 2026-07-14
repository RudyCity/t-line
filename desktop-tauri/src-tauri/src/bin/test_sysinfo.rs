use sysinfo::{Pid, System};
use std::process;

fn is_descendant_of(sys: &System, child_pid: Pid, parent_pid: Pid) -> bool {
    let mut current = child_pid;
    while let Some(proc) = sys.process(current) {
        if let Some(p) = proc.parent() {
            if p == parent_pid {
                return true;
            }
            current = p;
        } else {
            break;
        }
    }
    false
}

fn main() {
    let mut sys = System::new();
    sys.refresh_processes();

    let current_pid = Pid::from(process::id() as usize);
    println!("Current PID: {}", current_pid);

    let mut total_memory = 0u64;
    let mut main_memory = 0u64;

    println!("Process List:");
    for (pid, process) in sys.processes() {
        let is_current = *pid == current_pid;
        let is_desc = is_descendant_of(&sys, *pid, current_pid);
        
        if is_current || is_desc {
            let mem = process.memory();
            let virt = process.virtual_memory();
            println!(
                "PID: {}, Name: {}, Memory: {} bytes ({:.2} MB), Virtual: {} bytes ({:.2} MB), Parent: {:?}",
                pid,
                process.name(),
                mem,
                mem as f64 / 1024.0 / 1024.0,
                virt,
                virt as f64 / 1024.0 / 1024.0,
                process.parent()
            );
            
            if is_current {
                main_memory = mem;
            }
            total_memory += mem;
        }
    }

    println!("Main Process Memory: {:.2} MB", main_memory as f64 / 1024.0 / 1024.0);
    println!("Total Aggregated Memory: {:.2} MB", total_memory as f64 / 1024.0 / 1024.0);
}
