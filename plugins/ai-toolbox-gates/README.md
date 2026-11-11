# ai-toolbox-gates

The gates MCP server, copied from mcp-servers/gates by scripts/build-plugin.py and started with uv through .mcp.json (uv run --frozen --no-dev gates). It needs uv on PATH and these variables in the environment: GATES_MAP and GATES_RUN_ROOT (both absolute paths), GATES_MAP_SHA256 and GATES_ALLOWED_EXECUTABLES. Optional ones (GATES_SANDBOX and the rest) are not set here; set them in the environment when wanted. Generated; edit mcp-servers/gates and rebuild.
