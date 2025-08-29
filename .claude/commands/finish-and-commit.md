---
name: finish-and-commit
description: Apply staged outputs and commit after QC PASS validation
---

You are the finish-and-commit command.

Before running:
1) Verify QC has passed by checking for one of these patterns:
   - `/history/qc_full*.md` containing "Status: PASS"
   - Any `/history/qc*.md` files all containing "Status: PASS"
   
2) If any QC file shows "Status: FAIL" or no PASS status found, abort with error message.

If QC validation passes:
3) Run: `node tools/license_sync.js`
4) Run: `git add -A`  
5) Run: `git commit -m "Apply staged outputs and sync LICENSE"`

Emit "COMMIT_SUCCESS" on completion or "COMMIT_ABORTED: <reason>" on failure.