//! Pure tray decisions shared by menu construction and menu callbacks.
//! Keeping these independent of the OS tray makes overlapping workspaces,
//! bulk-close behavior and large session lists reproducible under unit tests.
use serde_json::Value;
use std::collections::HashSet;

pub const MAX_VISIBLE_SESSIONS: usize = 36;
pub const MAX_VISIBLE_TABS_PER_CATEGORY: usize = 14;

pub fn is_path_under_workspace(path: &str, workspace: &str) -> bool {
    let path = path.replace('\\', "/").trim_end_matches('/').to_lowercase();
    let root = workspace.replace('\\', "/").trim_end_matches('/').to_lowercase();
    !root.is_empty() && (path == root || path.starts_with(&(root + "/")))
}

/// Worktrees and nested workspaces belong to their longest matching root.
/// The same PTY cannot appear under both a parent project and nested project.
pub fn best_workspace_index(cwd: &str, workspaces: &[Value]) -> Option<usize> {
    workspaces.iter().enumerate()
        .filter_map(|(index, ws)| {
            let root = ws.get("path")?.as_str()?;
            is_path_under_workspace(cwd, root)
                .then_some((index, root.replace('\\', "/").trim_end_matches('/').len()))
        })
        .max_by_key(|(_, len)| *len)
        .map(|(index, _)| index)
}

pub fn displayed_sessions(sessions: &[Value]) -> Vec<&Value> {
    let mut seen = HashSet::new();
    sessions.iter()
        .filter(|value| {
            let Some(pid) = value.get("pid").and_then(Value::as_u64) else { return false };
            pid != 0 && seen.insert(pid)
        })
        .take(MAX_VISIBLE_SESSIONS)
        .collect()
}

/// Menu IDs must remain bounded: never encode dozens of arbitrary tab IDs
/// into a native menu item's identifier.
pub fn bulk_tab_ids(sync_state: &Value, category: &str) -> Vec<String> {
    sync_state.get("tabs").and_then(Value::as_array)
        .into_iter().flatten()
        .filter(|tab| match category {
            "all" => true,
            "agents" => tab.get("type").and_then(Value::as_str) == Some("agent"),
            "browsers" => tab.get("type").and_then(Value::as_str) == Some("browser"),
            "terminals" => matches!(tab.get("type").and_then(Value::as_str), Some("terminal" | "grid")),
            "other" => !matches!(tab.get("type").and_then(Value::as_str), Some("agent" | "browser" | "terminal" | "grid")),
            _ => false,
        })
        .filter_map(|tab| tab.get("id").and_then(Value::as_str))
        .filter(|id| !id.is_empty())
        .map(str::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn nested_worktree_belongs_to_longest_workspace_only() {
        let workspaces = vec![
            json!({"path":"D:\\Projects"}),
            json!({"path":"D:\\Projects\\my-app"}),
            json!({"path":"D:\\Projects\\my-app-extra"})
        ];
        assert_eq!(best_workspace_index("D:/Projects/my-app/src", &workspaces), Some(1));
        assert_eq!(best_workspace_index("D:/Projects/my-app-extra", &workspaces), Some(2));
        assert_eq!(best_workspace_index("D:/Projects/other", &workspaces), Some(0));
        assert_eq!(best_workspace_index("D:/Proj", &workspaces), None);
        assert_eq!(best_workspace_index("", &workspaces), None);
    }

    #[test]
    fn filters_invalid_and_duplicate_pids() {
        let sessions = vec![json!({"pid":0}), json!({"pid":2}), json!({"pid":2}), json!({"pid":3}), json!({})];
        let displayed = displayed_sessions(&sessions);
        assert_eq!(displayed.len(), 2);
        assert_eq!(displayed[0]["pid"], 2);
    }

    #[test]
    fn bulk_tab_ids_are_scoped_to_current_snapshot() {
        let state = json!({"tabs":[
            {"id":"a","type":"agent"}, {"id":"b","type":"browser"},
            {"id":"c","type":"terminal"}, {"id":"d","type":"grid"},
            {"id":"e","type":"file"}]});
        assert_eq!(bulk_tab_ids(&state,"agents"), vec!["a"]);
        assert_eq!(bulk_tab_ids(&state,"terminals"), vec!["c","d"]);
        assert_eq!(bulk_tab_ids(&state,"all").len(), 5);
        assert!(bulk_tab_ids(&state,"unexpected").is_empty());
    }
}
