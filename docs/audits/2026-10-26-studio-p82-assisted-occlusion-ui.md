# T-Line Studio P8.2 — Assisted Short-Merge Review and Approval

Date: 2026-10-26
Status: Developer preview, intended for explicit operator review only.

When normal Video-to-Code reports a frame-numbered transient occlusion, choose **Inspect before / flagged / after**. If the evidence has two to four visible components before and after and exactly one fewer at the flagged frame, T-Line shows **Assign object identities before → after**.

All pairs start **unselected**. Choose one distinct after-object for each before-object. The Preview button is disabled for missing or duplicate assignments. **Preview recovery candidate** requests a bounded server-side dry run and shows the original/source comparison PNG, merged QA frame count and flagged-frame foreground IoU. The candidate preview creates no project.

Changing an assignment, source clip, mode, workspace or frame invalidates the previous candidate and confirmation. The user must explicitly select **Confirm inferred recovery**, then click **Approve and create editable Studio project**. The backend validates the selected candidate digest again and saves only if the strict tests still pass. An accepted result becomes a normal editable Studio project with a conspicuous **inferred motion** project name and private audit manifest. Unapproved, mismatched and low-quality candidates cannot create an editable project.

This UI does not reconstruct hidden original pixels or guarantee the exact motion of occluded objects. Its approximation must be reviewed before distributing content. Desktop WebView2 installation and real footage manual acceptance remain separate work.
