#!/usr/bin/env bash
# Rebuild all fictional demo state from scratch: DB rows via the API, then signed-in browser sessions.
set -euo pipefail
cd "$(dirname "$0")"
node prep_data.cjs 2>&1 | grep -v NOTICE
node ui_setup.cjs demo.library@example.com r2 "الصف العاشر" "الرياضيات" "الكيمياء"
node ui_setup.cjs demo.classes@example.com r3 "الصف العاشر" "الرياضيات" "الكيمياء"
node ui_setup.cjs demo.messages@example.com r4 "الصف الثامن" "العلوم"
